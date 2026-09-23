import {
  cosineSimilarity,
  type VectorHit,
  type VectorPoint,
  type VectorStore,
} from './vector-store';

interface Collection {
  dimension: number;
  points: Map<string, VectorPoint>;
}

/** Brute-force cosine search. Fine for tests and small offline knowledge bases. */
export class MemoryVectorStore implements VectorStore {
  private readonly collections = new Map<string, Collection>();

  ensureCollection(name: string, dimension: number): Promise<void> {
    if (!this.collections.has(name))
      this.collections.set(name, { dimension, points: new Map() });
    return Promise.resolve();
  }

  upsert(collection: string, points: VectorPoint[]): Promise<void> {
    const c = this.get(collection);
    for (const p of points) {
      if (p.vector.length !== c.dimension) {
        return Promise.reject(
          new Error(
            `Vector dimension mismatch: expected ${c.dimension}, got ${p.vector.length}`,
          ),
        );
      }
    }
    for (const p of points) c.points.set(p.id, p);
    return Promise.resolve();
  }

  search(
    collection: string,
    vector: number[],
    k: number,
  ): Promise<VectorHit[]> {
    let c: Collection;
    try {
      c = this.get(collection);
    } catch (err) {
      return Promise.reject(err as Error);
    }
    const hits = [...c.points.values()]
      .map((p) => ({
        id: p.id,
        score: cosineSimilarity(vector, p.vector),
        payload: p.payload,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
    return Promise.resolve(hits);
  }

  private get(name: string): Collection {
    const c = this.collections.get(name);
    if (!c) throw new Error(`Unknown collection: ${name}`);
    return c;
  }
}
