import { Module } from '@nestjs/common';
import { ClinicalModule } from '../clinical/clinical.module';
import { PatientsModule } from '../patients/patients.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [PatientsModule, ClinicalModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
