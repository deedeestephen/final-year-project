import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CryptoModule } from './persistence/crypto/crypto.module';
import { AllExceptionsFilter } from './gateway/http/all-exceptions.filter';
import {
  AppThrottlerGuard,
  AUTH_THROTTLER,
} from './gateway/http/app-throttler.guard';
import {
  RateLimitModule,
  SHARED_THROTTLER_STORAGE,
} from './gateway/http/rate-limit.module';
import { RedisThrottlerStorage } from './gateway/http/redis-throttler.storage';
import { UserRateLimitGuard } from './gateway/http/user-rate-limit.guard';
import { createValidationPipe } from './gateway/http/validation';
import { loggerOptions } from './gateway/logging/logger-options';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './persistence/database/database.module';
import { JwtAuthGuard } from './gateway/access/jwt-auth.guard';
import { PermissionsGuard } from './gateway/access/permissions.guard';
import { AdminModule } from './services/admin/admin.module';
import { AuditModule } from './services/audit/audit.module';
import { AiModule } from './services/ai/ai.module';
import { AuthModule } from './services/auth/auth.module';
import { ImagingModule } from './services/imaging/imaging.module';
import { StorageModule } from './persistence/storage/storage.module';
import { ClinicalModule } from './services/clinical/clinical.module';
import { HealthModule } from './gateway/health/health.module';
import { NotificationsModule } from './services/notifications/notifications.module';
import { PatientsModule } from './services/patients/patients.module';
import { SyncModule } from './services/sync/sync.module';
import { UsersModule } from './services/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => loggerOptions(config),
    }),
    ThrottlerModule.forRootAsync({
      imports: [RateLimitModule],
      inject: [APP_CONFIG, SHARED_THROTTLER_STORAGE],
      useFactory: (
        config: AppConfig,
        shared: RedisThrottlerStorage | null,
      ) => ({
        throttlers: [
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
        // Shared counters across API instances; in-memory for a single instance.
        storage: shared ?? undefined,
      }),
    }),
    DatabaseModule,
    StorageModule,
    CryptoModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    ClinicalModule,
    NotificationsModule,
    AdminModule,
    SyncModule,
    ImagingModule,
    AiModule,
    HealthModule,
  ],
  providers: [
    // Gateway concerns applied to every route, in this order, in tests exactly as in production:
    // address rate limit -> authenticate (deny by default) -> per-account
    // rate limit -> authorise (RBAC).
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserRateLimitGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {}
