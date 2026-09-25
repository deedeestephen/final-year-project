import { Global, Logger, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { LocalObjectStorage } from './local-object-storage';
import type { ObjectStorage } from './object-storage';
import { S3ObjectStorage } from './s3-object-storage';

/** Injection token for the configured {@link ObjectStorage} driver. */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig): Promise<ObjectStorage> => {
        if (config.storage.driver === 'local') {
          return new LocalObjectStorage(config.storage.root);
        }
        const s3 = new S3ObjectStorage(config.storage);
        try {
          await s3.ensureBucket();
        } catch (err) {
          // Start anyway; uploads report the problem instead of the whole API failing.
          new Logger('Storage').warn(
            `Object storage bucket check failed: ${(err as Error).name}`,
          );
        }
        return s3;
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
