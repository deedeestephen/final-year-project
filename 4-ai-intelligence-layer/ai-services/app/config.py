"""Service configuration, read once from the environment."""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _repo_root(start: Path) -> Path:
    """The nearest folder above `start` that holds .env.example (the repository root)."""
    for folder in [start, *start.parents]:
        if (folder / ".env.example").is_file():
            return folder
    return start


#: The repository-root .env used in local development (deployments inject variables).
_DEV_ENV_FILE = _repo_root(Path(__file__).resolve().parent) / ".env"


@dataclass(frozen=True)
class Settings:
    #: Shared secret the backend sends as `Authorization: Bearer <token>`.
    #: When empty, every protected endpoint refuses to work (fail closed).
    service_token: str
    #: Anthropic API key: when set, Claude writes chat answers from the
    #: retrieved passages (ADR-010). Empty: quoted answers only (ADR-009).
    anthropic_api_key: str = ""
    #: A fast model keeps answers within the 2 s target (FR-07).
    chat_model: str = "claude-haiku-4-5-20251001"
    chat_llm_timeout_s: float = 8.0
    #: At most this many Claude calls per day (UTC), to cap the cost.
    chat_llm_daily_limit: int = 2000


def _from_env_file(path: Path, key: str) -> str:
    """Reads one KEY=value line from a .env file; empty when absent."""
    try:
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            name, sep, value = line.partition("=")
            if sep and name.strip() == key:
                return value.strip().strip('"').strip("'")
    except OSError:
        pass
    return ""


def load_settings(env_file: Path = _DEV_ENV_FILE) -> Settings:
    def setting(key: str) -> str:
        # The environment wins over .env, even when empty: tests switch Claude
        # off with ANTHROPIC_API_KEY="" although .env holds a key.
        if key in os.environ:
            return os.environ[key].strip()
        return _from_env_file(env_file, key)

    return Settings(
        service_token=setting("AI_SERVICE_TOKEN"),
        anthropic_api_key=setting("ANTHROPIC_API_KEY"),
        chat_model=setting("CHAT_LLM_MODEL") or Settings.chat_model,
        chat_llm_timeout_s=float(setting("CHAT_LLM_TIMEOUT_S") or Settings.chat_llm_timeout_s),
        chat_llm_daily_limit=int(setting("CHAT_LLM_DAILY_LIMIT") or Settings.chat_llm_daily_limit),
    )


@lru_cache
def get_settings() -> Settings:
    return load_settings()
