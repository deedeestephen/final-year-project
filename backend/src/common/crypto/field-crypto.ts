import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

const FORMAT_VERSION = 0x01;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Column-level encryption for direct identifiers (NFR-01, proposal §3.7.2).
 *
 * Layout of a sealed value: [version (1)] [iv (12)] [auth tag (16)] [ciphertext].
 * AES-256-GCM authenticates the data, so tampering or a wrong key fails loudly.
 * `hmac` gives a keyed, deterministic hash for exact-match lookups (for example
 * a national ID) without storing the value in clear.
 */
export class FieldCrypto {
  constructor(
    private readonly encryptionKey: Buffer,
    private readonly hmacKey: Buffer,
  ) {
    if (encryptionKey.length !== KEY_LENGTH || hmacKey.length !== KEY_LENGTH) {
      throw new Error('Field encryption and HMAC keys must each be 32 bytes');
    }
  }

  static fromEnv(env: Record<string, string | undefined>): FieldCrypto {
    const enc = env.FIELD_ENCRYPTION_KEY_BASE64;
    const mac = env.FIELD_HMAC_KEY_BASE64;
    if (!enc) throw new Error('FIELD_ENCRYPTION_KEY_BASE64 is not set');
    if (!mac) throw new Error('FIELD_HMAC_KEY_BASE64 is not set');
    return new FieldCrypto(
      Buffer.from(enc, 'base64'),
      Buffer.from(mac, 'base64'),
    );
  }

  /** Returns a standalone Uint8Array, the type Prisma uses for `Bytes` columns. */
  encrypt(plaintext: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const body = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return new Uint8Array(
      Buffer.concat([Buffer.of(FORMAT_VERSION), iv, cipher.getAuthTag(), body]),
    );
  }

  decrypt(value: Uint8Array): string {
    const sealed = Buffer.from(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    );
    if (
      sealed.length < 1 + IV_LENGTH + TAG_LENGTH ||
      sealed[0] !== FORMAT_VERSION
    ) {
      throw new Error('Unsupported encrypted field version or truncated value');
    }
    const iv = sealed.subarray(1, 1 + IV_LENGTH);
    const tag = sealed.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
    const body = sealed.subarray(1 + IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString(
      'utf8',
    );
  }

  hmac(value: string): string {
    return createHmac('sha256', this.hmacKey)
      .update(value, 'utf8')
      .digest('hex');
  }
}

/** Canonical form of a national ID before hashing, so formatting differences still match. */
export function normalizeNationalId(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}
