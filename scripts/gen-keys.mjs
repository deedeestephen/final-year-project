#!/usr/bin/env node
// Generates secrets for local development.
//   node scripts/gen-keys.mjs             print a JWT key pair and field-encryption key
//   node scripts/gen-keys.mjs --init-env  create .env from .env.example with every secret randomised
// Never overwrites an existing .env. Output must never be committed.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function jwtKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return {
    JWT_PRIVATE_KEY_BASE64: Buffer.from(privateKey).toString('base64'),
    JWT_PUBLIC_KEY_BASE64: Buffer.from(publicKey).toString('base64'),
  };
}

// Hex keeps secrets URL-safe inside connection strings.
const secret = (bytes = 24) => randomBytes(bytes).toString('hex');

function generated() {
  return {
    ...jwtKeyPair(),
    FIELD_ENCRYPTION_KEY_BASE64: randomBytes(32).toString('base64'),
    FIELD_HMAC_KEY_BASE64: randomBytes(32).toString('base64'),
  };
}

function initEnv() {
  const target = join(root, '.env');
  if (existsSync(target)) {
    console.error('.env already exists; refusing to overwrite it.');
    process.exit(1);
  }
  const passwords = {
    POSTGRES_PASSWORD: secret(),
    MONGO_PASSWORD: secret(),
    REDIS_PASSWORD: secret(),
    MINIO_ROOT_PASSWORD: secret(),
    AI_SERVICE_TOKEN: secret(32),
  };
  const values = { ...passwords, ...generated(), S3_SECRET_KEY: passwords.MINIO_ROOT_PASSWORD };

  let text = readFileSync(join(root, '.env.example'), 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp(`^${key}=.*$`, 'm');
    text = line.test(text) ? text.replace(line, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  }
  text = text
    .replace(/(postgresql:\/\/[^:]+:)change-me@/, `$1${passwords.POSTGRES_PASSWORD}@`)
    .replace(/(mongodb:\/\/[^:]+:)change-me@/, `$1${passwords.MONGO_PASSWORD}@`);

  if (/change-me/.test(text)) {
    console.error('A placeholder was left unreplaced; check .env.example.');
    process.exit(1);
  }
  writeFileSync(target, text, { mode: 0o600 });
  console.log('Created .env with random development secrets (git-ignored).');
}

if (process.argv.includes('--init-env')) {
  initEnv();
} else {
  for (const [key, value] of Object.entries(generated())) console.log(`${key}=${value}`);
}
