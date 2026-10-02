"""The meaning search (ADR-013): ordering, refusals, the index, its loading, and
(when the MedCPT models are downloaded) the encoder and the measured quality."""

import json
import threading
from collections import Counter
from collections.abc import Sequence
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main
from app.chat import embeddings
from app.chat.answer import (
    MEANING_FLOOR,
    MEANING_SECOND_GAP,
    MIN_SCORE,
    ChatAnswerRequest,
    ChatAnswerResult,
    answer,
)
from app.chat.eval_sets import (
    FOLLOW_UP_SET,
    OFF_TOPIC_SET,
    PARAPHRASE_SET,
    QUALITY_SET,
    SECTION_SET,
)
from app.chat.kb import KnowledgeBase, Passage, default_knowledge_base
from app.chat.meaning import MeaningIndex, MeaningLoader, passage_key
from app.chat.retrieve import Hit, Retriever
from app.config import Settings, get_settings
from app.main import app, get_meaning, meaning_loader, retrieval_mode, start_meaning_search

TOKEN = "test-service-token-0123456789"  # noqa: S105 - test-only value


@pytest.fixture(scope="module")
def kb() -> KnowledgeBase:
    return default_knowledge_base()


class FakeMeaning:
    """A stand-in for MedCPT: a fixed score per passage (article id and heading)
    or per article, and `default` for the others."""

    def __init__(
        self, fixed: dict[str | tuple[str, str], float] | None = None, default: float = 60.0
    ) -> None:
        self.fixed = fixed or {}
        self.default = default
        self.asked: list[str] = []

    def scores(self, question: str, passages: Sequence[Passage]) -> list[float]:
        self.asked.append(question)
        return [
            self.fixed.get((p.article_id, p.heading), self.fixed.get(p.article_id, self.default))
            for p in passages
        ]


def ask(
    kb: KnowledgeBase, question: str, meaning: object, audience: str = "patient"
) -> ChatAnswerResult:
    request = ChatAnswerRequest(question=question, audience=audience)  # type: ignore[arg-type]
    return answer(kb, request, meaning=meaning)  # type: ignore[arg-type]


def candidates(kb: KnowledgeBase, question: str, audience: str = "patient") -> list[Hit]:
    retriever = Retriever(kb, audience, "en")  # type: ignore[arg-type]
    return [
        h for h in retriever.search(question, top_k=len(retriever.passages)) if h.score >= MIN_SCORE
    ]


# --- how answers use the meaning -----------------------------------------------------

#: Matches several articles by its words (checked below, so a change to the
#: knowledge base shows here first).
MANY = "Who is at higher risk of prostate cancer and what does a PSA test show?"


def test_the_keywords_still_decide_whether_a_question_is_covered(kb: KnowledgeBase) -> None:
    assert candidates(kb, "hello") == []
    # However close the stand-in says the meaning is, no keyword match means no answer.
    result = ask(kb, "hello", FakeMeaning(default=99.0))
    assert result.matched is False


def test_the_article_closest_in_meaning_is_quoted_first(kb: KnowledgeBase) -> None:
    found = candidates(kb, MANY)
    assert len({h.passage.article_id for h in found}) >= 2, (
        "the test question needs several articles"
    )
    last = found[-1].passage.article_id  # the weakest keyword match
    result = ask(kb, MANY, FakeMeaning({last: 70.0}, default=55.0))
    assert result.passages[0].articleId == last
    assert result.matched is True


def test_inside_an_article_the_keywords_choose_the_section(kb: KnowledgeBase) -> None:
    # MedCPT scores the sections of one article within a point or two of each
    # other; "What does PI-RADS 4 mean?" lost the five categories that way.
    found = [h.passage for h in candidates(kb, MANY) if h.passage.article_id == "screening"]
    assert len(found) >= 3, "the test question needs several sections of one article"
    top, weakest = found[0], found[-1]  # in keyword order
    fake = FakeMeaning({("screening", weakest.heading): 80.0, "screening": 60.0}, default=55.0)
    result = ask(kb, MANY, fake)
    # The article is chosen by its closest section; its keyword-best section
    # is quoted, and the next section (60) is not close enough to 80 to follow.
    assert [(p.articleId, p.heading) for p in result.passages] == [("screening", top.heading)]


def test_an_answer_far_from_the_question_in_meaning_is_not_given(kb: KnowledgeBase) -> None:
    assert candidates(kb, MANY)
    result = ask(kb, MANY, FakeMeaning(default=MEANING_FLOOR - 0.1))
    assert result.matched is False
    assert result.text is None


def test_a_second_passage_is_quoted_only_when_it_is_nearly_as_close(kb: KnowledgeBase) -> None:
    found = candidates(kb, MANY)
    # Two articles with one matching passage each, so the order is clear.
    per_article = Counter(h.passage.article_id for h in found)
    single = sorted(
        (h.passage for h in found if per_article[h.passage.article_id] == 1),
        key=lambda p: len(p.body),
    )
    assert len(single) >= 2, "the test question needs two single-passage articles"
    first, second = single[0], single[1]
    assert len(first.body) + len(second.body) <= 700

    a, b = (first.article_id, first.heading), (second.article_id, second.heading)
    close = FakeMeaning({a: 70.0, b: 70.0 - MEANING_SECOND_GAP}, default=53.0)
    assert [(p.articleId, p.heading) for p in ask(kb, MANY, close).passages] == [a, b]

    far = FakeMeaning({a: 70.0, b: 70.0 - MEANING_SECOND_GAP - 0.5}, default=53.0)
    assert [(p.articleId, p.heading) for p in ask(kb, MANY, far).passages] == [a]


def test_with_the_meaning_search_answers_still_only_quote_the_knowledge_base(
    kb: KnowledgeBase,
) -> None:
    body_of = {(p.article_id, p.heading): p.body for p in kb.passages}
    for audience, question, _ in QUALITY_SET:
        result = ask(kb, question, FakeMeaning(), audience)
        used = [body_of[(p.articleId, p.heading)] for p in result.passages]
        assert result.text == " ".join(used)
        assert result.sources


def test_a_short_follow_up_is_scored_with_the_previous_question(kb: KnowledgeBase) -> None:
    fake = FakeMeaning()
    request = ChatAnswerRequest(
        question="Does it hurt?",
        audience="patient",
        history=[
            {"role": "user", "text": "What happens during a DRE?"},  # type: ignore[list-item]
            {"role": "assistant", "text": "The clinician gently puts a gloved finger..."},
        ],  # type: ignore[list-item]
    )
    answer(kb, request, meaning=fake)
    # First the passages for both questions together, then the short question alone.
    assert fake.asked == ["What happens during a DRE? Does it hurt?", "Does it hurt?"]


class ByQuestion(FakeMeaning):
    """A stand-in whose score depends on the question asked."""

    def __init__(self, by_question: dict[str, float]) -> None:
        super().__init__()
        self.by_question = by_question

    def scores(self, question: str, passages: Sequence[Passage]) -> list[float]:
        self.asked.append(question)
        return [self.by_question.get(question, 60.0) for _ in passages]


def test_a_new_topic_is_not_answered_as_a_follow_up(kb: KnowledgeBase) -> None:
    history = [
        {"role": "user", "text": "Is the finger test painful?"},
        {"role": "assistant", "text": "It may feel uncomfortable, but it should not be painful."},
    ]
    request = ChatAnswerRequest(
        question="What is the treatment for malaria?",
        audience="patient",
        history=history,  # type: ignore[arg-type]
    )
    # Read together, the two questions match the knowledge base...
    assert answer(kb, request, meaning=FakeMeaning()).matched is True
    # ...but the short question alone is far from the chosen passage in meaning.
    alone_far = ByQuestion({"What is the treatment for malaria?": MEANING_FLOOR - 1})
    assert answer(kb, request, meaning=alone_far).matched is False


# --- the index ------------------------------------------------------------------------


class FakeEncoder:
    """Three numbers per text: the counts of three words."""

    calls = 0

    def embed(self, texts: Sequence[str | tuple[str, str]]) -> list[list[float]]:
        FakeEncoder.calls += 1
        out = []
        for text in texts:
            words = " ".join(text).lower() if isinstance(text, tuple) else text.lower()
            out.append([float(words.count(w)) for w in ("psa", "prostate", "urine")])
        return out


def test_the_index_scores_by_dot_product_and_keeps_a_cache(
    kb: KnowledgeBase, tmp_path: Path
) -> None:
    FakeEncoder.calls = 0
    index = MeaningIndex.build(
        kb, tmp_path, make_query=lambda _: FakeEncoder(), make_article=lambda _: FakeEncoder()
    )
    cache = next(tmp_path.glob("index-*.json"))
    assert set(json.loads(cache.read_text(encoding="utf-8"))) == {
        passage_key(p) for p in kb.passages
    }
    psa = next(p for p in kb.passages if p.article_id == "psa-test")
    help_ = next(p for p in kb.passages if p.article_id == "get-help")
    a, b = index.scores("psa psa", [psa, help_])
    assert a > b

    def no_article_encoder(_: Path) -> FakeEncoder:
        raise AssertionError("the cache should have been used")

    again = MeaningIndex.build(
        kb, tmp_path, make_query=lambda _: FakeEncoder(), make_article=no_article_encoder
    )
    assert again.scores("psa psa", [psa, help_]) == [a, b]
    assert again.kb_version == kb.version


class BlockingEncoder(FakeEncoder):
    """Holds its slot until released, like a question still being encoded."""

    def __init__(self) -> None:
        self.entered = threading.Event()
        self.release = threading.Event()

    def embed(self, texts: Sequence[str | tuple[str, str]]) -> list[list[float]]:
        self.entered.set()
        self.release.wait(timeout=5)
        return super().embed(texts)


def test_when_every_slot_is_taken_the_keywords_alone_answer(kb: KnowledgeBase) -> None:
    encoder = BlockingEncoder()
    vectors = {passage_key(p): [1.0, 1.0, 1.0] for p in kb.passages}
    index = MeaningIndex(kb.version, encoder, vectors, slots=1, wait_s=0.05)
    other = threading.Thread(target=index.scores, args=("psa", kb.passages[:1]))
    other.start()
    assert encoder.entered.wait(timeout=5)  # the only slot is now taken
    try:
        result = ask(kb, MANY, index)
    finally:
        encoder.release.set()
        other.join(timeout=5)
    # Answered at once, as before ADR-013, and counted.
    assert result == ask(kb, MANY, None)
    assert index.busy == 1
    # With the slot free again, questions are scored by meaning.
    assert index.scores("psa", kb.passages[:1])
    assert index.busy == 1


def test_the_loader_builds_in_the_background_and_says_how_it_went(kb: KnowledgeBase) -> None:
    loader = MeaningLoader()
    assert loader.state == "off"
    assert loader.busy == 0
    index = MeaningIndex(kb.version, FakeEncoder(), {})
    loader.start(lambda: kb, lambda _: index).join(timeout=10)
    assert loader.state == "ready"
    assert loader.get(kb.version) is index
    assert loader.get("another version") is None
    index.busy = 3
    assert loader.busy == 3

    def broken(_: KnowledgeBase) -> MeaningIndex:
        raise OSError("disk full")

    failing = MeaningLoader()
    failing.start(lambda: kb, broken).join(timeout=10)
    assert failing.state == "failed: OSError"
    assert failing.get(kb.version) is None


def test_start_up_without_models_keeps_to_keywords(tmp_path: Path) -> None:
    before = meaning_loader.state
    try:
        start_meaning_search(Settings(service_token=TOKEN, chat_retrieval="keywords"))
        assert meaning_loader.state == before
        start_meaning_search(Settings(service_token=TOKEN, chat_models_dir=str(tmp_path)))
        assert meaning_loader.state == "models not downloaded"
        assert retrieval_mode() == "keywords (meaning search: models not downloaded)"
    finally:
        meaning_loader.state = before


@pytest.mark.parametrize(("configured", "expected"), [(3, 3), (0, 6)])
def test_start_up_with_models_builds_the_index_with_its_slots(
    kb: KnowledgeBase,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    configured: int,
    expected: int,
) -> None:
    built: list[tuple[Path, int, float | None]] = []
    one_thread: list[bool] = []

    def build(
        kb_: KnowledgeBase, base: Path, slots: int = 1, wait_s: float | None = None
    ) -> MeaningIndex:
        built.append((base, slots, wait_s))
        return MeaningIndex(kb_.version, FakeEncoder(), {}, slots, wait_s)

    monkeypatch.setattr(main, "meaning_loader", MeaningLoader())
    monkeypatch.setattr(main.embeddings, "is_installed", lambda base: True)
    monkeypatch.setattr(main.MeaningIndex, "build", build)
    monkeypatch.setattr(main.embeddings, "one_thread_per_question", lambda: one_thread.append(True))
    monkeypatch.setattr(main.os, "cpu_count", lambda: 8)  # 0 slots: 3/4 of 8 threads
    settings = Settings(
        service_token=TOKEN,
        chat_models_dir=str(tmp_path),
        chat_meaning_slots=configured,
        chat_meaning_wait_ms=250,
    )
    thread = start_meaning_search(settings)
    assert thread is not None
    thread.join(timeout=10)
    assert built == [(tmp_path, expected, 0.25)]
    assert one_thread == [True]
    body = TestClient(app).get("/v1/health").json()
    assert body["chat_retrieval"] == "keywords+meaning (MedCPT)"
    assert body["chat_meaning_busy"] == 0


def test_the_endpoint_uses_the_meaning_search_when_it_is_ready(kb: KnowledgeBase) -> None:
    found = candidates(kb, MANY)
    last = found[-1].passage.article_id
    app.dependency_overrides[get_settings] = lambda: Settings(service_token=TOKEN)
    app.dependency_overrides[get_meaning] = lambda: FakeMeaning({last: 70.0}, default=55.0)
    try:
        res = TestClient(app).post(
            "/v1/chat/answer",
            json={"question": MANY, "audience": "patient"},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 200
    assert res.json()["passages"][0]["articleId"] == last


def test_health_says_how_passages_are_found() -> None:
    body = TestClient(app).get("/v1/health").json()
    assert body["chat_retrieval"].startswith("keywords")
    assert body["chat_meaning_busy"] == 0


# --- with the real MedCPT models (skipped when they are not downloaded) ---------------

models = pytest.mark.skipif(
    not embeddings.is_installed(),
    reason="MedCPT models not downloaded (python -m app.chat.embeddings download)",
)

#: The model card's code (transformers 5, PyTorch, CPU) on the same texts, 1 October 2026.
REFERENCE = {
    "queries": ["What does a PSA test measure?", "Is the finger test painful?"],
    "articles": [
        (
            "What is a PSA test?: What PSA is",
            "PSA (prostate-specific antigen) is a protein made by the prostate. A small amount is "
            "normally found in the blood.",
        ),
        (
            "What is a digital rectal exam (DRE)?: What happens",
            "The clinician gently puts a gloved, lubricated finger into the back passage "
            "(rectum) to feel the prostate through the wall of the rectum. It may feel "
            "uncomfortable, but it should not be painful.",
        ),
    ],
    "q_first4": [[0.43641, -0.2681, 0.22785, 0.14949], [0.31265, 0.1579, -0.10698, -0.15205]],
    "a_first4": [[-0.04555, -0.04746, -0.0757, -0.07481], [-0.09187, 0.17653, -0.15246, -0.1181]],
    "scores": [[66.4913, 54.2293], [50.2561, 60.6465]],
}

_lock = threading.Lock()
_index: list[MeaningIndex] = []


def real_index(kb: KnowledgeBase) -> MeaningIndex:
    with _lock:
        if not _index:
            _index.append(MeaningIndex.build(kb))
        return _index[0]


@models
def test_the_numpy_encoder_gives_the_same_vectors_as_the_reference() -> None:
    q = embeddings.query_encoder().embed(REFERENCE["queries"])  # type: ignore[arg-type]
    a = embeddings.article_encoder().embed(REFERENCE["articles"])  # type: ignore[arg-type]
    for got, want in zip(q + a, REFERENCE["q_first4"] + REFERENCE["a_first4"], strict=True):  # type: ignore[operator]
        assert got[:4] == pytest.approx(want, abs=1e-4)
    scores = [[sum(x * y for x, y in zip(qv, av, strict=True)) for av in a] for qv in q]
    for row, want_row in zip(scores, REFERENCE["scores"], strict=True):  # type: ignore[arg-type]
        assert row == pytest.approx(want_row, abs=2e-3)


@models
def test_the_meaning_search_is_at_least_as_good_as_keywords_on_every_set(kb: KnowledgeBase) -> None:
    index = real_index(kb)

    def first(question: str, audience: str, meaning: object) -> str | None:
        result = ask(kb, question, meaning, audience)
        return result.passages[0].articleId if result.matched else None

    quality = [(a, q, frozenset({w})) for a, q, w in QUALITY_SET]
    counts = {}
    for mode, meaning in (("keywords", None), ("meaning", index)):
        counts[mode] = (
            sum(first(q, a, meaning) in w for a, q, w in quality),
            sum(first(q, a, meaning) in w for a, q, w in PARAPHRASE_SET),
            sum(first(q, "patient", meaning) is None for q in OFF_TOPIC_SET),
        )
    # Measured on 1 October 2026 (python -m app.chat.evaluate): keywords 18/18,
    # 18/24 and 9/12; with the meaning search 18/18, 20/24 and 11/12.
    assert counts["meaning"][0] == len(QUALITY_SET)
    assert counts["meaning"][1] >= 20
    assert counts["meaning"][2] >= 11
    for with_meaning, keywords in zip(counts["meaning"], counts["keywords"], strict=True):
        assert with_meaning >= keywords

    # And the right section of the article (2 October 2026: keywords 8/10,
    # with the meaning search 9/10; the first version only got 5).
    def section(question: str, audience: str, meaning: object) -> tuple[str, str] | None:
        result = ask(kb, question, meaning, audience)
        return (
            (result.passages[0].articleId, result.passages[0].heading) if result.matched else None
        )

    sections = {
        mode: sum(section(q, a, meaning) == (art, sec) for a, q, art, sec in SECTION_SET)
        for mode, meaning in (("keywords", None), ("meaning", index))
    }
    assert sections["meaning"] >= 9
    assert sections["meaning"] >= sections["keywords"]


@models
def test_follow_ups_are_understood_and_new_topics_are_not_taken_for_them(
    kb: KnowledgeBase,
) -> None:
    index = real_index(kb)

    def first(previous: str, question: str) -> str | None:
        history = [{"role": "user", "text": previous}, {"role": "assistant", "text": "â€¦"}]
        request = ChatAnswerRequest(
            question=question,
            audience="patient",
            history=history,  # type: ignore[arg-type]
        )
        result = answer(kb, request, meaning=index)
        return result.passages[0].articleId if result.matched else None

    follow_ups = [row for row in FOLLOW_UP_SET if row[2] is not None]
    new_topics = [row for row in FOLLOW_UP_SET if row[2] is None]
    assert all(first(p, q) == w for p, q, w in follow_ups)
    # Measured: 3 of the 4 new topics refused ("Will it rain tomorrow?" is not).
    assert sum(first(p, q) is None for p, q, _ in new_topics) >= 3
