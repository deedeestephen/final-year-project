import { checkPasswordPolicy, PasswordHasher } from './password';

describe('checkPasswordPolicy', () => {
  it('accepts a long passphrase', () => {
    expect(checkPasswordPolicy('river-mango-lantern-42', 'a@b.test')).toEqual(
      [],
    );
  });

  it.each([
    ['too short', 'Short1!', /at least 12/],
    ['too long', 'x'.repeat(129), /at most 128/],
    ['a common password', 'password1234', /too common/],
    ['a common password in another case', 'Password1234', /too common/],
    ['the email name', 'mwamba.banda-2026', /email/],
    ['only one repeated character', 'aaaaaaaaaaaaaa', /too common|variety/],
  ])('rejects %s', (_label, password, message) => {
    const problems = checkPasswordPolicy(password, 'mwamba.banda@example.test');
    expect(problems.join(' ')).toMatch(message);
  });
});

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes with Argon2id and verifies', async () => {
    const hash = await hasher.hash('river-mango-lantern-42');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('river-mango');
    await expect(hasher.verify(hash, 'river-mango-lantern-42')).resolves.toBe(
      true,
    );
    await expect(hasher.verify(hash, 'wrong-password-here')).resolves.toBe(
      false,
    );
  });

  it('uses a fresh salt for every hash', async () => {
    expect(await hasher.hash('same-password-123')).not.toBe(
      await hasher.hash('same-password-123'),
    );
  });

  it('treats a malformed stored hash as a failed verification, not a crash', async () => {
    await expect(hasher.verify('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('performs a comparable dummy verification for unknown users (timing)', async () => {
    await expect(hasher.verifyDummy('anything')).resolves.toBe(false);
  });
});
