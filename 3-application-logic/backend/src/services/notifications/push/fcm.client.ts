import { createPrivateKey, sign, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import type { AppConfig } from '../../../config/app-config';

/** One push to one phone. Title and body are the notification's own texts. */
export interface PushMessage {
  token: string;
  title: string;
  body: string;
  /** Small values the app reads when the push is tapped. */
  data: Record<string, string>;
}

/**
 * - `sent`: Firebase accepted it.
 * - `invalid-token`: the phone's token is no longer valid (the app was
 *   removed or signed out, or it belongs to another Firebase project), so the
 *   phone should be forgotten.
 * - `failed`: anything else. It is logged; the notification stays in the app.
 */
export type PushOutcome = 'sent' | 'invalid-token' | 'failed';

export interface PushSender {
  /** False when no Firebase project is configured: push is off. */
  readonly enabled: boolean;
  /** The Firebase project id, for the health check; null when off. */
  readonly project: string | null;
  send(message: PushMessage): Promise<PushOutcome>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');

/** Push is off: nothing is sent. */
export class NoPushSender implements PushSender {
  readonly enabled = false;
  readonly project = null;

  send(): Promise<PushOutcome> {
    return Promise.resolve('failed');
  }
}

export interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: KeyObject;
  tokenUri: string;
}

const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TIMEOUT_MS = 10_000;
/** A Google access token is renewed this long before it expires. */
const RENEW_EARLY_MS = 60_000;

/**
 * Reads a Firebase service-account key file (Firebase console › Project
 * settings › Service accounts). Errors say what is wrong with the file, never
 * what is in it: the private key is a secret.
 */
export function readServiceAccount(file: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(
      'FCM_SERVICE_ACCOUNT_FILE: the file cannot be read as JSON',
    );
  }
  const json = (parsed ?? {}) as Record<string, unknown>;
  const text = (key: string): string | null =>
    typeof json[key] === 'string' && json[key] !== '' ? json[key] : null;
  const projectId = text('project_id');
  const clientEmail = text('client_email');
  const pem = text('private_key');
  if (json.type !== 'service_account' || !projectId || !clientEmail || !pem) {
    throw new Error(
      'FCM_SERVICE_ACCOUNT_FILE: not a Firebase service-account key (it needs type, project_id, client_email and private_key)',
    );
  }
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey(pem);
  } catch {
    throw new Error(
      'FCM_SERVICE_ACCOUNT_FILE: the private key in the file cannot be read',
    );
  }
  const tokenUri = text('token_uri') ?? GOOGLE_TOKEN_URI;
  // The signed sign-in request goes to this address: https only, apart from
  // this computer (the tests' stand-in).
  const uri = new URL(tokenUri);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(uri.hostname);
  if (uri.protocol !== 'https:' && !(uri.protocol === 'http:' && local)) {
    throw new Error('FCM_SERVICE_ACCOUNT_FILE: token_uri must use https');
  }
  return { projectId, clientEmail, privateKey, tokenUri };
}

/**
 * Sends pushes through Firebase Cloud Messaging's HTTP v1 API. It signs in to
 * Google with the service account (a JWT signed with its key, exchanged for
 * an access token that lasts an hour). Redirects are refused, so neither the
 * key's assertion nor the access token is ever sent to another server.
 */
export class FcmClient implements PushSender {
  readonly enabled = true;
  private readonly logger = new Logger('Push');
  private access: { token: string; expiresAt: number } | null = null;
  private pending: Promise<string> | null = null;

  constructor(
    private readonly account: ServiceAccount,
    private readonly apiUrl: string,
    private readonly now: () => number = Date.now,
  ) {}

  get project(): string {
    return this.account.projectId;
  }

  async send(message: PushMessage): Promise<PushOutcome> {
    const url = `${this.apiUrl}/v1/projects/${encodeURIComponent(this.account.projectId)}/messages:send`;
    const body = JSON.stringify({
      message: {
        token: message.token,
        notification: { title: message.title, body: message.body },
        data: message.data,
        // A locked phone shows that a message came, not what it says.
        android: { notification: { visibility: 'PRIVATE' } },
      },
    });
    // A refused access token is renewed once (it may have been revoked).
    for (let attempt = 0; attempt < 2; attempt++) {
      let token: string;
      try {
        token = await this.accessToken();
      } catch (err) {
        this.logger.warn(`Google sign-in for push failed: ${reason(err)}`);
        return 'failed';
      }
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body,
          redirect: 'error',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        this.logger.warn(`Firebase could not be reached: ${reason(err)}`);
        return 'failed';
      }
      if (res.ok) {
        await res.text().catch(() => '');
        return 'sent';
      }
      const code = await errorCode(res);
      if (res.status === 401 && attempt === 0) {
        this.access = null;
        continue;
      }
      // Only Firebase's own codes forget a phone: a plain 404 could also be
      // a wrong project id, which must not wipe every phone.
      if (code === 'UNREGISTERED' || code === 'SENDER_ID_MISMATCH') {
        return 'invalid-token';
      }
      this.logger.warn(
        `Firebase refused a push (${res.status}${code ? `, ${code}` : ''})`,
      );
      return 'failed';
    }
    return 'failed';
  }

  /** A Google access token, renewed shortly before it expires; one request at a time. */
  private accessToken(): Promise<string> {
    if (this.access && this.access.expiresAt - RENEW_EARLY_MS > this.now()) {
      return Promise.resolve(this.access.token);
    }
    this.pending ??= this.signIn().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async signIn(): Promise<string> {
    const now = Math.floor(this.now() / 1000);
    const part = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({
      iss: this.account.clientEmail,
      scope: SCOPE,
      aud: this.account.tokenUri,
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = sign(
      'RSA-SHA256',
      Buffer.from(unsigned),
      this.account.privateKey,
    ).toString('base64url');
    const res = await fetch(this.account.tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }).toString(),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const answer = (await res.json().catch(() => ({}))) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (!res.ok || typeof answer.access_token !== 'string') {
      throw new Error(`Google refused the service account (${res.status})`);
    }
    const seconds =
      typeof answer.expires_in === 'number' ? answer.expires_in : 3600;
    this.access = {
      token: answer.access_token,
      expiresAt: this.now() + seconds * 1000,
    };
    return answer.access_token;
  }
}

/** Firebase's error code (`details[].errorCode`), or the general status. */
async function errorCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as {
      error?: { status?: unknown; details?: { errorCode?: unknown }[] };
    };
    const detail = body.error?.details?.find(
      (d) => typeof d?.errorCode === 'string',
    )?.errorCode;
    if (typeof detail === 'string') return detail;
    return typeof body.error?.status === 'string' ? body.error.status : null;
  } catch {
    return null;
  }
}

function reason(err: unknown): string {
  // A timed-out fetch rejects with a DOMException, and fetch's own errors
  // ("fetch failed") carry the real reason in `cause`: read the fields only.
  const e = err as {
    name?: unknown;
    message?: unknown;
    cause?: { code?: unknown; message?: unknown };
  } | null;
  if (e?.name === 'TimeoutError') return 'timed out';
  for (const text of [e?.cause?.code, e?.cause?.message, e?.message]) {
    if (typeof text === 'string' && text) return text;
  }
  return 'unknown error';
}

/** Push is on when a service-account key file is configured. */
export function pushSenderFrom(config: AppConfig): PushSender {
  const file = config.push.serviceAccountFile;
  return file
    ? new FcmClient(readServiceAccount(file), config.push.apiUrl)
    : new NoPushSender();
}
