import { clientOf } from '../../gateway/access/access.decorators';
import type { PrismaService } from '../../persistence/database/prisma.service';
import { ActivityService, daysBetween, lusakaDate } from './activity.service';
import type { AuditService } from './audit.service';

const admin = { id: 'u-admin', roles: ['ADMIN'] } as never;
const ctx = { requestId: 'r-1', ip: '127.0.0.1', client: 'web' as const };

/**
 * Answers the service's queries in the order it asks them: the nine
 * aggregates (run together), then the recent phone actions.
 */
function service(
  answers: unknown[][],
  emails: { id: string; email: string }[] = [],
) {
  const queue = [...answers];
  const prisma = {
    $queryRaw: jest.fn(() => Promise.resolve(queue.shift() ?? [])),
    user: { findMany: jest.fn(() => Promise.resolve(emails)) },
  };
  const audit = { record: jest.fn(() => Promise.resolve()) };
  return {
    svc: new ActivityService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    ),
    prisma,
    audit,
  };
}

describe('Zambian calendar days', () => {
  it('moves late UTC evenings to the next day', () => {
    expect(lusakaDate(new Date('2026-09-27T21:59:00Z'))).toBe('2026-09-27');
    expect(lusakaDate(new Date('2026-09-27T22:00:00Z'))).toBe('2026-09-28');
  });

  it('lists every day of the period once, both ends included', () => {
    expect(
      daysBetween(
        new Date('2026-09-26T10:00:00Z'),
        new Date('2026-09-28T10:00:00Z'),
      ),
    ).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
    const now = new Date('2026-09-28T10:00:00Z');
    expect(daysBetween(now, now)).toEqual(['2026-09-28']);
  });
});

describe('clientOf', () => {
  it('accepts only the two app names', () => {
    expect(clientOf('mobile')).toBe('mobile');
    expect(clientOf(' Web ')).toBe('web');
    expect(clientOf('curl')).toBeNull();
    expect(clientOf(['mobile'])).toBeNull();
    expect(clientOf(undefined)).toBeNull();
  });
});

describe('ActivityService', () => {
  it('answers an empty period with zeros and no lookups', async () => {
    const { svc, prisma, audit } = service([]);
    const view = await svc.activity(1, admin, ctx);
    expect(view.totals).toEqual({
      activeUsers: 0,
      activePhoneUsers: 0,
      activePhones: 0,
      signIns: 0,
      failedSignIns: 0,
      patientsRegistered: 0,
      screeningRecords: 0,
      uploads: 0,
      aiRequested: 0,
      aiCompleted: 0,
      consentsGranted: 0,
      consentsWithdrawn: 0,
      accessDenied: 0,
    });
    expect(view.daily.length).toBeGreaterThanOrEqual(2);
    expect(view.daily.every((d) => d.signIns === 0)).toBe(true);
    expect(view.byClient).toEqual([
      { name: 'mobile', count: 0 },
      { name: 'web', count: 0 },
      { name: 'other', count: 0 },
    ]);
    expect(view.sync).toEqual({ applied: 0, conflicts: 0, rejected: 0 });
    expect(view.recentPhone).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'activity.read',
        details: { days: 1 },
        client: 'web',
      }),
    );
  });

  it('adds up the rows and ignores what does not belong', async () => {
    const today = lusakaDate(new Date());
    const { svc } = service(
      [
        // actions
        [
          { key: 'auth.login', outcome: 'SUCCESS', n: 5 },
          { key: 'auth.login', outcome: 'FAILURE', n: 2 },
          { key: 'auth.login', outcome: 'DENIED', n: 1 },
          { key: 'imaging.uploaded', outcome: 'SUCCESS', n: 3 },
          { key: 'histopathology.uploaded', outcome: 'SUCCESS', n: 1 },
          { key: 'access.denied', outcome: 'DENIED', n: 4 },
        ],
        // daily: one known, one unknown action, one day outside the period
        [
          { day: today, key: 'auth.login', n: 5 },
          { day: today, key: 'patient.read', n: 9 },
          { day: '1999-01-01', key: 'auth.login', n: 7 },
        ],
        // clients
        [
          { key: 'web', n: 2 },
          { key: 'mobile', n: 8 },
        ],
        // roles, out of order
        [
          { key: 'ADMIN', n: 1 },
          { key: 'CLINICIAN', n: 4 },
        ],
        [{ n: 3 }], // active
        [{ n: 2 }], // phone active
        // sync results
        [
          { key: 'APPLIED', n: 10 },
          { key: 'CONFLICT', n: 2 },
          { key: 'REJECTED', n: 1 },
        ],
        // sync per day, including one outside the period
        [
          { day: today, n: 13 },
          { day: '1999-01-01', n: 99 },
        ],
        [{ n: 2 }], // devices
        // recent phone actions: a known, an unknown and no actor
        [
          {
            seq: 12n,
            occurred_at: new Date('2026-09-28T10:00:00Z'),
            action: 'clinical_record.created',
            outcome: 'SUCCESS',
            actor_user_id: 'u-1',
            actor_role: 'CLINICIAN',
          },
          {
            seq: 11n,
            occurred_at: new Date('2026-09-28T09:00:00Z'),
            action: 'auth.login',
            outcome: 'SUCCESS',
            actor_user_id: 'u-gone',
            actor_role: 'CLINICIAN',
          },
          {
            seq: 10n,
            occurred_at: new Date('2026-09-28T08:00:00Z'),
            action: 'access.denied',
            outcome: 'DENIED',
            actor_user_id: null,
            actor_role: null,
          },
        ],
      ],
      [{ id: 'u-1', email: 'clinician@example.test' }],
    );

    const view = await svc.activity(7, admin, ctx);
    expect(view.totals).toMatchObject({
      activeUsers: 3,
      activePhoneUsers: 2,
      activePhones: 2,
      signIns: 5,
      failedSignIns: 3,
      uploads: 4,
      accessDenied: 4,
    });
    const last = view.daily.at(-1)!;
    expect(last).toMatchObject({ date: today, signIns: 5, syncedChanges: 13 });
    expect(view.daily.some((d) => d.date === '1999-01-01')).toBe(false);
    expect(view.byClient).toEqual([
      { name: 'mobile', count: 8 },
      { name: 'web', count: 2 },
      { name: 'other', count: 0 },
    ]);
    expect(view.signInsByRole.map((r) => r.name)).toEqual([
      'CLINICIAN',
      'ADMIN',
    ]);
    expect(view.sync).toEqual({ applied: 10, conflicts: 2, rejected: 1 });
    expect(view.recentPhone.map((e) => [e.seq, e.actorEmail])).toEqual([
      ['12', 'clinician@example.test'],
      ['11', null],
      ['10', null],
    ]);
  });
});
