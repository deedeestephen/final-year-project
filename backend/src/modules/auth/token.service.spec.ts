import { generateKeyPairSync } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';
import { TEST_BASE_ENV } from '../../../test/fixtures/test-keys';
import { loadConfig } from '../../config/app-config';
import { TokenService } from './token.service';

const config = loadConfig(TEST_BASE_ENV);
const tokens = new TokenService(config);

const b64url = (v: object) =>
  Buffer.from(JSON.stringify(v)).toString('base64url');

describe('TokenService access tokens', () => {
  it('signs an EdDSA JWT and verifies its claims', async () => {
    const token = await tokens.signAccessToken({
      userId: 'u-1',
      familyId: 'f-1',
    });
    const [header] = token.split('.');
    expect(
      JSON.parse(Buffer.from(header, 'base64url').toString()),
    ).toMatchObject({
      alg: 'EdDSA',
      typ: 'JWT',
    });
    await expect(tokens.verifyAccessToken(token)).resolves.toMatchObject({
      userId: 'u-1',
      familyId: 'f-1',
    });
  });

  it('rejects an unsigned (alg: none) token', async () => {
    const forged = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
      sub: 'u-1',
      fid: 'f-1',
      iss: config.auth.issuer,
      aud: config.auth.audience,
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.`;
    await expect(tokens.verifyAccessToken(forged)).rejects.toThrow();
  });

  it('rejects a tampered payload', async () => {
    const token = await tokens.signAccessToken({
      userId: 'u-1',
      familyId: 'f-1',
    });
    const [h, , sig] = token.split('.');
    const tampered = `${h}.${b64url({ sub: 'admin', fid: 'f-1' })}.${sig}`;
    await expect(tokens.verifyAccessToken(tampered)).rejects.toThrow();
  });

  it('rejects a token signed with another key', async () => {
    const other = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const foreign = await new SignJWT({ fid: 'f-1' })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setSubject('u-1')
      .setIssuer(config.auth.issuer)
      .setAudience(config.auth.audience)
      .setExpirationTime('10m')
      .sign(await importPKCS8(other.privateKey, 'EdDSA'));
    await expect(tokens.verifyAccessToken(foreign)).rejects.toThrow();
  });

  it.each([
    ['wrong issuer', { iss: 'someone-else' }],
    ['wrong audience', { aud: 'another-app' }],
    ['expired', { exp: Math.floor(Date.now() / 1000) - 120 }],
    ['missing family id', { fid: undefined }],
  ])('rejects a token with %s', async (_label, override) => {
    const key = await importPKCS8(config.auth.jwtPrivateKeyPem, 'EdDSA');
    const claims = {
      fid: 'f-1',
      iss: config.auth.issuer,
      aud: config.auth.audience,
      exp: Math.floor(Date.now() / 1000) + 600,
      ...override,
    };
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setSubject('u-1')
      .setIssuedAt()
      .sign(key);
    await expect(tokens.verifyAccessToken(token)).rejects.toThrow();
  });

  it('rejects garbage', async () => {
    await expect(tokens.verifyAccessToken('not.a.jwt')).rejects.toThrow();
    await expect(tokens.verifyAccessToken('')).rejects.toThrow();
  });
});

describe('TokenService refresh tokens', () => {
  it('creates a random opaque token and stores only its SHA-256 hash', () => {
    const a = tokens.newRefreshToken();
    const b = tokens.newRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).not.toContain(a.token);
    expect(tokens.hashOpaqueToken(a.token)).toBe(a.hash);
  });

  it('computes refresh expiry from configuration', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(tokens.refreshExpiry(now).toISOString()).toBe(
      '2026-01-15T00:00:00.000Z',
    );
  });
});
