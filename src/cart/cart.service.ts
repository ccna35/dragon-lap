import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CartStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

type OwnerContext =
    | { ownerType: 'CUSTOMER'; userId: string }
    | { ownerType: 'GUEST'; guestSessionId: string };

@Injectable()
export class CartService {
    constructor(private readonly prisma: PrismaService) { }

    getCart(userId: string) {
        return this.getCartByOwner(this.resolveOwnerContext({ userId }));
    }

    getGuestCart(guestSessionId: string) {
        return this.getCartByOwner(this.resolveOwnerContext({ guestSessionId }));
    }

    async addItem(userId: string, dto: AddCartItemDto) {
        return this.addItemByOwner(this.resolveOwnerContext({ userId }), dto);
    }

    async addGuestItem(guestSessionId: string, dto: AddCartItemDto) {
        return this.addItemByOwner(this.resolveOwnerContext({ guestSessionId }), dto);
    }

    async updateItem(userId: string, cartItemId: string, dto: UpdateCartItemDto) {
        return this.updateItemByOwner(this.resolveOwnerContext({ userId }), cartItemId, dto);
    }

    async updateGuestItem(guestSessionId: string, cartItemId: string, dto: UpdateCartItemDto) {
        return this.updateItemByOwner(
            this.resolveOwnerContext({ guestSessionId }),
            cartItemId,
            dto,
        );
    }

    async removeItem(userId: string, cartItemId: string) {
        return this.removeItemByOwner(this.resolveOwnerContext({ userId }), cartItemId);
    }

    async removeGuestItem(guestSessionId: string, cartItemId: string) {
        return this.removeItemByOwner(this.resolveOwnerContext({ guestSessionId }), cartItemId);
    }

    private async getCartByOwner(owner: OwnerContext) {
        const cart = await this.getActiveCart(owner);
        if (!cart) {
            return [];
        }

        return this.prisma.cartItem.findMany({
            where: { cartId: cart.id },
            include: {
                laptop: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    private async addItemByOwner(owner: OwnerContext, dto: AddCartItemDto) {
        const laptop = await this.prisma.laptop.findUnique({
            where: { id: dto.laptopId },
        });

        if (!laptop || !laptop.isPublished) {
            throw new NotFoundException('Laptop not found');
        }

        if (laptop.stock < 1) {
            throw new BadRequestException('Laptop is out of stock');
        }

        if (dto.quantity > laptop.stock) {
            throw new BadRequestException('Requested quantity exceeds stock');
        }

        const cart = await this.getOrCreateActiveCart(owner);

        const existing = await this.prisma.cartItem.findUnique({
            where: {
                cartId_laptopId: {
                    cartId: cart.id,
                    laptopId: dto.laptopId,
                },
            },
        });

        if (existing) {
            const nextQuantity = existing.quantity + dto.quantity;
            if (nextQuantity > laptop.stock) {
                throw new BadRequestException('Requested quantity exceeds stock');
            }

            return this.prisma.cartItem.update({
                where: { id: existing.id },
                data: { quantity: nextQuantity },
                include: { laptop: true },
            });
        }

        return this.prisma.cartItem.create({
            data: {
                cartId: cart.id,
                laptopId: dto.laptopId,
                quantity: dto.quantity,
            },
            include: { laptop: true },
        });
    }

    private async updateItemByOwner(
        owner: OwnerContext,
        cartItemId: string,
        dto: UpdateCartItemDto,
    ) {
        const cartItem = await this.prisma.cartItem.findUnique({
            where: { id: cartItemId },
            include: {
                laptop: true,
                cart: {
                    select: {
                        userId: true,
                        guestSessionId: true,
                    },
                },
            },
        });

        if (!cartItem) {
            throw new NotFoundException('Cart item not found');
        }

        if (!this.isOwnerContextMatch(cartItem.cart, owner)) {
            throw new ForbiddenException('Not your cart item');
        }

        if (dto.quantity > cartItem.laptop.stock) {
            throw new BadRequestException('Requested quantity exceeds stock');
        }

        return this.prisma.cartItem.update({
            where: { id: cartItemId },
            data: { quantity: dto.quantity },
            include: { laptop: true },
        });
    }

    private async removeItemByOwner(owner: OwnerContext, cartItemId: string) {
        const cartItem = await this.prisma.cartItem.findUnique({
            where: { id: cartItemId },
            include: {
                cart: {
                    select: {
                        userId: true,
                        guestSessionId: true,
                    },
                },
            },
        });

        if (!cartItem) {
            throw new NotFoundException('Cart item not found');
        }

        if (!this.isOwnerContextMatch(cartItem.cart, owner)) {
            throw new ForbiddenException('Not your cart item');
        }

        await this.prisma.cartItem.delete({ where: { id: cartItemId } });

        return {
            message: 'Item removed from cart',
        };
    }

    private resolveOwnerContext(input: {
        userId?: string | null;
        guestSessionId?: string | null;
    }): OwnerContext {
        if (input.userId && input.guestSessionId) {
            throw new BadRequestException('Invalid ownership context');
        }

        if (input.userId) {
            return { ownerType: 'CUSTOMER', userId: input.userId };
        }

        if (input.guestSessionId) {
            return { ownerType: 'GUEST', guestSessionId: input.guestSessionId };
        }

        throw new BadRequestException('Missing ownership context');
    }

    private getOwnerCartWhere(owner: OwnerContext): Prisma.CartWhereInput {
        if (owner.ownerType === 'CUSTOMER') {
            return { userId: owner.userId };
        }

        return { guestSessionId: owner.guestSessionId };
    }

    private async getActiveCart(
        owner: OwnerContext,
        tx: Prisma.TransactionClient | PrismaService = this.prisma,
    ) {
        return tx.cart.findFirst({
            where: {
                ...this.getOwnerCartWhere(owner),
                status: CartStatus.ACTIVE,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    private async getOrCreateActiveCart(
        owner: OwnerContext,
        tx: Prisma.TransactionClient | PrismaService = this.prisma,
    ) {
        const existing = await this.getActiveCart(owner, tx);
        if (existing) {
            return existing;
        }

        return tx.cart.create({
            data: {
                userId: owner.ownerType === 'CUSTOMER' ? owner.userId : null,
                guestSessionId:
                    owner.ownerType === 'GUEST' ? owner.guestSessionId : null,
                status: CartStatus.ACTIVE,
            },
        });
    }

    private isOwnerContextMatch(
        cart: { userId: string | null; guestSessionId: string | null },
        owner: OwnerContext,
    ) {
        if (owner.ownerType === 'CUSTOMER') {
            return cart.userId === owner.userId;
        }

        return cart.guestSessionId === owner.guestSessionId;
    }
}
