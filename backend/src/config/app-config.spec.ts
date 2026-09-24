import { TEST_JWT_ENV } from '../../test/fixtures/test-keys';
import { loadConfig } from './app-config';

const base = {
  DATABASE_URL: 'postgresql://pca:super-secret-pw@localhost:5432/pca_mhealth',
  MONGO_URL: 'mongodb://pca:super-secret-pw@localhost:27018/pca_mhealth',
  ...TEST_JWT_ENV,
};

describe('loadConfig', () => {
  it('applies safe development defaults', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      corsOrigins: [],
      jsonBodyLimit: '1mb',
      rateLimit: { ttlMs: 60_000, limit: 600, userLimit: 120 },
      apiDocsEnabled: true,
      trustProxy: false,
    });
  });

  it('parses comma-separated CORS origins and numeric settings', () => {
    const config = loadConfig({
      ...base,
      PORT: '8080',
      CORS_ORIGINS: 'https://app.example.org, http://localhost:5173',
      RATE_LIMIT_MAX: '10',
      TRUST_PROXY: 'true',
    });
    expect(config.port).toBe(8080);
    expect(config.corsOrigins).toEqual([
      'https://app.example.org',
      'http://localhost:5173',
    ]);
    expect(config.rateLimit.limit).toBe(10);
    expect(config.trustProxy).toBe(true);
  });

  it('fails fast with every problem listed', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(
      /DATABASE_URL[\s\S]*MONGO_URL[\s\S]*PORT/,
    );
  });

  it('never echoes secret values in error messages', () => {
    try {
      loadConfig({ ...base, DATABASE_URL: 'not a url with password hunter2' });
      fail('expected an error');
    } catch (err) {
      expect((err as Error).message).toContain('DATABASE_URL');
      expect((err as Error).message).not.toContain('hunter2');
    }
  });

  it('rejects wildcard or malformed CORS origins', () => {
    expect(() => loadConfig({ ...base, CORS_ORIGINS: '*' })).toThrow(
      /CORS_ORIGINS/,
    );
    expect(() => loadConfig({ ...base, CORS_ORIGINS: 'example.org' })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('hardens production: explicit CORS allow-list required and API docs off by default', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(
      /CORS_ORIGINS/,
    );
    const config = loadConfig({
      ...base,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.example.org',
    });
    expect(config.apiDocsEnabled).toBe(false);
  });

  it('lets API docs be switched explicitly', () => {
    expect(
      loadConfig({ ...base, API_DOCS_ENABLED: 'false' }).apiDocsEnabled,
    ).toBe(false);
  });
});
