import { Body, Controller, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { LocalAuthenticatedRequest } from './authenticatedRequest.type';
import { LocalAuthGuard } from './guards/local-auth.guard';
import {
    clearGuestSessionIdCookie,
    GUEST_SESSION_COOKIE,
} from 'src/common/utils/guest-session.util';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly config: ConfigService,
    ) { }

    @Public()
    @Post('register')
    async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
        const { user, tokens } = await this.authService.register(dto);
        this.authService.setAuthCookies(response, tokens);
        return { user };
    }

    @Public()
    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(
        @Req() request: LocalAuthenticatedRequest,
        @Res({ passthrough: true }) response: Response,
        @Body() _dto: LoginDto,
    ) {
        const guestSessionId = request.cookies?.[GUEST_SESSION_COOKIE];
        const { user, tokens, mergedGuestCart } = await this.authService.login(
            request.user,
            guestSessionId,
        );
        this.authService.setAuthCookies(response, tokens);

        if (mergedGuestCart) {
            clearGuestSessionIdCookie(response, this.config);
        }

        return { user };
    }

    @Post('logout')
    async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
        const refreshToken = request.cookies?.refresh_token;
        await this.authService.logout(refreshToken);
        this.authService.clearAuthCookies(response);
        return { ok: true };
    }

    @Public()
    @Post('refresh')
    async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
        const refreshToken = request.cookies?.refresh_token;
        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token missing');
        }
        const { user, tokens } = await this.authService.refresh(refreshToken);
        this.authService.setAuthCookies(response, tokens);
        return { user };
    }
}
