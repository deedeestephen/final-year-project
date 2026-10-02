import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import { PrismaService } from '../../../persistence/database/prisma.service';
import { PUSH_SENDER, type PushSender } from './fcm.client';

/** Notifications taken per run. */
const BATCH = 100;

interface Claimed {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
}

export interface PushRun {
  /** Notifications taken in this run. */
  notifications: number;
  sent: number;
  failed: number;
  /** Phones forgotten because Firebase no longer knows their token. */
  removedDevices: number;
}

/**
 * Sends a push for each new in-app notification (ADR-014), as an outbox:
 * it reads the notifications table every few seconds instead of being called
 * where notifications are made. Those calls run inside database transactions,
 * and only committed rows are visible here, so a change that is rolled back
 * is never announced. Each notification is claimed in one statement (two API
 * instances never push the same one) and pushed at most once: a failed push
 * is not repeated, and the notification stays in the app's list.
 */
@Injectable()
export class PushOutbox implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Push');
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<PushRun> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.sender.enabled) return;
    this.timer = setInterval(() => void this.tick(), this.config.push.pollMs);
    this.timer.unref();
    this.logger.log(
      `Push notifications are on (Firebase project ${this.sender.project})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.running?.catch(() => undefined);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.warn(`Push run failed: ${(err as Error).message}`);
    }
  }

  /** One run: pushes the recent notifications not pushed yet. */
  runOnce(): Promise<PushRun> {
    this.running ??= this.run().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async run(): Promise<PushRun> {
    const result: PushRun = {
      notifications: 0,
      sent: 0,
      failed: 0,
      removedDevices: 0,
    };
    if (!this.sender.enabled) return result;
    const claimed = await this.prisma.$queryRaw<Claimed[]>`
      UPDATE notifications SET pushed_at = now()
      WHERE id IN (
        SELECT id FROM notifications
        WHERE pushed_at IS NULL
          AND created_at > now() - make_interval(mins => ${this.config.push.maxAgeMinutes}::int)
        ORDER BY created_at
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED)
      RETURNING id, user_id AS "userId", type, title, body`;
    result.notifications = claimed.length;
    if (claimed.length === 0) return result;

    // Disabled accounts get nothing; a locked one (wrong passwords) still does.
    const devices = await this.prisma.pushDevice.findMany({
      where: {
        userId: { in: [...new Set(claimed.map((n) => n.userId))] },
        user: { status: { not: 'DISABLED' } },
      },
      select: { id: true, userId: true, token: true },
    });
    const invalid = new Set<string>();
    for (const notification of claimed) {
      for (const device of devices) {
        if (device.userId !== notification.userId || invalid.has(device.id)) {
          continue;
        }
        const outcome = await this.sender.send({
          token: device.token,
          title: notification.title,
          body: notification.body,
          data: { notificationId: notification.id, type: notification.type },
        });
        if (outcome === 'sent') {
          result.sent++;
        } else {
          result.failed++;
          if (outcome === 'invalid-token') invalid.add(device.id);
        }
      }
    }
    if (invalid.size > 0) {
      const { count } = await this.prisma.pushDevice.deleteMany({
        where: { id: { in: [...invalid] } },
      });
      result.removedDevices = count;
    }
    if (result.failed > 0) {
      this.logger.warn(
        `Push: ${result.sent} sent, ${result.failed} not sent; ${result.removedDevices} phones no longer known to Firebase were removed`,
      );
    }
    return result;
  }
}
