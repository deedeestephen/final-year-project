import { Module } from '@nestjs/common';
import { PatientsModule } from '../patients/patients.module';
import {
  ClinicalRecordsController,
  PatientClinicalController,
} from './clinical.controller';
import { ClinicalService } from './clinical.service';

@Module({
  imports: [PatientsModule],
  controllers: [PatientClinicalController, ClinicalRecordsController],
  providers: [ClinicalService],
  exports: [ClinicalService],
})
export class ClinicalModule {}
