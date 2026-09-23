/**
 * Writes the OpenAPI 3.0 document to docs/api/openapi.json.
 *   npm run openapi:export         write the file
 *   npm run openapi:check          fail if the committed file is out of date
 * No database connection is made: clients connect lazily and are never used.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/app-config';
import { configureApp } from '../src/configure-app';
import { buildOpenApiDocument } from '../src/openapi';

const TARGET = path.resolve(
  __dirname,
  '..',
  '..',
  'docs',
  'api',
  'openapi.json',
);

async function main(): Promise<void> {
  // Placeholder connection strings: only needed to satisfy config validation.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??=
    'postgresql://openapi:openapi@127.0.0.1:1/openapi';
  process.env.MONGO_URL ??= 'mongodb://openapi:openapi@127.0.0.1:1/openapi';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    bodyParser: false,
  });
  configureApp(app, loadConfig(process.env));
  await app.init();
  const json = `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`;
  await app.close();

  if (process.argv.includes('--check')) {
    const current = readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');
    if (current !== json) {
      console.error(
        'docs/api/openapi.json is out of date. Run: npm run openapi:export',
      );
      process.exitCode = 1;
      return;
    }
    console.log('docs/api/openapi.json is up to date.');
    return;
  }
  writeFileSync(TARGET, json);
  console.log(`Wrote ${TARGET}`);
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
