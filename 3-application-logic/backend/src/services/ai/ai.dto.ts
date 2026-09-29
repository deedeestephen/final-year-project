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
  @ApiProperty({
    description:
      'True when an image can be fetched from GET /explanations/{id}/content',
  })
  hasImage!: boolean;
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
  @ApiProperty({
    type: [String],
    description:
      'Files that were not sent to the AI and why (for example, no de-identified copy)',
  })
  inputNotes!: string[];
  @ApiProperty() createdAt!: string;
}

export class AiJobView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Facility record number; only on the facility-wide list',
  })
  patientMrn?: string | null;
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

export class FairnessGroupView {
  @ApiProperty({ example: 'rural' }) name!: string;
  @ApiPropertyOptional({ nullable: true, type: Number }) auc!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) cases!: number | null;
  @ApiProperty({
    description: 'False when the group has too few test cases or figures',
  })
  compared!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) reason!: string | null;
}

export class FairnessDimensionView {
  @ApiProperty({ example: 'region' }) name!: string;
  @ApiProperty({ type: [FairnessGroupView] }) groups!: FairnessGroupView[];
  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'Highest minus lowest AUC of the compared groups',
  })
  aucGap!: number | null;
  @ApiProperty({ description: 'AUC gap above the threshold (0.05)' })
  flagged!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) note!: string | null;
}

/** Proposal §3.7: disaggregated AUC, gap above 0.05 flagged. */
export class FairnessView {
  @ApiProperty({ example: 0.05 }) threshold!: number;
  @ApiProperty({ example: 30 }) minCases!: number;
  @ApiProperty({ type: [FairnessDimensionView] })
  dimensions!: FairnessDimensionView[];
  @ApiProperty() flagged!: boolean;
}

export class EvaluationView {
  @ApiProperty({ format: 'uuid' }) modelId!: string;
  @ApiProperty({
    description: 'True only when a stored evaluation run exists',
  })
  available!: boolean;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'Evaluation data not yet available.',
  })
  message!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    description:
      'The stored evaluation (metrics, including per-group fairness figures)',
  })
  evaluation!: Record<string, unknown> | null;
  @ApiPropertyOptional({
    nullable: true,
    type: FairnessView,
    description:
      'Computed from the stored per-group figures only; null without them',
  })
  fairness!: FairnessView | null;
}
