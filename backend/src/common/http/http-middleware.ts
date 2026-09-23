import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { resolveRequestId } from '../logging/logger-options';

/**
 * Assigns the request id before anything else runs, so even requests that
 * never reach a route (404 outside /api, parser errors) carry one.
 */
export function requestIdMiddleware(
  req: Request & { id?: string },
  res: Response,
  next: NextFunction,
): void {
  req.id = resolveRequestId(req, res);
  next();
}

/**
 * Translates body-parser failures into typed HTTP exceptions. Without this,
 * Nest turns every JSON SyntaxError into a generic BadRequest and the
 * MALFORMED_JSON code is lost.
 */
export function bodyParserErrorMiddleware(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const type = (err as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') {
    next(
      new BadRequestException({
        code: 'MALFORMED_JSON',
        message: 'Request body is not valid JSON',
      }),
    );
    return;
  }
  if (type === 'entity.too.large') {
    next(
      new PayloadTooLargeException({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body is too large',
      }),
    );
    return;
  }
  next(err);
}
