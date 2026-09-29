# Knowledge base for the chatbot (Phase 13)

The chatbot answers **only** from these documents, by quoting them. It never writes medical text of its own (see [docs/chatbot-plan.md](../../docs/chatbot-plan.md) and [ADR-009](../../docs/decisions/ADR-009-offline-extractive-chatbot.md)).

| File | Audience | What it holds |
|---|---|---|
| `en/patient-learn.json` | patients (and clinicians) | the app's Learn articles, word for word. A test keeps it identical to `1-presentation-layer/mobile-app/assets/education/en/articles.json` |
| `en/clinician-reference.json` | clinicians | reference cards: ISUP grade groups, PI-RADS v2.1, PSA density and free-to-total PSA, DRE findings, how to read this app's AI report |

**Status: draft.** Every document says *"Draft for review by a qualified clinician"*, and so does every chatbot answer, until a clinician signs the content off. Record the sign-off by changing `reviewStatus` and noting the reviewer and date in the development log.

**Rules for adding a document:**
- One JSON file per audience and language, in the same shape: `articles[]`, each with `id`, `title`, `sections[]` (`heading`, `body`) and `sources[]` (`name`, `url`).
- Each section becomes one passage the chatbot can quote, so keep sections short and self-contained.
- Every article needs at least one source. Check the licence before copying text, and prefer writing your own plain summary with the source cited.
- Clinical cut-offs and treatment advice do not belong here: they differ between guidelines and must come from the local protocol.
- **Bemba and Nyanja** (`bem/`, `nya/`) only with human-verified translations. Until they exist, the chatbot answers "not available yet" in those languages.
