/*
 * A small load generator for Phase 17: "virtual users" that each wait a
 * random think time, send one request, and repeat, like people using the
 * app. Latency is measured on the client from sending to the full answer.
 */

export interface Sample {
  name: string;
  ms: number;
  status: number;
}

export interface Stats {
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

/** Nearest-rank percentile of already sorted values. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** Counts, errors (5xx, network, and any status not listed as ok) and percentiles. */
export function stats(
  samples: Sample[],
  ok: (status: number) => boolean = (s) => s >= 200 && s < 300,
): Stats {
  const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
  return {
    count: samples.length,
    errors: samples.filter((s) => !ok(s.status)).length,
    p50: Math.round(percentile(ms, 50)),
    p95: Math.round(percentile(ms, 95)),
    p99: Math.round(percentile(ms, 99)),
    max: Math.round(ms.at(-1) ?? 0),
  };
}

/** Stats per request name, plus "all". */
export function statsByName(samples: Sample[]): Record<string, Stats> {
  const out: Record<string, Stats> = { all: stats(samples) };
  for (const name of new Set(samples.map((s) => s.name))) {
    out[name] = stats(samples.filter((s) => s.name === name));
  }
  return out;
}

export interface TimedResponse {
  status: number;
  ms: number;
  body: unknown;
}

/** One request, timed until the whole body has arrived. */
export async function timed(
  url: string,
  init: RequestInit = {},
): Promise<TimedResponse> {
  const start = performance.now();
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const ms = performance.now() - start;
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON; keep the text.
    }
    return { status: res.status, ms, body };
  } catch {
    return { status: 0, ms: performance.now() - start, body: null };
  }
}

export interface Step {
  name: string;
  run: () => Promise<TimedResponse>;
}

/**
 * Runs `users` virtual users. Each starts at a random moment within
 * `rampMs`, then repeats: think (uniform in `thinkMs`), pick a step, send.
 * Only answers that finish inside the measured window (after the ramp) are
 * kept.
 */
export async function runVirtualUsers(options: {
  users: number;
  rampMs: number;
  measureMs: number;
  thinkMs: [number, number];
  nextStep: (user: number) => Step;
}): Promise<{ samples: Sample[]; windowMs: number }> {
  const { users, rampMs, measureMs, thinkMs, nextStep } = options;
  const t0 = performance.now();
  const windowStart = t0 + rampMs;
  const end = windowStart + measureMs;
  const samples: Sample[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const think = () => thinkMs[0] + Math.random() * (thinkMs[1] - thinkMs[0]);

  await Promise.all(
    Array.from({ length: users }, async (_, user) => {
      await sleep(Math.random() * rampMs);
      while (performance.now() < end) {
        await sleep(think());
        if (performance.now() >= end) break;
        const step = nextStep(user);
        const sentAt = performance.now();
        const res = await step.run();
        if (sentAt >= windowStart && performance.now() <= end) {
          samples.push({ name: step.name, ms: res.ms, status: res.status });
        }
      }
    }),
  );
  return { samples, windowMs: measureMs };
}

/** Runs `tasks` with at most `limit` at a time. */
export async function inBatches<T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await task(items[i], i);
      }
    }),
  );
}
