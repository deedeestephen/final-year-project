import * as os from 'node:os';
import { MongoClient, type MongoClientOptions } from 'mongodb';

/**
 * The MongoDB 7 driver loads `os` with a dynamic `import()`, which fails inside
 * Jest's CommonJS sandbox; the handshake then lacks client metadata and the
 * server rejects it. Supplying the adapter explicitly works in every runtime.
 */
export function createMongoClient(
  url: string,
  options: MongoClientOptions = {},
): MongoClient {
  return new MongoClient(url, {
    ...options,
    runtimeAdapters: { os, ...options.runtimeAdapters },
  });
}
