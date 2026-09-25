import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ClinicalRecordView } from '../clinical/clinical.dto';
import { PatientView } from '../patients/patients.dto';

export const SYNC_ENTITIES = ['patient', 'clinical_record'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];
export const SYNC_OPERATIONS = ['CREATE', 'UPDATE'] as const;
export const SYNC_RESULTS = ['APPLIED', 'CONFLICT', 'REJECTED'] as const;
export const MAX_SYNC_BATCH = 100;

export class SyncOperationDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Generated once on the device; retries reuse it',
  })
  @IsUUID()
  idempotencyKey!: string;

  @ApiProperty({ enum: SYNC_ENTITIES })
  @IsIn(SYNC_ENTITIES)
  entityType!: SyncEntity;

  @ApiProperty({ enum: SYNC_OPERATIONS })
  @IsIn(SYNC_OPERATIONS)
  operation!: 'CREATE' | 'UPDATE';

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'UPDATE: server id or the clientUuid the device created it with',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'clinical_record: the patient, by server id or by the clientUuid of a patient created offline',
  })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({
    description: 'UPDATE: the version the device edited',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  baseVersion?: number;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  clientTimestamp!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Body of the matching REST call (CreatePatientDto, UpdatePatientDto without version, CreateClinicalRecordDto); validated per operation',
  })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class SyncBatchDto {
  @ApiProperty({ description: 'Stable id of this app installation' })
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{8,100}$/, {
    message:
      'deviceId must be 8-100 letters, digits, dots, dashes or underscores',
  })
  deviceId!: string;

  @ApiProperty({ type: [SyncOperationDto], maxItems: MAX_SYNC_BATCH })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SYNC_BATCH)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations!: SyncOperationDto[];
}

export class SyncErrorView {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({
    description: 'Field-level messages, as in VALIDATION_FAILED responses',
  })
  details?: unknown;
}

export class SyncOperationResult {
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty({ enum: SYNC_RESULTS }) result!:
    'APPLIED' | 'CONFLICT' | 'REJECTED';
  @ApiProperty({ enum: SYNC_ENTITIES }) entityType!: SyncEntity;
  @ApiPropertyOptional({ description: 'Server id of the entity' })
  entityId?: string;
  @ApiPropertyOptional({ description: 'Server version after the operation' })
  version?: number;
  @ApiProperty({
    description:
      'True when this key was already processed and the stored result is returned',
  })
  replayed!: boolean;
  @ApiPropertyOptional({ type: SyncErrorView }) error?: SyncErrorView;
  @ApiPropertyOptional({
    type: PatientView,
    description: 'CONFLICT: the current server copy, for the user to compare',
  })
  server?: PatientView;
}

export class SyncBatchResponse {
  @ApiProperty({ type: [SyncOperationResult] }) results!: SyncOperationResult[];
  @ApiProperty({ format: 'date-time' }) serverTime!: string;
}

export class SyncChangesQuery {
  @ApiPropertyOptional({
    description: 'Opaque cursor from the previous response',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,512}$/, { message: 'cursor is not valid' })
  cursor?: string;

  @ApiPropertyOptional({ default: 200, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 200;
}

export class SyncChangesResponse {
  @ApiProperty({ type: [PatientView] }) patients!: PatientView[];
  @ApiProperty({ type: [ClinicalRecordView] })
  clinicalRecords!: ClinicalRecordView[];
  @ApiProperty({ description: 'Pass back to get the next changes' })
  cursor!: string;
  @ApiProperty() hasMore!: boolean;
}
