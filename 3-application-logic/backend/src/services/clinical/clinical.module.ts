import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';
import {
  ClinicalRecordsController,
  PatientClinicalController,
} from './clinical.controller';
import { ClinicalService } from './clinical.service';

@Module({
  imports: [PatientsModule, NotificationsModule],
  controllers: [PatientClinicalController, ClinicalRecordsController],
  providers: [ClinicalService],
  exports: [ClinicalService],
})
export class ClinicalModule {}
