import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../persistence/database/prisma.service';
import type { AuthenticatedUser } from '../../../gateway/access/access.decorators';
import type { PushDeviceView, RegisterDeviceDto } from '../notifications.dto';

/** An account keeps at most this many phones; the longest unseen ones go first. */
export const MAX_DEVICES_PER_USER = 10;

/** The phones that receive the caller's push notifications (ADR-014). */
@Injectable()
export class PushDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registers this phone for the caller's pushes. A token that is already
   * known (the same phone, perhaps signed in to another account before)
   * moves to the caller, so a phone never receives two accounts' pushes.
   */
  async register(
    dto: RegisterDeviceDto,
    user: AuthenticatedUser,
  ): Promise<PushDeviceView> {
    const device = await this.prisma.pushDevice.upsert({
      where: { token: dto.token },
      create: { userId: user.id, token: dto.token, platform: dto.platform },
      update: {
        userId: user.id,
        platform: dto.platform,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });
    const extra = await this.prisma.pushDevice.findMany({
      where: { userId: user.id },
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
      skip: MAX_DEVICES_PER_USER,
      select: { id: true },
    });
    if (extra.length > 0) {
      await this.prisma.pushDevice.deleteMany({
        where: { id: { in: extra.map((d) => d.id) } },
      });
    }
    return { id: device.id };
  }

  /** Stops pushes to one of the caller's phones; others' are not found. */
  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const { count } = await this.prisma.pushDevice.deleteMany({
      where: { id, userId: user.id },
    });
    if (count === 0) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Device not found',
      });
    }
  }
}
