import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { loadConfig, type AppConfig } from '../../src/config/app-config';
import { configureApp } from '../../src/configure-app';
import { MongoService } from '../../src/infrastructure/database/mongo.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...loadConfig({ ...process.env, NODE_ENV: 'test' }), ...overrides };
}

describe('PrismaService and MongoService against real databases', () => {
  it('ping PostgreSQL and MongoDB', async () => {
    const prisma = new PrismaService(config());
    const mongo = new MongoService(config());
    try {
      await expect(prisma.ping()).resolves.toBeUndefined();
      await expect(mongo.ping()).resolves.toBeUndefined();
      // A second call reuses the open connection.
      await expect(mongo.db()).resolves.toBeDefined();
    } finally {
      await prisma.onModuleDestroy();
      await mongo.onModuleDestroy();
    }
  });

  it('lets a failed MongoDB connection be retried instead of caching the failure', async () => {
    const mongo = new MongoService(
      config({ mongoUrl: 'mongodb://127.0.0.1:1/unreachable' }),
    );
    try {
      await expect(mongo.db()).rejects.toThrow();
      await expect(mongo.db()).rejects.toThrow();
    } finally {
      await mongo.onModuleDestroy();
    }
  }, 30_000);
});

describe('readiness endpoint with the real application and databases', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    configureApp(app, config());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports PostgreSQL and MongoDB as up', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200, { status: 'ok', checks: { postgres: 'up', mongodb: 'up' } });
  });
});
