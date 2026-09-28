import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import { PrismaService } from '../../persistence/database/prisma.service';
import type {
  ActivityDayView,
  ActivityEventView,
  ActivityTotalsView,
  ActivityView,
} from './activity.dto';
import { AuditService } from './audit.service';

/** Days are counted in Zambian time (UTC+2, no daylight saving). */
export const ACTIVITY_TIME_ZONE = 'Africa/Lusaka';

/** The date (YYYY-MM-DD) of an instant in Zambian time. */
export function lusakaDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ACTIVITY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Every date from `from` to `to` (Zambian time), inclusive. */
export function daysBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  for (let t = from.getTime(); ; t += 86_400_000) {
    const d = lusakaDate(new Date(t));
    if (out.at(-1) !== d) out.push(d);
    if (d === lusakaDate(to) || t > to.getTime()) break;
  }
  return out;
}

interface CountRow {
  key: string;
  outcome: string;
  n: number;
}
interface DayRow {
  day: string;
  key: string;
  n: number;
}

/**
 * The admin dashboard of what happens in the apps (read-only aggregates of
 * the audit log and the sync log). No clinical values and no patient names:
 * only counts, actions, and the staff account that acted.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async activity(
    days: number,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ActivityView> {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);

    const [
      actions,
      daily,
      clients,
      roles,
      active,
      phoneActive,
      syncRows,
      syncDaily,
      devices,
    ] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>`
          SELECT action AS key, outcome::text AS outcome, count(*)::int AS n
          FROM audit_logs WHERE occurred_at >= ${from}
          GROUP BY 1, 2`,
      this.prisma.$queryRaw<DayRow[]>`
          SELECT to_char(occurred_at AT TIME ZONE ${ACTIVITY_TIME_ZONE}, 'YYYY-MM-DD') AS day,
                 action AS key, count(*)::int AS n
          FROM audit_logs
          WHERE occurred_at >= ${from} AND outcome = 'SUCCESS'
            AND action IN ('auth.login', 'clinical_record.created', 'ai_job.requested')
          GROUP BY 1, 2`,
      this.prisma.$queryRaw<{ key: string; n: number }[]>`
          SELECT coalesce(details->>'client', 'other') AS key, count(*)::int AS n
          FROM audit_logs
          WHERE occurred_at >= ${from} AND actor_user_id IS NOT NULL
          GROUP BY 1`,
      this.prisma.$queryRaw<{ key: string; n: number }[]>`
          SELECT coalesce(actor_role, 'UNKNOWN') AS key, count(*)::int AS n
          FROM audit_logs
          WHERE occurred_at >= ${from} AND action = 'auth.login' AND outcome = 'SUCCESS'
          GROUP BY 1`,
      this.prisma.$queryRaw<{ n: number }[]>`
          SELECT count(DISTINCT actor_user_id)::int AS n FROM audit_logs
          WHERE occurred_at >= ${from} AND outcome = 'SUCCESS'`,
      this.prisma.$queryRaw<{ n: number }[]>`
          SELECT count(DISTINCT u)::int AS n FROM (
            SELECT actor_user_id AS u FROM audit_logs
            WHERE occurred_at >= ${from} AND details->>'client' = 'mobile'
              AND actor_user_id IS NOT NULL
            UNION
            SELECT user_id AS u FROM sync_operations WHERE received_at >= ${from}
          ) phone_users`,
      this.prisma.$queryRaw<{ key: string; n: number }[]>`
          SELECT result::text AS key, count(*)::int AS n FROM sync_operations
          WHERE received_at >= ${from} GROUP BY 1`,
      this.prisma.$queryRaw<{ day: string; n: number }[]>`
          SELECT to_char(received_at AT TIME ZONE ${ACTIVITY_TIME_ZONE}, 'YYYY-MM-DD') AS day,
                 count(*)::int AS n
          FROM sync_operations WHERE received_at >= ${from} GROUP BY 1`,
      this.prisma.$queryRaw<{ n: number }[]>`
          SELECT count(DISTINCT device_id)::int AS n FROM sync_operations
          WHERE received_at >= ${from}`,
    ]);

    const count = (action: string, outcome = 'SUCCESS') =>
      actions
        .filter((r) => r.key === action && r.outcome === outcome)
        .reduce((s, r) => s + r.n, 0);
    const totals: ActivityTotalsView = {
      activeUsers: active[0]?.n ?? 0,
      activePhoneUsers: phoneActive[0]?.n ?? 0,
      activePhones: devices[0]?.n ?? 0,
      signIns: count('auth.login'),
      failedSignIns:
        count('auth.login', 'FAILURE') + count('auth.login', 'DENIED'),
      patientsRegistered: count('patient.created'),
      screeningRecords: count('clinical_record.created'),
      uploads: count('imaging.uploaded') + count('histopathology.uploaded'),
      aiRequested: count('ai_job.requested'),
      aiCompleted: count('ai_job.completed'),
      consentsGranted: count('consent.granted'),
      consentsWithdrawn: count('consent.withdrawn'),
      accessDenied: actions
        .filter((r) => r.key === 'access.denied')
        .reduce((s, r) => s + r.n, 0),
    };

    const byDay = new Map<string, ActivityDayView>(
      daysBetween(from, to).map((date) => [
        date,
        {
          date,
          signIns: 0,
          screeningRecords: 0,
          syncedChanges: 0,
          aiRequested: 0,
        },
      ]),
    );
    const field = {
      'auth.login': 'signIns',
      'clinical_record.created': 'screeningRecords',
      'ai_job.requested': 'aiRequested',
    } as const;
    for (const r of daily) {
      const day = byDay.get(r.day);
      const f = field[r.key as keyof typeof field];
      if (day && f) day[f] += r.n;
    }
    for (const r of syncDaily) {
      const day = byDay.get(r.day);
      if (day) day.syncedChanges += r.n;
    }

    const sync = { applied: 0, conflicts: 0, rejected: 0 };
    for (const r of syncRows) {
      if (r.key === 'APPLIED') sync.applied += r.n;
      else if (r.key === 'CONFLICT') sync.conflicts += r.n;
      else sync.rejected += r.n;
    }

    const clientOrder = ['mobile', 'web', 'other'];
    const byClient = clientOrder.map((name) => ({
      name,
      count: clients.find((c) => c.key === name)?.n ?? 0,
    }));

    await this.audit.record({
      action: 'activity.read',
      entityType: 'audit_log',
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: { days },
      ...ctx,
    });

    return {
      days,
      from: from.toISOString(),
      to: to.toISOString(),
      totals,
      daily: [...byDay.values()],
      byClient,
      signInsByRole: roles
        .map((r) => ({ name: r.key, count: r.n }))
        .sort((a, b) => b.count - a.count),
      sync,
      recentPhone: await this.recentPhone(),
    };
  }

  private async recentPhone(): Promise<ActivityEventView[]> {
    const rows = await this.prisma.$queryRaw<
      {
        seq: bigint;
        occurred_at: Date;
        action: string;
        outcome: string;
        actor_user_id: string | null;
        actor_role: string | null;
      }[]
    >`
      SELECT seq, occurred_at, action, outcome::text AS outcome, actor_user_id, actor_role
      FROM audit_logs WHERE details->>'client' = 'mobile'
      ORDER BY seq DESC LIMIT 15`;
    const ids = [
      ...new Set(
        rows.map((r) => r.actor_user_id).filter((x): x is string => !!x),
      ),
    ];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, email: true },
        })
      : [];
    const emails = new Map(users.map((u) => [u.id, u.email]));
    return rows.map((r) => ({
      seq: r.seq.toString(),
      occurredAt: r.occurred_at.toISOString(),
      action: r.action,
      outcome: r.outcome,
      actorEmail: r.actor_user_id
        ? (emails.get(r.actor_user_id) ?? null)
        : null,
      actorRole: r.actor_role,
    }));
  }
}
