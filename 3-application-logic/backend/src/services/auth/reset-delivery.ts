import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { repoRoot } from '../../config/repo-root';

/**
 * How a password-reset token reaches the user. The prototype has no SMS or
 * e-mail provider (that would incur costs), so:
 *  - development: writes the message to a git-ignored local outbox file;
 *  - test: captured in memory by the test suite;
 *  - production: must be replaced with a real channel before deployment.
 * Tokens are never written to application logs.
 */
export abstract class ResetDelivery {
  abstract send(email: string, token: string, expiresAt: Date): Promise<void>;
}

@Injectable()
export class DevOutboxResetDelivery extends ResetDelivery {
  private readonly logger = new Logger('ResetDelivery');

  constructor(
    private readonly outboxDir = path.join(repoRoot(), 'var', 'outbox'),
    private readonly enabled = process.env.NODE_ENV === 'development',
  ) {
    super();
  }

  async send(email: string, token: string, expiresAt: Date): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        'Password reset requested but no delivery channel is configured',
      );
      return;
    }
    await mkdir(this.outboxDir, { recursive: true });
    const file = path.join(this.outboxDir, `password-reset-${Date.now()}.json`);
    await writeFile(
      file,
      JSON.stringify({ to: email, token, expiresAt }, null, 2),
      {
        mode: 0o600,
      },
    );
    this.logger.log(
      'Password reset message written to the local development outbox',
    );
  }
}
