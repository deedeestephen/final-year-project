import type { Db, Document, IndexDescription } from 'mongodb';

/**
 * Document-store collections (Layer 5, MongoDB). Server-side $jsonSchema
 * validators reject malformed documents even if application code is wrong.
 */
export interface CollectionSpec {
  name: string;
  validator: Document;
  indexes: IndexDescription[];
}

export const PROVENANCE_VALUES = ['MOCK', 'RESEARCH_MODEL'] as const;
export const CHAT_LANGUAGES = ['en', 'bem', 'nya'] as const;

export const COLLECTIONS: readonly CollectionSpec[] = [
  {
    name: 'ai_reports',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'jobId',
          'patientRef',
          'provenance',
          'disclaimer',
          'modelVersions',
          'outputs',
          'createdAt',
        ],
        properties: {
          jobId: { bsonType: 'string' },
          patientRef: { bsonType: 'string' },
          provenance: { enum: [...PROVENANCE_VALUES] },
          disclaimer: { bsonType: 'string', minLength: 20 },
          modelVersions: { bsonType: 'object' },
          outputs: { bsonType: 'object' },
          explanations: { bsonType: 'array' },
          createdAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { jobId: 1 }, name: 'jobId_unique', unique: true },
      { key: { patientRef: 1, createdAt: -1 }, name: 'patient_recent' },
    ],
  },
  {
    name: 'imaging_metadata',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['imagingStudyId', 'modality', 'createdAt'],
        properties: {
          imagingStudyId: { bsonType: 'string' },
          modality: { enum: ['MRI', 'TRUS', 'CT', 'WSI'] },
          dicom: { bsonType: 'object' },
          createdAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      {
        key: { imagingStudyId: 1 },
        name: 'imagingStudyId_unique',
        unique: true,
      },
    ],
  },
  {
    name: 'chatbot_conversations',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'language', 'messages', 'createdAt', 'updatedAt'],
        properties: {
          userId: { bsonType: 'string' },
          language: { enum: [...CHAT_LANGUAGES] },
          messages: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['role', 'text', 'at'],
              properties: {
                role: { enum: ['user', 'assistant'] },
                text: { bsonType: 'string' },
                sources: { bsonType: 'array' },
                at: { bsonType: 'date' },
              },
            },
          },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [{ key: { userId: 1, updatedAt: -1 }, name: 'user_recent' }],
  },
  {
    name: 'ai_inference_logs',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['jobId', 'event', 'at'],
        properties: {
          jobId: { bsonType: 'string' },
          event: { bsonType: 'string' },
          at: { bsonType: 'date' },
          durationMs: { bsonType: ['int', 'long', 'double'] },
        },
      },
    },
    indexes: [{ key: { jobId: 1, at: 1 }, name: 'job_timeline' }],
  },
];

/** Creates or updates every collection's validator and indexes. Idempotent. */
export async function ensureMongoCollections(db: Db): Promise<void> {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (c) => c.name,
    ),
  );
  for (const spec of COLLECTIONS) {
    if (existing.has(spec.name)) {
      await db.command({
        collMod: spec.name,
        validator: spec.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    } else {
      await db.createCollection(spec.name, {
        validator: spec.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    }
    if (spec.indexes.length > 0) {
      await db.collection(spec.name).createIndexes(spec.indexes);
    }
  }
}
