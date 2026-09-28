import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export const ACTIVITY_PERIODS = [1, 7, 30, 90] as const;

export class ActivityQuery {
  @ApiPropertyOptional({
    enum: ACTIVITY_PERIODS,
    default: 7,
    description: 'Days back from now (1 = the last 24 hours)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn(ACTIVITY_PERIODS)
  days: (typeof ACTIVITY_PERIODS)[number] = 7;
}

export class ActivityTotalsView {
  @ApiProperty({ description: 'Accounts that did anything successfully' })
  activeUsers!: number;
  @ApiProperty({ description: 'Accounts active from the phone app' })
  activePhoneUsers!: number;
  @ApiProperty({ description: 'Phones that synced (distinct device ids)' })
  activePhones!: number;
  @ApiProperty() signIns!: number;
  @ApiProperty() failedSignIns!: number;
  @ApiProperty() patientsRegistered!: number;
  @ApiProperty() screeningRecords!: number;
  @ApiProperty({ description: 'Images and slides accepted' }) uploads!: number;
  @ApiProperty() aiRequested!: number;
  @ApiProperty() aiCompleted!: number;
  @ApiProperty() consentsGranted!: number;
  @ApiProperty() consentsWithdrawn!: number;
  @ApiProperty({ description: 'Requests refused for lack of permission' })
  accessDenied!: number;
}

export class ActivityDayView {
  @ApiProperty({ example: '2026-09-28', description: 'Day in Zambia time' })
  date!: string;
  @ApiProperty() signIns!: number;
  @ApiProperty() screeningRecords!: number;
  @ApiProperty({ description: 'Offline changes received from phones' })
  syncedChanges!: number;
  @ApiProperty() aiRequested!: number;
}

export class ActivityCountView {
  @ApiProperty() name!: string;
  @ApiProperty() count!: number;
}

export class SyncHealthView {
  @ApiProperty() applied!: number;
  @ApiProperty({
    description: 'Edits that met a newer version (not overwritten)',
  })
  conflicts!: number;
  @ApiProperty({ description: 'Changes the server refused as invalid' })
  rejected!: number;
}

export class ActivityEventView {
  @ApiProperty() seq!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty() action!: string;
  @ApiProperty({ enum: ['SUCCESS', 'DENIED', 'FAILURE'] }) outcome!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) actorEmail!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) actorRole!:
    string | null;
}

export class ActivityView {
  @ApiProperty({ enum: ACTIVITY_PERIODS }) days!: number;
  @ApiProperty({ format: 'date-time' }) from!: string;
  @ApiProperty({ format: 'date-time' }) to!: string;
  @ApiProperty({ type: ActivityTotalsView }) totals!: ActivityTotalsView;
  @ApiProperty({ type: [ActivityDayView] }) daily!: ActivityDayView[];
  @ApiProperty({
    type: [ActivityCountView],
    description: 'Recorded actions by app: mobile, web, other',
  })
  byClient!: ActivityCountView[];
  @ApiProperty({ type: [ActivityCountView] })
  signInsByRole!: ActivityCountView[];
  @ApiProperty({ type: SyncHealthView }) sync!: SyncHealthView;
  @ApiProperty({
    type: [ActivityEventView],
    description: 'Latest actions from the phone app (newest first)',
  })
  recentPhone!: ActivityEventView[];
}
