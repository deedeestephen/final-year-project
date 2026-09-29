# ADR-010: Claude writes chat answers from the reviewed passages

- **Status:** Accepted (owner request, 2026-09-29: "can you use the Claude API to run the chatbot"). This is the owner's approval of the optional language-model step in the [chatbot plan](../chatbot-plan.md) (step 7). It extends [ADR-009](ADR-009-offline-extractive-chatbot.md), which stays the fallback.
- **Context:** Quoted answers (ADR-009) are safe but read like documents: they cannot answer a follow-up in its own words or explain something more simply. The owner wants the assistant to chat with patients.

## Decision

1. **Claude writes, the knowledge base decides.**
   - The AI service still finds the matching reviewed passages first.
   - Claude then gets only the best three passages, the last three questions and answers, and the question. It writes the answer through a forced tool call (`give_answer`: `covered`, `answer`, `citations`).
   - It must use only the passages, say when they do not cover the question (the app then shows "no reviewed information"), and never diagnose, interpret results or name medicines or doses.
   - Only the passages Claude cites become the answer's sources.
2. **The server's safety rules still come first.** Emergencies, self-harm, doses and a patient's own results never reach Claude (`chat-safety.ts`). Claude's answer then goes through the same output check: a source is required, and no dose may appear.
3. **Model:** `claude-haiku-4-5-20251001` by default (`CHAT_LLM_MODEL`).
   - It is Claude's fast, low-cost model: short answers from three passages fit the 2 s target (FR-07) and the project's budget.
   - A more capable model such as `claude-sonnet-5` can be set in `.env`, at a higher cost and latency. It must be measured again with `PERF_ONLY=chat npm run perf`.
4. **Always a fallback.** With no `ANTHROPIC_API_KEY`, an API error, an unusable reply, or the timeout (`CHAT_LLM_TIMEOUT_S`, 8 s, no retries), the service quotes the passages as before. Claude is never needed for the chat to work.
5. **Cost cap:** at most `CHAT_LLM_DAILY_LIMIT` (2,000) Claude calls a day per AI service, plus the existing 30 questions an hour per account. At Haiku 4.5's list price (check the current price on anthropic.com), a question with three passages costs well under a US cent.
6. **Privacy:**
   - Before anything is sent, e-mail addresses, NRC numbers, phone numbers and long digit strings are replaced (`scrub`).
   - The app tells users not to type their name, NRC, phone number or results.
   - Each Claude-written answer is labelled *"Written by AI (Claude) from the sources below"*.
   - The model is stored with the answer and in the audit log (never the text).
   - The key lives only in the git-ignored `.env`.

## Consequences

- **What users get:** more natural answers that can follow the conversation, still limited to reviewed content and still showing their sources.
- **Before real patients use it:**
  - Questions are sent to Anthropic, a company in the United States. This needs a data-protection review under Zambia's Data Protection Act (2021), including cross-border transfer, and ethics approval.
  - The prototype uses synthetic data only. Anthropic's data-retention terms for API use must be checked and recorded.
- **Tests:**
  - The unit tests use a fake Anthropic client, so they cost nothing.
  - The end-to-end and performance runs start their own AI service with Claude switched off (`ANTHROPIC_API_KEY=""` wins over `.env`), unless `LIVE_CLAUDE=1` is set. Use `LIVE_CLAUDE=1 PERF_ONLY=chat npm run perf` to measure Claude's speed.
  - `test_live_claude_answer` makes one real call when `ANTHROPIC_API_KEY_LIVE_TEST=1` and a key are set.
