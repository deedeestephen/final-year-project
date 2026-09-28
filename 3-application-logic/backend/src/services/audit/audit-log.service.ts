import { Injectable } from '@nestjs/common';
import type { AuditLog, Prisma } from '@prisma/client';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import { PrismaService } from '../../persistence/database/prisma.service';
import type {
  AuditChainView,
  AuditEntryView,
  AuditLogPage,
  ListAuditLogsQuery,
} from './audit-log.dto';
import { AuditService } from './audit.service';

/**
 * Read side of the audit log for administrators (UC-09, FR-10): filtered,
 * paged reading, and a check of the hash chain. Reading the log is itself
 * audited. The log stays append-only: nothing here can change it.
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListAuditLogsQuery,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<AuditLogPage> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.outcome ? { outcome: query.outcome } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { seq: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actorIds = [
      ...new Set(
        rows.map((r) => r.actorUserId).filter((x): x is string => !!x),
      ),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true },
        })
      : [];
    const emails = new Map(actors.map((a) => [a.id, a.email]));

    await this.audit.record({
      action: 'audit.read',
      entityType: 'audit_log',
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: {
        filters: {
          action: query.action ?? null,
          outcome: query.outcome ?? null,
          actorUserId: query.actorUserId ?? null,
          from: query.from ?? null,
          to: query.to ?? null,
        },
        page: query.page,
        returned: rows.length,
      },
      ...ctx,
    });
    return {
      items: rows.map((r) => toEntryView(r, emails)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Walks the whole chain in the database (audit_logs_verify_chain). */
  async verify(
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<AuditChainView> {
    const [broken, entries] = await Promise.all([
      this.prisma.$queryRaw<{ broken_seq: bigint; reason: string }[]>`
        SELECT broken_seq, reason FROM audit_logs_verify_chain()`,
      this.prisma.auditLog.count(),
    ]);
    const first = broken[0];
    const view: AuditChainView = {
      intact: !first,
      entries,
      brokenAt: first ? first.broken_seq.toString() : null,
      reason: first?.reason ?? null,
      checkedAt: new Date().toISOString(),
    };
    await this.audit.record({
      action: 'audit.verified',
      entityType: 'audit_log',
      outcome: view.intact ? 'SUCCESS' : 'FAILURE',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: { intact: view.intact, entries, brokenAt: view.brokenAt },
      ...ctx,
    });
    return view;
  }
}

function toEntryView(r: AuditLog, emails: Map<string, string>): AuditEntryView {
  return {
    seq: r.seq.toString(),
    occurredAt: r.occurredAt.toISOString(),
    actorUserId: r.actorUserId,
    actorEmail: r.actorUserId ? (emails.get(r.actorUserId) ?? null) : null,
    actorRole: r.actorRole,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    outcome: r.outcome,
    requestId: r.requestId,
    ip: r.ip,
    details:
      r.details && typeof r.details === 'object' && !Array.isArray(r.details)
        ? r.details
        : null,
  };
}
