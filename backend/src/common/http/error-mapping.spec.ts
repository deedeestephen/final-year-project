import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { toErrorBody } from './error-mapping';

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(
    'db message with secret value 123456/78/1',
    {
      code,
      clientVersion: 'test',
      meta,
    },
  );

describe('toErrorBody', () => {
  it('maps HTTP exceptions to a stable code', () => {
    expect(toErrorBody(new NotFoundException('Patient not found'))).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Patient not found',
    });
    expect(toErrorBody(new ForbiddenException()).code).toBe('FORBIDDEN');
  });

  it('keeps validation details produced by the validation pipe', () => {
    const body = toErrorBody(
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: [{ field: 'psaNgMl', errors: ['must not be less than 0'] }],
      }),
    );
    expect(body).toEqual({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed',
      details: [{ field: 'psaNgMl', errors: ['must not be less than 0'] }],
    });
  });

  it('maps rate limiting to 429 RATE_LIMITED', () => {
    expect(toErrorBody(new ThrottlerException())).toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      code: 'RATE_LIMITED',
    });
  });

  it('maps a unique violation to 409 without leaking values', () => {
    const body = toErrorBody(prismaError('P2002', { target: ['email'] }));
    expect(body).toEqual({
      status: 409,
      code: 'CONFLICT',
      message: 'A record with the same unique value already exists',
      details: [{ field: 'email' }],
    });
    expect(JSON.stringify(body)).not.toContain('123456');
  });

  it('maps a missing record to 404 and a bad reference to 400', () => {
    expect(toErrorBody(prismaError('P2025')).status).toBe(404);
    expect(toErrorBody(prismaError('P2003'))).toMatchObject({
      status: 400,
      code: 'INVALID_REFERENCE',
    });
  });

  it('maps body-parser errors (oversize and malformed JSON)', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      status: 413,
    });
    const badJson = Object.assign(new Error('Unexpected token'), {
      type: 'entity.parse.failed',
      status: 400,
    });
    expect(toErrorBody(tooLarge)).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(toErrorBody(badJson)).toMatchObject({
      status: 400,
      code: 'MALFORMED_JSON',
    });
  });

  it('hides internal errors behind a generic 500', () => {
    const body = toErrorBody(
      new Error('connection string postgres://pca:pw@db failed'),
    );
    expect(body).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  it('hides unknown database errors too', () => {
    expect(toErrorBody(prismaError('P1001')).code).toBe('INTERNAL_ERROR');
  });

  it('never exposes the message of a 5xx HTTP exception but keeps its status', () => {
    const body = toErrorBody(
      new ServiceUnavailableException('db at 10.0.0.5 down'),
    );
    expect(body).toEqual({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'An unexpected error occurred',
    });
  });

  it('uses a generic code for unmapped client statuses and honours custom codes', () => {
    expect(toErrorBody(new HttpException('teapot', 418)).code).toBe('ERROR');
    expect(
      toErrorBody(
        new UnauthorizedException({
          code: 'ACCOUNT_LOCKED',
          message: 'Account locked',
        }),
      ),
    ).toEqual({
      status: 401,
      code: 'ACCOUNT_LOCKED',
      message: 'Account locked',
    });
  });

  it('handles unique violations whose target is a string or missing', () => {
    expect(
      toErrorBody(prismaError('P2002', { target: 'users_email_key' })).details,
    ).toEqual([{ field: 'users_email_key' }]);
    expect(toErrorBody(prismaError('P2002'))).not.toHaveProperty('details');
  });

  it('ignores non-object throwables safely', () => {
    expect(toErrorBody('a string').code).toBe('INTERNAL_ERROR');
    expect(toErrorBody(null).code).toBe('INTERNAL_ERROR');
  });
});
