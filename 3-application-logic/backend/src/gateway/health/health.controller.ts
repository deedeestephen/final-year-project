import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../access/access.decorators';
import { MongoService } from '../../persistence/database/mongo.service';
import { PrismaService } from '../../persistence/database/prisma.service';
import { AiBrokerService } from '../../services/ai/ai-broker.service';

export interface HealthStatus {
  status: 'ok';
  service: 'pca-mhealth-backend';
  timestamp: string;
}

export type DependencyState = 'up' | 'down';

export interface ReadinessStatus {
  status: 'ok' | 'unavailable';
  checks: {
    postgres: DependencyState;
    mongodb: DependencyState;
    /** Informational: without the AI service only AI analysis is unavailable. */
    ai: DependencyState | 'disabled';
  };
}

export const READINESS_TIMEOUT_MS = 3_000;

async function probe(check: () => Promise<void>): Promise<DependencyState> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('timeout')),
      READINESS_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([check(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly ai: AiBrokerService,
  ) {}

  /** Liveness: the process is running. No dependency checks. */
  @Get()
  @ApiOkResponse({ description: 'Process is alive' })
  check(): HealthStatus {
    return {
      status: 'ok',
      service: 'pca-mhealth-backend',
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: the databases the API depends on are reachable. */
  @Get('ready')
  @ApiOkResponse({ description: 'All dependencies reachable' })
  @ApiServiceUnavailableResponse({
    description: 'At least one dependency is down',
  })
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReadinessStatus> {
    const [postgres, mongodb, ai] = await Promise.all([
      probe(() => this.prisma.ping()),
      probe(() => this.mongo.ping()),
      this.ai.health(),
    ]);
    const ok = postgres === 'up' && mongodb === 'up';
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: ok ? 'ok' : 'unavailable',
      checks: { postgres, mongodb, ai },
    };
  }
}
