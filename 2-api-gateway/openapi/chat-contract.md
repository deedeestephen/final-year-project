# Chat API contract (PLANNED, not implemented)

The planned endpoints for the chatbot (Phase 13; see [docs/chatbot-plan.md](../../docs/chatbot-plan.md)). They are written down now so the app and backend can be built against one agreed shape. When they are built, they will appear in `openapi.json` like every other endpoint, and this file will be retired.

All routes need a signed-in user with the permission `chatbot:use` (patients and clinicians). The per-account rate limit applies, plus a chat limit.

## `POST /api/v1/chat/conversations`
Starts a conversation.
```json
{ "language": "en" }                      // en | bem | nya (bem/nya only once verified content exists)
```
→ `201` `{ "id": "uuid", "language": "en", "audience": "patient", "createdAt": "…" }`
The audience (`patient` or `clinician`) comes from the user's role, never from the request.

## `POST /api/v1/chat/conversations/{id}/messages`
Asks a question. The answer comes back in the same response.
```json
{ "text": "What does a PSA test measure?" }   // 1-1000 characters
```
→ `200`
```json
{
  "question": { "id": "uuid", "text": "…", "at": "…" },
  "answer": {
    "id": "uuid",
    "text": "PSA is a protein made by the prostate…",
    "sources": [
      { "title": "PSA test", "publisher": "NHS", "url": "https://…", "reviewedOn": "2026-…" }
    ],
    "safety": "OK",                 // OK | URGENT_CARE | DECLINED
    "disclaimer": "This is general information, not medical advice. Speak to your clinician about your own health.",
    "mode": "EXTRACTIVE",           // EXTRACTIVE (offline, quotes sources) | GENERATED (LLM, cites sources)
    "at": "…"
  }
}
```
- `safety: URGENT_CARE`: the question suggested an emergency. The text is the fixed urgent-care guidance, with no normal answer.
- `safety: DECLINED`: a diagnosis or dosing request. The text is a polite refusal and says why.
- An answer **always** has at least one source, or it is `DECLINED`.

## `GET /api/v1/chat/conversations`
The caller's own conversations, newest first (paged).

## `GET /api/v1/chat/conversations/{id}`
One conversation with its messages. Other users' conversations answer `404`.

## `DELETE /api/v1/chat/conversations/{id}`
The user deletes their own conversation (`204`).

## Errors
The usual envelope `{ "error": { "code", "message", "requestId" } }`. Chat-specific codes:
- `CHAT_UNAVAILABLE` (503): the knowledge base is not loaded
- `LANGUAGE_NOT_AVAILABLE` (409): no verified content in that language yet
- `RATE_LIMITED` (429, with `Retry-After`)
