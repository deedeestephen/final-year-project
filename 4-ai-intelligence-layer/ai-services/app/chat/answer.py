"""Extractive answers: whole sentences quoted from the best-matching passages.

The service never writes medical text of its own, so it cannot invent a fact
(ADR-009). When nothing in the knowledge base matches well enough, it says so.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.chat.kb import Audience, KnowledgeBase
from app.chat.retrieve import Hit, Retriever

Language = Literal["en", "bem", "nya"]

#: Below this BM25 score the best passage does not answer the question
#: (tuned on the retrieval quality set in tests/test_chat.py).
MIN_SCORE = 2.0
#: A second passage is quoted only when it matches nearly as well.
SECOND_PASSAGE_RATIO = 0.75
#: Answers stay short enough to read on a phone.
MAX_CHARS = 700


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChatAnswerRequest(_Strict):
    question: str = Field(min_length=1, max_length=1000)
    audience: Literal["patient", "clinician"]
    language: Language = "en"


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
    mode: Literal["EXTRACTIVE"] = "EXTRACTIVE"
    #: False when no passage matches well enough; `text` is then None.
    matched: bool
    text: str | None
    passages: list[PassageOut]
    sources: list[SourceOut]
    knowledgeBase: KnowledgeBaseInfo


class LanguageNotAvailableError(ValueError):
    """No verified content in the requested language."""


def answer(kb: KnowledgeBase, request: ChatAnswerRequest) -> ChatAnswerResult:
    if request.language not in kb.languages():
        raise LanguageNotAvailableError(request.language)
    audience: Audience = request.audience
    retriever = Retriever(kb, audience, request.language)
    hits = retriever.search(request.question)
    info = KnowledgeBaseInfo(version=kb.version, reviewStatus=kb.review_status)
    if not hits or hits[0].score < MIN_SCORE:
        return ChatAnswerResult(
            matched=False, text=None, passages=[], sources=[], knowledgeBase=info
        )

    # Whole passages are quoted: each knowledge base section is written to
    # stand on its own, so a quote never loses the sentence it depends on.
    used: list[Hit] = [hits[0]]
    if (
        len(hits) > 1
        and hits[1].score >= SECOND_PASSAGE_RATIO * hits[0].score
        and len(hits[0].passage.body) + len(hits[1].passage.body) <= MAX_CHARS
    ):
        used.append(hits[1])

    sources: list[SourceOut] = []
    for hit in used:
        for s in hit.passage.sources:
            out = SourceOut(name=s.name, url=s.url)
            if out not in sources:
                sources.append(out)
    return ChatAnswerResult(
        matched=True,
        text=" ".join(h.passage.body for h in used),
        passages=[
            PassageOut(
                articleId=h.passage.article_id,
                title=h.passage.title,
                heading=h.passage.heading,
                score=round(h.score, 3),
            )
            for h in used
        ],
        sources=sources,
        knowledgeBase=info,
    )
