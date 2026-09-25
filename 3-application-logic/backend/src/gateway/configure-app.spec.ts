import { TEST_BASE_ENV } from '../../test/fixtures/test-keys';
import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { loadConfig } from '../config/app-config';
import { API_PREFIX, configureApp } from './configure-app';

function fakeApp() {
  return {
    setGlobalPrefix: jest.fn(),
    enableVersioning: jest.fn(),
    use: jest.fn(),
    enableCors: jest.fn(),
    useBodyParser: jest.fn(),
    set: jest.fn(),
    enableShutdownHooks: jest.fn(),
  };
}

const env = TEST_BASE_ENV;

describe('configureApp', () => {
  it('serves every route under /api with URI versioning defaulting to v1', () => {
    const app = fakeApp();
    configureApp(app as unknown as NestExpressApplication, loadConfig(env));

    expect(API_PREFIX).toBe('api');
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
  });

  it('disables cross-origin access unless origins are allow-listed', () => {
    const closed = fakeApp();
    configureApp(closed as unknown as NestExpressApplication, loadConfig(env));
    expect(closed.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({ origin: false, credentials: false }),
    );

    const open = fakeApp();
    configureApp(
      open as unknown as NestExpressApplication,
      loadConfig({ ...env, CORS_ORIGINS: 'https://app.example.org' }),
    );
    expect(open.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: ['https://app.example.org'],
        // The admin web app sends its HttpOnly refresh cookie (ADR-005).
        credentials: true,
        allowedHeaders: expect.arrayContaining(['X-Client']) as unknown,
        exposedHeaders: expect.arrayContaining([
          'Retry-After',
          'X-RateLimit-Remaining',
        ]) as unknown,
      }),
    );
  });

  it('applies the configured body size limit and trusts the proxy only when asked', () => {
    const app = fakeApp();
    configureApp(
      app as unknown as NestExpressApplication,
      loadConfig({ ...env, JSON_BODY_LIMIT: '256kb' }),
    );
    expect(app.useBodyParser).toHaveBeenCalledWith('json', { limit: '256kb' });
    expect(app.set).not.toHaveBeenCalled();

    const proxied = fakeApp();
    configureApp(
      proxied as unknown as NestExpressApplication,
      loadConfig({ ...env, TRUST_PROXY: 'true' }),
    );
    expect(proxied.set).toHaveBeenCalledWith('trust proxy', 1);
  });

  it('uses a strict content security policy when API docs are disabled', () => {
    const app = fakeApp();
    configureApp(
      app as unknown as NestExpressApplication,
      loadConfig({ ...env, API_DOCS_ENABLED: 'false' }),
    );
    // helmet middleware is registered after the request-id middleware
    expect(app.use).toHaveBeenCalledTimes(3);
  });
});
