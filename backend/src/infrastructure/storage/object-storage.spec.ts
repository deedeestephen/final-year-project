import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { assertValidKey, generateObjectKey } from './object-storage';
import { LocalObjectStorage } from './local-object-storage';

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}

describe('object keys', () => {
  it('generates server-side keys under a prefix, never from user input', () => {
    const key = generateObjectKey('imaging', '.dcm');
    expect(key).toMatch(/^imaging\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.dcm$/);
    expect(generateObjectKey('imaging', '.dcm')).not.toBe(key);
  });

  it.each([
    '../etc/passwd',
    'imaging/../../secret',
    '/absolute/path',
    'C:\\Windows\\system32',
    'imaging\\evil',
    'imaging//double',
    '',
    'Imaging/UPPER',
    'imaging/%2e%2e/x',
    'imaging/ space',
  ])('rejects unsafe key %p', (key) => {
    expect(() => assertValidKey(key)).toThrow(/Invalid object key/);
  });

  it('rejects an unsafe prefix or extension when generating', () => {
    expect(() => generateObjectKey('../x', '.dcm')).toThrow();
    expect(() => generateObjectKey('imaging', '/../x')).toThrow();
  });
});

describe('LocalObjectStorage', () => {
  let root: string;
  let storage: LocalObjectStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pca-objects-'));
    storage = new LocalObjectStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('stores, stats, reads and deletes an object', async () => {
    const key = generateObjectKey('imaging', '.dcm');
    const data = Buffer.from('DICM-synthetic-test-bytes');

    await storage.put(key, Readable.from([data]), {
      contentType: 'application/dicom',
    });

    expect(await storage.exists(key)).toBe(true);
    expect((await storage.stat(key)).sizeBytes).toBe(data.length);
    expect(await readAll(await storage.get(key))).toEqual(data);

    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it('refuses keys that would escape the storage root', async () => {
    await expect(
      storage.put('../escape.txt', Readable.from(['x']), {}),
    ).rejects.toThrow(/Invalid object key/);
    expect(await readdir(root)).toEqual([]);
  });

  it('does not overwrite an existing object', async () => {
    const key = generateObjectKey('imaging', '.dcm');
    await storage.put(key, Readable.from(['first']), {});
    await expect(
      storage.put(key, Readable.from(['second']), {}),
    ).rejects.toThrow(/already exists/);
    expect((await readAll(await storage.get(key))).toString()).toBe('first');
  });

  it('reports a missing object clearly', async () => {
    await expect(
      storage.get(generateObjectKey('imaging', '.dcm')),
    ).rejects.toThrow(/not found/);
  });
});
