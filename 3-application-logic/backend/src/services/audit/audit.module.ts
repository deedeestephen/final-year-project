import { Global, Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditLogController, ActivityController],
  providers: [AuditService, AuditLogService, ActivityService],
  exports: [AuditService],
})
export class AuditModule {}
