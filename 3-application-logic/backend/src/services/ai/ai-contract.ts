import { z } from 'zod';

/**
 * The backend's own check of what ai-services sends back
 * (2-api-gateway/openapi/ai-contract.yaml). Nothing from the AI service is stored or shown
 * until it passes this schema.
 */
export const MOCK_DISCLAIMER = 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.';

export const provenanceSchema = z.enum(['MOCK', 'RESEARCH_MODEL']);

/** Largest explanation image accepted, as base64 (about 2 MB of PNG). */
export const MAX_ARTIFACT_BASE64 = 2_800_000;

const explanationSchema = z
  .object({
    kind: z.enum(['GRADCAM', 'SHAP', 'MIL_ATTENTION']),
    module: z.string().min(1).max(100),
    storageKey: z.string().max(512).nullable().optional(),
    artifact: z
      .object({
        contentType: z.literal('image/png'),
        dataBase64: z.string().min(8).max(MAX_ARTIFACT_BASE64),
      })
      .nullable()
      .optional(),
    values: z.record(z.string(), z.number()).nullable().optional(),
    unavailableReason: z.string().min(1).max(500).nullable().optional(),
  })
  .refine(
    (e) =>
      (e.storageKey != null || e.artifact != null || e.values != null) !==
      (e.unavailableReason != null),
    'an explanation needs an artifact or an unavailableReason',
  );

export type ContractExplanation = z.infer<typeof explanationSchema>;

export const inferenceResultSchema = z
  .object({
    jobId: z.uuid(),
    provenance: provenanceSchema,
    disclaimer: z.string().min(20).max(500),
    modelVersions: z.record(z.string(), z.string().max(100)),
    outputs: z.object({
      pcaProbability: z.number().min(0).max(1).nullable().optional(),
      probabilityInterval: z
        .tuple([z.number().min(0).max(1), z.number().min(0).max(1)])
        .nullable()
        .optional(),
      gleasonGradeGroup: z.number().int().min(1).max(5).nullable().optional(),
      segmentationMaskKey: z.string().max(512).nullable().optional(),
      modulesUsed: z.array(z.string().max(100)).default([]),
      modulesSkipped: z
        .array(z.object({ module: z.string(), reason: z.string().max(500) }))
        .default([]),
    }),
    explanations: z.array(explanationSchema).max(50),
  })
  .refine(
    (r) => r.provenance !== 'MOCK' || r.disclaimer === MOCK_DISCLAIMER,
    'a MOCK result must carry the mock disclaimer',
  );

export type InferenceResult = z.infer<typeof inferenceResultSchema>;

export const modelInfoSchema = z.object({
  name: z.string().min(1).max(100),
  architecture: z.enum([
    'UNET',
    'RESNET50',
    'ANN',
    'PATCH_CNN_MIL',
    'XGBOOST_FUSION',
  ]),
  version: z.string().min(1).max(100),
  provenance: provenanceSchema,
  evaluation: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type ModelInfo = z.infer<typeof modelInfoSchema>;

/** What the backend sends: de-identified values and storage references only. */
export interface InferenceRequest {
  jobId: string;
  patientRef: string;
  inputs: {
    clinical?: {
      ageYears?: number;
      psaNgMl?: number;
      freePsaNgMl?: number;
      dreFinding?: string;
      piradsScore?: number;
      prostateVolumeMl?: number;
      biopsyHistory?: string;
      familyHistory?: boolean;
    };
    imaging: { storageKey: string; modality: string }[];
    histopathology: { storageKey: string; stain?: string }[];
  };
}
