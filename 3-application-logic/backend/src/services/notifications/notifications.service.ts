import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../../persistence/database/prisma.service';
import type { AuthenticatedUser } from '../../gateway/access/access.decorators';
import type {
  ListNotificationsQuery,
  MarkedReadResponse,
  NotificationPage,
  NotificationView,
} from './notifications.dto';

/**
 * In-app notifications. Text never contains clinical values, names or
 * identifiers: a notification may later be shown on a phone's lock screen.
 */
export const NOTIFICATION_TEXT = {
  recordAdded: {
    type: 'clinical_record.created',
    title: 'New screening record',
    body: 'A new screening record was added. Open My results to see it.',
  },
  consentGranted: {
    type: 'consent.granted',
    title: 'Consent recorded',
    body: 'A consent was recorded for you. You can see or withdraw it in Profile.',
  },
  consentWithdrawn: {
    type: 'consent.withdrawn',
    title: 'Consent withdrawn',
    body: 'Your consent was withdrawn. You can see the details in Profile.',
  },
  accountLinked: {
    type: 'account.linked',
    title: 'Account linked',
    body: 'Your account is now linked to your clinic record. You can see your results in the app.',
  },
} as const;

type NotificationText =
  (typeof NOTIFICATION_TEXT)[keyof typeof NOTIFICATION_TEXT];

function toView(n: Notification): NotificationView {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Notifies the app account linked to a patient, if there is one. */
  async notifyPatient(
    patientId: string,
    text: NotificationText,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const patient = await tx.patient.findUnique({
      where: { id: patientId },
      select: { userId: true },
    });
    if (!patient?.userId) return;
    await tx.notification.create({
      data: {
        userId: patient.userId,
        type: text.type,
        title: text.title,
        body: text.body,
      },
    });
  }

  /** Notifies a user account directly. */
  async notifyUser(
    userId: string,
    text: NotificationText,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.notification.create({
      data: { userId, type: text.type, title: text.title, body: text.body },
    });
  }

  async list(
    query: ListNotificationsQuery,
    user: AuthenticatedUser,
  ): Promise<NotificationPage> {
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);
    return {
      items: items.map(toView),
      unreadCount,
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Someone else's notification is reported as not found. */
  async markRead(
    id: string,
    user: AuthenticatedUser,
  ): Promise<NotificationView> {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== user.id) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Notification not found',
      });
    }
    if (existing.readAt) return toView(existing);
    return toView(
      await this.prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      }),
    );
  }

  async markAllRead(user: AuthenticatedUser): Promise<MarkedReadResponse> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
