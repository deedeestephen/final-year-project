import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password';
import { DevOutboxResetDelivery, ResetDelivery } from './reset-delivery';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordHasher,
    { provide: ResetDelivery, useFactory: () => new DevOutboxResetDelivery() },
  ],
  exports: [AuthService, PasswordHasher, TokenService],
})
export class AuthModule {}
