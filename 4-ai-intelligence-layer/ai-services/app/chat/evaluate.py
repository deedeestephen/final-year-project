"""Measures the chat's retrieval with and without the meaning search (ADR-013).

    python -m app.chat.evaluate

Needs the MedCPT models (python -m app.chat.embeddings download). Prints, for
each evaluation set (eval_sets.py), how often the first quoted passage comes
from a right article and how many off-topic questions get no answer, then
every question whose result differs, and the meaning scores next to the
floor in answer.py, so a change to the knowledge base can be checked.
"""

import sys
import time

from app.chat import embeddings
from app.chat.answer import MEANING_FLOOR, MIN_SCORE, ChatAnswerRequest, answer
from app.chat.eval_sets import (
    FOLLOW_UP_SET,
    OFF_TOPIC_SET,
    PARAPHRASE_SET,
    QUALITY_SET,
    SECTION_SET,
)
from app.chat.kb import KnowledgeBase, default_knowledge_base
from app.chat.meaning import MeaningIndex, MeaningScorer
from app.chat.retrieve import Retriever


def first_article(
    question: str, audience: str, meaning: MeaningScorer | None, previous: str | None = None
) -> str | None:
    kb = default_knowledge_base()
    history = [{"role": "user", "text": previous}, {"role": "assistant", "text": "…"}]
    request = ChatAnswerRequest(
        question=question,
        audience=audience,  # type: ignore[arg-type]
        history=history if previous else [],  # type: ignore[arg-type]
    )
    result = answer(kb, request, meaning=meaning)
    return result.passages[0].articleId if result.matched else None


def first_section(question: str, audience: str, meaning: MeaningScorer | None) -> str | None:
    request = ChatAnswerRequest(question=question, audience=audience)  # type: ignore[arg-type]
    result = answer(default_knowledge_base(), request, meaning=meaning)
    if not result.matched:
        return None
    return f"{result.passages[0].articleId}/{result.passages[0].heading}"


def best_closeness(kb: KnowledgeBase, index: MeaningIndex, audience: str, q: str) -> float | None:
    """The meaning score of the passage the answer would quote first (as answer.py)."""
    retriever = Retriever(kb, audience, "en")  # type: ignore[arg-type]
    hits = [h for h in retriever.search(q, top_k=len(retriever.passages)) if h.score >= MIN_SCORE]
    return max(index.scores(q, [h.passage for h in hits])) if hits else None


def main() -> int:
    if not embeddings.is_installed():
        print("The MedCPT models are not downloaded: python -m app.chat.embeddings download")
        return 1
    kb = default_knowledge_base()
    started = time.perf_counter()
    index = MeaningIndex.build(kb)
    seconds = time.perf_counter() - started
    print(f"Meaning index for {len(kb.passages)} passages ready in {seconds:.1f} s")
    sets: dict[str, list[tuple[str, str, frozenset[str]]]] = {
        "quality set": [(a, q, frozenset({w})) for a, q, w in QUALITY_SET],
        "everyday-words set": PARAPHRASE_SET,
    }
    modes: dict[str, MeaningScorer | None] = {"keywords": None, "keywords + meaning": index}
    results = {
        mode: {(a, q): first_article(q, a, scorer) for rows in sets.values() for a, q, _ in rows}
        | {("patient", q): first_article(q, "patient", scorer) for q in OFF_TOPIC_SET}
        for mode, scorer in modes.items()
    }
    print(f"\n{'':22}{'quality':>10}{'everyday':>10}{'off-topic refused':>20}")
    for mode, got in results.items():
        cells = [
            f"{sum(got[(a, q)] in w for a, q, w in rows)}/{len(rows)}" for rows in sets.values()
        ]
        refused = sum(got[("patient", q)] is None for q in OFF_TOPIC_SET)
        print(f"{mode:22}{cells[0]:>10}{cells[1]:>10}{f'{refused}/{len(OFF_TOPIC_SET)}':>20}")
    print("\nQuestions whose first passage changes with the meaning search:")
    before, after = results["keywords"], results["keywords + meaning"]
    for rows in sets.values():
        for a, q, w in rows:
            if before[(a, q)] != after[(a, q)]:
                verdict = (
                    "better" if after[(a, q)] in w else "worse" if before[(a, q)] in w else "other"
                )
                print(f"  {verdict:6} {q}: {before[(a, q)]} -> {after[(a, q)]}")
    for q in OFF_TOPIC_SET:
        if before[("patient", q)] != after[("patient", q)]:
            print(f"  off-topic {q}: {before[('patient', q)]} -> {after[('patient', q)]}")
    print("\nShort questions after a first one (follow-ups, and new topics):")
    print(f"{'':22}{'follow-ups right':>18}{'new topics refused':>20}")
    follow_ups = [row for row in FOLLOW_UP_SET if row[2] is not None]
    new_topics = [row for row in FOLLOW_UP_SET if row[2] is None]
    for mode, scorer in modes.items():
        understood = sum(first_article(q, "patient", scorer, p) == w for p, q, w in follow_ups)
        declined = sum(first_article(q, "patient", scorer, p) is None for p, q, _ in new_topics)
        print(
            f"{mode:22}{f'{understood}/{len(follow_ups)}':>18}{f'{declined}/{len(new_topics)}':>20}"
        )
    print("\nThe right section quoted first (the sets above only check the article):")
    for mode, scorer in modes.items():
        quoted = [
            (q, first_section(q, a, scorer), f"{art}/{sec}") for a, q, art, sec in SECTION_SET
        ]
        print(
            f"  {mode:20}{sum(got_s == right_s for _, got_s, right_s in quoted)}/{len(SECTION_SET)}"
        )
        for asked, got_s, right_s in quoted:
            if got_s != right_s:
                print(f"    {asked}: {got_s} (right: {right_s})")
    print(f"\nMeaning score of the passage quoted first (the floor is {MEANING_FLOOR}):")
    right = [
        (closeness, q)
        for rows in sets.values()
        for a, q, w in rows
        if after[(a, q)] in w and (closeness := best_closeness(kb, index, a, q)) is not None
    ]
    for closeness, q in sorted(right)[:3]:
        print(f"  right answer, {q!r}: {closeness:.1f}")
    for q in OFF_TOPIC_SET:
        closeness = best_closeness(kb, index, "patient", q)
        if closeness is not None:
            print(f"  off-topic with a keyword match, {q!r}: {closeness:.1f}")
    started = time.perf_counter()
    for _ in range(10):
        index.scores("Is the finger test painful?", kb.passages[:5])
    per_question_ms = (time.perf_counter() - started) * 100
    print(f"\nOne question takes {per_question_ms:.0f} ms with the meaning search.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
