import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { MongoServerError, type Db, type MongoClient } from 'mongodb';
import { createMongoClient } from '../../src/persistence/mongo/client';
import {
  COLLECTIONS,
  ensureMongoCollections,
} from '../../src/persistence/mongo/collections';
import {
  generateObjectKey,
  ObjectNotFoundError,
} from '../../src/persistence/storage/object-storage';
import { S3ObjectStorage } from '../../src/persistence/storage/s3-object-storage';
import { QdrantVectorStore } from '../../src/persistence/vector/qdrant-vector-store';

describe('MongoDB collections', () => {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    client = createMongoClient(process.env.MONGO_URL!);
    await client.connect();
    db = client.db();
    await ensureMongoCollections(db);
  });

  afterAll(async () => {
    await client.close();
  });

  it('creates every collection with its indexes, and re-running is harmless', async () => {
    await ensureMongoCollections(db);
    for (const spec of COLLECTIONS) {
      const names = (await db.collection(spec.name).indexes()).map(
        (i) => i.name,
      );
      for (const idx of spec.indexes) expect(names).toContain(idx.name);
    }
  });

  const report = () => ({
    jobId: randomUUID(),
    patientRef: randomUUID(),
    provenance: 'MOCK',
    disclaimer: 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.',
    modelVersions: { fusion: 'mock-0.1.0' },
    outputs: {},
    createdAt: new Date(),
  });

  it('accepts a well-formed AI report', async () => {
    await expect(
      db.collection('ai_reports').insertOne(report()),
    ).resolves.toBeDefined();
  });

  it('rejects an AI report without provenance', async () => {
    const { provenance: _omit, ...withoutProvenance } = report();
    await expect(
      db.collection('ai_reports').insertOne(withoutProvenance),
    ).rejects.toThrow(MongoServerError);
  });

  it('rejects an AI report claiming an unknown provenance', async () => {
    await expect(
      db
        .collection('ai_reports')
        .insertOne({ ...report(), provenance: 'CLINICALLY_VALIDATED' }),
    ).rejects.toThrow(/Document failed validation/);
  });

  it('allows only one report per job', async () => {
    const r = report();
    await db.collection('ai_reports').insertOne({ ...r });
    await expect(
      db.collection('ai_reports').insertOne({ ...r }),
    ).rejects.toThrow(/duplicate key/);
  });

  it('rejects a chatbot conversation in an unsupported language', async () => {
    await expect(
      db.collection('chatbot_conversations').insertOne({
        userId: randomUUID(),
        language: 'fr',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toThrow(/Document failed validation/);
  });
});

describe('S3 object storage against MinIO', () => {
  const storage = new S3ObjectStorage({
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    bucket: process.env.S3_BUCKET!,
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  });

  beforeAll(async () => {
    await storage.ensureBucket();
  });

  it('round-trips an object and reports missing ones', async () => {
    const key = generateObjectKey('imaging', '.dcm');
    await storage.put(key, Readable.from([Buffer.from('synthetic')]), {
      contentType: 'application/dicom',
    });
    expect((await storage.stat(key)).sizeBytes).toBe(9);
    const chunks: Buffer[] = [];
    for await (const c of await storage.get(key))
      chunks.push(Buffer.from(c as Buffer));
    expect(Buffer.concat(chunks).toString()).toBe('synthetic');
    await expect(
      storage.put(key, Readable.from(['again']), {}),
    ).rejects.toThrow(/already exists/);
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it('reports a missing object as not found (read and stat)', async () => {
    const missing = generateObjectKey('imaging', '.dcm');
    await expect(storage.get(missing)).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
    await expect(storage.stat(missing)).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
  });

  it('surfaces credential errors instead of reporting "missing"', async () => {
    const wrongCredentials = new S3ObjectStorage({
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
      bucket: process.env.S3_BUCKET!,
      accessKeyId: 'wrong-access-key',
      secretAccessKey: 'wrong-secret-key',
    });
    const key = generateObjectKey('imaging', '.dcm');
    const error = await wrongCredentials.stat(key).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ObjectNotFoundError);
  });

  it('rejects unsafe keys before calling the server', async () => {
    await expect(
      storage.put('../escape', Readable.from(['x']), {}),
    ).rejects.toThrow(/Invalid object key/);
  });
});

describe('Qdrant vector store', () => {
  const store = new QdrantVectorStore(
    process.env.QDRANT_URL ?? 'http://localhost:6333',
  );
  const collection = `test_${randomUUID().replace(/-/g, '')}`;

  it('returns nearest neighbours with their original ids and payloads', async () => {
    await store.ensureCollection(collection, 3);
    await store.ensureCollection(collection, 3);
    await store.upsert(collection, [
      { id: 'kb-psa-1', vector: [1, 0, 0], payload: { title: 'PSA' } },
      { id: 'kb-biopsy-1', vector: [0, 1, 0], payload: { title: 'Biopsy' } },
    ]);
    const hits = await store.search(collection, [0.9, 0.1, 0], 1);
    expect(hits).toEqual([
      expect.objectContaining({ id: 'kb-psa-1', payload: { title: 'PSA' } }),
    ]);
  });
});
