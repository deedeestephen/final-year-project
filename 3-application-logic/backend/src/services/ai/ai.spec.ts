import { randomUUID } from 'node:crypto';
import {
  inferenceResultSchema,
  MAX_ARTIFACT_BASE64,
  MOCK_DISCLAIMER,
} from './ai-contract';
import { InProcessJobQueue } from './job-queue';

const result = (overrides: Record<string, unknown> = {}) => ({
  jobId: randomUUID(),
  provenance: 'MOCK',
  disclaimer: MOCK_DISCLAIMER,
  modelVersions: { ann_clinical: 'mock-0.1' },
  outputs: { pcaProbability: 0.4, modulesUsed: ['ann_clinical'] },
  explanations: [],
  ...overrides,
});

describe('AI contract check', () => {
  it('accepts a correctly labelled mock result', () => {
    expect(inferenceResultSchema.safeParse(result()).success).toBe(true);
  });

  it('refuses a mock result without the exact mock disclaimer', () => {
    expect(
      inferenceResultSchema.safeParse(
        result({ disclaimer: 'Development data, not a clinical result' }),
      ).success,
    ).toBe(false);
  });

  it('refuses out-of-range values and unknown provenance', () => {
    expect(
      inferenceResultSchema.safeParse(
        result({ outputs: { pcaProbability: 1.3, modulesUsed: [] } }),
      ).success,
    ).toBe(false);
    expect(
      inferenceResultSchema.safeParse(
        result({ outputs: { gleasonGradeGroup: 6, modulesUsed: [] } }),
      ).success,
    ).toBe(false);
    expect(
      inferenceResultSchema.safeParse(result({ provenance: 'GUESS' })).success,
    ).toBe(false);
  });

  it('requires each explanation to be an artifact or a stated reason', () => {
    const ok = result({
      explanations: [
        { kind: 'GRADCAM', module: 'resnet50_imaging', unavailableReason: 'x' },
      ],
    });
    const neither = result({
      explanations: [{ kind: 'SHAP', module: 'ann_clinical' }],
    });
    expect(inferenceResultSchema.safeParse(ok).success).toBe(true);
    expect(inferenceResultSchema.safeParse(neither).success).toBe(false);
  });
});

describe('explanation images in the contract', () => {
  const withExplanation = (e: Record<string, unknown>) =>
    inferenceResultSchema.safeParse(result({ explanations: [e] })).success;

  it('accepts a PNG image or a reason, but not both and not another type', () => {
    const artifact = { contentType: 'image/png', dataBase64: 'iVBORw0KGgo=' };
    expect(withExplanation({ kind: 'GRADCAM', module: 'm', artifact })).toBe(
      true,
    );
    expect(
      withExplanation({
        kind: 'GRADCAM',
        module: 'm',
        artifact,
        unavailableReason: 'x',
      }),
    ).toBe(false);
    expect(
      withExplanation({
        kind: 'GRADCAM',
        module: 'm',
        artifact: { contentType: 'image/jpeg', dataBase64: 'abcdefgh' },
      }),
    ).toBe(false);
  });

  it('refuses oversized images', () => {
    expect(
      withExplanation({
        kind: 'GRADCAM',
        module: 'm',
        artifact: {
          contentType: 'image/png',
          dataBase64: 'A'.repeat(MAX_ARTIFACT_BASE64 + 1),
        },
      }),
    ).toBe(false);
  });
});

describe('InProcessJobQueue', () => {
  it('runs jobs with bounded concurrency and reports when idle', async () => {
    let active = 0;
    let peak = 0;
    const done: string[] = [];
    const queue = new InProcessJobQueue(async (id) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      done.push(id);
      active -= 1;
    }, 2);
    ['a', 'b', 'c', 'd', 'e'].forEach((id) => queue.enqueue(id));
    await queue.idle();
    expect(done.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(peak).toBe(2);
    await expect(queue.idle()).resolves.toBeUndefined();
  });

  it('keeps going after a job throws', async () => {
    const done: string[] = [];
    const queue = new InProcessJobQueue((id) => {
      if (id === 'bad') return Promise.reject(new Error('boom'));
      done.push(id);
      return Promise.resolve();
    }, 1);
    queue.enqueue('bad');
    queue.enqueue('good');
    await queue.idle();
    expect(done).toEqual(['good']);
  });
});
