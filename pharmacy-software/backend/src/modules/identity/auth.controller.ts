import type { Request, Response } from 'express';
import { env } from '@/config/env';
import { authService } from './auth.service';
import { authRepository } from './auth.repository';
import type { LoginBody, ChangePasswordBody } from './auth.schemas';
import { AuthenticationError } from '@/shared/errors/AppError';

const REFRESH_COOKIE_NAME = 'pharmacy_refresh_token';

function refreshCookieOptions(expiresAt: Date) {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    domain: env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost' ? env.COOKIE_DOMAIN : undefined,
    expires: expiresAt,
    path: '/api/v1/auth',
  };
}

export const authController = {
  async login(req: Request, res: Response) {
    const body = req.body as LoginBody;
    const result = await authService.login(body);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
  },

  async refresh(req: Request, res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!rawToken) throw new AuthenticationError('Missing refresh token');
    const result = await authService.refresh(rawToken);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
    res.json({ data: { accessToken: result.accessToken } });
  },

  async logout(req: Request, res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await authService.logout(rawToken);
    const isProd = env.NODE_ENV === 'production';
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: '/api/v1/auth',
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      domain: env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost' ? env.COOKIE_DOMAIN : undefined,
    });
    res.status(204).send();
  },

  async changePassword(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const body = req.body as ChangePasswordBody;
    const result = await authService.changePassword(req.user.sub, body);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
    res.json({ data: { accessToken: result.accessToken } });
  },

  async me(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const user = await authRepository.findById(req.user.sub);
    if (!user) throw new AuthenticationError();
    res.json({
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        mustResetPassword: user.mustResetPassword,
      },
    });
  },
};
