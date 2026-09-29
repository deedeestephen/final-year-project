"""The knowledge base: reviewed documents split into passages the chatbot may quote.

Each section of an article becomes one passage. The knowledge base lives in
4-ai-intelligence-layer/knowledge-base/<language>/*.json (or KNOWLEDGE_BASE_DIR).
"""

import hashlib
import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

Audience = Literal["patient", "clinician"]

#: 4-ai-intelligence-layer/knowledge-base, next to the ai-services folder.
DEFAULT_DIR = Path(__file__).resolve().parents[3] / "knowledge-base"


@dataclass(frozen=True)
class Source:
    name: str
    url: str


@dataclass(frozen=True)
class Passage:
    article_id: str
    title: str
    heading: str
    body: str
    audience: Audience
    language: str
    sources: tuple[Source, ...]


@dataclass(frozen=True)
class KnowledgeBase:
    passages: tuple[Passage, ...]
    #: Short content hash, so an answer can say which version it came from.
    version: str
    review_status: str

    def languages(self) -> set[str]:
        return {p.language for p in self.passages}


class KnowledgeBaseError(ValueError):
    """The knowledge base files are missing or malformed."""


def _require(value: Any, what: str) -> Any:
    if value is None or value == "" or value == []:
        raise KnowledgeBaseError(f"missing {what}")
    return value


def load(directory: Path) -> KnowledgeBase:
    """Reads every <language>/*.json file; refuses articles without sources."""
    files = sorted(directory.glob("*/*.json"))
    if not files:
        raise KnowledgeBaseError(f"no knowledge base files in {directory}")
    digest = hashlib.sha256()
    passages: list[Passage] = []
    statuses: set[str] = set()
    for file in files:
        raw = file.read_bytes()
        digest.update(file.name.encode())
        digest.update(raw)
        doc = json.loads(raw.decode("utf-8"))
        audience = doc.get("audience")
        if audience not in ("patient", "clinician"):
            raise KnowledgeBaseError(f"{file.name}: audience must be patient or clinician")
        language = _require(doc.get("language"), f"{file.name}: language")
        statuses.add(str(_require(doc.get("reviewStatus"), f"{file.name}: reviewStatus")))
        for article in _require(doc.get("articles"), f"{file.name}: articles"):
            article_id = _require(article.get("id"), f"{file.name}: article id")
            sources = tuple(
                Source(name=str(_require(s.get("name"), "source name")), url=str(s.get("url", "")))
                for s in _require(article.get("sources"), f"{article_id}: sources")
            )
            for section in _require(article.get("sections"), f"{article_id}: sections"):
                passages.append(
                    Passage(
                        article_id=article_id,
                        title=str(_require(article.get("title"), f"{article_id}: title")),
                        heading=str(_require(section.get("heading"), f"{article_id}: heading")),
                        body=str(_require(section.get("body"), f"{article_id}: body")),
                        audience=audience,
                        language=str(language),
                        sources=sources,
                    )
                )
    return KnowledgeBase(
        passages=tuple(passages),
        version=f"kb-{digest.hexdigest()[:12]}",
        review_status=" ".join(sorted(statuses)),
    )


@lru_cache
def default_knowledge_base() -> KnowledgeBase:
    return load(Path(os.environ.get("KNOWLEDGE_BASE_DIR", str(DEFAULT_DIR))))
