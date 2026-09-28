import { Module } from '@nestjs/common';
import { FhirController } from './fhir.controller';
import { FhirExportService } from './fhir-export.service';
import { SmartCareClient } from './smartcare.client';

@Module({
  controllers: [FhirController],
  providers: [FhirExportService, SmartCareClient],
})
export class FhirModule {}
