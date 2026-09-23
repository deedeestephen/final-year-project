import { INestApplication, VersioningType } from '@nestjs/common';
import { API_PREFIX, configureApp } from './configure-app';

describe('configureApp', () => {
  it('serves every route under /api with URI versioning defaulting to v1', () => {
    const app = {
      setGlobalPrefix: jest.fn(),
      enableVersioning: jest.fn(),
    };

    configureApp(app as unknown as INestApplication);

    expect(API_PREFIX).toBe('api');
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
  });
});
