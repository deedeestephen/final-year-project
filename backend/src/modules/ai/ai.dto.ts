import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const AI_JOB_STATUSES = [
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'TIMED_OUT',
] as const;

export class SkippedModuleView {
  @ApiProperty({ example: 'resnet50_imaging' }) module!: string;
  @ApiProperty({ example: 'No imaging study was provided' }) reason!: string;
}

export class AiOutputsView {
  @ApiPropertyOptional({ nullable: true, type: Number, minimum: 0, maximum: 1 })
  pcaProbability!: number | null;
  @ApiPropertyOptional({
    nullable: true,
    type: [Number],
    description: '[low, high]',
  })
  probabilityInterval!: [number, number] | null;
  @ApiPropertyOptional({ nullable: true, type: Number, minimum: 1, maximum: 5 })
  gleasonGradeGroup!: number | null;
  @ApiProperty({ type: [String] }) modulesUsed!: string[];
  @ApiProperty({ type: [SkippedModuleView] })
  modulesSkipped!: SkippedModuleView[];
}

export class ExplanationView {
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'Stored artifact id (Phase 12), when one exists',
  })
  id!: string | null;
  @ApiProperty({ enum: ['GRADCAM', 'SHAP', 'MIL_ATTENTION'] }) kind!: string;
  @ApiProperty() module!: string;
  @ApiProperty({ description: 'False when no explanation could be produced' })
  available!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String })
  unavailableReason!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'SHAP contributions, only from a real model',
  })
  values!: Record<string, number> | null;
}

export class AiReportView {
  @ApiProperty({ enum: ['MOCK', 'RESEARCH_MODEL'] }) provenance!: string;
  @ApiProperty({
    description:
      'True for development mock output: show the disclaimer prominently',
  })
  isMock!: boolean;
  @ApiProperty({ example: 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.' })
  disclaimer!: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  modelVersions!: Record<string, string>;
  @ApiProperty({ type: AiOutputsView }) outputs!: AiOutputsView;
  @ApiProperty({ type: [ExplanationView] }) explanations!: ExplanationView[];
  @ApiProperty() createdAt!: string;
}

export class AiJobView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ enum: AI_JOB_STATUSES }) status!: string;
  @ApiProperty({ format: 'uuid' }) requestedById!: string;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Why it failed, in plain words',
  })
  error!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  startedAt!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  finishedAt!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: AiReportView,
    description: 'Present on the single-job endpoint once the job succeeded',
  })
  report!: AiReportView | null;
}

export class AiModelView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({
    enum: ['UNET', 'RESNET50', 'ANN', 'PATCH_CNN_MIL', 'XGBOOST_FUSION'],
  })
  architecture!: string;
  @ApiProperty() version!: string;
  @ApiProperty({ enum: ['MOCK', 'RESEARCH_MODEL'] }) provenance!: string;
  @ApiProperty({ enum: ['REGISTERED', 'ACTIVE', 'RETIRED'] }) status!: string;
  @ApiProperty({
    description: 'True only when a stored evaluation run exists',
  })
  evaluationAvailable!: boolean;
}
