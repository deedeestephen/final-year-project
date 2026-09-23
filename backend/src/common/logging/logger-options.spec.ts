import { Writable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import { loadConfig } from '../../config/app-config';
import {
  loggerOptions,
  REDACT_PATHS,
  resolveRequestId,
} from './logger-options';

function capture(): { logger: pino.Logger; lines: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  const logger = pino(
    { redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } },
    stream,
  );
  return { logger, lines: () => chunks.join('') };
}

describe('log redaction', () => {
  it('removes credentials, tokens and patient identifiers', () => {
    const { logger, lines } = capture();
    logger.info(
      {
        req: {
          headers: {
            authorization: 'Bearer eyJhbGciOi.secret',
            cookie: 'sid=abc',
          },
        },
        body: {
          password: 'Hunter2!',
          refreshToken: 'rt-secret',
          nationalId: '123456/78/1',
          givenName: 'Mwamba',
          email: 'patient@example.org',
          psaNgMl: 4.2,
        },
      },
      'request',
    );
    const out = lines();
    for (const secret of [
      'eyJhbGciOi',
      'sid=abc',
      'Hunter2!',
      'rt-secret',
      '123456/78/1',
      'Mwamba',
      'patient@example.org',
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('4.2'); // non-identifying values are kept
  });
});

describe('resolveRequestId', () => {
  const res = () => {
    const setHeader = jest.fn();
    return { setHeader, res: { setHeader } as unknown as ServerResponse };
  };
  const req = (id?: string) =>
    ({ headers: id ? { 'x-request-id': id } : {} }) as IncomingMessage;

  it('keeps a well-formed incoming id and echoes it', () => {
    const r = res();
    expect(resolveRequestId(req('trace-12345678'), r.res)).toBe(
      'trace-12345678',
    );
    expect(r.setHeader).toHaveBeenCalledWith('x-request-id', 'trace-12345678');
  });

  it.each(['short', '<script>alert(1)</script>', 'a'.repeat(65)])(
    'replaces unsafe id %p',
    (id) => {
      expect(resolveRequestId(req(id), res().res)).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});

describe('loggerOptions', () => {
  const env = {
    DATABASE_URL: 'postgresql://u:p@h:5432/d',
    MONGO_URL: 'mongodb://u:p@h:27018/d',
  };

  it('is silent in tests and pretty only in development', () => {
    const test = loggerOptions(loadConfig({ ...env, NODE_ENV: 'test' }))
      .pinoHttp as pino.LoggerOptions;
    expect(test.level).toBe('silent');
    expect(test.transport).toBeUndefined();
    const dev = loggerOptions(loadConfig(env)).pinoHttp as pino.LoggerOptions;
    expect(dev.transport).toMatchObject({ target: 'pino-pretty' });
  });

  it('logs the request path without its query string', () => {
    const opts = loggerOptions(loadConfig(env)).pinoHttp as {
      serializers: { req: (r: unknown) => unknown };
    };
    expect(
      opts.serializers.req({
        id: '1',
        method: 'GET',
        url: '/api/v1/x?token=abc',
      }),
    ).toEqual({
      id: '1',
      method: 'GET',
      path: '/api/v1/x',
    });
  });

  it('reuses the id assigned by the request-id middleware', () => {
    const opts = loggerOptions(loadConfig(env)).pinoHttp as {
      genReqId: (req: unknown, res: unknown) => string;
    };
    expect(
      opts.genReqId(
        { id: 'already-set-1234', headers: {} },
        { setHeader: jest.fn() },
      ),
    ).toBe('already-set-1234');
    expect(opts.genReqId({ headers: {} }, { setHeader: jest.fn() })).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it('does not log health-check noise', () => {
    const opts = loggerOptions(loadConfig(env)).pinoHttp as {
      autoLogging: { ignore: (req: { url?: string }) => boolean };
    };
    expect(opts.autoLogging.ignore({ url: '/api/v1/health/ready' })).toBe(true);
    expect(opts.autoLogging.ignore({ url: '/api/v1/patients' })).toBe(false);
    expect(opts.autoLogging.ignore({})).toBe(false);
  });
});
