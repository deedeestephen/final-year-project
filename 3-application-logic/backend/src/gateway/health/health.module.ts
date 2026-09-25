import { Module } from '@nestjs/common';
import { AiBrokerService } from '../../services/ai/ai-broker.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [AiBrokerService],
})
export class HealthModule {}
