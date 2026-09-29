import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { repoRoot } from '../../src/config/repo-root';
import { PasswordHasher } from '../../src/services/auth/password';
import { TEST_PASSWORD, createFacility, ensureSeeded } from '../db/helpers';
import {
  removeRunFolder,
  startLiveStack,
  type LiveStack,
} from '../workflows/live-stack';
import {
  inBatches,
  percentile,
  runVirtualUsers,
  stats,
  statsByName,
  timed,
  type Sample,
  type Step,
} from './load';

/*
 * Phase 17: performance, measured on the real system (the built backend in
 * production mode as its own process, the Python AI service with mock
 * models, PostgreSQL and MongoDB), with synthetic users and patients only.
 *
 *   npm run perf                       (full run, about 6 minutes)
 *   PERF_USERS=100 PERF_MEASURE_S=20 npm run perf   (a quick look)
 *   PERF_ONLY=sync npm run perf        (only some stages: load, ai, sync)
 *
 * The results are written to var/perf/ and summarised in docs/performance.md.
 * Nothing is asserted about speed here: the numbers are reported as they
 * are. The run fails only if the system gives wrong answers under load.
 */

const USERS = Number(process.env.PERF_USERS ?? 500);
const MEASURE_MS = Number(process.env.PERF_MEASURE_S ?? 60) * 1000;
const FACILITIES = 10;
const PATIENTS_PER_FACILITY = 30;
const AI_READY_PER_FACILITY = 10;
const ONLY = process.env.PERF_ONLY?.split(',');
/** A measured stage; skipped when PERF_ONLY names other stages. */
const stage = (name: 'load' | 'ai' | 'sync') =>
  !ONLY || ONLY.includes(name) ? it : it.skip;

const prisma = new PrismaClient();
let stack: LiveStack;

interface VUser {
  email: string;
  /** Letters, digits and dashes only (a valid device id part). */
  handle: string;
  token: string;
  facility: number;
  cursor?: string;
}

describe('performance on the live system (Phase 17)', () => {
  const users: VUser[] = [];
  const facilityIds: string[] = [];
  /** Server ids of patients per facility. */
  const patients: string[][] = [];
  /** Patients with AI consent and a record, each used for one AI job. */
  const aiReady: { facility: number; patientId: string }[] = [];
  const results: Record<string, unknown> = {};
  const url = (p: string) => `${stack.baseUrl}/api/v1${p}`;
  const auth = (u: VUser) => ({
    Authorization: `Bearer ${u.token}`,
    'Content-Type': 'application/json',
    'X-Client': 'mobile',
  });

  beforeAll(async () => {
    await ensureSeeded(prisma);
    stack = await startLiveStack({
      LOG_LEVEL: 'info',
      // Every virtual user comes from this one computer's address, so the
      // per-address limit (600/min, meant for many phones on many addresses)
      // is lifted. The per-account limit stays at its normal 120/min.
      RATE_LIMIT_MAX: '100000000',
      AUTH_RATE_LIMIT_MAX: '100000',
    });
    results.startup = stack.timings;

    // 500 synthetic clinicians in 10 synthetic facilities (one password hash).
    const hash = await new PasswordHasher().hash(TEST_PASSWORD);
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: 'CLINICIAN' },
    });
    for (let f = 0; f < FACILITIES; f++) {
      facilityIds.push(await createFacility(prisma, `PERF${f}`));
      patients.push([]);
    }
    const tag = randomUUID().slice(0, 6);
    await inBatches(
      Array.from({ length: USERS }, (_, i) => i),
      20,
      async (i) => {
        const email = `perf-${tag}-${i}@example.test`;
        await prisma.user.create({
          data: {
            email,
            displayName: `SYNTHETIC Perf ${i}`,
            passwordHash: hash,
            facilityId: facilityIds[i % FACILITIES],
            isSynthetic: true,
            roles: { create: { roleId: role.id } },
          },
        });
        users[i] = {
          email,
          handle: `perf-${tag}-${i}`,
          token: '',
          facility: i % FACILITIES,
        };
      },
    );
  }, 600_000);

  afterAll(async () => {
    await stack?.stop();
    if (stack) removeRunFolder(stack.backendLog);
    await prisma.$disconnect();
    const dir = path.join(repoRoot(), 'var', 'perf');
    mkdirSync(dir, { recursive: true });
    const file = path.join(
      dir,
      `phase17-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    writeFileSync(
      file,
      JSON.stringify(
        {
          machine: {
            os: `${os.type()} ${os.release()}`,
            cpus: `${os.cpus().length} x ${os.cpus()[0]?.model ?? '?'}`,
            memoryGb: Math.round(os.totalmem() / 2 ** 30),
            freeMemoryGbAtEnd: Math.round((os.freemem() / 2 ** 30) * 10) / 10,
            node: process.version,
          },
          settings: { users: USERS, measureMs: MEASURE_MS },
          ...results,
        },
        null,
        2,
      ),
    );
    console.log(`Results written to ${file}`);
  });

  it('signs everyone in', async () => {
    const samples: Sample[] = [];
    const start = performance.now();
    await inBatches(users, 25, async (u) => {
      const res = await timed(url('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
        body: JSON.stringify({ email: u.email, password: TEST_PASSWORD }),
      });
      samples.push({ name: 'login', ms: res.ms, status: res.status });
      u.token = (res.body as { accessToken: string }).accessToken;
    });
    results.login = {
      ...stats(samples),
      totalSeconds: Math.round((performance.now() - start) / 100) / 10,
      concurrency: 25,
    };
    expect(stats(samples).errors).toBe(0);
  });

  it('prepares synthetic patients through the API', async () => {
    const lead = (f: number) => users[f];
    await inBatches(
      Array.from({ length: FACILITIES }, (_, f) => f),
      FACILITIES,
      async (f) => {
        for (let n = 0; n < PATIENTS_PER_FACILITY; n++) {
          const created = await timed(url('/patients'), {
            method: 'POST',
            headers: auth(lead(f)),
            body: JSON.stringify({
              givenName: 'SYNTHETIC',
              familyName: `Perf ${f}-${n}`,
              dateOfBirth: '1958-01-01',
              regionClass: n % 2 ? 'RURAL' : 'URBAN',
            }),
          });
          expect(created.status).toBe(201);
          const id = (created.body as { id: string }).id;
          patients[f].push(id);
          if (n < AI_READY_PER_FACILITY) {
            const record = await timed(
              url(`/patients/${id}/clinical-records`),
              {
                method: 'POST',
                headers: auth(lead(f)),
                body: JSON.stringify({
                  encounterDate: '2026-09-20',
                  psaNgMl: 4 + (n % 7),
                  dreFinding: 'NORMAL',
                }),
              },
            );
            const consent = await timed(url(`/patients/${id}/consents`), {
              method: 'POST',
              headers: auth(lead(f)),
              body: JSON.stringify({
                type: 'AI_ANALYSIS',
                method: 'WRITTEN',
                consentTextVersion: 'v1',
              }),
            });
            expect([record.status, consent.status]).toEqual([201, 201]);
            aiReady.push({ facility: f, patientId: id });
          }
        }
      },
    );
    expect(aiReady).toHaveLength(FACILITIES * AI_READY_PER_FACILITY);
  });

  /** A clinician's day: open the app, pull changes, look at patients, save a record. */
  const mix = (u: VUser): Step => {
    const r = Math.random();
    const list = patients[u.facility];
    const patient = list[Math.floor(Math.random() * list.length)];
    if (r < 0.25) {
      return {
        name: 'GET /users/me',
        run: () => timed(url('/users/me'), { headers: auth(u) }),
      };
    }
    if (r < 0.45) {
      return {
        name: 'GET /sync/changes',
        run: async () => {
          const q = u.cursor ? `?cursor=${u.cursor}` : '';
          const res = await timed(url(`/sync/changes${q}`), {
            headers: auth(u),
          });
          const next = (res.body as { cursor?: string } | null)?.cursor;
          if (res.status === 200 && next) u.cursor = next;
          return res;
        },
      };
    }
    if (r < 0.65) {
      return {
        name: 'GET /patients (page)',
        run: () =>
          timed(url('/patients?page=1&pageSize=20'), { headers: auth(u) }),
      };
    }
    if (r < 0.8) {
      return {
        name: 'GET /patients/:id',
        run: () => timed(url(`/patients/${patient}`), { headers: auth(u) }),
      };
    }
    if (r < 0.9) {
      return {
        name: 'GET /patients/:id/clinical-records',
        run: () =>
          timed(url(`/patients/${patient}/clinical-records`), {
            headers: auth(u),
          }),
      };
    }
    return {
      name: 'POST /sync (1 record)',
      run: () =>
        timed(url('/sync'), {
          method: 'POST',
          headers: auth(u),
          body: JSON.stringify({
            deviceId: `device-${u.handle}`,
            operations: [
              {
                idempotencyKey: randomUUID(),
                clientTimestamp: new Date().toISOString(),
                entityType: 'clinical_record',
                operation: 'CREATE',
                patientId: patient,
                payload: {
                  clientUuid: randomUUID(),
                  encounterDate: '2026-09-28',
                  psaNgMl: 5.2,
                  dreFinding: 'NORMAL',
                },
              },
            ],
          }),
        }),
    };
  };

  const summarise = (samples: Sample[], windowMs: number, users: number) => ({
    users,
    requestsPerSecond: Math.round((samples.length / windowMs) * 10000) / 10,
    byRequest: statsByName(samples),
    statuses: samples.reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    }, {}),
  });

  stage('load')('baseline: 25 people using the app', async () => {
    const { samples, windowMs } = await runVirtualUsers({
      users: 25,
      rampMs: 5_000,
      measureMs: Math.min(30_000, MEASURE_MS),
      thinkMs: [2_000, 8_000],
      nextStep: (i) => mix(users[i * Math.floor(USERS / 25)]),
    });
    results.baseline = summarise(samples, windowMs, 25);
    expect(stats(samples).errors).toBe(0);
  });

  /** One AI job, timed from the request until the finished report is seen. */
  const aiJob = async (item: { facility: number; patientId: string }) => {
    const u = users[item.facility];
    const start = performance.now();
    const queued = await timed(url(`/patients/${item.patientId}/ai-jobs`), {
      method: 'POST',
      headers: auth(u),
    });
    if (queued.status !== 202) {
      return {
        ms: performance.now() - start,
        status: queued.status,
        serverMs: null,
      };
    }
    const id = (queued.body as { id: string }).id;
    for (;;) {
      await new Promise((r) => setTimeout(r, 100));
      const res = await timed(url(`/ai-jobs/${id}`), { headers: auth(u) });
      const job = res.body as {
        status: string;
        createdAt: string;
        finishedAt: string | null;
      };
      if (res.status === 200 && !['QUEUED', 'RUNNING'].includes(job.status)) {
        return {
          ms: performance.now() - start,
          status: job.status === 'SUCCEEDED' ? 200 : 500,
          serverMs: job.finishedAt
            ? Date.parse(job.finishedAt) - Date.parse(job.createdAt)
            : null,
        };
      }
      if (performance.now() - start > 60_000) {
        return { ms: performance.now() - start, status: 504, serverMs: null };
      }
    }
  };

  const aiSummary = (
    runs: { ms: number; status: number; serverMs: number | null }[],
  ) => {
    const client = runs.map((r) => r.ms).sort((a, b) => a - b);
    const server = runs
      .map((r) => r.serverMs)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    return {
      jobs: runs.length,
      failed: runs.filter((r) => r.status !== 200).length,
      endToEndMs: {
        p50: Math.round(percentile(client, 50)),
        p95: Math.round(percentile(client, 95)),
        max: Math.round(client.at(-1) ?? 0),
      },
      serverMs: {
        p50: Math.round(percentile(server, 50)),
        p95: Math.round(percentile(server, 95)),
        max: Math.round(server.at(-1) ?? 0),
      },
    };
  };

  stage('load')(
    `${USERS} people using the app, with AI analyses running`,
    async () => {
      const aiRuns: { ms: number; status: number; serverMs: number | null }[] =
        [];
      const steady = aiReady.slice(0, 60);
      // One AI analysis requested every second during the measured window.
      const ai = (async () => {
        await new Promise((r) => setTimeout(r, 15_000));
        await Promise.all(
          steady.map(async (item, i) => {
            await new Promise((r) =>
              setTimeout(r, (i * MEASURE_MS) / steady.length),
            );
            aiRuns.push(await aiJob(item));
          }),
        );
      })();
      const { samples, windowMs } = await runVirtualUsers({
        users: USERS,
        rampMs: 15_000,
        measureMs: MEASURE_MS,
        thinkMs: [2_000, 8_000],
        nextStep: (i) => mix(users[i]),
      });
      await ai;
      results.main = summarise(samples, windowMs, USERS);
      results.aiUnderLoad = aiSummary(aiRuns);
      expect(samples.filter((s) => s.status >= 500 || s.status === 0)).toEqual(
        [],
      );
      expect(aiRuns.filter((r) => r.status !== 200)).toEqual([]);
    },
  );

  stage('load')(
    `stress: ${USERS} people each acting about once a second`,
    async () => {
      const { samples, windowMs } = await runVirtualUsers({
        users: USERS,
        rampMs: 10_000,
        measureMs: Math.min(30_000, MEASURE_MS),
        thinkMs: [500, 1_500],
        nextStep: (i) => mix(users[i]),
      });
      results.stress = summarise(samples, windowMs, USERS);
      expect(samples.filter((s) => s.status >= 500 || s.status === 0)).toEqual(
        [],
      );
    },
  );

  stage('ai')('a burst of 20 AI analyses at the same moment', async () => {
    const burst = aiReady.slice(60, 80);
    const runs = await Promise.all(burst.map((item) => aiJob(item)));
    results.aiBurst = { ...aiSummary(runs), maxConcurrentJobs: 2 };
    expect(runs.filter((r) => r.status !== 200)).toEqual([]);
  });

  const PHONES = Math.min(100, USERS);
  stage('sync')(
    `sync stress: ${PHONES} phones send 20 changes each at once, then resend them`,
    async () => {
      const phones = users.slice(0, PHONES);
      const batches = phones.map((u) => {
        const list = patients[u.facility];
        const newPatient = randomUUID();
        return {
          u,
          body: JSON.stringify({
            deviceId: `sync-${u.handle}`,
            operations: [
              {
                idempotencyKey: randomUUID(),
                clientTimestamp: new Date().toISOString(),
                entityType: 'patient',
                operation: 'CREATE',
                payload: {
                  clientUuid: newPatient,
                  givenName: 'SYNTHETIC',
                  familyName: `Sync ${u.handle}`,
                  dateOfBirth: '1960-06-06',
                  regionClass: 'RURAL',
                },
              },
              ...Array.from({ length: 19 }, (_, k) => ({
                idempotencyKey: randomUUID(),
                clientTimestamp: new Date().toISOString(),
                entityType: 'clinical_record',
                operation: 'CREATE',
                patientId: k === 0 ? newPatient : list[k % list.length],
                payload: {
                  clientUuid: randomUUID(),
                  encounterDate: '2026-09-27',
                  psaNgMl: 3 + (k % 9),
                  dreFinding: 'NORMAL',
                },
              })),
            ],
          }),
          newPatient,
        };
      });
      const send = async () => {
        const samples: Sample[] = [];
        const outcomes: { result: string; replayed: boolean }[] = [];
        await Promise.all(
          batches.map(async (b) => {
            const res = await timed(url('/sync'), {
              method: 'POST',
              headers: auth(b.u),
              body: b.body,
            });
            samples.push({
              name: 'POST /sync (20 changes)',
              ms: res.ms,
              status: res.status,
            });
            outcomes.push(
              ...((res.body as { results?: typeof outcomes })?.results ?? []),
            );
          }),
        );
        return { samples, outcomes };
      };
      const first = await send();
      const again = await send();
      const created = await prisma.patient.count({
        where: { clientUuid: { in: batches.map((b) => b.newPatient) } },
      });
      results.syncStress = {
        phones: PHONES,
        changesPerPhone: 20,
        first: stats(first.samples),
        resend: stats(again.samples),
        applied: first.outcomes.filter((o) => o.result === 'APPLIED').length,
        replayedOnResend: again.outcomes.filter((o) => o.replayed).length,
        patientsCreated: created,
      };
      expect(stats(first.samples).errors).toBe(0);
      expect(first.outcomes.filter((o) => o.result === 'APPLIED')).toHaveLength(
        PHONES * 20,
      );
      expect(again.outcomes.every((o) => o.replayed)).toBe(true);
      expect(created).toBe(PHONES);
    },
  );
});
