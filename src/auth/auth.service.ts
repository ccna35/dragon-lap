import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UsersService } from 'src/users/users.service';
import { CartStatus, Prisma, RefreshToken, User, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

export interface JwtPayload {
    userId: string;
    role: UserRole;
}

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

@Injectable()
export class AuthService {
    private readonly accessTtlMs = 5 * 60 * 1000;
    private readonly refreshTtlMs = 7 * 24 * 60 * 60 * 1000;
    private readonly refreshTokenSaltRounds = 10;

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) { }

    async register(dto: RegisterDto) {
        const user = await this.usersService.create({
            email: dto.email,
            name: dto.fullName,
            password: dto.password,
            role: UserRole.CUSTOMER,
        });

        const tokens = await this.issueTokens(user);
        return { user: this.toSafeUser(user), tokens };
    }

    async login(
        user: User,
        guestSessionId?: string,
    ): Promise<{
        user: Omit<User, 'passwordHash'>;
        tokens: AuthTokens;
        mergedGuestCart: boolean;
    }> {
        const mergedGuestCart = guestSessionId
            ? await this.mergeGuestCartOnLogin(user.id, guestSessionId)
            : false;
        const tokens = await this.issueTokens(user);
        return { user: this.toSafeUser(user), tokens, mergedGuestCart };
    }

    async validateUser(email: string, password: string): Promise<User | null> {
        const user = await this.usersService.findByEmail(email);
        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return user;
    }

    async logout(refreshToken?: string): Promise<void> {
        if (!refreshToken) return;

        try {
            const payload = await this.verifyRefreshToken(refreshToken);
            const activeToken = await this.findActiveRefreshToken(payload.userId, refreshToken);
            if (activeToken) {
                await this.prisma.refreshToken.update({
                    where: { id: activeToken.id },
                    data: { revokedAt: new Date() },
                });
            }
        } catch {
            // Best-effort logout: ignore invalid/expired tokens.
        }
    }

    setAuthCookies(response: Response, tokens: AuthTokens): void {
        const cookieOptions = this.getCookieOptions();

        response.cookie('access_token', tokens.accessToken, {
            ...cookieOptions,
            maxAge: this.accessTtlMs,
        });
        response.cookie('refresh_token', tokens.refreshToken, {
            ...cookieOptions,
            maxAge: this.refreshTtlMs,
        });
    }

    clearAuthCookies(response: Response): void {
        const cookieOptions = this.getCookieOptions();
        response.clearCookie('access_token', cookieOptions);
        response.clearCookie('refresh_token', cookieOptions);
    }

    private getCookieOptions() {
        return {
            httpOnly: true,
            sameSite: 'none' as const,
            secure: this.config.get<string>('COOKIE_SECURE') !== 'false',
            path: '/',
        };
    }

    private async issueTokens(user: User): Promise<AuthTokens> {
        const payload: JwtPayload = { userId: user.id, role: user.role };

        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.getAccessSecret(),
            expiresIn: '5m',
        });

        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: this.getRefreshSecret(),
            expiresIn: '7d',
        });

        await this.storeRefreshToken(user.id, refreshToken);

        return { accessToken, refreshToken };
    }

    private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
        const tokenHash = await bcrypt.hash(refreshToken, this.refreshTokenSaltRounds);
        const expiresAt = new Date(Date.now() + this.refreshTtlMs);

        await this.prisma.refreshToken.create({
            data: {
                userId,
                tokenHash,
                expiresAt,
            },
        });
    }

    private async findActiveRefreshToken(
        userId: string,
        refreshToken: string,
    ): Promise<RefreshToken | null> {
        const now = new Date();
        const activeTokens = await this.prisma.refreshToken.findMany({
            where: {
                userId,
                revokedAt: null,
                expiresAt: {
                    gt: now,
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        for (const token of activeTokens) {
            const matches = await bcrypt.compare(refreshToken, token.tokenHash);
            if (matches) return token;
        }

        return null;
    }

    private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
        try {
            return await this.jwtService.verifyAsync(refreshToken, {
                secret: this.getRefreshSecret(),
            });
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    private getAccessSecret(): string {
        return this.config.get<string>('JWT_SECRET') ?? 'access-secret';
    }

    private getRefreshSecret(): string {
        return this.config.get<string>('JWT_REFRESH_SECRET') ?? 'refresh-secret';
    }

    private toSafeUser(user: User): Omit<User, 'passwordHash'> {
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    }

    async refresh(
        refreshToken: string,
    ): Promise<{ user: Omit<User, 'passwordHash'>; tokens: AuthTokens }> {
        const payload = await this.verifyRefreshToken(refreshToken);
        const activeToken = await this.findActiveRefreshToken(payload.userId, refreshToken);

        if (!activeToken) {
            throw new UnauthorizedException('Refresh token not recognized');
        }

        await this.prisma.refreshToken.update({
            where: { id: activeToken.id },
            data: { revokedAt: new Date() },
        });

        const user = await this.usersService.findById(payload.userId);

        // In case the user was deleted or deactivated after the token was issued
        if (!user || !user.isActive) {
            throw new UnauthorizedException('User not found or inactive');
        }

        const tokens = await this.issueTokens(user);

        return { user: this.toSafeUser(user), tokens };
    }

    private async mergeGuestCartOnLogin(
        userId: string,
        guestSessionId: string,
    ): Promise<boolean> {
        if (!guestSessionId) {
            return false;
        }

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const guestCart = await tx.cart.findFirst({
                where: {
                    guestSessionId,
                    status: CartStatus.ACTIVE,
                },
                include: {
                    items: {
                        include: {
                            laptop: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            if (!guestCart) {
                return false;
            }

            const customerCart = await tx.cart.findFirst({
                where: {
                    userId,
                    status: CartStatus.ACTIVE,
                },
                include: {
                    items: {
                        include: {
                            laptop: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            if (!customerCart) {
                await tx.cart.update({
                    where: { id: guestCart.id },
                    data: {
                        userId,
                        guestSessionId: null,
                    },
                });
                return true;
            }

            const customerItemsByLaptopId = new Map(
                customerCart.items.map((item) => [item.laptopId, item]),
            );

            for (const guestItem of guestCart.items) {
                const matchingCustomerItem = customerItemsByLaptopId.get(guestItem.laptopId);
                if (!matchingCustomerItem) {
                    if (guestItem.quantity > guestItem.laptop.stock) {
                        throw new BadRequestException(
                            `Not enough stock for '${guestItem.laptop.title}'`,
                        );
                    }

                    const created = await tx.cartItem.create({
                        data: {
                            cartId: customerCart.id,
                            laptopId: guestItem.laptopId,
                            quantity: guestItem.quantity,
                        },
                    });

                    customerItemsByLaptopId.set(created.laptopId, {
                        ...guestItem,
                        id: created.id,
                        cartId: created.cartId,
                        createdAt: created.createdAt,
                        updatedAt: created.updatedAt,
                    });
                    continue;
                }

                const mergedQuantity = matchingCustomerItem.quantity + guestItem.quantity;
                if (mergedQuantity > guestItem.laptop.stock) {
                    throw new BadRequestException(
                        `Not enough stock for '${guestItem.laptop.title}'`,
                    );
                }

                await tx.cartItem.update({
                    where: { id: matchingCustomerItem.id },
                    data: {
                        quantity: mergedQuantity,
                    },
                });
            }

            await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });

            await tx.cart.update({
                where: { id: guestCart.id },
                data: {
                    status: CartStatus.MERGED,
                    guestSessionId: null,
                },
            });

            return true;
        });
    }
}
