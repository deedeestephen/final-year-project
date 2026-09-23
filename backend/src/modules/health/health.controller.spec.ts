import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok with an ISO timestamp', () => {
    const result = new HealthController().check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('pca-mhealth-backend');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
