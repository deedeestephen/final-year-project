/**
 * Writes docs/access-matrix.md: every API route and the rule that protects it,
 * read from the code. Fails when a route breaks a review rule
 * (src/gateway/access/access-matrix.ts).
 *   npm run access:matrix          write the file
 *   npm run access:matrix:check    fail if it is out of date or a rule is broken
 * No database connection is made: clients connect lazily and are never used.
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Module } from '@nestjs/common';
import { DiscoveryModule, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/app-config';
import { repoRoot } from '../src/config/repo-root';
import { configureApp } from '../src/gateway/configure-app';
import {
  accessProblems,
  collectRoutes,
  toMarkdown,
} from '../src/gateway/access/access-matrix';

const TARGET = path.join(repoRoot(), 'docs', 'access-matrix.md');

@Module({ imports: [AppModule, DiscoveryModule] })
class MatrixModule {}

async function main(): Promise<void> {
  // Placeholder settings: only needed to satisfy config validation.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://matrix:matrix@127.0.0.1:1/matrix';
  process.env.MONGO_URL ??= 'mongodb://matrix:matrix@127.0.0.1:1/matrix';
  if (!process.env.JWT_PRIVATE_KEY_BASE64) {
    const keys = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    process.env.JWT_PRIVATE_KEY_BASE64 = Buffer.from(keys.privateKey).toString(
      'base64',
    );
    process.env.JWT_PUBLIC_KEY_BASE64 = Buffer.from(keys.publicKey).toString(
      'base64',
    );
  }
  process.env.FIELD_ENCRYPTION_KEY_BASE64 ??=
    randomBytes(32).toString('base64');
  process.env.FIELD_HMAC_KEY_BASE64 ??= randomBytes(32).toString('base64');

  const app = await NestFactory.create<NestExpressApplication>(MatrixModule, {
    logger: false,
    bodyParser: false,
  });
  configureApp(app, loadConfig(process.env));
  await app.init();
  const routes = collectRoutes(app);
  await app.close();

  const problems = accessProblems(routes);
  const markdown = toMarkdown(routes);
  if (problems.length > 0) {
    console.error('Access review rules broken:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
  }
  if (process.argv.includes('--check')) {
    const current = existsSync(TARGET)
      ? readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n')
      : '';
    if (current !== markdown) {
      console.error(
        'docs/access-matrix.md is out of date. Run: npm run access:matrix',
      );
      process.exitCode = 1;
      return;
    }
    if (problems.length === 0) {
      console.log(
        `docs/access-matrix.md is up to date (${routes.length} routes).`,
      );
    }
    return;
  }
  writeFileSync(TARGET, markdown);
  console.log(`Wrote ${TARGET} (${routes.length} routes)`);
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
