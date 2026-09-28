import { Injectable } from '@nestjs/common';
import { Prisma, type AuditOutcome } from '@prisma/client';
import { PrismaService } from '../../persistence/database/prisma.service';

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string | null;
  outcome: AuditOutcome;
  actorUserId?: string | null;
  actorRole?: string | null;
  requestId?: string | null;
  ip?: string | null;
  /** Which app sent the request ('mobile' or 'web'); kept in the details. */
  client?: 'mobile' | 'web' | null;
  /** Must not contain passwords, tokens or direct patient identifiers. */
  details?: Record<string, unknown>;
}

/**
 * Writes to the append-only, hash-chained audit log (FR-10). Failures are
 * propagated (fail closed): a security-relevant action is not completed if
 * it cannot be recorded.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    event: AuditEvent,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    // The app is part of the hashed details, so the activity report can tell
    // phone activity from the admin website without a schema change.
    const details = event.client
      ? { ...(event.details ?? {}), client: event.client }
      : event.details;
    await tx.auditLog.create({
      data: {
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        outcome: event.outcome,
        actorUserId: event.actorUserId ?? null,
        actorRole: event.actorRole ?? null,
        requestId: event.requestId ?? null,
        ip: event.ip ?? null,
        details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
