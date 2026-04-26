import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

export const GUEST_SESSION_COOKIE = 'guest_session_id';

export function getGuestSessionCookieOptions(config: ConfigService) {
    return {
        httpOnly: true,
        sameSite: 'none' as const,
        secure: config.get<string>('COOKIE_SECURE') !== 'false',
        path: '/',
    };
}

export function ensureGuestSessionId(
    request: Request,
    response: Response,
    config: ConfigService,
): string {
    const current = request.cookies?.[GUEST_SESSION_COOKIE];
    if (current) {
        return current;
    }

    const guestSessionId = randomUUID();
    response.cookie(
        GUEST_SESSION_COOKIE,
        guestSessionId,
        getGuestSessionCookieOptions(config),
    );

    return guestSessionId;
}

export function clearGuestSessionIdCookie(response: Response, config: ConfigService): void {
    response.clearCookie(GUEST_SESSION_COOKIE, getGuestSessionCookieOptions(config));
}
