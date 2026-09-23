import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toErrorBody } from './error-mapping';

/**
 * Centralised error handling (API gateway requirement): every error leaves
 * the API as `{ "error": { status, code, message, details?, requestId } }`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();
    const body = toErrorBody(exception);

    if (body.status >= 500) {
      // Full detail goes to the server log only (redacted by the logger config).
      this.logger.error(
        { requestId: req.id, err: exception },
        'Unhandled error while processing request',
      );
    }

    res.status(body.status).json({ error: { ...body, requestId: req.id } });
  }
}
