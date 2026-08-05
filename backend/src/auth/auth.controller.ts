import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface RefreshRequest extends Request {
  user: { sub: string };
}

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: UserResponseDto }> {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @UseGuards(ThrottlerGuard, JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: RefreshRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const presentedToken = (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ?? '';
    const { accessToken, refreshToken } = await this.authService.refresh(req.user.sub, presentedToken);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  // Requires a valid access token (JwtAuthGuard), not just the refresh
  // cookie: a cross-origin request cannot set the `Authorization` header the
  // way a browser automatically attaches cookies, so this prevents a
  // cross-site request from forcing another user's logout (threat model,
  // POST /auth/logout, Spoofing/CSRF).
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(req.user.sub);
    this.clearRefreshCookie(res);
    return { message: 'Sesión cerrada' };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  private clearRefreshCookie(res: Response): void {
    // Same httpOnly/sameSite/secure flags used when the cookie was set:
    // Express's `clearCookie` needs matching path/domain options to
    // actually make the browser drop it.
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
  }
}
