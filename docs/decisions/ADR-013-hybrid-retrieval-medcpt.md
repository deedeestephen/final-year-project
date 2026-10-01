# ADR-013: Keywords decide, meaning orders: hybrid retrieval with MedCPT

- **Status:** Accepted (owner request, 1 October 2026: "doall3", the semantic-search item of the proposal review in [requirements-traceability.md](../requirements-traceability.md)). It extends point 2 of [ADR-009](ADR-009-offline-extractive-chatbot.md) ("Retrieval is lexical (BM25)"). The rest of ADR-009 and [ADR-010](ADR-010-claude-for-chat-answers.md) stand.
- **Context:**
  - **What the proposal says (§3.3.5):** retrieval with semantic embeddings from a biomedical model (BioBERT or PubMedBERT, 768 dimensions), cosine similarity, the top 5, in a vector database.
  - **What was built in Phase 13 (ADR-009):** keyword search (BM25) with a small everyday-word map. It is fast, offline and explainable, but it only sees shared words, so it fails in two ways:
    - **A question in everyday words gets the wrong article.** "Are African men more likely to get it?" got the article about the gland, not the one about who is at higher risk.
    - **An off-topic question that shares one word gets an answer.** "What is the treatment for malaria?" got a screening passage, and "How much does a bus ticket to Ndola cost?" got the PSA test.
  - **Rules that stay:** answers only from the reviewed knowledge base, nothing invented, no paid service without the owner's approval, works without the internet, answers within 2 s (FR-07).

## Options considered

| Option | Result |
|---|---|
| **A general sentence-embedding model** (NeuML/pubmedbert-base-embeddings, mean of the tokens, cosine) | **Tried first and dropped.** On the same question sets it put fewer first passages in the right article than BM25 alone |
| **Embeddings only, without BM25** | **Rejected.** A nearest passage always exists, so there is no natural point at which to say "no reviewed information": off-topic questions would be answered |
| **MedCPT** (NCBI; Jin et al., *Bioinformatics* 2023): PubMedBERT trained as a retriever on 255 million question–article pairs from PubMed searches, with one encoder for questions and one for articles | **Chosen.** Public domain (a US government work), English, 768 dimensions, made for exactly this job |
| **Qdrant** for the vectors | **Not needed yet.** The knowledge base has 32 passages: their vectors fit in one small file and are compared in under a millisecond. Qdrant stays available for a much larger knowledge base |

## Decision

1. **Keywords decide whether the question is covered; meaning decides the order** (`app/chat/answer.py`):
   - BM25 finds every passage scoring at least 2.0 (`MIN_SCORE`, unchanged). If there is none, the answer is "no reviewed information", as before.
   - MedCPT scores those passages, and the closest in meaning is quoted first (and given first to Claude, when Claude writes).
   - **The meaning floor:** if the best passage scores below **52.0** (`MEANING_FLOOR`), the answer is "no reviewed information". The words matched, but the meaning did not.
   - A second passage is quoted only when it scores within **2.0** of the first (`MEANING_SECOND_GAP`) and both fit in 700 characters.
   - **Follow-ups:** a short question ("Does it hurt?") is still read together with the previous question. The short question on its own must also reach the floor with the chosen passage. So a new topic after a covered one ("What is the treatment for malaria?" after a question about the DRE) is not answered from the earlier topic.
2. **The models:** the MedCPT query encoder (questions, up to 64 tokens) and article encoder (each passage as its title and heading, then its text, up to 512 tokens). The score is the dot product of the two 768-number vectors, as in the model card.
   - **Pinned:** a fixed revision of each, and the SHA-256 sum of every file. `python -m app.chat.embeddings download` fetches them once (about 880 MB) into `ai-services/models/`, which Git ignores. A file whose sum differs is refused.
   - **No PyTorch:** the 12-layer BERT encoder is written with numpy (`app/chat/embeddings.py`). On reference texts, its vectors match the model card's code (transformers and PyTorch) to within 0.0001, and its scores to within 0.002 (`tests/test_meaning.py`).
3. **The passages' vectors are worked out once** and kept in `models/index-<knowledge-base version>-<model revision>.json`. A new knowledge-base version builds a new file at the next start-up (about 12 s). Otherwise the index is ready in under a second.
4. **It is optional, and the chat works without it:**
   - `CHAT_RETRIEVAL=auto` (the default) uses the meaning search when the models are downloaded;
   - `keywords` switches it off;
   - `meaning` also warns at start-up when the models are missing.
   - The index loads in the background. Until it is ready, or if anything fails, the chat answers with keywords as before.
   - `GET /v1/health` says which is in use, for example `"chat_retrieval": "keywords+meaning (MedCPT)"`.
5. **It keeps the 2 s target under load:**
   - Each question is encoded on one processor thread, and up to `CHAT_MEANING_SLOTS` questions are encoded side by side (by default, three-quarters of the processor threads).
   - A question that waits more than `CHAT_MEANING_WAIT_MS` (500 ms) for a free slot is answered with keywords only, as before this ADR.
   - These fallbacks are counted in `GET /v1/health` (`chat_meaning_busy`).
   - The first version had none of this, and failed the load test (below).
6. **Nothing leaves the computer.** The models run in the AI service itself. The only network use is the one-time download from Hugging Face.

## Measured

`python -m app.chat.evaluate`, on 1 October 2026. The sets are in `app/chat/eval_sets.py`. An answer counts as right when the first quoted passage comes from a right article; an off-topic question counts as right when it gets no answer.

| | Quality set (18) | Everyday words (24) | Off-topic refused (12) | Follow-ups right (7) | New topic after a covered one, refused (4) |
|---|---|---|---|---|---|
| Keywords only (ADR-009) | 18 | 18 | 9 | 6 | 0 |
| **Keywords and meaning (this ADR)** | **18** | **20** | **11** | **7** | **3** |

**What changed:**
- "Are African men more likely to get it?" now gets the article on who is at higher risk (was: the gland).
- "The gland feels hard and irregular on rectal exam" now gets the clinician card on DRE findings (was: the patient article on the DRE).
- "What is the treatment for malaria?" and "How much does a bus ticket to Ndola cost?" now get "no reviewed information".
- "Why are the heat maps not shown?" was answered from the wrong card (grade groups); it now gets "no reviewed information". That is safer, but still not the right answer, which is the card on the AI report.

**Speed** ([performance.md](../performance.md)):
- **One question at a time:** encoding takes about 60 ms on this laptop (4 cores, numpy).
- **The load test:** 100 clinicians asking every 2 to 8 s, about 18 questions a second.
  - **First version** (one question at a time, on all threads): the questions queued, and P95 was **8.4 s**, far over the 2 s target.
  - **As shipped** (6 slots, one thread each): P50 **260 ms**, P95 **514 ms**, 0 errors. No question needed the keyword fallback.
  - **With one slot only** (like a one-core server): 53% of questions fell back to keywords, but P95 stayed at **676 ms**.

**Memory:** the query encoder takes about 440 MB in the AI service. The article encoder is loaded only to build the index file, then released.

## Known limits

- **A near topic can pass.** "Tell me about breast cancer screening" still gets the passage on prostate cancer screening (meaning score 66.9: to MedCPT, both are cancer screening). The answer names its source, so the person can see it is about the prostate. When Claude writes the answers, it can still say that the passages do not cover the question (ADR-010).
- **One new topic still passes as a follow-up:** "Will it rain tomorrow?" after a PSA question is answered from the PSA article (53.4, just above the floor).
- **Small, hand-written sets.** The floor and the gap were tuned on these 65 questions, written by the developer. They guard against getting worse; they do not prove quality. Real questions from the UAT sessions ([uat/](../uat/README.md)) should be added to the sets, and the thresholds checked again with `python -m app.chat.evaluate`.
- **Under heavy load, some answers use keywords only.** That keeps answers fast, but those questions lose the better ordering and the meaning floor. The health check counts them, so a server that needs more processor threads can be spotted.
- **English only,** like the knowledge base. Bemba and Nyanja would need a different model as well as verified content.
- **Retrieval only.** MedCPT finds passages; it writes nothing. Answers are still quoted passages, or Claude's text from them.

## Consequences

- The proposal's "semantic embeddings from PubMedBERT, 768 dimensions" is met, in a hybrid with BM25. Three details differ, and the report says so: the score is MedCPT's dot product (its own measure), not cosine similarity; every passage that passes the keyword check is ranked, not a fixed top 5; and the vectors are kept in a file, not in Qdrant.
- `6-infrastructure/scripts/dev-up.ps1` says how to download the models when they are missing.
- **Tests:**
  - `tests/test_meaning.py`: the ordering, the floor, the second passage, follow-ups and new topics, the keyword fallback when every slot is taken, the index file, background loading, start-up with and without models, and the health fields. With the models downloaded, it also checks the vectors against the reference and the measured results above.
  - `tests/test_embeddings.py`: the numpy encoder on a tiny made-up model, padding, long texts, the checksum check of the download, and the evaluation command.
  - CI has no models, so the tests that need them are skipped there. Coverage stays at 98%.
