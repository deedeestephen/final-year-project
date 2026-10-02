"""Chat answers from the reviewed knowledge base.

The passages that match the question's words are found first (BM25); only
a match of at least MIN_SCORE means the knowledge base covers the question.
When the meaning search is on (ADR-013), MedCPT then puts the articles of
those passages in order of meaning (the keywords still order the sections
inside an article) and refuses an answer whose closest passage is far from
the question; when it is too busy, the keywords alone decide. Then either:
- Claude writes the answer from those passages only and names the ones it
  used (`GENERATED`, ADR-010), when an API key is configured; or
- the passages are quoted word for word (`EXTRACTIVE`, ADR-009), which is
  also the fallback whenever Claude is not available.
When nothing in the knowledge base matches well enough, the answer says so.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.chat.generate import ClaudeWriter, Turn
from app.chat.kb import Audience, KnowledgeBase, Passage
from app.chat.meaning import MeaningBusyError, MeaningScorer
from app.chat.retrieve import Hit, Retriever, query_terms

Language = Literal["en", "bem", "nya"]

#: Below this BM25 score the best passage does not answer the question
#: (tuned on the retrieval quality set in tests/test_chat.py).
MIN_SCORE = 2.0
#: A second passage is quoted only when it matches nearly as well.
SECOND_PASSAGE_RATIO = 0.75
#: Answers stay short enough to read on a phone.
MAX_CHARS = 700
#: Claude is given this many of the best passages to write from.
PASSAGES_FOR_CLAUDE = 3
#: A question with this few content words is read as a follow-up.
FOLLOW_UP_TERMS = 2
#: Meaning search: the chosen passage's MedCPT score must reach this, or the
#: answer is "no reviewed information". Right answers on the evaluation sets
#: scored 56.7 or more; off-topic questions that pass the keyword gate
#: ("What is the treatment for malaria?") 48.5 (python -m app.chat.evaluate).
MEANING_FLOOR = 52.0
#: Meaning search: a second passage is quoted when it scores this close to the first.
MEANING_SECOND_GAP = 2.0


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HistoryTurn(_Strict):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=4000)


class ChatAnswerRequest(_Strict):
    question: str = Field(min_length=1, max_length=1000)
    audience: Literal["patient", "clinician"]
    language: Language = "en"
    #: The last few messages of the conversation, oldest first.
    history: list[HistoryTurn] = Field(default_factory=list, max_length=6)


class SourceOut(_Strict):
    name: str
    url: str


class PassageOut(_Strict):
    articleId: str
    title: str
    heading: str
    score: float


class KnowledgeBaseInfo(_Strict):
    version: str
    reviewStatus: str


class ChatAnswerResult(_Strict):
    mode: Literal["EXTRACTIVE", "GENERATED"] = "EXTRACTIVE"
    #: False when nothing reviewed covers the question; `text` is then None.
    matched: bool
    text: str | None
    passages: list[PassageOut]
    sources: list[SourceOut]
    knowledgeBase: KnowledgeBaseInfo
    #: The Claude model that wrote the answer (GENERATED only).
    model: str | None = None


class LanguageNotAvailableError(ValueError):
    """No verified content in the requested language."""


def _search_text(request: ChatAnswerRequest) -> str:
    """A short follow-up ("and the DRE?") is read with the previous question."""
    if len(query_terms(request.question)) > FOLLOW_UP_TERMS:
        return request.question
    previous = [t.text for t in request.history if t.role == "user"]
    return f"{previous[-1]} {request.question}" if previous else request.question


def _sources(passages: list[Passage]) -> list[SourceOut]:
    sources: list[SourceOut] = []
    for passage in passages:
        for s in passage.sources:
            out = SourceOut(name=s.name, url=s.url)
            if out not in sources:
                sources.append(out)
    return sources


def _info(kb: KnowledgeBase, passages: list[Passage]) -> KnowledgeBaseInfo:
    """The review status of the documents actually used, each named once."""
    statuses = list(dict.fromkeys(p.review_status for p in passages if p.review_status))
    return KnowledgeBaseInfo(
        version=kb.version, reviewStatus=" ".join(statuses) or kb.review_status
    )


def _passage_out(hit: Hit) -> PassageOut:
    return PassageOut(
        articleId=hit.passage.article_id,
        title=hit.passage.title,
        heading=hit.passage.heading,
        score=round(hit.score, 3),
    )


def _rank(
    retriever: Retriever, question: str, text: str, meaning: MeaningScorer | None
) -> tuple[list[Hit], list[Hit]] | None:
    """The passages in order of relevance, and the ones to quote; None when the
    knowledge base does not cover the question. `text` is the question, or a
    short follow-up read together with the previous question."""
    if meaning is None:
        hits = retriever.search(text)
        if not hits or hits[0].score < MIN_SCORE:
            return None
        # Whole passages are quoted: each knowledge base section is written to
        # stand on its own, so a quote never loses the sentence it depends on.
        quoted = [hits[0]]
        if (
            len(hits) > 1
            and hits[1].score >= SECOND_PASSAGE_RATIO * hits[0].score
            and len(hits[0].passage.body) + len(hits[1].passage.body) <= MAX_CHARS
        ):
            quoted.append(hits[1])
        return hits, quoted

    # Meaning search: the keywords decide whether the question is covered.
    # MedCPT tells articles apart well, but scores the sections of one article
    # within a point or two of each other, where the keywords choose better
    # ("What does PI-RADS 4 mean?" is answered by the five categories). So the
    # articles come in order of their closest passage, and inside an article
    # the passages keep their keyword order (candidates are in BM25 order, and
    # the sort is stable).
    hits = retriever.search(text, top_k=len(retriever.passages))
    candidates = [h for h in hits if h.score >= MIN_SCORE]
    if not candidates:
        return None
    closeness = meaning.scores(text, [h.passage for h in candidates])
    article_best: dict[str, float] = {}
    for hit, close in zip(candidates, closeness, strict=True):
        article = hit.passage.article_id
        article_best[article] = max(article_best.get(article, close), close)
    ordered = sorted(
        zip(candidates, closeness, strict=True),
        key=lambda pair: -article_best[pair[0].passage.article_id],
    )
    best = ordered[0][0]
    best_closeness = article_best[best.passage.article_id]
    if best_closeness < MEANING_FLOOR:
        return None
    # A short question read with the previous one must itself be close to the
    # article: "Does it hurt?" after the DRE is, "What is the treatment for
    # malaria?" after the DRE is not (it is a new topic, and not covered).
    if text != question:
        same_article = [
            h.passage for h, _ in ordered if h.passage.article_id == best.passage.article_id
        ]
        if max(meaning.scores(question, same_article)) < MEANING_FLOOR:
            return None
    quoted = [best]
    if (
        len(ordered) > 1
        and ordered[1][1] >= best_closeness - MEANING_SECOND_GAP
        and len(best.passage.body) + len(ordered[1][0].passage.body) <= MAX_CHARS
    ):
        quoted.append(ordered[1][0])
    ranked = [h for h, _ in ordered] + [h for h in hits if h.score < MIN_SCORE]
    return ranked, quoted


def answer(
    kb: KnowledgeBase,
    request: ChatAnswerRequest,
    writer: ClaudeWriter | None = None,
    meaning: MeaningScorer | None = None,
) -> ChatAnswerResult:
    if request.language not in kb.languages():
        raise LanguageNotAvailableError(request.language)
    audience: Audience = request.audience
    retriever = Retriever(kb, audience, request.language)
    info = KnowledgeBaseInfo(version=kb.version, reviewStatus=kb.review_status)
    unmatched = ChatAnswerResult(
        matched=False, text=None, passages=[], sources=[], knowledgeBase=info
    )
    text = _search_text(request)
    try:
        ranking = _rank(retriever, request.question, text, meaning)
    except MeaningBusyError:
        # Every slot of the meaning search is taken (heavy load): keywords
        # only, as before ADR-013, so the answer still comes within 2 s.
        ranking = _rank(retriever, request.question, text, None)
    if ranking is None:
        return unmatched
    hits, quoted = ranking

    if writer is not None:
        given = hits[:PASSAGES_FOR_CLAUDE]
        written = writer.write(
            request.question,
            audience,
            [h.passage for h in given],
            [Turn(role=t.role, text=t.text) for t in request.history],
        )
        if written is not None and not written.covered:
            return unmatched.model_copy(update={"mode": "GENERATED", "model": written.model})
        if written is not None and written.cited:
            used = [given[i] for i in written.cited]
            return ChatAnswerResult(
                mode="GENERATED",
                matched=True,
                text=written.text,
                passages=[_passage_out(h) for h in used],
                sources=_sources([h.passage for h in used]),
                knowledgeBase=_info(kb, [h.passage for h in used]),
                model=written.model,
            )
        # No usable answer from Claude: quote the passages instead.

    return ChatAnswerResult(
        matched=True,
        text=" ".join(h.passage.body for h in quoted),
        passages=[_passage_out(h) for h in quoted],
        sources=_sources([h.passage for h in quoted]),
        knowledgeBase=_info(kb, [h.passage for h in quoted]),
    )
