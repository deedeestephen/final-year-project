import { createHash } from 'node:crypto';
import type { VectorHit, VectorPoint, VectorStore } from './vector-store';

/** Qdrant only accepts unsigned integers or UUIDs as point ids, so string ids are mapped to UUIDs. */
export function toQdrantId(id: string): string {
  const h = createHash('sha256').update(id).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Qdrant REST driver (VECTOR_STORE=qdrant). The original id is kept in the payload. */
export class QdrantVectorStore implements VectorStore {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async ensureCollection(name: string, dimension: number): Promise<void> {
    const existing = await this.request(
      'GET',
      `/collections/${encodeURIComponent(name)}`,
      undefined,
      true,
    );
    if (existing) return;
    await this.request('PUT', `/collections/${encodeURIComponent(name)}`, {
      vectors: { size: dimension, distance: 'Cosine' },
    });
  }

  async upsert(collection: string, points: VectorPoint[]): Promise<void> {
    await this.request(
      'PUT',
      `/collections/${encodeURIComponent(collection)}/points?wait=true`,
      {
        points: points.map((p) => ({
          id: toQdrantId(p.id),
          vector: p.vector,
          payload: { ...p.payload, _id: p.id },
        })),
      },
    );
  }

  async search(
    collection: string,
    vector: number[],
    k: number,
  ): Promise<VectorHit[]> {
    const res = (await this.request(
      'POST',
      `/collections/${encodeURIComponent(collection)}/points/search`,
      {
        vector,
        limit: k,
        with_payload: true,
      },
    )) as { result: { score: number; payload: Record<string, unknown> }[] };
    return res.result.map(({ score, payload }) => {
      const { _id, ...rest } = payload;
      return { id: String(_id), score, payload: rest };
    });
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    allowNotFound = false,
  ): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { 'api-key': this.apiKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (allowNotFound && res.status === 404) return null;
    if (!res.ok)
      throw new Error(
        `Qdrant ${method} ${path} failed: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }
}
