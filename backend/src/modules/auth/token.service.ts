import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  SignJWT,
  importPKCS8,
  importSPKI,
  jwtVerify,
  type KeyLike,
} from 'jose';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

export interface AccessTokenClaims {
  userId: string;
  /** Refresh-token family (login session) this access token belongs to. */
  familyId: string;
}

const ALGORITHM = 'EdDSA';

/**
 * Access tokens: short-lived EdDSA (Ed25519) JWTs. The algorithm is pinned on
 * verification, so `alg: none` and algorithm-confusion tokens are rejected.
 * Refresh tokens: 256-bit random opaque strings; only their SHA-256 is stored.
 */
@Injectable()
export class TokenService {
  private privateKey?: Promise<KeyLike>;
  private publicKey?: Promise<KeyLike>;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    this.privateKey ??= importPKCS8(
      this.config.auth.jwtPrivateKeyPem,
      ALGORITHM,
    );
    return new SignJWT({ fid: claims.familyId })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(this.config.auth.issuer)
      .setAudience(this.config.auth.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.config.auth.accessTokenTtlSec}s`)
      .sign(await this.privateKey);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    this.publicKey ??= importSPKI(this.config.auth.jwtPublicKeyPem, ALGORITHM);
    const { payload } = await jwtVerify(token, await this.publicKey, {
      algorithms: [ALGORITHM],
      issuer: this.config.auth.issuer,
      audience: this.config.auth.audience,
      requiredClaims: ['sub', 'exp', 'iat'],
      typ: 'JWT',
    });
    if (typeof payload.sub !== 'string' || typeof payload.fid !== 'string') {
      throw new Error('Access token is missing required claims');
    }
    return { userId: payload.sub, familyId: payload.fid };
  }

  get accessTokenTtlSec(): number {
    return this.config.auth.accessTokenTtlSec;
  }

  newRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashOpaqueToken(token) };
  }

  /** SHA-256 is appropriate here: tokens are 256-bit random, not guessable passwords. */
  hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  refreshExpiry(now = new Date()): Date {
    return new Date(
      now.getTime() + this.config.auth.refreshTokenTtlDays * 86_400_000,
    );
  }
}
