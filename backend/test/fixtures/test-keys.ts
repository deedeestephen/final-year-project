import { generateKeyPairSync } from 'node:crypto';

/**
 * Throwaway Ed25519 key pair generated per test run. Never used outside tests
 * and never written to disk.
 */
const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

export const TEST_JWT_ENV = {
  JWT_PRIVATE_KEY_BASE64: Buffer.from(privateKey).toString('base64'),
  JWT_PUBLIC_KEY_BASE64: Buffer.from(publicKey).toString('base64'),
};

/** Minimal valid environment for building an AppConfig in unit tests. */
export const TEST_BASE_ENV = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  MONGO_URL: 'mongodb://u:p@localhost:27018/db',
  ...TEST_JWT_ENV,
};
