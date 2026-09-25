import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  bodyParserErrorMiddleware,
  requestIdMiddleware,
} from './http-middleware';

describe('requestIdMiddleware', () => {
  it('attaches an id to the request and the response header', () => {
    const req = { headers: {} } as Request & { id?: string };
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next = jest.fn();
    requestIdMiddleware(req, res, next);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', req.id);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('bodyParserErrorMiddleware', () => {
  const run = (err: unknown) => {
    const next = jest.fn<void, [unknown?]>();
    bodyParserErrorMiddleware(err, {} as Request, {} as Response, next);
    return next.mock.calls[0][0];
  };

  it('turns a JSON parse failure into MALFORMED_JSON', () => {
    const out = run(
      Object.assign(new SyntaxError('bad'), { type: 'entity.parse.failed' }),
    );
    expect(out).toBeInstanceOf(BadRequestException);
    expect((out as BadRequestException).getResponse()).toMatchObject({
      code: 'MALFORMED_JSON',
    });
  });

  it('turns an oversize body into PayloadTooLargeException', () => {
    expect(
      run(Object.assign(new Error('too big'), { type: 'entity.too.large' })),
    ).toBeInstanceOf(PayloadTooLargeException);
  });

  it('passes unrelated errors through unchanged', () => {
    const err = new Error('other');
    expect(run(err)).toBe(err);
    expect(run(null)).toBeNull();
  });
});
