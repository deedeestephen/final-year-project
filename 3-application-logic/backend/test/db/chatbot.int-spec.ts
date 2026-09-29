import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { FIXED_TEXT } from '../../src/services/chatbot/chat-safety';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
} from './helpers';

const prisma = new PrismaClient();
const TOKEN = 'integration-chat-service-token';

interface AskBody {
  question: { id: string; text: string; role: string };
  answer: {
    text: string;
    safety: string;
    mode: string;
    sources: { name: string; url: string }[];
    disclaimer: string;
    reviewStatus?: string;
  };
}
interface ErrorBody {
  error: { code: string };
}

/** What the fake AI service answers, by question. */
type Reply = 'answer' | 'no-match' | 'dose' | 'language' | 'down' | 'invalid';

describe('the chatbot (real database, fake AI service)', () => {
  let fakeAi: Server;
  let reply: Reply = 'answer';
  const asked: { question: string; audience: string; language: string }[] = [];
  let app: NestExpressApplication;
  let patient: string;
  let patientId: string;
  let otherPatient: string;
  let clinician: string;
  let pathologist: string;
  let admin: string;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const start = async (token: string, language = 'en') =>
    (
      await http()
        .post('/api/v1/chat/conversations')
        .set(as(token))
        .send({ language })
        .expect(201)
    ).body as { id: string; audience: string };

  const ask = (token: string, id: string, text: string) =>
    http()
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .set(as(token))
      .send({ text });

  beforeAll(async () => {
    fakeAi = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const send = (status: number, body: unknown) => {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        };
        if (req.headers.authorization !== `Bearer ${TOKEN}`) {
          return send(401, { detail: 'Invalid service token' });
        }
        const body = JSON.parse(
          Buffer.concat(chunks).toString(),
        ) as (typeof asked)[number];
        asked.push(body);
        const kb = {
          version: 'kb-test',
          reviewStatus: 'Draft for review by a qualified clinician (test).',
        };
        switch (reply) {
          case 'no-match':
            return send(200, {
              mode: 'EXTRACTIVE',
              matched: false,
              text: null,
              passages: [],
              sources: [],
              knowledgeBase: kb,
            });
          case 'dose':
            return send(200, {
              mode: 'EXTRACTIVE',
              matched: true,
              text: 'Take 400 mg twice a day.',
              passages: [
                { articleId: 'x', title: 'X', heading: 'Y', score: 3 },
              ],
              sources: [{ name: 'Test source', url: '' }],
              knowledgeBase: kb,
            });
          case 'language':
            return send(409, { detail: { code: 'LANGUAGE_NOT_AVAILABLE' } });
          case 'down':
            return send(503, { detail: { code: 'CHAT_UNAVAILABLE' } });
          case 'invalid':
            return send(200, { mode: 'GENERATED', matched: true, text: 'x' });
          default:
            return send(200, {
              mode: 'EXTRACTIVE',
              matched: true,
              text: 'PSA (prostate-specific antigen) is a protein made by the prostate.',
              passages: [
                {
                  articleId: 'psa-test',
                  title: 'What is a PSA test?',
                  heading: 'What PSA is',
                  score: 6.4,
                },
              ],
              sources: [
                {
                  name: 'NHS: PSA testing',
                  url: 'https://www.nhs.uk/conditions/prostate-cancer/psa-testing/',
                },
              ],
              knowledgeBase: kb,
            });
        }
      });
    });
    await new Promise<void>((resolve) =>
      fakeAi.listen(0, '127.0.0.1', resolve),
    );
    const { port } = fakeAi.address() as AddressInfo;
    await ensureSeeded(prisma);
    app = await createDbTestApp({
      AI_SERVICE_URL: `http://127.0.0.1:${port}`,
      AI_SERVICE_TOKEN: TOKEN,
      CHAT_TIMEOUT_MS: '1000',
      CHAT_MAX_QUESTIONS_PER_HOUR: '8',
    });
    const facility = await createFacility(prisma, 'CHAT');
    const p = await createUser(prisma, 'PATIENT', null);
    patientId = p.id;
    patient = await loginAs(app, p.email);
    otherPatient = await loginAs(
      app,
      (await createUser(prisma, 'PATIENT', null)).email,
    );
    clinician = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facility)).email,
    );
    pathologist = await loginAs(
      app,
      (await createUser(prisma, 'PATHOLOGIST', facility)).email,
    );
    admin = await loginAs(app, (await createUser(prisma, 'ADMIN', null)).email);
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => fakeAi.close(resolve));
    await prisma.$disconnect();
  });

  beforeEach(() => {
    reply = 'answer';
    asked.length = 0;
  });

  it('is for patients and clinicians only, and the audience comes from the role', async () => {
    for (const token of [pathologist, admin]) {
      await http()
        .post('/api/v1/chat/conversations')
        .set(as(token))
        .send({})
        .expect(403);
    }
    expect((await start(patient)).audience).toBe('patient');
    expect((await start(clinician)).audience).toBe('clinician');
    const bem = await http()
      .post('/api/v1/chat/conversations')
      .set(as(patient))
      .send({ language: 'bem' })
      .expect(409);
    expect((bem.body as ErrorBody).error.code).toBe('LANGUAGE_NOT_AVAILABLE');
    await http()
      .post('/api/v1/chat/conversations')
      .set(as(patient))
      .send({ language: 'fr' })
      .expect(400);
  });

  it('answers from the knowledge base with sources, a disclaimer and the review status', async () => {
    const c = await start(patient);
    const res = await ask(
      patient,
      c.id,
      'What does a PSA test measure?',
    ).expect(200);
    const body = res.body as AskBody;
    expect(body.question).toMatchObject({
      role: 'user',
      text: 'What does a PSA test measure?',
    });
    expect(body.answer).toMatchObject({
      safety: 'OK',
      mode: 'EXTRACTIVE',
      sources: [{ name: 'NHS: PSA testing' }],
      reviewStatus: 'Draft for review by a qualified clinician (test).',
    });
    expect(body.answer.disclaimer).toContain('not medical advice');
    expect(asked).toEqual([
      {
        question: 'What does a PSA test measure?',
        audience: 'patient',
        language: 'en',
      },
    ]);

    // The clinician gets the clinician audience and disclaimer.
    const cc = await start(clinician);
    const clin = (await ask(clinician, cc.id, 'What is PI-RADS?').expect(200))
      .body as AskBody;
    expect(clin.answer.disclaimer).toContain('clinical judgement');
    expect(asked.at(-1)?.audience).toBe('clinician');
  });

  it('never looks anything up for emergencies, medicines or own results', async () => {
    const c = await start(patient);
    const urgent = (
      await ask(patient, c.id, 'I cannot pass urine at all').expect(200)
    ).body as AskBody;
    expect(urgent.answer).toMatchObject({
      safety: 'URGENT_CARE',
      mode: 'FIXED',
      text: FIXED_TEXT.urgentMedical,
      sources: [],
    });
    const dose = (
      await ask(patient, c.id, 'What dose of tamsulosin should I take?').expect(
        200,
      )
    ).body as AskBody;
    expect(dose.answer).toMatchObject({
      safety: 'DECLINED',
      text: FIXED_TEXT.medicines,
    });
    const own = (await ask(patient, c.id, 'Is my PSA bad?').expect(200))
      .body as AskBody;
    expect(own.answer).toMatchObject({
      safety: 'DECLINED',
      text: FIXED_TEXT.ownResults,
    });
    expect(asked).toEqual([]);
  });

  it('says so when nothing matches, and never shows an answer that fails the output check', async () => {
    const c = await start(patient);
    reply = 'no-match';
    const none = (await ask(patient, c.id, 'hello').expect(200))
      .body as AskBody;
    expect(none.answer).toMatchObject({
      safety: 'NO_SOURCE',
      text: FIXED_TEXT.noSourcePatient,
      sources: [],
    });
    reply = 'dose';
    const blocked = (await ask(patient, c.id, 'tell me about pain').expect(200))
      .body as AskBody;
    expect(blocked.answer.safety).toBe('NO_SOURCE');
    expect(blocked.answer.text).not.toContain('mg');
  });

  it('keeps conversations private, lists them and lets the owner delete them', async () => {
    const c = await start(patient);
    await ask(patient, c.id, 'What does a PSA test measure?').expect(200);
    // Another account cannot see, use or delete it.
    await http()
      .get(`/api/v1/chat/conversations/${c.id}`)
      .set(as(otherPatient))
      .expect(404);
    await ask(otherPatient, c.id, 'hello').expect(404);
    await http()
      .delete(`/api/v1/chat/conversations/${c.id}`)
      .set(as(otherPatient))
      .expect(404);

    const one = await http()
      .get(`/api/v1/chat/conversations/${c.id}`)
      .set(as(patient))
      .expect(200);
    expect(one.body).toMatchObject({
      id: c.id,
      messageCount: 2,
      preview: 'What does a PSA test measure?',
    });
    const list = await http()
      .get('/api/v1/chat/conversations?pageSize=50')
      .set(as(patient))
      .expect(200);
    const ids = (list.body as { items: { id: string }[] }).items.map(
      (i) => i.id,
    );
    expect(ids[0]).toBe(c.id);
    const others = await http()
      .get('/api/v1/chat/conversations')
      .set(as(otherPatient))
      .expect(200);
    expect(JSON.stringify(others.body)).not.toContain(c.id);

    await http()
      .delete(`/api/v1/chat/conversations/${c.id}`)
      .set(as(patient))
      .expect(204);
    await http()
      .get(`/api/v1/chat/conversations/${c.id}`)
      .set(as(patient))
      .expect(404);
  });

  it('audits every question without its text', async () => {
    const c = await start(patient);
    const secret = 'SYNTHETIC unique question text 4711';
    await ask(patient, c.id, secret).expect(200);
    const rows = await prisma.auditLog.findMany({
      where: { action: 'chat.asked', actorUserId: patientId },
      orderBy: { seq: 'asc' },
    });
    expect(rows.length).toBeGreaterThan(0);
    const all = JSON.stringify(rows, (_k, v: unknown) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    expect(all).not.toContain('4711');
    expect(rows.at(-1)?.details).toMatchObject({
      safety: 'OK',
      mode: 'EXTRACTIVE',
      sources: 1,
      knowledgeBase: 'kb-test',
    });
  });

  it('answers 503 when the assistant is down or answers badly, and 409 for a language it lacks', async () => {
    const c = await start(clinician);
    for (const r of ['down', 'invalid'] as const) {
      reply = r;
      const res = await ask(clinician, c.id, 'What is PI-RADS?').expect(503);
      expect((res.body as ErrorBody).error.code).toBe('CHAT_UNAVAILABLE');
    }
    reply = 'language';
    const res = await ask(clinician, c.id, 'What is PI-RADS?').expect(409);
    expect((res.body as ErrorBody).error.code).toBe('LANGUAGE_NOT_AVAILABLE');
    // Failed questions are not stored.
    const one = await http()
      .get(`/api/v1/chat/conversations/${c.id}`)
      .set(as(clinician))
      .expect(200);
    expect((one.body as { messageCount: number }).messageCount).toBe(0);
  });

  it('limits questions per hour and says when to try again', async () => {
    const token = await loginAs(
      app,
      (await createUser(prisma, 'PATIENT', null)).email,
    );
    const c = await start(token);
    for (let i = 0; i < 8; i++) {
      await ask(token, c.id, `What does a PSA test measure? ${i}`).expect(200);
    }
    const limited = await ask(token, c.id, 'one more').expect(429);
    expect((limited.body as ErrorBody).error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('checks the question text', async () => {
    const c = await start(patient);
    await ask(patient, c.id, '').expect(400);
    await ask(patient, c.id, 'x'.repeat(1001)).expect(400);
    await ask(patient, c.id, '<script>alert(1)</script>').expect(400);
    await http()
      .post('/api/v1/chat/conversations/not-a-uuid/messages')
      .set(as(patient))
      .send({ text: 'PSA' })
      .expect(400);
  });
});
