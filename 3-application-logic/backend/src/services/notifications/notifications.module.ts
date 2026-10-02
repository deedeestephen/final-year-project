import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PUSH_SENDER, pushSenderFrom } from './push/fcm.client';
import { PushDevicesService } from './push/push-devices.service';
import { PushOutbox } from './push/push-outbox.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushDevicesService,
    PushOutbox,
    {
      // Push is off unless a Firebase service-account key file is set; a
      // file that is set but unusable stops the start-up with the reason.
      provide: PUSH_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => pushSenderFrom(config),
    },
  ],
  exports: [NotificationsService, PUSH_SENDER],
})
export class NotificationsModule {}
