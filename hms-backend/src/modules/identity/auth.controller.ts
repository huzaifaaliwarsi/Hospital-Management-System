import type { Request, Response } from 'express';
import { env } from '@/config/env';
import { authService } from './auth.service';
import type { LoginBody, ChangePasswordBody } from './auth.schemas';
import { AuthenticationError } from '@/shared/errors/AppError';

const REFRESH_COOKIE_NAME = 'hms_refresh_token';

function refreshCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    domain: env.COOKIE_DOMAIN,
    expires: expiresAt,
    path: '/api/v1/auth',
  };
}

export const authController = {
  async login(req: Request, res: Response) {
    const body = req.body as LoginBody;
    const result = await authService.login(body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
  },

  async refresh(req: Request, res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!rawToken) throw new AuthenticationError('Missing refresh token');

    const result = await authService.refresh(rawToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
    res.json({ data: { accessToken: result.accessToken } });
  },

  async logout(req: Request, res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await authService.logout(rawToken);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.status(204).send();
  },

  async changePassword(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const body = req.body as ChangePasswordBody;
    await authService.changePassword(req.user.sub, body);
    res.status(204).send();
  },

  async me(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    res.json({
      data: {
        id: req.user.sub,
        role: req.user.role,
        staffId: req.user.staffId,
        mustResetPassword: req.user.mustResetPassword,
      },
    });
  },
};
