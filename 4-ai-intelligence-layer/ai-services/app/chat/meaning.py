"""Meaning search over the knowledge base (ADR-013).

The keyword search (BM25) still decides whether the knowledge base covers a
question at all. MedCPT then puts the passages that match the keywords in
order of meaning, and an answer whose best passage is far from the question
in meaning is not given (answer.py). Measured on the evaluation sets in
eval_sets.py: python -m app.chat.evaluate.

The passages' vectors are worked out once with the article encoder and kept
in a cache file per knowledge-base version, so the article encoder (440 MB
in memory) is only loaded when the content changes. Questions are encoded
with the query encoder at about 60 ms each, a few at a time (the slots). A
question that finds every slot taken for longer than the wait is answered
with keywords only, so answers stay fast under heavy load.
"""

import json
import logging
import threading
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Protocol

from app.chat.embeddings import ARTICLE_ENCODER, MODELS_DIR, article_encoder, query_encoder
from app.chat.kb import KnowledgeBase, Passage

log = logging.getLogger("uvicorn.error")


class Encoder(Protocol):
    def embed(self, texts: Sequence[str | tuple[str, str]]) -> list[list[float]]: ...


class MeaningScorer(Protocol):
    def scores(self, question: str, passages: Sequence[Passage]) -> list[float]: ...


class MeaningBusyError(RuntimeError):
    """Every slot of the meaning search stayed taken for longer than the wait."""


def passage_key(p: Passage) -> str:
    return f"{p.language}|{p.audience}|{p.article_id}|{p.heading}"


def article_text(p: Passage) -> tuple[str, str]:
    """A passage as MedCPT reads an article: (title, text)."""
    return (f"{p.title}: {p.heading}", p.body)


class MeaningIndex:
    """The vectors of every passage of one knowledge base, and a query encoder.

    At most `slots` questions are encoded at once. A question waits at most
    `wait_s` seconds for a free slot (None: as long as it takes), then
    MeaningBusyError is raised and counted in `busy`."""

    def __init__(
        self,
        kb_version: str,
        query: Encoder,
        vectors: dict[str, list[float]],
        slots: int = 1,
        wait_s: float | None = None,
    ) -> None:
        self.kb_version = kb_version
        self._query = query
        self._vectors = vectors
        self._slots = threading.BoundedSemaphore(slots)
        self._wait_s = wait_s
        self._busy_lock = threading.Lock()
        #: Questions turned away because every slot was taken.
        self.busy = 0

    def scores(self, question: str, passages: Sequence[Passage]) -> list[float]:
        """MedCPT's score (a dot product) for each passage: higher is closer in meaning."""
        if not self._slots.acquire(timeout=self._wait_s):
            with self._busy_lock:
                self.busy += 1
            raise MeaningBusyError
        try:
            q = self._query.embed([question])[0]
        finally:
            self._slots.release()
        return [
            sum(a * b for a, b in zip(q, self._vectors[passage_key(p)], strict=True))
            for p in passages
        ]

    @classmethod
    def build(
        cls,
        kb: KnowledgeBase,
        base: Path = MODELS_DIR,
        make_query: Callable[[Path], Encoder] = query_encoder,
        make_article: Callable[[Path], Encoder] = article_encoder,
        slots: int = 1,
        wait_s: float | None = None,
    ) -> "MeaningIndex":
        cache = base / f"index-{kb.version}-{ARTICLE_ENCODER.revision[:12]}.json"
        vectors: dict[str, list[float]] | None = None
        if cache.is_file():
            stored = json.loads(cache.read_text(encoding="utf-8"))
            if {passage_key(p) for p in kb.passages} <= stored.keys():
                vectors = stored
        if vectors is None:
            articles = make_article(base)
            embedded = articles.embed([article_text(p) for p in kb.passages])
            vectors = {passage_key(p): v for p, v in zip(kb.passages, embedded, strict=True)}
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(vectors), encoding="utf-8")
            del articles  # 440 MB: only needed to build the cache
        return cls(kb.version, make_query(base), vectors, slots, wait_s)


class MeaningLoader:
    """Builds the index in the background at start-up (about 15 s the first time,
    a few seconds with the cache), so the service answers with keywords at once."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._index: MeaningIndex | None = None
        self.state = "off"

    def start(
        self, load_kb: Callable[[], KnowledgeBase], build: Callable[[KnowledgeBase], MeaningIndex]
    ) -> threading.Thread:
        self.state = "loading"

        def work() -> None:
            try:
                index = build(load_kb())
            except Exception as err:  # noqa: BLE001 - the service keeps answering with keywords
                self.state = f"failed: {type(err).__name__}"
                log.warning("Meaning search is off: %s", err)
                return
            with self._lock:
                self._index = index
                self.state = "ready"
            log.info("Meaning search is ready (MedCPT).")

        thread = threading.Thread(target=work, name="meaning-index", daemon=True)
        thread.start()
        return thread

    def get(self, kb_version: str) -> MeaningIndex | None:
        with self._lock:
            index = self._index
        return index if index is not None and index.kb_version == kb_version else None

    @property
    def busy(self) -> int:
        """Questions answered with keywords only because the meaning search was busy."""
        with self._lock:
            return self._index.busy if self._index is not None else 0
