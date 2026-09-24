import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AllowWhenPasswordChangeRequired,
  AuthRateLimited,
  Ctx,
  CurrentUser,
  Public,
  type AuthenticatedUser,
  type RequestContext,
} from '../access/access.decorators';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponse,
  MessageResponse,
  RefreshDto,
  RegisterDto,
  RegisteredUserResponse,
  ResetPasswordDto,
  SessionResponse,
} from './auth.dto';
import {
  AuthService,
  type LoginResult,
  type SessionTokens,
} from './auth.service';
import {
  clearRefreshCookie,
  isWebClient,
  readRefreshCookie,
  setRefreshCookie,
  withoutRefreshToken,
} from './web-session';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('register')
  @Public()
  @AuthRateLimited()
  @ApiCreatedResponse({
    type: RegisteredUserResponse,
    description: 'Patient account created',
  })
  register(@Body() dto: RegisterDto, @Ctx() ctx: RequestContext) {
    return this.auth.register(dto, ctx);
  }

  @Post('login')
  @Public()
  @AuthRateLimited()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: LoginResponse,
    description:
      'With header X-Client: web the refresh token is set as an HttpOnly cookie instead of returned',
  })
  async login(
    @Body() dto: LoginDto,
    @Ctx() ctx: RequestContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult | Omit<LoginResult, 'refreshToken'>> {
    const result = await this.auth.login(dto.email, dto.password, ctx);
    if (!isWebClient(req)) return result;
    setRefreshCookie(res, result.refreshToken, this.config);
    return withoutRefreshToken(result);
  }

  @Post('refresh')
  @Public()
  // Not in the strict login bucket: refresh tokens are 256-bit random values
  // (nothing to guess), and the web portal refreshes on every page load, so a
  // clinic sharing one IP would be signed out. The per-IP limit still applies.
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: SessionResponse,
    description:
      'Web clients (X-Client: web) may omit the body; the HttpOnly cookie is used and rotated',
  })
  async refresh(
    @Body() dto: RefreshDto,
    @Ctx() ctx: RequestContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionTokens | Omit<SessionTokens, 'refreshToken'>> {
    const web = isWebClient(req);
    const token =
      dto.refreshToken ?? (web ? readRefreshCookie(req) : undefined);
    if (!token) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Session expired. Please sign in again.',
      });
    }
    const tokens = await this.auth.refresh(token, ctx);
    if (!web) return tokens;
    setRefreshCookie(res, tokens.refreshToken, this.config);
    return withoutRefreshToken(tokens);
  }

  @Post('logout')
  @ApiBearerAuth()
  @AllowWhenPasswordChangeRequired()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Session revoked' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(user, ctx);
    clearRefreshCookie(res, this.config);
  }

  @Post('forgot-password')
  @Public()
  @AuthRateLimited()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: MessageResponse })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ctx() ctx: RequestContext,
  ) {
    await this.auth.forgotPassword(dto.email, ctx);
    return {
      message:
        'If an account exists for this email, password reset instructions have been sent.',
    };
  }

  @Post('reset-password')
  @Public()
  @AuthRateLimited()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Password changed; all sessions signed out',
  })
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    return this.auth.resetPassword(dto.token, dto.newPassword, ctx);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @AllowWhenPasswordChangeRequired()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Password changed; other sessions signed out',
  })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    return this.auth.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
      ctx,
    );
  }
}
