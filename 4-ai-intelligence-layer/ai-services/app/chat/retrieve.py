"""Lexical retrieval (BM25): finds the passages that best match a question.

Offline and free: no model download, no external service, and every result
can be explained by the words it shares with the question (ADR-009).
"""

import math
import re
from collections import Counter
from dataclasses import dataclass

from app.chat.kb import Audience, KnowledgeBase, Passage

_STOPWORDS = frozenset(
    """a about above after again all am an and any are as at be because been before being
    below between both but by can could did do does doing down during each few for from
    further had has have having he her here hers him his how i if in into is it its itself
    just me more most my myself no nor not now of off on once only or other our ours out
    over own same she should so some such than that the their them then there these they
    this those through to too under until up very was we were what when which while
    who whom why will with would you your yours tell please know explain mean means""".split()
)

_WORD = re.compile(r"[a-z0-9]+")


def _stem(word: str) -> str:
    # A light touch: plurals only ("tests" -> "test"), never below 3 letters.
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def terms(text: str) -> list[str]:
    """Lower-case words without stopwords, lightly stemmed."""
    return [_stem(w) for w in _WORD.findall(text.lower()) if w not in _STOPWORDS]


#: Everyday words people ask with, mapped to the words the documents use.
_SYNONYMS = {
    "doctor": "clinician",
    "physician": "clinician",
    "nurse": "clinician",
    "pee": "urine",
    "urinate": "urine",
    "urinating": "urine",
    "urination": "urine",
    "examination": "exam",
    "check": "exam",
}


def query_terms(question: str) -> set[str]:
    """The question's terms plus the document words for everyday ones."""
    found = set(terms(question))
    return found | {_SYNONYMS[t] for t in found if t in _SYNONYMS}


@dataclass(frozen=True)
class Hit:
    passage: Passage
    score: float


class Retriever:
    """BM25 over the passages one audience may see."""

    K1 = 1.5
    B = 0.75

    def __init__(self, kb: KnowledgeBase, audience: Audience, language: str) -> None:
        # Clinicians may also be given the plain patient information.
        allowed = {"patient"} if audience == "patient" else {"patient", "clinician"}
        self.passages = [p for p in kb.passages if p.audience in allowed and p.language == language]
        # The title and heading count twice: they say what the passage is about.
        self._docs = [
            terms(f"{p.title} {p.heading} {p.title} {p.heading} {p.body}") for p in self.passages
        ]
        self._freq = [Counter(d) for d in self._docs]
        n = len(self._docs)
        self._avg_len = sum(len(d) for d in self._docs) / n if n else 0.0
        df: Counter[str] = Counter()
        for d in self._docs:
            df.update(set(d))
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    def search(self, question: str, top_k: int = 5) -> list[Hit]:
        query = query_terms(question)
        hits: list[Hit] = []
        for passage, doc, freq in zip(self.passages, self._docs, self._freq, strict=True):
            score = 0.0
            for t in query:
                f = freq.get(t, 0)
                if f:
                    norm = self.K1 * (1 - self.B + self.B * len(doc) / self._avg_len)
                    score += self.idf[t] * f * (self.K1 + 1) / (f + norm)
            if score > 0:
                hits.append(Hit(passage, score))
        hits.sort(key=lambda h: h.score, reverse=True)
        return hits[:top_k]
