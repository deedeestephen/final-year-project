import { Logger } from '@nestjs/common';

/**
 * Where AI jobs wait to run. This in-process queue is enough for one API
 * instance; with several instances it is replaced by a Redis-backed queue
 * (BullMQ) behind the same interface, so jobs are shared and survive restarts.
 */
export interface JobQueue {
  enqueue(jobId: string): void;
  /** Resolves when nothing is queued or running (used by tests and shutdown). */
  idle(): Promise<void>;
}

export class InProcessJobQueue implements JobQueue {
  private readonly logger = new Logger('AiJobQueue');
  private readonly waiting: string[] = [];
  private running = 0;
  private idleWaiters: (() => void)[] = [];

  constructor(
    private readonly worker: (jobId: string) => Promise<void>,
    private readonly concurrency: number,
  ) {}

  enqueue(jobId: string): void {
    this.waiting.push(jobId);
    this.pump();
  }

  idle(): Promise<void> {
    if (this.running === 0 && this.waiting.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private pump(): void {
    while (this.running < this.concurrency && this.waiting.length > 0) {
      const jobId = this.waiting.shift()!;
      this.running += 1;
      // Next tick, so the request that queued the job answers first.
      setImmediate(() => {
        this.worker(jobId)
          .catch((err: unknown) =>
            this.logger.error(
              `AI job ${jobId} crashed: ${(err as Error).name}`,
            ),
          )
          .finally(() => {
            this.running -= 1;
            this.pump();
            if (this.running === 0 && this.waiting.length === 0) {
              const waiters = this.idleWaiters;
              this.idleWaiters = [];
              waiters.forEach((resolve) => resolve());
            }
          });
      });
    }
  }
}
