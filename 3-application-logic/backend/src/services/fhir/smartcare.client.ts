import { Inject, Injectable } from '@nestjs/common';
import type { Bundle, OperationOutcome } from 'fhir/r4';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

export type SmartCareFailureKind =
  'NOT_CONFIGURED' | 'UNREACHABLE' | 'TIMED_OUT' | 'REJECTED';

export class SmartCareError extends Error {
  constructor(
    readonly kind: SmartCareFailureKind,
    message: string,
    readonly httpStatus: number | null = null,
    /** The receiver's own reason, cleaned; kept for the audit log only. */
    readonly remoteDetail: string | null = null,
  ) {
    super(message);
    this.name = 'SmartCareError';
  }
}

export interface SmartCareReceipt {
  httpStatus: number;
  /** The id the receiving server gave the bundle, when it says. */
  receiverId: string | null;
}

/** Longest part of a remote error message that is kept. */
const MAX_REMOTE_MESSAGE = 300;

/**
 * Sends an export to the SmartCare Pro FHIR endpoint (`POST {base}/Bundle`,
 * standard FHIR REST create). Real SmartCare Pro access needs a data-sharing
 * agreement, so development points this at the local mock
 * (`npm run smartcare:mock`). Redirects are refused, so the token is never
 * sent to another server.
 */
@Injectable()
export class SmartCareClient {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get enabled(): boolean {
    return this.config.fhir.smartcareUrl.length > 0;
  }

  /** The target's host name only (for audit and the admin page). */
  get targetHost(): string | null {
    if (!this.enabled) return null;
    return new URL(this.config.fhir.smartcareUrl).host;
  }

  async send(bundle: Bundle): Promise<SmartCareReceipt> {
    if (!this.enabled) {
      throw new SmartCareError(
        'NOT_CONFIGURED',
        'No SmartCare Pro address is set on this server',
      );
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };
    if (this.config.fhir.smartcareToken) {
      headers.Authorization = `Bearer ${this.config.fhir.smartcareToken}`;
    }
    let res: Response;
    try {
      res = await fetch(`${this.config.fhir.smartcareUrl}/Bundle`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bundle),
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.fhir.timeoutMs),
      });
    } catch (err) {
      // A timed-out fetch rejects with a DOMException, which is not always
      // an instance of Error, so only the name is checked.
      if ((err as { name?: unknown } | null)?.name === 'TimeoutError') {
        throw new SmartCareError(
          'TIMED_OUT',
          'SmartCare Pro did not answer in time',
        );
      }
      throw new SmartCareError(
        'UNREACHABLE',
        'SmartCare Pro could not be reached',
      );
    }
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      // The receiver's text is untrusted: it goes to the audit log (cleaned
      // and shortened), never into the API answer.
      throw new SmartCareError(
        res.status >= 500 ? 'UNREACHABLE' : 'REJECTED',
        res.status >= 500
          ? `SmartCare Pro answered with an error (${res.status})`
          : `SmartCare Pro refused the export (${res.status})`,
        res.status,
        remoteMessage(text),
      );
    }
    return { httpStatus: res.status, receiverId: receiverIdOf(res, text) };
  }
}

/** The first issue of an OperationOutcome, cleaned and shortened. */
function remoteMessage(text: string): string | null {
  try {
    const outcome = JSON.parse(text) as OperationOutcome;
    const issue = outcome.issue?.[0];
    const message = issue?.diagnostics ?? issue?.details?.text;
    if (typeof message !== 'string') return null;
    return message
      .replace(/[^\x20-\x7E]/g, ' ')
      .trim()
      .slice(0, MAX_REMOTE_MESSAGE);
  } catch {
    return null;
  }
}

function receiverIdOf(res: Response, text: string): string | null {
  const location = res.headers.get('Location');
  const fromLocation = location?.match(/Bundle\/([A-Za-z0-9\-.]{1,64})/)?.[1];
  if (fromLocation) return fromLocation;
  try {
    const body = JSON.parse(text) as { id?: unknown };
    return typeof body.id === 'string' && /^[A-Za-z0-9\-.]{1,64}$/.test(body.id)
      ? body.id
      : null;
  } catch {
    return null;
  }
}
