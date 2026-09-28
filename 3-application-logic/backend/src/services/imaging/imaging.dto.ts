import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export const IMAGING_MODALITIES = ['MRI', 'TRUS', 'CT'] as const;
export type ImagingModalityName = (typeof IMAGING_MODALITIES)[number];

export const SLIDE_FORMATS = ['SVS', 'TIFF', 'NDPI'] as const;
export type SlideFormat = (typeof SLIDE_FORMATS)[number];

/** Documents the multipart form for OpenAPI; parsing is done by the stream handler. */
export class ImagingUploadForm {
  @ApiProperty({ enum: IMAGING_MODALITIES })
  modality!: ImagingModalityName;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Client-generated id; a retry with the same id never duplicates',
  })
  clientUuid?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'DICOM for MRI and CT; DICOM, JPEG or PNG for TRUS. Send the other fields first.',
  })
  file!: unknown;
}

export class SlideUploadForm {
  @ApiPropertyOptional({ enum: SLIDE_FORMATS, default: 'TIFF' })
  format?: SlideFormat;

  @ApiPropertyOptional({ example: 'H&E', maxLength: 40 })
  stain?: string;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'YYYY-MM-DD' })
  biopsyDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  clientUuid?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'Whole-slide image (TIFF-based: SVS, TIFF, NDPI). Send the other fields first.',
  })
  file!: unknown;
}

export class ImagingStudyView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ enum: IMAGING_MODALITIES }) modality!: ImagingModalityName;
  @ApiProperty({ example: 'application/dicom' }) mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ description: 'SHA-256 of the stored file' }) sha256!: string;
  @ApiProperty({
    enum: ['VALIDATED'],
    description: 'Only files that passed every check are recorded',
  })
  status!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  studyInstanceUid!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  seriesInstanceUid!: string | null;
  @ApiProperty({ format: 'uuid' }) uploadedById!: string;
  @ApiProperty({
    description:
      'True when a de-identified copy exists, so the file can be used in an AI analysis',
  })
  aiReady!: boolean;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Why the file is not sent to the AI, in plain words',
  })
  aiExcludedReason!: string | null;
  @ApiProperty() createdAt!: string;
}

export class SpecimenView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ enum: SLIDE_FORMATS }) format!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) stain!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, example: '2026-09-01' })
  biopsyDate!: string | null;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() sha256!: string;
  @ApiProperty({ enum: ['VALIDATED'] }) status!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  gleasonPrimary!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  gleasonSecondary!: number | null;
  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description:
      'ISUP grade group 1-5, computed by the server from the Gleason patterns',
  })
  isupGradeGroup!: number | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  reviewedAt!: string | null;
  @ApiProperty({ format: 'uuid' }) uploadedById!: string;
  @ApiProperty() createdAt!: string;
}

export class ReviewSpecimenDto {
  @ApiProperty({
    minimum: 3,
    maximum: 5,
    description: 'Most common Gleason pattern',
  })
  @IsInt()
  @Min(3)
  @Max(5)
  gleasonPrimary!: number;

  @ApiProperty({
    minimum: 3,
    maximum: 5,
    description: 'Second most common pattern',
  })
  @IsInt()
  @Min(3)
  @Max(5)
  gleasonSecondary!: number;
}
