/**
 * A stand-in for the SmartCare Pro FHIR endpoint, for development only
 * (real SmartCare Pro access needs a data-sharing agreement with the Ministry
 * of Health). It accepts the de-identified export and keeps it on this PC.
 *
 *   npm run smartcare:mock
 *
 * Then set, in .env:  SMARTCARE_FHIR_URL=http://localhost:8090/fhir
 * and restart the backend. If SMARTCARE_TOKEN is set in .env, the mock
 * requires it as a Bearer token, like the real service would.
 *
 *   POST /fhir/Bundle       store a Bundle (201 with Location)
 *   GET  /fhir/Bundle/{id}  read it back
 *   GET  /fhir/metadata     a minimal CapabilityStatement
 *
 * Received bundles are written to var/smartcare-mock/ (git-ignored).
 */
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import path from 'node:path';
import type { Bundle, OperationOutcome, OperationOutcomeIssue } from 'fhir/r4';
import { loadRootEnv, repoRoot } from '../src/config/repo-root';

loadRootEnv();
const PORT = Number(process.env.SMARTCARE_MOCK_PORT ?? 8090);
const TOKEN = process.env.SMARTCARE_TOKEN ?? '';
const STORE = path.join(repoRoot(), 'var', 'smartcare-mock');
const MAX_BYTES = 50 * 1024 * 1024;
mkdirSync(STORE, { recursive: true });

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/fhir+json');
  res.end(JSON.stringify(body));
}

function outcome(
  code: OperationOutcomeIssue['code'],
  diagnostics: string,
): OperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'error', code, diagnostics }],
  };
}

function authorised(header: string | undefined): boolean {
  if (!TOKEN) return true;
  const expected = Buffer.from(`Bearer ${TOKEN}`);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const server = createServer((req, res) => {
  const url = req.url ?? '';
  if (req.method === 'GET' && url === '/fhir/metadata') {
    send(res, 200, {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString().slice(0, 10),
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      software: { name: 'PCa mHealth SmartCare Pro mock (development only)' },
      rest: [
        {
          mode: 'server',
          resource: [
            {
              type: 'Bundle',
              interaction: [{ code: 'create' }, { code: 'read' }],
            },
          ],
        },
      ],
    });
    return;
  }
  if (!authorised(req.headers.authorization)) {
    send(res, 401, outcome('security', 'Missing or wrong token'));
    return;
  }
  const read = /^\/fhir\/Bundle\/([A-Za-z0-9-]{1,64})$/.exec(url);
  if (req.method === 'GET' && read) {
    const file = path.join(STORE, `${read[1]}.json`);
    if (!existsSync(file)) {
      send(res, 404, outcome('not-found', 'No such bundle'));
      return;
    }
    res.setHeader('Content-Type', 'application/fhir+json');
    res.end(readFileSync(file));
    return;
  }
  if (req.method !== 'POST' || url !== '/fhir/Bundle') {
    send(
      res,
      404,
      outcome('not-supported', 'Only POST /fhir/Bundle is supported'),
    );
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (c: Buffer) => {
    size += c.length;
    if (size <= MAX_BYTES) chunks.push(c);
  });
  req.on('end', () => {
    if (size > MAX_BYTES) {
      send(res, 413, outcome('too-costly', 'Bundle too large'));
      return;
    }
    let bundle: Bundle;
    try {
      bundle = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Bundle;
    } catch {
      send(res, 400, outcome('structure', 'Body is not JSON'));
      return;
    }
    if (bundle.resourceType !== 'Bundle' || bundle.type !== 'collection') {
      send(
        res,
        422,
        outcome('invalid', 'Expected a Bundle of type collection'),
      );
      return;
    }
    const id = randomUUID();
    const stored: Bundle = {
      ...bundle,
      id,
      meta: { ...bundle.meta, versionId: '1' },
    };
    writeFileSync(
      path.join(STORE, `${id}.json`),
      JSON.stringify(stored, null, 2),
    );
    const types = new Map<string, number>();
    for (const e of bundle.entry ?? []) {
      const t = e.resource?.resourceType ?? '?';
      types.set(t, (types.get(t) ?? 0) + 1);
    }
    const purpose = bundle.meta?.security?.[0]?.code ?? '?';
    console.log(
      `${new Date().toISOString()}  received bundle ${id} (purpose ${purpose}): ` +
        [...types].map(([t, n]) => `${n} ${t}`).join(', '),
    );
    res.setHeader(
      'Location',
      `http://localhost:${PORT}/fhir/Bundle/${id}/_history/1`,
    );
    send(res, 201, stored);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `SmartCare Pro mock (development only) on http://localhost:${PORT}/fhir`,
  );
  console.log(
    TOKEN ? 'Requires the SMARTCARE_TOKEN from .env.' : 'No token required.',
  );
  console.log(`Received bundles are saved in ${STORE}`);
});
