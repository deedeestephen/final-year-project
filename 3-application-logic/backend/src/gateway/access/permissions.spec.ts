import { PERMISSIONS, ROLES, ROLE_PERMISSIONS } from './permissions';

describe('RBAC catalogue', () => {
  it('defines permissions for every role, with no duplicates', () => {
    for (const role of ROLES) {
      const perms = ROLE_PERMISSIONS[role];
      expect(perms.length).toBeGreaterThan(0);
      expect(new Set(perms).size).toBe(perms.length);
      for (const p of perms) expect(PERMISSIONS).toHaveProperty(p);
    }
  });

  it('keeps patients away from clinical and administrative actions', () => {
    const patient = ROLE_PERMISSIONS.PATIENT;
    expect(patient).not.toContain('patient:read');
    expect(patient).not.toContain('clinical:read');
    expect(patient).not.toContain('ai:request');
    expect(patient).not.toContain('user:manage');
    expect(patient).not.toContain('audit:read');
  });

  it('does not give administrators routine access to clinical data (data minimisation)', () => {
    const admin = ROLE_PERMISSIONS.ADMIN;
    for (const p of [
      'patient:read',
      'clinical:read',
      'imaging:read',
      'ai:read',
    ] as const) {
      expect(admin).not.toContain(p);
    }
  });

  it('only lets pathologists record a pathology grading', () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role].includes('histopathology:review')).toBe(
        role === 'PATHOLOGIST',
      );
    }
  });

  it('assigns every defined permission to at least one role', () => {
    const used = new Set(ROLES.flatMap((r) => ROLE_PERMISSIONS[r]));
    expect([...used].sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });
});
