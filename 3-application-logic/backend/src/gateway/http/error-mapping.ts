import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Body of every error response: `{ "error": { ...ErrorBody, requestId } }`. */
export interface ErrorBody {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  423: 'LOCKED',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

const INTERNAL: ErrorBody = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  code: 'INTERNAL_ERROR',
  message: 'An unexpected error occurred',
};

/**
 * Converts any thrown value into a safe, stable error body.
 * Internal details (stack traces, SQL, connection strings, record values)
 * never reach the client; they are logged server-side by the filter.
 */
export function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof HttpException) return fromHttpException(err);
  if (err instanceof Prisma.PrismaClientKnownRequestError)
    return fromPrisma(err);
  const parserError = fromBodyParser(err);
  if (parserError) return parserError;
  return INTERNAL;
}

function fromHttpException(err: HttpException): ErrorBody {
  const status = err.getStatus();
  const response = err.getResponse();
  const body: ErrorBody = {
    status,
    code:
      CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
    message: err.message,
  };
  if (typeof response === 'object' && response !== null) {
    const r = response as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };
    if (typeof r.code === 'string') body.code = r.code;
    if (typeof r.message === 'string') body.message = r.message;
    if (r.details !== undefined) body.details = r.details;
  }
  if (status >= 500) return { ...INTERNAL, status, code: body.code };
  return body;
}

function fromPrisma(err: Prisma.PrismaClientKnownRequestError): ErrorBody {
  switch (err.code) {
    case 'P2002': {
      const target = (err.meta?.target as string[] | string | undefined) ?? [];
      const fields = (Array.isArray(target) ? target : [target]).map(
        (field) => ({ field }),
      );
      return {
        status: HttpStatus.CONFLICT,
        code: 'CONFLICT',
        message: 'A record with the same unique value already exists',
        ...(fields.length > 0 ? { details: fields } : {}),
      };
    }
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'Record not found',
      };
    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'INVALID_REFERENCE',
        message: 'A referenced record does not exist',
      };
    default:
      return INTERNAL;
  }
}

function fromBodyParser(err: unknown): ErrorBody | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const type = (err as { type?: unknown }).type;
  if (type === 'entity.too.large') {
    return {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
    };
  }
  if (type === 'entity.parse.failed') {
    return {
      status: 400,
      code: 'MALFORMED_JSON',
      message: 'Request body is not valid JSON',
    };
  }
  return undefined;
}
