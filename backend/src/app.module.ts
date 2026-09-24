import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CryptoModule } from './common/crypto/crypto.module';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import {
  AppThrottlerGuard,
  AUTH_THROTTLER,
} from './common/http/app-throttler.guard';
import { createValidationPipe } from './common/http/validation';
import { loggerOptions } from './common/logging/logger-options';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { JwtAuthGuard } from './modules/access/jwt-auth.guard';
import { PermissionsGuard } from './modules/access/permissions.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { HealthModule } from './modules/health/health.module';
import { PatientsModule } from './modules/patients/patients.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => loggerOptions(config),
    }),
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [
        {
          name: 'default',
          ttl: config.rateLimit.ttlMs,
          limit: config.rateLimit.limit,
        },
        {
          name: AUTH_THROTTLER,
          ttl: config.rateLimit.ttlMs,
          limit: config.auth.rateLimitMax,
        },
      ],
    }),
    DatabaseModule,
    CryptoModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    ClinicalModule,
    HealthModule,
  ],
  providers: [
    // Gateway concerns applied to every route, in this order, in tests exactly as in production:
    // rate limit -> authenticate (deny by default) -> authorise (RBAC).
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {}
