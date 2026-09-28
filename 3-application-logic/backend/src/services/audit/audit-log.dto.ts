import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const AUDIT_OUTCOMES = ['SUCCESS', 'DENIED', 'FAILURE'] as const;

export class ListAuditLogsQuery {
  @ApiPropertyOptional({
    description:
      'Actions starting with this text, e.g. "fhir." or "auth.login"',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_.]{1,60}$/, {
    message: 'action may contain only lower-case letters, digits, "_" and "."',
  })
  action?: string;

  @ApiPropertyOptional({ enum: AUDIT_OUTCOMES })
  @IsOptional()
  @IsIn(AUDIT_OUTCOMES)
  outcome?: (typeof AUDIT_OUTCOMES)[number];

  @ApiPropertyOptional({ format: 'uuid', description: 'Who did it' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'From (inclusive)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Until (exclusive)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 50;
}

export class AuditEntryView {
  @ApiProperty({
    description: 'Position in the chain (as text: it can exceed 2^53)',
  })
  seq!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'uuid' })
  actorUserId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  actorEmail!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  actorRole!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() entityType!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  entityId!: string | null;
  @ApiProperty({ enum: AUDIT_OUTCOMES }) outcome!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  requestId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  ip!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    description: 'Never holds passwords, tokens or direct patient identifiers',
  })
  details!: Record<string, unknown> | null;
}

export class AuditLogPage {
  @ApiProperty({ type: [AuditEntryView] }) items!: AuditEntryView[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

export class AuditChainView {
  @ApiProperty({
    description:
      'True when every entry links to the one before and matches its hash',
  })
  intact!: boolean;
  @ApiProperty({ description: 'Entries checked' }) entries!: number;
  @ApiPropertyOptional({ nullable: true, type: String })
  brokenAt!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  reason!: string | null;
  @ApiProperty({ format: 'date-time' }) checkedAt!: string;
}
