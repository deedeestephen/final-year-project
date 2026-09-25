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


def test_finds_the_repository_env_file_from_any_depth(tmp_path: Path) -> None:
    from app.config import _repo_root

    (tmp_path / ".env.example").write_text("", encoding="utf-8")
    deep = tmp_path / "4-layer" / "service" / "app"
    deep.mkdir(parents=True)
    assert _repo_root(deep) == tmp_path


def test_stays_put_when_there_is_no_repository(tmp_path: Path) -> None:
    from app.config import _repo_root

    lonely = tmp_path / "deployed" / "app"
    lonely.mkdir(parents=True)
    assert _repo_root(lonely) == lonely
