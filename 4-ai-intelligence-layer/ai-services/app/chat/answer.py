"""Chat answers from the reviewed knowledge base.

The passages that match the question are found first (BM25). Then either:
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


def answer(
    kb: KnowledgeBase, request: ChatAnswerRequest, writer: ClaudeWriter | None = None
) -> ChatAnswerResult:
    if request.language not in kb.languages():
        raise LanguageNotAvailableError(request.language)
    audience: Audience = request.audience
    retriever = Retriever(kb, audience, request.language)
    hits = retriever.search(_search_text(request))
    info = KnowledgeBaseInfo(version=kb.version, reviewStatus=kb.review_status)
    unmatched = ChatAnswerResult(
        matched=False, text=None, passages=[], sources=[], knowledgeBase=info
    )
    if not hits or hits[0].score < MIN_SCORE:
        return unmatched

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

    # Whole passages are quoted: each knowledge base section is written to
    # stand on its own, so a quote never loses the sentence it depends on.
    quoted: list[Hit] = [hits[0]]
    if (
        len(hits) > 1
        and hits[1].score >= SECOND_PASSAGE_RATIO * hits[0].score
        and len(hits[0].passage.body) + len(hits[1].passage.body) <= MAX_CHARS
    ):
        quoted.append(hits[1])
    return ChatAnswerResult(
        matched=True,
        text=" ".join(h.passage.body for h in quoted),
        passages=[_passage_out(h) for h in quoted],
        sources=_sources([h.passage for h in quoted]),
        knowledgeBase=_info(kb, [h.passage for h in quoted]),
    )
