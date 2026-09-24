import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

/**
 * Atomic fixed-window counter with an optional block period, run inside
 * Redis so every API instance shares the same counts (horizontal scaling).
 *
 * KEYS[1] hit counter, KEYS[2] block flag
 * ARGV[1] window ms, ARGV[2] limit, ARGV[3] block ms
 * Returns {hits, windowMsLeft, blocked (0/1), blockMsLeft}.
 */
const SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {hits, math.max(redis.call('PTTL', KEYS[1]), 0), 1, blockTtl}
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
if hits > tonumber(ARGV[2]) then
  local block = tonumber(ARGV[3])
  if block > 0 then
    redis.call('SET', KEYS[2], '1', 'PX', block)
    return {hits, ttl, 1, block}
  end
  return {hits, ttl, 1, ttl}
end
return {hits, ttl, 0, 0}
`;

/**
 * Rate-limit counters in Redis. If Redis cannot be reached the request is
 * allowed (fail open) and a warning is logged: a short Redis outage must not
 * take the whole API down.
 */
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;
  private readonly prefix: string;
  private lastWarning = 0;

  constructor(url: string, keyPrefix = 'rl') {
    this.prefix = keyPrefix;
    this.redis = new Redis(url, {
      // Wait briefly for a connection, then give up (fail open) quickly.
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 500,
    });
    // Connection errors are reported per request below; avoid unhandled events.
    this.redis.on('error', () => undefined);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const base = `${this.prefix}:${throttlerName}:${key}`;
    try {
      const [hits, windowLeft, blocked, blockLeft] = (await this.redis.eval(
        SCRIPT,
        2,
        `${base}:hits`,
        `${base}:block`,
        String(ttl),
        String(limit),
        String(blockDuration),
      )) as [number, number, number, number];
      return {
        totalHits: hits,
        timeToExpire: Math.ceil(windowLeft / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockLeft / 1000),
      };
    } catch (err) {
      const now = Date.now();
      if (now - this.lastWarning > 60_000) {
        this.lastWarning = now;
        this.logger.warn(
          `Rate-limit store unavailable, allowing requests: ${(err as Error).message}`,
        );
      }
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
