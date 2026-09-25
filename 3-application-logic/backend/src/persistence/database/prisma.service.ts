import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

/** Shared PostgreSQL client. Connects lazily on first query. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ datasourceUrl: config.databaseUrl });
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
