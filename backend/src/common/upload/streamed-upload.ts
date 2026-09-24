import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import Busboy from 'busboy';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { Transform, type Readable, type TransformCallback } from 'node:stream';
import { SNIFF_BYTES, sniffFile, type DetectedFile } from './file-signatures';

export interface UploadOptions {
  /** Largest accepted file, in bytes (413 above it). */
  maxBytes: number;
  /** Form fields accepted. They must be sent before the file. */
  fields: readonly string[];
  /** Which detected file types are allowed (415 otherwise). */
  accept: (file: DetectedFile) => boolean;
  /** Leading bytes kept in memory for header parsing (e.g. DICOM). */
  keepHeadBytes?: number;
  /**
   * Called when the fields have arrived, before any file byte is stored.
   * Return false to skip storing (e.g. an idempotent retry of a finished upload).
   */
  shouldStore: (fields: Record<string, string>) => Promise<boolean>;
  /** Consumes the checked file stream, e.g. `storage.put(key, body)`. */
  store: (file: DetectedFile, body: Readable) => Promise<void>;
}

export type UploadResult =
  | { stored: false; fields: Record<string, string> }
  | {
      stored: true;
      fields: Record<string, string>;
      file: DetectedFile;
      sha256: string;
      sizeBytes: number;
      head: Buffer;
    };

const bad = (message: string) =>
  new BadRequestException({ code: 'VALIDATION_FAILED', message });

const tooLarge = (maxBytes: number) =>
  new PayloadTooLargeException({
    code: 'PAYLOAD_TOO_LARGE',
    message: `The file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit`,
  });

const unsupported = () =>
  new UnsupportedMediaTypeException({
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'This type of file is not accepted here',
  });

/**
 * Pass-through stream that enforces the size cap, hashes every byte, keeps the
 * first bytes for header parsing, and decides the file type from its magic
 * bytes before letting anything through to storage.
 */
class UploadGuard extends Transform {
  sizeBytes = 0;
  readonly detected: Promise<DetectedFile>;
  private readonly hash = createHash('sha256');
  private readonly headChunks: Buffer[] = [];
  private headLength = 0;
  private pending: Buffer[] = [];
  private pendingLength = 0;
  private decided = false;
  private resolveDetected!: (file: DetectedFile) => void;
  private rejectDetected!: (err: unknown) => void;

  constructor(
    private readonly maxBytes: number,
    private readonly keepHeadBytes: number,
    private readonly accept: (file: DetectedFile) => boolean,
  ) {
    super();
    this.detected = new Promise((resolve, reject) => {
      this.resolveDetected = resolve;
      this.rejectDetected = reject;
    });
    this.detected.catch(() => undefined); // handled by the caller
    this.on('error', (err) => this.rejectDetected(err));
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.sizeBytes += chunk.length;
    if (this.sizeBytes > this.maxBytes) {
      callback(tooLarge(this.maxBytes));
      return;
    }
    this.hash.update(chunk);
    if (this.headLength < this.keepHeadBytes) {
      const part = chunk.subarray(0, this.keepHeadBytes - this.headLength);
      this.headChunks.push(part);
      this.headLength += part.length;
    }
    if (this.decided) {
      callback(null, chunk);
      return;
    }
    this.pending.push(chunk);
    this.pendingLength += chunk.length;
    if (this.pendingLength >= SNIFF_BYTES) this.decide(callback);
    else callback();
  }

  override _flush(callback: TransformCallback): void {
    if (this.decided) callback();
    else this.decide(callback);
  }

  digest(): string {
    return this.hash.digest('hex');
  }

  head(): Buffer {
    return Buffer.concat(this.headChunks);
  }

  private decide(callback: TransformCallback): void {
    const buffered = Buffer.concat(this.pending);
    this.pending = [];
    const file = sniffFile(buffered);
    if (!file || !this.accept(file)) {
      callback(unsupported());
      return;
    }
    this.decided = true;
    this.resolveDetected(file);
    callback(null, buffered);
  }
}

/**
 * Receives one file from a multipart/form-data request and streams it straight
 * to storage: nothing is buffered on disk or held whole in memory, and the
 * caller's file name and declared content type are ignored.
 */
export function receiveUpload(
  req: Request,
  options: UploadOptions,
): Promise<UploadResult> {
  if (!/^multipart\/form-data/i.test(req.headers['content-type'] ?? '')) {
    return Promise.reject(
      new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Send the file as multipart/form-data',
      }),
    );
  }

  return new Promise<UploadResult>((resolve, reject) => {
    let parser: Busboy.Busboy;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          // Busboy reports a limit as soon as it is reached, so allow one
          // extra; unknown and repeated fields are rejected by name anyway.
          files: 1,
          fields: options.fields.length + 1,
          fieldSize: 1024,
          parts: options.fields.length + 2,
        },
      });
    } catch {
      reject(bad('The upload could not be read'));
      return;
    }

    let settled = false;
    let activeGuard: UploadGuard | undefined;
    const finish = (err: unknown, result?: UploadResult) => {
      if (settled) return;
      settled = true;
      if (err) {
        // Stop parsing, abandon any partial write, discard the rest of the body.
        activeGuard?.destroy(err as Error);
        req.unpipe(parser);
        req.resume();
        reject(err instanceof Error ? err : new Error('Upload failed'));
      } else {
        resolve(result as UploadResult);
      }
    };

    const fields: Record<string, string> = {};
    let work: Promise<UploadResult> | undefined;

    parser.on('field', (name, value) => {
      if (work) return finish(bad('Send the form fields before the file'));
      if (!options.fields.includes(name)) {
        return finish(bad(`Unknown form field: ${name}`));
      }
      if (name in fields) return finish(bad(`Repeated form field: ${name}`));
      fields[name] = value;
    });

    parser.on('file', (name, stream) => {
      if (name !== 'file' || work) {
        stream.resume();
        return finish(bad('Send exactly one file, in a field called "file"'));
      }
      work = handleFile(stream);
      work.then(
        (result) => {
          if (!result.stored) finish(null, result);
        },
        (err: unknown) => {
          stream.unpipe();
          stream.resume();
          finish(err);
        },
      );
    });

    parser.on('filesLimit', () => finish(bad('Send only one file')));
    parser.on('fieldsLimit', () => finish(bad('Too many form fields')));
    parser.on('partsLimit', () => finish(bad('Too many form parts')));
    parser.on('error', () => finish(bad('The upload could not be read')));
    parser.on('close', () => {
      if (!work) return finish(bad('No file was sent'));
      work.then(
        (result) => finish(null, result),
        (err: unknown) => finish(err),
      );
    });

    req.pipe(parser);

    async function handleFile(stream: Readable): Promise<UploadResult> {
      if (!(await options.shouldStore({ ...fields }))) {
        stream.resume();
        return { stored: false, fields: { ...fields } };
      }
      const guard = new UploadGuard(
        options.maxBytes,
        options.keepHeadBytes ?? 0,
        options.accept,
      );
      activeGuard = guard;
      stream.on('error', (err) => guard.destroy(err));
      stream.pipe(guard);
      const file = await guard.detected;
      await options.store(file, guard);
      return {
        stored: true,
        fields: { ...fields },
        file,
        sha256: guard.digest(),
        sizeBytes: guard.sizeBytes,
        head: guard.head(),
      };
    }
  });
}
