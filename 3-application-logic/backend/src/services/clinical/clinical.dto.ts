import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsPastCalendarDate } from '../../gateway/validation/calendar-date';
import { IsSafeText } from '../../gateway/validation/safe-text';

export const DRE_FINDINGS = [
  'NORMAL',
  'ENLARGED_SMOOTH',
  'NODULAR',
  'INDURATED',
  'NOT_PERFORMED',
] as const;
export const BIOPSY_HISTORY = [
  'NONE',
  'PRIOR_NEGATIVE',
  'PRIOR_POSITIVE',
  'UNKNOWN',
] as const;

/** Lower urinary tract symptoms, recorded as structured yes/no answers. */
export class SymptomsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() nocturia?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() frequency?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() urgency?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() weakStream?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() haematuria?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() bonePain?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() weightLoss?: boolean;
}

export class CreateClinicalRecordDto {
  @ApiProperty({ format: 'date', example: '2026-09-20' })
  @IsPastCalendarDate()
  encounterDate!: string;

  @ApiPropertyOptional({ description: 'Total PSA in ng/mL', example: 6.8 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(10_000)
  psaNgMl?: number;

  @ApiPropertyOptional({
    description: 'Free PSA in ng/mL; must not exceed total PSA',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(10_000)
  freePsaNgMl?: number;

  @ApiProperty({ enum: DRE_FINDINGS })
  @IsIn(DRE_FINDINGS)
  dreFinding!: (typeof DRE_FINDINGS)[number];

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    description: 'PI-RADS v2.1 category, when imaging exists',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  piradsScore?: number;

  @ApiPropertyOptional({ description: 'Prostate volume in mL' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1, allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(500)
  prostateVolumeMl?: number;

  @ApiPropertyOptional({ enum: BIOPSY_HISTORY, default: 'UNKNOWN' })
  @IsOptional()
  @IsIn(BIOPSY_HISTORY)
  biopsyHistory?: (typeof BIOPSY_HISTORY)[number];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() familyHistory?: boolean;

  @ApiPropertyOptional({ type: SymptomsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SymptomsDto)
  symptoms?: SymptomsDto;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  @IsSafeText()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Client-generated id; resubmitting the same id returns the existing record',
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;
}

export class ClinicalRecordView {
  @ApiProperty() id!: string;
  @ApiProperty() patientId!: string;
  @ApiProperty() facilityId!: string;
  @ApiProperty() recordedById!: string;
  @ApiProperty({ format: 'date' }) encounterDate!: string;
  @ApiProperty({ nullable: true, type: Number }) psaNgMl!: number | null;
  @ApiProperty({ nullable: true, type: Number }) freePsaNgMl!: number | null;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'free/total PSA ratio, when both are known',
  })
  freeToTotalPsaRatio!: number | null;
  @ApiProperty({ enum: DRE_FINDINGS }) dreFinding!: string;
  @ApiProperty({ nullable: true, type: Number }) piradsScore!: number | null;
  @ApiProperty({ nullable: true, type: Number }) prostateVolumeMl!:
    number | null;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'PSA density (ng/mL per mL), when volume is known',
  })
  psaDensity!: number | null;
  @ApiProperty({ enum: BIOPSY_HISTORY }) biopsyHistory!: string;
  @ApiProperty({ nullable: true, type: Boolean }) familyHistory!:
    boolean | null;
  @ApiProperty({ nullable: true, type: SymptomsDto })
  symptoms!: SymptomsDto | null;
  @ApiProperty({ nullable: true, type: String }) notes!: string | null;
  @ApiProperty() version!: number;
  @ApiProperty({ nullable: true, type: String }) clientUuid!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export const CONSENT_TYPES = [
  'DATA_PROCESSING',
  'AI_ANALYSIS',
  'RESEARCH_USE',
  'EHR_SHARING',
] as const;
export const CONSENT_METHODS = [
  'WRITTEN',
  'VERBAL_WITNESSED',
  'DIGITAL',
] as const;

export class GrantConsentDto {
  @ApiProperty({ enum: CONSENT_TYPES })
  @IsIn(CONSENT_TYPES)
  type!: (typeof CONSENT_TYPES)[number];

  @ApiProperty({ enum: CONSENT_METHODS })
  @IsIn(CONSENT_METHODS)
  method!: (typeof CONSENT_METHODS)[number];

  @ApiProperty({
    example: 'consent-v1.0-en',
    description: 'Version of the consent text the patient agreed to',
  })
  @IsString()
  @Length(1, 40)
  @IsSafeText()
  consentTextVersion!: string;
}

export class ConsentView {
  @ApiProperty() id!: string;
  @ApiProperty() patientId!: string;
  @ApiProperty({ enum: CONSENT_TYPES }) type!: string;
  @ApiProperty({ enum: ['GRANTED', 'WITHDRAWN'] }) status!: string;
  @ApiProperty({ enum: CONSENT_METHODS }) method!: string;
  @ApiProperty() consentTextVersion!: string;
  @ApiProperty({ format: 'date-time' }) grantedAt!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  withdrawnAt!: string | null;
  @ApiProperty() version!: number;
}
