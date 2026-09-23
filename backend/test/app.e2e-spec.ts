import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { HealthStatus } from './../src/modules/health/health.controller';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health reports the service as up', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    const body = res.body as HealthStatus;
    expect(body).toMatchObject({
      status: 'ok',
      service: 'pca-mhealth-backend',
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('does not serve unversioned routes', () => {
    return request(app.getHttpServer()).get('/health').expect(404);
  });

  it('no longer exposes the scaffold root route', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });
});
