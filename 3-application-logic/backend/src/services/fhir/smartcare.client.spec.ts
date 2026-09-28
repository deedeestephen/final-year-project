import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Bundle } from 'fhir/r4';
import type { AppConfig } from '../../config/app-config';
import { SmartCareClient, SmartCareError } from './smartcare.client';

const bundle: Bundle = { resourceType: 'Bundle', type: 'collection' };

function client(
  url: string,
  timeoutMs = 2000,
  token = 't0ken',
): SmartCareClient {
  return new SmartCareClient({
    fhir: {
      smartcareUrl: url,
      smartcareToken: token,
      timeoutMs,
      maxPatients: 10,
    },
  } as AppConfig);
}

async function failure(p: Promise<unknown>): Promise<SmartCareError> {
  try {
    await p;
  } catch (err) {
    if (err instanceof SmartCareError) return err;
    throw err;
  }
  throw new Error('expected a SmartCareError');
}

describe('SmartCareClient', () => {
  let server: Server;
  let base: string;
  let handler: (res: import('node:http').ServerResponse) => void;
  let lastAuth: string | undefined;

  beforeAll(async () => {
    server = createServer((req, res) => {
      lastAuth = req.headers.authorization;
      req.resume();
      req.on('end', () => handler(res));
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/fhir`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  it('is off without an address', async () => {
    const c = client('');
    expect(c.enabled).toBe(false);
    expect(c.targetHost).toBeNull();
    expect((await failure(c.send(bundle))).kind).toBe('NOT_CONFIGURED');
  });

  it('reports the host only, never the token', () => {
    expect(client(base).targetHost).toBe(new URL(base).host);
  });

  it('reads the new id from the Location header', async () => {
    handler = (res) => {
      res.statusCode = 201;
      res.setHeader('Location', `${base}/Bundle/abc-123/_history/1`);
      res.end();
    };
    await expect(client(base).send(bundle)).resolves.toEqual({
      httpStatus: 201,
      receiverId: 'abc-123',
    });
    expect(lastAuth).toBe('Bearer t0ken');
  });

  it('sends no Authorization header without a token', async () => {
    handler = (res) => {
      res.statusCode = 200;
      res.end('{"resourceType":"Bundle","id":"x1"}');
    };
    await expect(client(base, 2000, '').send(bundle)).resolves.toEqual({
      httpStatus: 200,
      receiverId: 'x1',
    });
    expect(lastAuth).toBeUndefined();
  });

  it('refuses to follow a redirect, so the token cannot go elsewhere', async () => {
    handler = (res) => {
      res.statusCode = 307;
      res.setHeader('Location', 'http://127.0.0.1:9/steal');
      res.end();
    };
    expect((await failure(client(base).send(bundle))).kind).toBe('UNREACHABLE');
  });

  it('times out', async () => {
    handler = (res) => setTimeout(() => res.end('{}'), 1500);
    expect((await failure(client(base, 1000).send(bundle))).kind).toBe(
      'TIMED_OUT',
    );
  });

  it('says when nothing answers at that address', async () => {
    expect(
      (await failure(client('http://127.0.0.1:9/fhir').send(bundle))).kind,
    ).toBe('UNREACHABLE');
  });

  it('keeps the receiver reason cleaned and short, apart from the message', async () => {
    handler = (res) => {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          resourceType: 'OperationOutcome',
          issue: [{ diagnostics: `bad\u0000 ${'x'.repeat(400)}` }],
        }),
      );
    };
    const err = await failure(client(base).send(bundle));
    expect(err.kind).toBe('REJECTED');
    expect(err.httpStatus).toBe(400);
    expect(err.message).toBe('SmartCare Pro refused the export (400)');
    expect(err.remoteDetail?.startsWith('bad ')).toBe(true);
    expect(err.remoteDetail?.length).toBe(300);
  });
});
