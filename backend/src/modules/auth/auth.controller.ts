import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  @ApiOkResponse({ type: LoginResponse })
  login(
    @Body() dto: LoginDto,
    @Ctx() ctx: RequestContext,
  ): Promise<LoginResult> {
    return this.auth.login(dto.email, dto.password, ctx);
  }

  @Post('refresh')
  @Public()
  @AuthRateLimited()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SessionResponse })
  refresh(
    @Body() dto: RefreshDto,
    @Ctx() ctx: RequestContext,
  ): Promise<SessionTokens> {
    return this.auth.refresh(dto.refreshToken, ctx);
  }

  @Post('logout')
  @ApiBearerAuth()
  @AllowWhenPasswordChangeRequired()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Session revoked' })
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    return this.auth.logout(user, ctx);
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
