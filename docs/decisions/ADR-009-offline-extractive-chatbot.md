# ADR-009: An offline, extractive chatbot over a reviewed knowledge base

- **Status:** Accepted (Phase 13, 2026-09-29). The owner asked for Phase 13 to be built after the other phases. The decisions the [chatbot plan](../chatbot-plan.md) left to the owner were given the defaults below. Each is recorded here, and each can be changed. Point 2 is extended by [ADR-013](ADR-013-hybrid-retrieval-medcpt.md) (1 October 2026): the keywords still decide whether a question is covered, and a biomedical model (MedCPT) now orders the passages by meaning.
- **Context:** The proposal asks for a RAG chatbot for patients and clinicians (FR-07, UC-07), answering within 2 s, in English, Bemba and Nyanja. The project rules forbid paid services unless the owner approves the cost, and forbid invented medical content. There is no clinician on the team to sign off content, and no trained language model runs on this laptop without large downloads.

## Decision

1. **Answers are quoted, never written.** The AI service finds the best-matching passages and returns them word for word (`EXTRACTIVE` mode):
   - It cannot invent a fact, a number or a dose, because it has no text of its own. A test checks that every answer equals the quoted passages.
   - When nothing matches well enough, it says so, instead of guessing.
   - A language-model provider (`GENERATED` mode) remains possible later behind the same contract, but only with the owner's approval of cost and data protection.
2. **Retrieval is lexical (BM25), in the AI service.**
   - Why: it needs no model download and no GPU, works offline and answers in milliseconds.
   - Every result can be explained by the words it shares with the question.
   - A small word map links everyday words to the documents' words (doctor → clinician, pee → urine).
   - The Qdrant vector store stays in place for a neural embedding model later. BM25 is enough for a few dozen reviewed documents.
3. **The knowledge base is small, versioned, and marked as a draft** (`4-ai-intelligence-layer/knowledge-base/`):
   - **Patient content:** the app's own Learn articles, word for word. A test keeps the copies identical.
   - **Clinician content:** reference cards (ISUP grade groups, PI-RADS v2.1, PSA density and free-to-total PSA, DRE findings, how to read the AI report). Each card cites a source; the journal citations were checked in PubMed.
   - Everything says *"Draft for review by a qualified clinician"*, and every answer shows it, until a clinician signs the content off.
   - Patients only get patient content. Clinicians get both.
4. **The backend owns safety.** Before any retrieval:
   - Emergency and self-harm wording gets the fixed urgent-care text.
   - Diagnosis, own-result and dose requests are politely declined.
   - After retrieval, an answer without a source is never shown.
   - The audit log records that a question was asked, never its text.
5. **Defaults for the owner's open decisions:**
   - Offline extractive answers only.
   - Pathologists do not get the assistant (as the permissions already say).
   - Bemba and Nyanja return "not available yet" until human-verified content exists.
   - Conversations are deleted by the user or automatically after 180 days (`CHAT_RETENTION_DAYS`).

## Consequences

- **Cost and data:** answers cost nothing and work in low connectivity. No question text leaves the system.
- **Tone:** answers read like the source documents, not like a conversation. For health information, reviewed wording is safer than fluent generated text.
- **Quality of retrieval:** it depends on the documents using the words people ask with. The retrieval quality set in `tests/test_chat.py` must stay at 90% or more at the first passage whenever documents are added.
- **What the owner still owes:** clinical sign-off of the knowledge base, a translator and reviewer for Bemba and Nyanja, and any decision to add a language model.
