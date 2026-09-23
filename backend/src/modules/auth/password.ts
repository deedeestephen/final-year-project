import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Argon2id, 64 MiB, 3 passes (OWASP-recommended range). Also used by the seed. */
export const ARGON2_OPTIONS: argon2.HashOptions & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

// Small denylist of the most common passwords (lower-cased). Length already
// excludes most of the classic lists; these are the long ones people still use.
const COMMON = new Set([
  'password1234',
  'password12345',
  'password123456',
  '123456789012',
  '1234567890123',
  'qwertyuiop123',
  'qwerty123456',
  'iloveyou1234',
  'welcome12345',
  'letmein12345',
  'administrator',
  'admin1234567',
  'changeme1234',
  'passw0rd1234',
  'p@ssw0rd1234',
  'zambia123456',
  'lusaka123456',
  'football1234',
  'monkey123456',
  'sunshine1234',
]);

/**
 * Returns the list of policy violations (empty when acceptable).
 * Length-based policy per NIST SP 800-63B: no forced character classes.
 */
export function checkPasswordPolicy(password: string, email: string): string[] {
  const problems: string[] = [];
  if (password.length < MIN_LENGTH)
    problems.push(`must be at least ${MIN_LENGTH} characters`);
  if (password.length > MAX_LENGTH)
    problems.push(`must be at most ${MAX_LENGTH} characters`);
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password))
    problems.push('is too common');
  if (new Set(password).size < 4)
    problems.push('needs more variety of characters');
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 4 && lower.includes(local))
    problems.push('must not contain your email name');
  return problems;
}

@Injectable()
export class PasswordHasher {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Runs a verification of similar cost when the account does not exist, so
   * response time does not reveal which emails are registered.
   */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-only');
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
