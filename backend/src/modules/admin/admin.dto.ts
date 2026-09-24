import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PermissionInfo {
  @ApiProperty() code!: string;
  @ApiProperty() description!: string;
}

export class RoleView {
  @ApiProperty({ enum: ['PATIENT', 'CLINICIAN', 'PATHOLOGIST', 'ADMIN'] })
  name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({
    description: 'True when an administrator changed the defaults',
  })
  customised!: boolean;
  @ApiProperty({ description: 'Accounts that have this role' })
  userCount!: number;
  @ApiProperty({
    type: [String],
    description: 'Permissions that can never be given to this role',
  })
  notAllowed!: string[];
  @ApiProperty({
    type: [String],
    description: 'Permissions this role must always keep',
  })
  required!: string[];
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions!: string[];
}

export class FacilityView {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() province!: string;
  @ApiProperty() district!: string;
}

export class ListPatientAccountsQuery {
  @ApiPropertyOptional({ enum: ['unlinked', 'linked', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['unlinked', 'linked', 'all'])
  status: 'unlinked' | 'linked' | 'all' = 'all';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class LinkedRecordView {
  @ApiProperty() patientId!: string;
  @ApiProperty() mrn!: string;
  @ApiProperty() facilityName!: string;
}

export class PatientAccountView {
  @ApiProperty() userId!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ nullable: true, type: String, enum: ['NRC', 'PASSPORT'] })
  idDocumentType!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Last 4 only' })
  idNumberMasked!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Last 4 only' })
  phoneMasked!: string | null;
  @ApiProperty({ nullable: true, type: LinkedRecordView })
  linked!: LinkedRecordView | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class PatientAccountPage {
  @ApiProperty({ type: [PatientAccountView] }) items!: PatientAccountView[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

export class RecordMatchView extends LinkedRecordView {
  @ApiProperty({
    description: 'True when the record is already linked to another account',
  })
  linkedToAnotherAccount!: boolean;
}
