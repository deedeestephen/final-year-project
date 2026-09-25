from pathlib import Path

import pytest

from app.config import load_settings


def test_environment_variable_wins(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    env = tmp_path / ".env"
    env.write_text("AI_SERVICE_TOKEN=from-file\n", encoding="utf-8")
    monkeypatch.setenv("AI_SERVICE_TOKEN", "from-environment")
    assert load_settings(env).service_token == "from-environment"  # noqa: S105 - test value


def test_falls_back_to_the_dev_env_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    env = tmp_path / ".env"
    env.write_text(
        "# comment\nOTHER=1\nAI_SERVICE_TOKEN = 'quoted-token' \n",
        encoding="utf-8",
    )
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)
    assert load_settings(env).service_token == "quoted-token"  # noqa: S105 - test value


def test_no_token_anywhere_means_fail_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)
    assert load_settings(tmp_path / "missing.env").service_token == ""
