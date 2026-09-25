import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  assertValidKey,
  ObjectNotFoundError,
  type ObjectMetadata,
  type ObjectStat,
  type ObjectStorage,
} from './object-storage';

/** Filesystem driver for development and tests (STORAGE_DRIVER=local). Streams; never buffers whole files. */
export class LocalObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    assertValidKey(key);
    const full = resolve(this.root, ...key.split('/'));
    // Defence in depth: the key pattern already forbids traversal.
    if (!full.startsWith(this.root + sep))
      throw new Error(`Invalid object key: ${key}`);
    return full;
  }

  async put(
    key: string,
    body: Readable,
    _metadata: ObjectMetadata,
  ): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    try {
      // 'wx' fails if the file exists, so objects are write-once.
      await pipeline(body, createWriteStream(target, { flags: 'wx' }));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error(`Object already exists: ${key}`);
      }
      await rm(target, { force: true });
      throw err;
    }
  }

  async get(key: string): Promise<Readable> {
    const target = this.pathFor(key);
    if (!(await this.exists(key))) throw new ObjectNotFoundError(key);
    return createReadStream(target);
  }

  async stat(key: string): Promise<ObjectStat> {
    try {
      const s = await stat(this.pathFor(key));
      return { sizeBytes: s.size };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT')
        throw new ObjectNotFoundError(key);
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
