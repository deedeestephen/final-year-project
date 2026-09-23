import { cosineSimilarity } from './vector-store';
import { MemoryVectorStore } from './memory-vector-store';

describe('cosineSimilarity', () => {
  it('is 1 for identical direction, 0 for orthogonal, -1 for opposite', () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('rejects mismatched dimensions and zero vectors', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/dimension/);
    expect(() => cosineSimilarity([0, 0], [1, 1])).toThrow(/zero/);
  });
});

describe('MemoryVectorStore', () => {
  const store = new MemoryVectorStore();

  beforeAll(async () => {
    await store.ensureCollection('kb', 3);
    await store.upsert('kb', [
      {
        id: 'screening',
        vector: [1, 0, 0],
        payload: { title: 'PSA screening' },
      },
      { id: 'biopsy', vector: [0, 1, 0], payload: { title: 'Biopsy' } },
      { id: 'mixed', vector: [0.7, 0.7, 0], payload: { title: 'Mixed' } },
    ]);
  });

  it('returns the k nearest points, best first', async () => {
    const hits = await store.search('kb', [1, 0.1, 0], 2);
    expect(hits.map((h) => h.id)).toEqual(['screening', 'mixed']);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(hits[0].payload).toEqual({ title: 'PSA screening' });
  });

  it('replaces a point on upsert with the same id', async () => {
    await store.upsert('kb', [
      { id: 'biopsy', vector: [1, 0, 0], payload: { title: 'Biopsy v2' } },
    ]);
    const hits = await store.search('kb', [1, 0, 0], 3);
    expect(hits.filter((h) => h.id === 'biopsy')).toHaveLength(1);
  });

  it('rejects vectors of the wrong dimension and unknown collections', async () => {
    await expect(
      store.upsert('kb', [{ id: 'x', vector: [1, 0], payload: {} }]),
    ).rejects.toThrow(/dimension/);
    await expect(store.search('missing', [1, 0, 0], 1)).rejects.toThrow(
      /Unknown collection/,
    );
  });

  it('returns an empty result for an empty collection', async () => {
    await store.ensureCollection('empty', 3);
    expect(await store.search('empty', [1, 0, 0], 5)).toEqual([]);
  });
});
