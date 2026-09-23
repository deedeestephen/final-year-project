import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Db, MongoClient } from 'mongodb';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { createMongoClient } from '../mongo/client';

/** Shared MongoDB connection, opened on first use. */
@Injectable()
export class MongoService implements OnModuleDestroy {
  private readonly client: MongoClient;
  private connecting?: Promise<MongoClient>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = createMongoClient(config.mongoUrl, {
      serverSelectionTimeoutMS: 5_000,
    });
  }

  async db(): Promise<Db> {
    this.connecting ??= this.client.connect();
    try {
      await this.connecting;
    } catch (err) {
      this.connecting = undefined; // allow a retry after a failed connect
      throw err;
    }
    return this.client.db();
  }

  async ping(): Promise<void> {
    await (await this.db()).command({ ping: 1 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
