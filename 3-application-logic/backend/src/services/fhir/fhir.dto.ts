import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export const EXPORT_PURPOSES = ['RESEARCH', 'NATIONAL_EHR'] as const;

const PURPOSE_HELP =
  'RESEARCH includes patients with research-use consent; NATIONAL_EHR ' +
  '(SmartCare Pro) includes patients with EHR-sharing consent.';

export class FhirExportQuery {
  @ApiProperty({ enum: EXPORT_PURPOSES, description: PURPOSE_HELP })
  @IsIn(EXPORT_PURPOSES)
  purpose!: (typeof EXPORT_PURPOSES)[number];

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only this facility (default: all facilities)',
  })
  @IsOptional()
  @IsUUID()
  facilityId?: string;
}

export class FhirExportDto extends FhirExportQuery {}

export class FhirPushDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only this facility (default: all facilities)',
  })
  @IsOptional()
  @IsUUID()
  facilityId?: string;
}

export class FhirCountsView {
  @ApiProperty() patients!: number;
  @ApiProperty() screeningVisits!: number;
  @ApiProperty() observations!: number;
  @ApiProperty() pathologyReports!: number;
  @ApiProperty() aiReports!: number;
  @ApiProperty({
    description:
      'Development mock AI results found for these patients; they are never exported',
  })
  aiReportsLeftOutMock!: number;
}

export class FhirExportSummaryView {
  @ApiProperty({ enum: EXPORT_PURPOSES }) purpose!: string;
  @ApiProperty({ description: 'Patients in scope (facility filter applied)' })
  patientsInScope!: number;
  @ApiProperty({ description: 'Patients with the consent this purpose needs' })
  patientsWithConsent!: number;
  @ApiProperty({ enum: ['RESEARCH_USE', 'EHR_SHARING'] })
  consentRequired!: string;
  @ApiProperty({ type: FhirCountsView }) willExport!: FhirCountsView;
  @ApiProperty({ description: 'Largest number of patients in one export' })
  maxPatients!: number;
  @ApiProperty({ description: 'Whether a SmartCare Pro address is set' })
  smartcareConfigured!: boolean;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'SmartCare Pro host name (never the token)',
  })
  smartcareHost!: string | null;
}

export class FhirPushResultView {
  @ApiProperty({ enum: ['SENT'] }) status!: 'SENT';
  @ApiProperty({ format: 'uuid' }) bundleId!: string;
  @ApiProperty() httpStatus!: number;
  @ApiPropertyOptional({ nullable: true, type: String })
  receiverId!: string | null;
  @ApiProperty() target!: string;
  @ApiProperty({ type: FhirCountsView }) counts!: FhirCountsView;
}
