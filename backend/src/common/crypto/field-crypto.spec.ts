import { randomBytes } from 'node:crypto';
import { FieldCrypto, normalizeNationalId } from './field-crypto';

describe('FieldCrypto', () => {
  const crypto = new FieldCrypto(randomBytes(32), randomBytes(32));

  it('round-trips text through AES-256-GCM', () => {
    const sealed = crypto.encrypt('Mwamba Banda');
    expect(sealed).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(sealed).toString('utf8')).not.toContain('Mwamba');
    expect(crypto.decrypt(sealed)).toBe('Mwamba Banda');
  });

  it('uses a fresh IV so equal plaintexts produce different ciphertexts', () => {
    expect(
      Buffer.from(crypto.encrypt('same')).equals(crypto.encrypt('same')),
    ).toBe(false);
  });

  it('rejects tampered ciphertext', () => {
    const sealed = crypto.encrypt('secret');
    sealed[sealed.length - 1] ^= 0x01;
    expect(() => crypto.decrypt(sealed)).toThrow();
  });

  it('rejects ciphertext from a different key', () => {
    const other = new FieldCrypto(randomBytes(32), randomBytes(32));
    expect(() => other.decrypt(crypto.encrypt('secret'))).toThrow();
  });

  it('rejects an unknown format version', () => {
    const sealed = crypto.encrypt('secret');
    sealed[0] = 0x7f;
    expect(() => crypto.decrypt(sealed)).toThrow(/version/);
  });

  it('produces a stable keyed hash for lookups', () => {
    expect(crypto.hmac('123456/78/1')).toBe(crypto.hmac('123456/78/1'));
    expect(crypto.hmac('123456/78/1')).toMatch(/^[0-9a-f]{64}$/);
    const other = new FieldCrypto(randomBytes(32), randomBytes(32));
    expect(other.hmac('123456/78/1')).not.toBe(crypto.hmac('123456/78/1'));
  });

  it('requires 32-byte keys', () => {
    expect(() => new FieldCrypto(randomBytes(16), randomBytes(32))).toThrow(
      /32 bytes/,
    );
    expect(() => new FieldCrypto(randomBytes(32), randomBytes(8))).toThrow(
      /32 bytes/,
    );
  });

  it('loads keys from base64 environment variables', () => {
    const env = {
      FIELD_ENCRYPTION_KEY_BASE64: randomBytes(32).toString('base64'),
      FIELD_HMAC_KEY_BASE64: randomBytes(32).toString('base64'),
    };
    const fromEnv = FieldCrypto.fromEnv(env);
    expect(fromEnv.decrypt(fromEnv.encrypt('x'))).toBe('x');
    expect(() => FieldCrypto.fromEnv({})).toThrow(
      /FIELD_ENCRYPTION_KEY_BASE64/,
    );
  });
});

describe('normalizeNationalId', () => {
  it('removes whitespace and upper-cases so equivalent entries match', () => {
    expect(normalizeNationalId(' 123456 / 78 / 1 ')).toBe('123456/78/1');
    expect(normalizeNationalId('ab12')).toBe('AB12');
  });
});
