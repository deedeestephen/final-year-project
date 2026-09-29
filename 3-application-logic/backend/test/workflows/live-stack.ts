import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  createWriteStream,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  createServer as createHttpsServer,
  type Server as HttpsServer,
} from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createNetServer, type AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from '../../src/config/repo-root';
import { createMongoClient } from '../../src/persistence/mongo/client';
import { ensureMongoCollections } from '../../src/persistence/mongo/collections';

/*
 * The whole system, running for real (Phase 16 end-to-end and Phase 17
 * performance): the built backend as its own process in PRODUCTION mode, the
 * Python AI service (mock models), and a SmartCare Pro stand-in over HTTPS.
 * Everything uses this run's own databases and a temporary folder; nothing
 * of the development environment is touched.
 */

export interface LiveStack {
  baseUrl: string;
  aiUrl: string;
  /** Requests the SmartCare Pro stand-in received. */
  smartcare: { received: { authorization?: string; body: string }[] };
  backendLog: string;
  aiLog: string;
  storageRoot: string;
  secrets: { aiToken: string; smartcareToken: string };
  /** From starting each process until it answered ready (Phase 17). */
  timings: { aiReadyMs: number; backendReadyMs: number };
  stop(): Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createNetServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

async function waitFor(
  url: string,
  ok: (status: number, body: string) => boolean,
  timeoutMs: number,
): Promise<void> {
  const end = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      const body = await res.text();
      if (ok(res.status, body)) return;
      last = `${res.status} ${body.slice(0, 200)}`;
    } catch (err) {
      last = String(err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${last}`);
}

/** A self-signed certificate for the SmartCare Pro stand-in (openssl). */
function selfSigned(dir: string): { key: string; cert: string } {
  const key = path.join(dir, 'smartcare.key');
  const cert = path.join(dir, 'smartcare.crt');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
  );
  return { key, cert };
}

function startSmartCare(
  certs: { key: string; cert: string },
  token: string,
): Promise<{
  server: HttpsServer;
  port: number;
  received: LiveStack['smartcare']['received'];
}> {
  const received: LiveStack['smartcare']['received'] = [];
  const server = createHttpsServer(
    { key: readFileSync(certs.key), cert: readFileSync(certs.cert) },
    (req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        received.push({
          authorization: req.headers.authorization,
          body: Buffer.concat(chunks).toString('utf8'),
        });
        res.setHeader('Content-Type', 'application/fhir+json');
        if (req.headers.authorization !== `Bearer ${token}`) {
          res.statusCode = 401;
          res.end(
            '{"resourceType":"OperationOutcome","issue":[{"severity":"error","code":"security"}]}',
          );
          return;
        }
        res.statusCode = 201;
        res.setHeader('Location', '/fhir/Bundle/e2e-received/_history/1');
        res.end('{"resourceType":"Bundle","id":"e2e-received"}');
      });
    },
  );
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        server,
        port: (server.address() as AddressInfo).port,
        received,
      }),
    ),
  );
}

function pythonOf(aiDir: string): string {
  const win = path.join(aiDir, '.venv', 'Scripts', 'python.exe');
  const nix = path.join(aiDir, '.venv', 'bin', 'python');
  try {
    readFileSync(win);
    return win;
  } catch {
    return nix;
  }
}

export async function startLiveStack(
  overrides: Record<string, string> = {},
): Promise<LiveStack> {
  const root = repoRoot();
  const backendDir = path.join(root, '3-application-logic', 'backend');
  const aiDir = path.join(root, '4-ai-intelligence-layer', 'ai-services');
  const work = mkdtempSync(path.join(os.tmpdir(), 'pca-live-'));
  const aiToken = randomBytes(24).toString('base64url');
  const smartcareToken = randomBytes(24).toString('base64url');

  // MongoDB collections with their validators, as `npm run db:mongo:migrate` makes them.
  const mongo = createMongoClient(process.env.MONGO_URL!);
  try {
    await ensureMongoCollections((await mongo.connect()).db());
  } finally {
    await mongo.close();
  }

  const certs = selfSigned(work);
  const smartcare = await startSmartCare(certs, smartcareToken);

  const aiPort = await freePort();
  const aiLog = path.join(work, 'ai-service.log');
  const aiStart = performance.now();
  const ai: ChildProcess = spawn(
    pythonOf(aiDir),
    [
      '-m',
      'uvicorn',
      'app.main:app',
      '--host',
      '127.0.0.1',
      '--port',
      String(aiPort),
    ],
    {
      cwd: aiDir,
      env: {
        ...process.env,
        AI_SERVICE_TOKEN: aiToken,
        // Claude costs money and varies: off unless LIVE_CLAUDE=1 (ADR-010).
        ANTHROPIC_API_KEY:
          process.env.LIVE_CLAUDE === '1'
            ? (process.env.ANTHROPIC_API_KEY ?? '')
            : '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const aiOut = createWriteStream(aiLog);
  ai.stdout?.pipe(aiOut);
  ai.stderr?.pipe(aiOut);
  const aiUrl = `http://127.0.0.1:${aiPort}`;
  await waitFor(`${aiUrl}/v1/health`, (s) => s === 200, 60_000);
  const aiReadyMs = Math.round(performance.now() - aiStart);

  const port = await freePort();
  const storageRoot = path.join(work, 'objects');
  const backendLog = path.join(work, 'backend.log');
  const backendStart = performance.now();
  const backend: ChildProcess = spawn(process.execPath, ['dist/main.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      LOG_LEVEL: 'debug',
      CORS_ORIGINS: 'http://localhost:5173',
      REDIS_URL: '',
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_ROOT: storageRoot,
      AI_SERVICE_URL: aiUrl,
      AI_SERVICE_TOKEN: aiToken,
      SMARTCARE_FHIR_URL: `https://localhost:${smartcare.port}/fhir`,
      SMARTCARE_TOKEN: smartcareToken,
      // The stand-in's certificate is self-signed: trust only it, only here.
      NODE_EXTRA_CA_CERTS: certs.cert,
      // Many sign-ins from one address in a short run.
      AUTH_RATE_LIMIT_MAX: '200',
      ...overrides,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const out = createWriteStream(backendLog);
  backend.stdout?.pipe(out);
  backend.stderr?.pipe(out);
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitFor(
    `${baseUrl}/api/v1/health/ready`,
    (s, body) => s === 200 && body.includes('"ai":"up"'),
    90_000,
  );
  const backendReadyMs = Math.round(performance.now() - backendStart);

  let stopped: Promise<void> | undefined;
  const stop = () => (stopped ??= stopAll());
  const stopAll = async () => {
    const exited = (p: ChildProcess) =>
      new Promise<void>((resolve) => {
        if (p.exitCode !== null) return resolve();
        p.once('exit', () => resolve());
        p.kill();
        // A fallback that never keeps the test run alive by itself.
        setTimeout(resolve, 5000).unref();
      });
    await Promise.all([exited(backend), exited(ai)]);
    await new Promise((r) => smartcare.server.close(r));
    await new Promise((r) => out.end(r));
    await new Promise((r) => aiOut.end(r));
  };

  writeFileSync(
    path.join(work, 'README.txt'),
    'Temporary folder of one live-stack test run.\n',
  );
  return {
    baseUrl,
    aiUrl,
    smartcare: { received: smartcare.received },
    backendLog,
    aiLog,
    storageRoot,
    secrets: { aiToken, smartcareToken },
    timings: { aiReadyMs, backendReadyMs },
    stop,
  };
}

/** Removes a run's temporary folder (after its logs were read). */
export function removeRunFolder(anyFileInIt: string): void {
  rmSync(path.dirname(anyFileInIt), { recursive: true, force: true });
}
