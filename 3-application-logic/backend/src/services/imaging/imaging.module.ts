import { Module } from '@nestjs/common';
import { PatientsModule } from '../patients/patients.module';
import {
  HistopathologyController,
  ImagingController,
  PatientFilesController,
} from './imaging.controller';
import { ImagingService } from './imaging.service';

@Module({
  imports: [PatientsModule],
  controllers: [
    PatientFilesController,
    ImagingController,
    HistopathologyController,
  ],
  providers: [ImagingService],
  exports: [ImagingService],
})
export class ImagingModule {}
