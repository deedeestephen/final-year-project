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

  it('stores uploads locally by default, with size caps', () => {
    const config = loadConfig(base);
    expect(config.storage).toEqual({ driver: 'local', root: 'var/objects' });
    expect(config.uploads).toEqual({
      maxImagingBytes: 512 * 1024 * 1024,
      maxSlideBytes: 2048 * 1024 * 1024,
    });
  });

  it('keeps push notifications off until a Firebase key file is set (ADR-014)', () => {
    expect(loadConfig(base).push).toEqual({
      serviceAccountFile: '',
      apiUrl: 'https://fcm.googleapis.com',
      pollMs: 2000,
      maxAgeMinutes: 10,
    });
    const config = loadConfig({
      ...base,
      FCM_SERVICE_ACCOUNT_FILE: ' D:\\keys\\firebase.json ',
      FCM_API_URL: 'http://127.0.0.1:9099/',
      PUSH_POLL_MS: '500',
      PUSH_MAX_AGE_MIN: '30',
    });
    expect(config.push).toEqual({
      serviceAccountFile: 'D:\\keys\\firebase.json',
      apiUrl: 'http://127.0.0.1:9099',
      pollMs: 500,
      maxAgeMinutes: 30,
    });
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.example.org',
        FCM_API_URL: 'http://fcm.example.org',
      }),
    ).toThrow(/FCM_API_URL: must use https in production/);
  });

  it('requires every S3 setting when STORAGE_DRIVER=s3, without echoing values', () => {
    expect(() =>
      loadConfig({ ...base, STORAGE_DRIVER: 's3', S3_SECRET_KEY: 'hush' }),
    ).toThrow(/S3_BUCKET: is required when STORAGE_DRIVER=s3/);
    try {
      loadConfig({ ...base, STORAGE_DRIVER: 's3', S3_SECRET_KEY: 'hush' });
    } catch (err) {
      expect((err as Error).message).not.toContain('hush');
    }
    const config = loadConfig({
      ...base,
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_BUCKET: 'pca-mhealth',
      S3_ACCESS_KEY: 'key',
      S3_SECRET_KEY: 'secret',
    });
    expect(config.storage).toMatchObject({
      driver: 's3',
      bucket: 'pca-mhealth',
    });
  });
});
