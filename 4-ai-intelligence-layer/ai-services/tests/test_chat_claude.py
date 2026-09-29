"""Claude-written chat answers (ADR-010), tested with a fake Anthropic client."""

import os
from collections.abc import Iterator
from datetime import date
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.chat.answer import ChatAnswerRequest, HistoryTurn, answer
from app.chat.generate import ClaudeWriter, Turn, _messages, scrub
from app.chat.kb import KnowledgeBase, default_knowledge_base
from app.config import Settings, get_settings, load_settings
from app.main import app, get_writer

TOKEN = "test-service-token-0123456789"  # noqa: S105 - test-only value
AUTH = {"Authorization": f"Bearer {TOKEN}"}
MODEL = "claude-haiku-4-5-20251001"


def tool_reply(covered: bool, text: str, citations: list[int]) -> SimpleNamespace:
    block = SimpleNamespace(
        type="tool_use",
        name="give_answer",
        input={"covered": covered, "answer": text, "citations": citations},
    )
    return SimpleNamespace(content=[block])


class FakeMessages:
    """Stands in for anthropic.Anthropic().messages and records each request."""

    def __init__(self, reply: object) -> None:
        self.reply = reply
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> object:
        self.calls.append(kwargs)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


@pytest.fixture(scope="module")
def kb() -> KnowledgeBase:
    return default_knowledge_base()


def ask(
    kb: KnowledgeBase,
    writer: ClaudeWriter | None,
    question: str,
    audience: str = "patient",
    history: list[HistoryTurn] | None = None,
) -> Any:
    return answer(
        kb,
        ChatAnswerRequest(
            question=question,
            audience=audience,  # type: ignore[arg-type]
            history=history or [],
        ),
        writer,
    )


def test_personal_details_are_removed_before_anything_leaves() -> None:
    text = "I am john.banda@example.com, NRC 123456/78/1, phone +260 97 123 4567 or 0971234567."
    clean = scrub(text)
    for secret in ["john.banda@example.com", "123456/78/1", "97 123 4567", "0971234567"]:
        assert secret not in clean
    assert "[NRC removed]" in clean and "[phone removed]" in clean


def test_claude_writes_the_answer_from_the_cited_passages_only(kb: KnowledgeBase) -> None:
    fake = FakeMessages(
        tool_reply(True, "PSA is a protein made by the prostate [1]. The test measures it.", [1])
    )
    writer = ClaudeWriter(fake, model=MODEL, daily_limit=10)
    result = ask(kb, writer, "What does a PSA test measure?")

    assert result.mode == "GENERATED"
    assert result.model == MODEL
    assert result.matched is True
    assert result.text == "PSA is a protein made by the prostate. The test measures it."
    assert [p.articleId for p in result.passages] == ["psa-test"]
    assert result.sources and all(s.name for s in result.sources)

    call = fake.calls[0]
    assert call["model"] == MODEL
    assert call["tool_choice"] == {"type": "tool", "name": "give_answer"}
    assert "reading age" in call["system"] and "Never diagnose" in call["system"]
    last = call["messages"][-1]
    assert last["role"] == "user"
    assert '<passage number="1"' in last["content"]
    assert "What does a PSA test measure?" in last["content"]


def test_clinicians_get_the_clinician_instructions(kb: KnowledgeBase) -> None:
    fake = FakeMessages(tool_reply(True, "PI-RADS 4 means high likelihood.", [1]))
    ask(
        kb,
        ClaudeWriter(fake, model=MODEL, daily_limit=10),
        "What does PI-RADS 4 mean?",
        "clinician",
    )
    assert "clinical judgement" in fake.calls[0]["system"]


def test_not_covered_means_no_reviewed_information(kb: KnowledgeBase) -> None:
    fake = FakeMessages(tool_reply(False, "I do not have reviewed information about that.", []))
    result = ask(kb, ClaudeWriter(fake, model=MODEL, daily_limit=10), "What does a PSA test cost?")
    assert result.matched is False
    assert result.text is None
    assert result.mode == "GENERATED"


@pytest.mark.parametrize(
    "reply",
    [
        RuntimeError("API down"),
        SimpleNamespace(content=[SimpleNamespace(type="text", text="plain text")]),
        tool_reply(True, "An answer without a valid citation.", [9]),
        tool_reply(True, "", [1]),
        SimpleNamespace(
            content=[SimpleNamespace(type="tool_use", name="give_answer", input={"answer": 1})]
        ),
    ],
)
def test_anything_unusable_falls_back_to_quoting(kb: KnowledgeBase, reply: object) -> None:
    result = ask(
        kb, ClaudeWriter(FakeMessages(reply), model=MODEL, daily_limit=10), "What is a PSA test?"
    )
    assert result.mode == "EXTRACTIVE"
    assert result.matched is True
    assert result.model is None


def test_nothing_is_sent_when_no_passage_matches(kb: KnowledgeBase) -> None:
    fake = FakeMessages(tool_reply(True, "x", [1]))
    result = ask(kb, ClaudeWriter(fake, model=MODEL, daily_limit=10), "hello")
    assert result.matched is False
    assert fake.calls == []


def test_the_daily_budget_caps_calls_and_resets_the_next_day(kb: KnowledgeBase) -> None:
    today = [date(2026, 9, 29)]
    fake = FakeMessages(tool_reply(True, "PSA is a protein.", [1]))
    writer = ClaudeWriter(fake, model=MODEL, daily_limit=2, today=lambda: today[0])
    modes = [ask(kb, writer, "What is a PSA test?").mode for _ in range(3)]
    assert modes == ["GENERATED", "GENERATED", "EXTRACTIVE"]
    today[0] = date(2026, 9, 30)
    assert ask(kb, writer, "What is a PSA test?").mode == "GENERATED"
    assert len(fake.calls) == 3


def test_follow_ups_use_the_conversation(kb: KnowledgeBase) -> None:
    history = [
        HistoryTurn(role="user", text="What happens during a rectal exam?"),
        HistoryTurn(role="assistant", text="The clinician gently feels the prostate."),
    ]
    # "Does it hurt?" alone matches nothing; with the previous question it finds the DRE.
    assert ask(kb, None, "Does it hurt?").matched is False
    follow_up = ask(kb, None, "Does it hurt?", history=history)
    assert follow_up.matched is True
    assert follow_up.passages[0].articleId == "dre"

    fake = FakeMessages(tool_reply(True, "It may feel uncomfortable but should not hurt.", [1]))
    ask(kb, ClaudeWriter(fake, model=MODEL, daily_limit=10), "Does it hurt?", history=history)
    roles = [m["role"] for m in fake.calls[0]["messages"]]
    assert roles == ["user", "assistant", "user"]


def test_messages_always_alternate_and_start_with_the_user() -> None:
    kb_passage = default_knowledge_base().passages[0]
    history = [
        Turn(role="assistant", text="Hello!"),
        Turn(role="user", text="hi"),
        Turn(role="user", text="my email is a@b.co"),
    ]
    messages = _messages("What is PSA?", [kb_passage], history)
    assert [m["role"] for m in messages] == ["user"]
    assert "[email removed]" in messages[0]["content"]


# --- configuration and the endpoint ---------------------------------------------------


def test_the_key_and_model_come_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")
    monkeypatch.setenv("CHAT_LLM_MODEL", "claude-sonnet-5")
    monkeypatch.setenv("CHAT_LLM_DAILY_LIMIT", "5")
    settings = load_settings()
    assert settings.anthropic_api_key == "test-key-not-real"  # noqa: S105
    assert settings.chat_model == "claude-sonnet-5"
    assert settings.chat_llm_daily_limit == 5


def test_an_empty_environment_value_switches_claude_off(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("ANTHROPIC_API_KEY=key-from-env-file", encoding="utf-8")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert load_settings(env_file).anthropic_api_key == "key-from-env-file"
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    assert load_settings(env_file).anthropic_api_key == ""


@pytest.fixture
def client() -> Iterator[TestClient]:
    app.dependency_overrides[get_settings] = lambda: Settings(service_token=TOKEN)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_without_a_key_the_service_quotes(client: TestClient) -> None:
    assert client.get("/v1/health").json()["chat_writer"] == "quotes"
    res = client.post(
        "/v1/chat/answer",
        json={"question": "What is a PSA test?", "audience": "patient"},
        headers=AUTH,
    )
    assert res.json()["mode"] == "EXTRACTIVE"


def test_with_a_writer_the_service_answers_with_claude(client: TestClient) -> None:
    fake = FakeMessages(tool_reply(True, "PSA is a protein made by the prostate.", [1]))
    app.dependency_overrides[get_writer] = lambda: ClaudeWriter(fake, model=MODEL, daily_limit=5)
    assert client.get("/v1/health").json()["chat_writer"] == f"claude:{MODEL}"
    body = client.post(
        "/v1/chat/answer",
        json={
            "question": "What is a PSA test?",
            "audience": "patient",
            "history": [{"role": "user", "text": "hello"}],
        },
        headers=AUTH,
    ).json()
    assert body["mode"] == "GENERATED"
    assert body["model"] == MODEL


def test_a_configured_key_builds_a_real_client() -> None:
    fake_key = "test-key-not-real"  # noqa: S105  # gitleaks:allow (made-up test value)
    writer = get_writer(Settings(service_token=TOKEN, anthropic_api_key=fake_key))
    assert writer is not None and writer.model == Settings.chat_model
    assert get_writer(Settings(service_token=TOKEN)) is None


@pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY_LIVE_TEST"),
    reason="set ANTHROPIC_API_KEY_LIVE_TEST=1 (and ANTHROPIC_API_KEY) to call the real API once",
)
def test_live_claude_answer(kb: KnowledgeBase) -> None:  # pragma: no cover - costs money
    settings = load_settings()
    writer = get_writer(settings)
    assert writer is not None, "ANTHROPIC_API_KEY is not configured"
    result = ask(kb, writer, "What does a PSA test measure?")
    assert result.mode == "GENERATED", "Claude did not answer (check the key and the model)"
    assert result.sources
