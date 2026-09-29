import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import {
  chatAnswerResultSchema,
  inferenceResultSchema,
  modelInfoSchema,
  type ChatAnswerResult,
  type ChatAudience,
  type InferenceRequest,
  type InferenceResult,
  type ModelInfo,
} from './ai-contract';

/** Why a call to ai-services did not produce a usable result. */
export type AiFailureKind =
  | 'NOT_CONFIGURED'
  | 'UNREACHABLE'
  | 'TIMED_OUT'
  | 'INSUFFICIENT_INPUTS'
  | 'REJECTED'
  | 'INVALID_RESPONSE';

export class AiServiceError extends Error {
  constructor(
    readonly kind: AiFailureKind,
    message: string,
    /** The AI service's HTTP status, when it answered with an error. */
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

/**
 * The only way the backend talks to ai-services (Layer 4): service token,
 * timeout, and strict validation of every response against the contract.
 */
@Injectable()
export class AiBrokerService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get enabled(): boolean {
    return this.config.ai.serviceToken.length > 0;
  }

  async infer(request: InferenceRequest): Promise<InferenceResult> {
    const body = await this.call('/v1/infer', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    const parsed = inferenceResultSchema.safeParse(body);
    if (!parsed.success || parsed.data.jobId !== request.jobId) {
      throw new AiServiceError(
        'INVALID_RESPONSE',
        'The AI service returned an invalid or unlabelled result',
      );
    }
    return parsed.data;
  }

  /** Quoted passages for a chat question (Phase 13), or no match. */
  async chatAnswer(request: {
    question: string;
    audience: ChatAudience;
    language: string;
  }): Promise<ChatAnswerResult> {
    const body = await this.call(
      '/v1/chat/answer',
      { method: 'POST', body: JSON.stringify(request) },
      this.config.chat.timeoutMs,
    );
    const parsed = chatAnswerResultSchema.safeParse(body);
    if (!parsed.success) {
      throw new AiServiceError(
        'INVALID_RESPONSE',
        'The AI service returned an invalid chat answer',
      );
    }
    return parsed.data;
  }

  async models(): Promise<ModelInfo[]> {
    const body = await this.call('/v1/models', { method: 'GET' });
    const parsed = modelInfoSchema.array().max(100).safeParse(body);
    if (!parsed.success) {
      throw new AiServiceError(
        'INVALID_RESPONSE',
        'The AI service returned an invalid model list',
      );
    }
    return parsed.data;
  }

  /** Liveness only; never throws. */
  async health(): Promise<'up' | 'down' | 'disabled'> {
    if (!this.enabled) return 'disabled';
    try {
      const res = await fetch(`${this.config.ai.serviceUrl}/v1/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      return res.ok ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private async call(
    path: string,
    init: RequestInit,
    timeoutMs = this.config.ai.timeoutMs,
  ): Promise<unknown> {
    if (!this.enabled) {
      throw new AiServiceError(
        'NOT_CONFIGURED',
        'AI analysis is switched off on this server',
      );
    }
    let res: Response;
    try {
      res = await fetch(`${this.config.ai.serviceUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.config.ai.serviceToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if ((err as Error).name === 'TimeoutError') {
        throw new AiServiceError(
          'TIMED_OUT',
          `The AI service did not answer within ${Math.round(timeoutMs / 1000)} seconds`,
        );
      }
      throw new AiServiceError(
        'UNREACHABLE',
        'The AI service could not be reached',
      );
    }
    if (res.status === 422) {
      throw new AiServiceError(
        'INSUFFICIENT_INPUTS',
        'No AI module could use the data available for this patient',
      );
    }
    if (!res.ok) {
      throw new AiServiceError(
        'REJECTED',
        `The AI service refused the request (HTTP ${res.status})`,
        res.status,
      );
    }
    try {
      return (await res.json()) as unknown;
    } catch {
      throw new AiServiceError(
        'INVALID_RESPONSE',
        'The AI service returned something that is not JSON',
      );
    }
  }
}
