/**
 * Vector database abstraction for the chatbot's retrieval-augmented generation
 * knowledge base (proposal §3.3.5). Implementations: in-memory (tests, offline
 * development) and Qdrant.
 */
export type Payload = Record<string, unknown>;

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Payload;
}

export interface VectorHit {
  id: string;
  score: number;
  payload: Payload;
}

export interface VectorStore {
  ensureCollection(name: string, dimension: number): Promise<void>;
  upsert(collection: string, points: VectorPoint[]): Promise<void>;
  search(collection: string, vector: number[], k: number): Promise<VectorHit[]>;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length)
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0)
    throw new Error('Cannot compare a zero vector');
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
