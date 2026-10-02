import { Module } from '@nestjs/common';
import { AiBrokerService } from '../../services/ai/ai-broker.service';
import { NotificationsModule } from '../../services/notifications/notifications.module';
import { HealthController } from './health.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [HealthController],
  providers: [AiBrokerService],
})
export class HealthModule {}
