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
    token = os.environ.get("AI_SERVICE_TOKEN", "").strip()
    if not token:
        token = _from_env_file(env_file, "AI_SERVICE_TOKEN")
    return Settings(service_token=token)


@lru_cache
def get_settings() -> Settings:
    return load_settings()
