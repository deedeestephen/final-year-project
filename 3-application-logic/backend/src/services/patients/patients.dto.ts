import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsSafeText } from '../../gateway/validation/safe-text';
import { IsPastCalendarDate } from '../../gateway/validation/calendar-date';

export const REGION_CLASSES = ['URBAN', 'PERI_URBAN', 'RURAL'] as const;
export type RegionClassValue = (typeof REGION_CLASSES)[number];

export class CreatePatientDto {
  @ApiPropertyOptional({
    description: 'Facility medical record number; generated when omitted',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,30}$/, {
    message: 'mrn must be 3-30 letters, digits or dashes',
  })
  mrn?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  @IsSafeText()
  givenName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  @IsSafeText()
  familyName!: string;

  @ApiPropertyOptional({
    example: '123456/78/1',
    description: 'National Registration Card number',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z/ -]{4,30}$/, {
    message: 'nationalId has an invalid format',
  })
  nationalId?: string;

  @ApiPropertyOptional({ example: '+260971234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ]{7,20}$/, { message: 'phone must be a telephone number' })
  phone?: string;

  @ApiProperty({ example: '1958-03-14', format: 'date' })
  @IsPastCalendarDate()
  dateOfBirth!: string;

  @ApiProperty({ enum: REGION_CLASSES })
  @IsIn(REGION_CLASSES)
  regionClass!: RegionClassValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @IsSafeText()
  district?: string;

  @ApiPropertyOptional({
    description:
      'Client-generated id for offline-created records (idempotency)',
  })
  @IsOptional()
  @IsUUID()
  clientUuid?: string;
}

export class UpdatePatientDto {
  @ApiProperty({
    description: 'Version the client last saw (optimistic concurrency)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @IsSafeText()
  givenName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @IsSafeText()
  familyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ]{7,20}$/, { message: 'phone must be a telephone number' })
  phone?: string;

  @ApiPropertyOptional({ enum: REGION_CLASSES })
  @IsOptional()
  @IsIn(REGION_CLASSES)
  regionClass?: RegionClassValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @IsSafeText()
  district?: string;

  @ApiPropertyOptional({
    description: "Link the patient's own app account (a PATIENT user)",
  })
  @IsOptional()
  @IsUUID()
  accountUserId?: string;
}

export class ListPatientsQuery {
  @ApiPropertyOptional({
    description: 'Exact match; formatting differences are ignored',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z/ -]{4,30}$/)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,30}$/)
  mrn?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class PatientSummary {
  @ApiProperty() id!: string;
  @ApiProperty() mrn!: string;
  @ApiProperty() givenName!: string;
  @ApiProperty() familyName!: string;
  @ApiProperty() ageYears!: number;
  @ApiProperty({ enum: REGION_CLASSES }) regionClass!: string;
  @ApiProperty() version!: number;
}

export class PatientView extends PatientSummary {
  @ApiProperty() facilityId!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Masked; only the last characters are shown',
  })
  nationalIdMasked!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ format: 'date' }) dateOfBirth!: string;
  @ApiProperty({ nullable: true, type: String }) district!: string | null;
  @ApiProperty({ nullable: true, type: String }) accountUserId!: string | null;
  @ApiProperty() isSynthetic!: boolean;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Device-generated id when the patient was registered offline',
  })
  clientUuid!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class PatientPage {
  @ApiProperty({ type: [PatientSummary] }) items!: PatientSummary[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}
