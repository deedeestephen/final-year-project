# Chatbot build plan (Phase 13): for patients and clinicians

**Status:** planned, not built. The app already shows where the chatbot will appear: "Ask a question" for patients and "Ask the assistant" for clinicians, both marked *Coming in build phase 13*. The planned API is in [`2-api-gateway/openapi/chat-contract.md`](../2-api-gateway/openapi/chat-contract.md).

## 1. What it is for (and what it must never do)

| | Patients | Clinicians |
|---|---|---|
| **Helps with** | plain-language education on the prostate, PSA, DRE, screening and biopsy; preparing questions for their clinician; knowing when to seek urgent care | quick lookup of guidelines and protocols (screening intervals, PI-RADS and ISUP definitions, referral criteria), always with the source |
| **Never** | diagnoses; interprets the patient's own results ("is my PSA bad?" → "Your clinician will explain your results"); gives medication doses; replaces a visit | overrides clinical judgement; invents numbers; answers without a source |
| **Tone** | short, calm sentences; reading age about 12 | concise, with references |

Pathologists do not have the chatbot permission today (`chatbot:use`). Adding it is a decision for the owner.

## 2. How it works: retrieval-augmented generation (RAG)

```
question → safety check → find passages (vector search) → write answer from those passages only
        → output check → answer + sources + disclaimer          (conversation kept in MongoDB)
```

1. **Knowledge base (the most important part).** A curated set of documents, each with a source, date, licence and audience (patient or clinician):
   - WHO, NCI, CDC and NHS patient information
   - Zambian Ministry of Health and cancer guidelines, where available
   - the app's own reviewed Learn articles

   Only licensed, reviewed documents go in, and a clinician signs off each one.
2. **Chunking and embeddings.** Documents are split into passages of about 300–500 words, turned into embeddings and stored in the vector database. This is Qdrant; the store already exists: `3-application-logic/backend/src/persistence/vector/`.
3. **Retrieval.** The top 5 passages for the question are found, filtered by audience and language.
4. **Answer writing.** An LLM provider interface with two implementations:
   - **Offline extractive fallback (default, free):** it answers by quoting the best-matching passages. No external service is needed, so it works in low connectivity and costs nothing.
   - **LLM provider (optional):** it writes a fluent answer **only from the retrieved passages** and must cite them. It is used only if the owner approves the cost and a provider that meets data-protection needs. The retrieved text is treated as **data, never as instructions**.
5. **Citations and disclaimer** on every answer: "This is general information, not medical advice. Speak to your clinician about your own health."

## 3. Safety rules (built before any answer is shown)
- **Input check:**
  - emergency and self-harm wording → urgent-care guidance and the local emergency number, with no normal answer
  - requests for a diagnosis or dose → a polite refusal and an explanation why
  - prompt-injection attempts ("ignore your rules…") → handled as ordinary text
- **Output check:** no answer without at least one source; no dosing; no diagnosis wording; length limits.
- **Privacy:**
  - the chatbot never sees the patient's records unless a later, separately approved feature adds this
  - conversations are stored per user, and deletable by the user
  - the audit log records *that* a chat happened, never the message text
- **Rate limits:** the existing per-account limit, plus a chat-specific one (for example 30 questions an hour).

## 4. Languages: English, Bemba, Nyanja
- English first.
- **Bemba and Nyanja only with human-verified translations** of the knowledge base and the fixed safety messages, the same rule as the Learn tab. No machine translation of medical content.
- The user chooses the language (no guessing). If a passage has no verified translation, the answer says so and offers English.

## 5. Later: working with the AI models
Once the trained models are integrated (see [ai-model-integration-guide.md](ai-model-integration-guide.md)), the clinician assistant may explain **what a section of an AI report means**, for example "What is a grade group?". It will never produce new numbers or reinterpret a patient's result. Patients do not get AI-report explanations from the chatbot; their clinician explains results.

## 6. Build steps (when the owner says "start")
| Step | What | Done when |
|---|---|---|
| 1 | Knowledge base: collect, check licences, clinician sign-off, store as versioned files | a reviewed set of at least 30 patient and 30 clinician documents |
| 2 | Ingestion: chunk → embed → Qdrant (embedding model chosen: a small multilingual open model, run locally) | a re-runnable script; tests on synthetic documents |
| 3 | Backend `services/chatbot` + the API in `chat-contract.md` (permission `chatbot:use`, audit, rate limit) | integration tests: role behaviour, sources required, conversation history |
| 4 | Safety filter and output check | a red-team test set (emergency, diagnosis, dosing and injection prompts) passes 100% |
| 5 | Extractive answering (free, offline) | answers cite sources; the retrieval quality set reaches the agreed score |
| 6 | App screens: patient "Ask a question", clinician "Ask the assistant"; chat bubbles, sources, disclaimer, offline message | widget tests; tested on the S9+ |
| 7 | (Optional, needs the owner's approval of cost) LLM provider | same tests pass; cost per 1,000 questions measured |
| 8 | Bemba and Nyanja content after human verification | reviewer sign-off recorded |
| 9 | Measure the ≤ 2 s answer target (FR-07) and report honestly | results in `docs/scalability.md` |

## 7. Decisions needed from the owner before building
1. Which documents make up the knowledge base, and who signs them off clinically.
2. Offline extractive answers only, or also an LLM provider (and which, at what cost).
3. Whether pathologists get the assistant.
4. Who translates and verifies Bemba and Nyanja.
5. How long conversations are kept.

## 8. Already in place for it
- Permission `chatbot:use` (patients and clinicians).
- MongoDB collection `chatbot_conversations` (language en, bem or nya; messages with sources) with validation rules.
- Vector store (Qdrant or in-memory) with tests.
- Per-account rate limits.
- App entry points showing *Coming in build phase 13*.
- The planned API contract.
