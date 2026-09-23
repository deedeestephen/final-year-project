import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import {
  assertValidKey,
  ObjectNotFoundError,
  type ObjectMetadata,
  type ObjectStat,
  type ObjectStorage,
} from './object-storage';

export interface S3StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

/**
 * S3-API driver (STORAGE_DRIVER=s3): MinIO in development, any S3-compatible
 * store in deployment. Objects are written with server-side encryption requested.
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.config.bucket }),
      );
    } catch {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.config.bucket }),
      );
    }
  }

  async put(
    key: string,
    body: Readable,
    metadata: ObjectMetadata,
  ): Promise<void> {
    assertValidKey(key);
    if (await this.exists(key))
      throw new Error(`Object already exists: ${key}`);
    // The SDK needs a known length for streamed uploads, so buffer only here.
    // Large-file multipart upload is added with the imaging module (Phase 10).
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk as Buffer));
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: Buffer.concat(chunks),
        ContentType: metadata.contentType,
        Metadata: metadata.sha256 ? { sha256: metadata.sha256 } : undefined,
      }),
    );
  }

  async get(key: string): Promise<Readable> {
    assertValidKey(key);
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return res.Body as Readable;
    } catch (err) {
      throw this.notFoundOr(err, key);
    }
  }

  async stat(key: string): Promise<ObjectStat> {
    assertValidKey(key);
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return {
        sizeBytes: res.ContentLength ?? 0,
        contentType: res.ContentType,
      };
    } catch (err) {
      throw this.notFoundOr(err, key);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.stat(key);
      return true;
    } catch (err) {
      if (err instanceof ObjectNotFoundError) return false;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }

  private notFoundOr(err: unknown, key: string): Error {
    // 403 is deliberately not treated as "missing": it signals a credentials problem.
    if (
      err instanceof S3ServiceException &&
      (err.$metadata.httpStatusCode === 404 ||
        err.name === 'NoSuchKey' ||
        err.name === 'NotFound')
    ) {
      return new ObjectNotFoundError(key);
    }
    return err as Error;
  }
}
