import { Module } from '@nestjs/common';
import { ClinicalModule } from '../clinical/clinical.module';
import { PatientsModule } from '../patients/patients.module';
import { AiBrokerService } from './ai-broker.service';
import {
  AiJobsController,
  AiModelsController,
  PatientAiController,
} from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [PatientsModule, ClinicalModule],
  controllers: [PatientAiController, AiJobsController, AiModelsController],
  providers: [AiBrokerService, AiService],
  exports: [AiService, AiBrokerService],
})
export class AiModule {}
