# Chat API (implemented in Phase 13)

The chat endpoints are built. Their exact schemas are in [`openapi.json`](openapi.json) under the tag `chat`, like every other endpoint. This page keeps the rules in plain words. See also [docs/chatbot-plan.md](../../docs/chatbot-plan.md) and [ADR-009](../../docs/decisions/ADR-009-offline-extractive-chatbot.md).

**Who may use it:** signed-in users with the permission `chatbot:use` (patients and clinicians). The per-account rate limit applies, plus a chat limit of `CHAT_MAX_QUESTIONS_PER_HOUR` (30 by default).

| Route | What it does |
|---|---|
| `POST /api/v1/chat/conversations` | Starts a conversation: `{ "language": "en" }`. The audience (`patient` or `clinician`) comes from the role, never from the request. `bem` and `nya` answer `409 LANGUAGE_NOT_AVAILABLE` until human-verified content exists |
| `POST /api/v1/chat/conversations/{id}/messages` | Asks a question: `{ "text": "…" }` (1–1000 characters, no markup). The answer comes back in the same response |
| `GET /api/v1/chat/conversations` | The caller's own conversations, newest first (paged) |
| `GET /api/v1/chat/conversations/{id}` | One conversation with its messages. Someone else's conversation answers `404` |
| `DELETE /api/v1/chat/conversations/{id}` | The owner deletes it (`204`) |

**Every answer carries:**
- `safety`:
  - `OK`: quoted from the knowledge base, with sources
  - `URGENT_CARE`: the fixed urgent-care text; nothing was looked up
  - `DECLINED`: medicines or doses (everyone), or the patient's own results or a diagnosis (patients). A fixed, polite text
  - `NO_SOURCE`: nothing reviewed covers it
- `mode`: `EXTRACTIVE` (quoted) or `FIXED` (a fixed safety text).
- `sources` (at least one when `safety` is `OK`), a `disclaimer` for the audience, and the knowledge base's `reviewStatus`.

**Privacy:**
- The audit log records `chat.asked` with the safety result and the number of sources, never the question or the answer.
- Conversations are deleted by their owner, or automatically `CHAT_RETENTION_DAYS` (180) after the last message.

**Errors** use the usual envelope. Chat-specific codes:
- `CHAT_UNAVAILABLE` (503): the AI service or its knowledge base is not available.
- `LANGUAGE_NOT_AVAILABLE` (409): no verified content in that language.
- `RATE_LIMITED` (429, with `Retry-After`).
