import { Controller, Get } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  service: 'pca-mhealth-backend';
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return {
      status: 'ok',
      service: 'pca-mhealth-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
