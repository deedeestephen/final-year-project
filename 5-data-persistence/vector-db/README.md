# Vector database: chatbot knowledge-base embeddings

The chatbot (Phase 13) will answer only from a curated, cited knowledge base. Each passage is stored with its embedding so the closest passages can be found for a question.

- **Store:** Qdrant (`http://localhost:6333` in docker compose), or an in-memory store for tests (`VECTOR_STORE=memory`).
- **Code:** `3-application-logic/backend/src/persistence/vector/`, with `VectorStore` (`ensureCollection`, `upsert`, `search`), `QdrantVectorStore` and `MemoryVectorStore`. Tested against real Qdrant in the database tests.
- **Status:** the store is ready. The knowledge base, embeddings and chatbot are built in Phase 13. Bemba and Nyanja content must be checked by a human translator before use.
