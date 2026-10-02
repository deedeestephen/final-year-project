import type { Response } from 'express';
import type { MongoService } from '../../persistence/database/mongo.service';
import type { PrismaService } from '../../persistence/database/prisma.service';
import type { AiBrokerService } from '../../services/ai/ai-broker.service';
import {
  NoPushSender,
  type PushSender,
} from '../../services/notifications/push/fcm.client';
import { HealthController } from './health.controller';

const aiDown = {
  health: () => Promise.resolve('down'),
} as unknown as AiBrokerService;

function controller(
  postgresUp: boolean,
  mongoUp: boolean,
  push: PushSender = new NoPushSender(),
): HealthController {
  const fake = (up: boolean) => ({
    ping: () => (up ? Promise.resolve() : Promise.reject(new Error('down'))),
  });
  return new HealthController(
    fake(postgresUp) as unknown as PrismaService,
    fake(mongoUp) as unknown as MongoService,
    aiDown,
    push,
  );
}

function fakeResponse(): Response & { statusCode: number } {
  const res = { statusCode: 200 } as Response & { statusCode: number };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  return res;
}

describe('HealthController', () => {
  it('liveness returns ok with an ISO timestamp', () => {
    const result = controller(true, true).check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('pca-mhealth-backend');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('readiness is ok when both databases answer', async () => {
    const res = fakeResponse();
    await expect(controller(true, true).ready(res)).resolves.toEqual({
      status: 'ok',
      checks: { postgres: 'up', mongodb: 'up', ai: 'down', push: 'off' },
    });
    // The AI service is optional: its absence never makes the API unready.
    expect(res.statusCode).toBe(200);
  });

  it('readiness says when push notifications are on', async () => {
    const on = { enabled: true, project: 'demo' } as unknown as PushSender;
    await expect(
      controller(true, true, on).ready(fakeResponse()),
    ).resolves.toMatchObject({ checks: { push: 'on' } });
  });

  it('readiness is 503 and names the failed dependency', async () => {
    const res = fakeResponse();
    await expect(controller(true, false).ready(res)).resolves.toEqual({
      status: 'unavailable',
      checks: { postgres: 'up', mongodb: 'down', ai: 'down', push: 'off' },
    });
    expect(res.statusCode).toBe(503);
  });

  it('treats a hung dependency as down after the timeout', async () => {
    jest.useFakeTimers();
    const hung = new HealthController(
      { ping: () => new Promise(() => undefined) } as unknown as PrismaService,
      { ping: () => Promise.resolve() } as unknown as MongoService,
      aiDown,
      new NoPushSender(),
    );
    const res = fakeResponse();
    const pending = hung.ready(res);
    await jest.advanceTimersByTimeAsync(3_001);
    await expect(pending).resolves.toMatchObject({
      checks: { postgres: 'down' },
    });
    jest.useRealTimers();
  });
});
