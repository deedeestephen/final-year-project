import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import type { AppConfig } from '../../../config/app-config';
import {
  FcmClient,
  NoPushSender,
  pushSenderFrom,
  readServiceAccount,
  type PushMessage,
} from './fcm.client';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const PROJECT = 'demo-project';
const EMAIL = 'push@demo-project.iam.gserviceaccount.com';
const message: PushMessage = {
  token: 'phone-token-1',
  title: 'New screening record',
  body: 'A new screening record was added.',
  data: { notificationId: 'n-1', type: 'clinical_record.created' },
};

interface Received {
  path: string;
  authorization?: string;
  body: string;
}

describe('FcmClient (Firebase Cloud Messaging HTTP v1)', () => {
  let server: Server;
  let base: string;
  let folder: string;
  let received: Received[];
  let onSend: (res: ServerResponse) => void;
  let onToken: (res: ServerResponse) => void;
  let tokens: number;
  let warn: jest.SpyInstance;

  const keyFile = (fields: Record<string, unknown>): string => {
    const file = path.join(folder, `key-${Math.random()}.json`);
    writeFileSync(file, JSON.stringify(fields));
    return file;
  };
  const account = () =>
    readServiceAccount(
      keyFile({
        type: 'service_account',
        project_id: PROJECT,
        client_email: EMAIL,
        private_key: privateKey,
        token_uri: `${base}/token`,
      }),
    );
  const sends = () => received.filter((r) => r.path.includes('messages:send'));

  beforeAll(async () => {
    // The refusals below are expected; their warnings would only clutter the output.
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    folder = mkdtempSync(path.join(os.tmpdir(), 'pca-fcm-'));
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        received.push({
          path: req.url ?? '',
          authorization: req.headers.authorization,
          body: Buffer.concat(chunks).toString('utf8'),
        });
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/token') onToken(res);
        else onSend(res);
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    received = [];
    tokens = 0;
    onToken = (res) => {
      tokens++;
      res.end(
        JSON.stringify({ access_token: `access-${tokens}`, expires_in: 3600 }),
      );
    };
    onSend = (res) => res.end('{"name":"projects/demo-project/messages/1"}');
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await new Promise((r) => server.close(r));
  });

  it('signs in with a JWT signed by the service account, then sends the push', async () => {
    const client = new FcmClient(account(), base);
    expect(client.project).toBe(PROJECT);
    await expect(client.send(message)).resolves.toBe('sent');

    const signIn = new URLSearchParams(received[0].body);
    expect(signIn.get('grant_type')).toBe(
      'urn:ietf:params:oauth:grant-type:jwt-bearer',
    );
    const [header, claims, signature] = signIn.get('assertion')!.split('.');
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${claims}`),
        publicKey,
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
    expect(
      JSON.parse(Buffer.from(claims, 'base64url').toString()),
    ).toMatchObject({
      iss: EMAIL,
      aud: `${base}/token`,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    });

    const [send] = sends();
    expect(send.path).toBe(`/v1/projects/${PROJECT}/messages:send`);
    expect(send.authorization).toBe('Bearer access-1');
    expect(JSON.parse(send.body)).toEqual({
      message: {
        token: 'phone-token-1',
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: { notification: { visibility: 'PRIVATE' } },
      },
    });
  });

  it('keeps the access token until shortly before it expires', async () => {
    let now = Date.now();
    const client = new FcmClient(account(), base, () => now);
    await client.send(message);
    await client.send(message);
    expect(tokens).toBe(1);
    now += 3_550_000; // less than a minute left
    await client.send(message);
    expect(tokens).toBe(2);
    expect(sends().map((s) => s.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-1',
      'Bearer access-2',
    ]);
  });

  it('asks for one access token when several pushes start at once', async () => {
    const client = new FcmClient(account(), base);
    await Promise.all([client.send(message), client.send(message)]);
    expect(tokens).toBe(1);
  });

  it('renews a refused access token once, then sends', async () => {
    let refused = false;
    onSend = (res) => {
      if (!refused) {
        refused = true;
        res.statusCode = 401;
        res.end('{"error":{"status":"UNAUTHENTICATED"}}');
        return;
      }
      res.end('{}');
    };
    await expect(new FcmClient(account(), base).send(message)).resolves.toBe(
      'sent',
    );
    expect(tokens).toBe(2);
  });

  it.each([
    [404, 'UNREGISTERED', 'invalid-token'],
    [403, 'SENDER_ID_MISMATCH', 'invalid-token'],
    [400, 'INVALID_ARGUMENT', 'failed'],
    [429, 'QUOTA_EXCEEDED', 'failed'],
    [503, 'UNAVAILABLE', 'failed'],
  ])(
    'answer %i with %s: %s',
    async (status: number, code: string, outcome: string) => {
      onSend = (res) => {
        res.statusCode = status;
        res.end(
          JSON.stringify({
            error: {
              code: status,
              status: 'X',
              details: [
                {
                  '@type':
                    'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                  errorCode: code,
                },
              ],
            },
          }),
        );
      };
      await expect(new FcmClient(account(), base).send(message)).resolves.toBe(
        outcome,
      );
    },
  );

  it('does not forget a phone on a plain 404 (it may be a wrong project id)', async () => {
    onSend = (res) => {
      res.statusCode = 404;
      res.end('{"error":{"code":404,"status":"NOT_FOUND"}}');
    };
    await expect(new FcmClient(account(), base).send(message)).resolves.toBe(
      'failed',
    );
  });

  it('fails without sending when Google refuses the service account', async () => {
    onToken = (res) => {
      res.statusCode = 400;
      res.end('{"error":"invalid_grant"}');
    };
    await expect(new FcmClient(account(), base).send(message)).resolves.toBe(
      'failed',
    );
    expect(sends()).toHaveLength(0);
  });

  it('fails when Firebase cannot be reached or redirects, and says why', async () => {
    // A port that was free a moment ago: nothing listens there now.
    const spare = createServer();
    await new Promise<void>((r) => spare.listen(0, '127.0.0.1', r));
    const { port } = spare.address() as AddressInfo;
    await new Promise((r) => spare.close(r));
    warn.mockClear();
    await expect(
      new FcmClient(account(), `http://127.0.0.1:${port}`).send(message),
    ).resolves.toBe('failed');
    onSend = (res) => {
      res.statusCode = 307;
      res.setHeader('Location', 'http://127.0.0.1:9/elsewhere');
      res.end();
    };
    await expect(new FcmClient(account(), base).send(message)).resolves.toBe(
      'failed',
    );
    const logged = (warn.mock.calls as unknown[][]).map((call) =>
      String(call[0]),
    );
    expect(logged[0]).toMatch(/could not be reached: ECONNREFUSED/);
    expect(logged[1]).toMatch(/could not be reached: .*redirect/);
  });

  describe('the service-account key file', () => {
    const errorOf = (file: string): string => {
      try {
        readServiceAccount(file);
      } catch (err) {
        return (err as Error).message;
      }
      throw new Error('expected an error');
    };

    it('explains what is wrong, never repeating the key', () => {
      const good = {
        type: 'service_account',
        project_id: PROJECT,
        client_email: EMAIL,
        private_key: privateKey,
      };
      expect(errorOf(path.join(folder, 'missing.json'))).toMatch(
        /cannot be read as JSON/,
      );
      expect(errorOf(keyFile({ ...good, type: 'authorized_user' }))).toMatch(
        /not a Firebase service-account key/,
      );
      const broken = errorOf(
        keyFile({ ...good, private_key: 'not a key at all' }),
      );
      expect(broken).toMatch(/private key in the file cannot be read/);
      expect(broken).not.toContain('not a key at all');
      expect(
        errorOf(keyFile({ ...good, token_uri: 'http://example.org/token' })),
      ).toMatch(/token_uri must use https/);
      expect(readServiceAccount(keyFile(good)).tokenUri).toBe(
        'https://oauth2.googleapis.com/token',
      );
    });

    it('decides whether push is on', async () => {
      const off = pushSenderFrom({
        push: { serviceAccountFile: '', apiUrl: base },
      } as AppConfig);
      expect(off).toBeInstanceOf(NoPushSender);
      expect(off.enabled).toBe(false);
      expect(off.project).toBeNull();
      await expect(off.send(message)).resolves.toBe('failed');

      const on = pushSenderFrom({
        push: {
          serviceAccountFile: keyFile({
            type: 'service_account',
            project_id: PROJECT,
            client_email: EMAIL,
            private_key: privateKey,
          }),
          apiUrl: base,
        },
      } as AppConfig);
      expect(on.enabled).toBe(true);
      expect(on.project).toBe(PROJECT);
    });
  });
});
