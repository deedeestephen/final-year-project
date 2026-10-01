import logging
import os
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status

from app.auth import require_service_token
from app.chat import embeddings
from app.chat.answer import (
    ChatAnswerRequest,
    ChatAnswerResult,
    LanguageNotAvailableError,
    answer,
)
from app.chat.generate import ClaudeWriter
from app.chat.kb import KnowledgeBase, KnowledgeBaseError, default_knowledge_base
from app.chat.meaning import MeaningIndex, MeaningLoader
from app.config import Settings, get_settings
from app.contract import InferenceRequest, InferenceResult, ModelInfo
from app.router import InsufficientInputsError, ModelRouter, default_router

SERVICE_NAME = "pca-mhealth-ai-services"
log = logging.getLogger("uvicorn.error")

#: The meaning search's index, built in the background (ADR-013).
meaning_loader = MeaningLoader()


def start_meaning_search(settings: Settings) -> threading.Thread | None:
    """Starts building the meaning index, unless it is switched off or the
    models are not downloaded (then the chat uses keywords only)."""
    if settings.chat_retrieval == "keywords":
        return None
    base = Path(settings.chat_models_dir) if settings.chat_models_dir else embeddings.MODELS_DIR
    if not embeddings.is_installed(base):
        meaning_loader.state = "models not downloaded"
        if settings.chat_retrieval == "meaning":
            log.warning(
                "Meaning search is off: the MedCPT models are not in %s. "
                "Download them with: python -m app.chat.embeddings download",
                base,
            )
        return None
    slots = settings.chat_meaning_slots or max(1, (os.cpu_count() or 1) * 3 // 4)

    def build(kb: KnowledgeBase) -> MeaningIndex:
        index = MeaningIndex.build(
            kb, base, slots=slots, wait_s=settings.chat_meaning_wait_ms / 1000
        )
        # The index file is built with every thread; questions then use one each.
        embeddings.one_thread_per_question()
        return index

    return meaning_loader.start(default_knowledge_base, build)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    start_meaning_search(get_settings())
    yield


app = FastAPI(
    title="PCa mHealth AI Services",
    version="0.1.0",
    description=(
        "AI Intelligence Layer (L4). Research prototype. No output is a clinical diagnosis. "
        "Only the backend may call it (service token)."
    ),
    lifespan=lifespan,
)

_router = default_router()


def get_router() -> ModelRouter:
    return _router


Router = Annotated[ModelRouter, Depends(get_router)]


def get_knowledge_base() -> KnowledgeBase:
    try:
        return default_knowledge_base()
    except (KnowledgeBaseError, OSError, ValueError) as err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "CHAT_UNAVAILABLE", "message": "The knowledge base is not loaded"},
        ) from err


Knowledge = Annotated[KnowledgeBase, Depends(get_knowledge_base)]


@lru_cache
def _writer(api_key: str, model: str, timeout_s: float, daily_limit: int) -> ClaudeWriter:
    import anthropic  # only loaded when a key is configured

    # No automatic retries: a slow or failed call falls back to quoting at once.
    client = anthropic.Anthropic(api_key=api_key, timeout=timeout_s, max_retries=0)
    return ClaudeWriter(client.messages, model=model, daily_limit=daily_limit)


def get_writer(settings: Annotated[Settings, Depends(get_settings)]) -> ClaudeWriter | None:
    """Claude writes chat answers only when ANTHROPIC_API_KEY is set (ADR-010)."""
    if not settings.anthropic_api_key:
        return None
    return _writer(
        settings.anthropic_api_key,
        settings.chat_model,
        settings.chat_llm_timeout_s,
        settings.chat_llm_daily_limit,
    )


Writer = Annotated[ClaudeWriter | None, Depends(get_writer)]


def get_meaning(kb: Knowledge) -> MeaningIndex | None:
    """The meaning search when its index is ready for this knowledge base."""
    return meaning_loader.get(kb.version)


Meaning = Annotated[MeaningIndex | None, Depends(get_meaning)]


def retrieval_mode() -> str:
    if meaning_loader.state == "ready":
        return "keywords+meaning (MedCPT)"
    if meaning_loader.state == "off":
        return "keywords"
    return f"keywords (meaning search: {meaning_loader.state})"


@app.get("/v1/health")
def health(router: Router, writer: Writer) -> dict[str, object]:
    # Until trained and evaluated models are registered, report mock mode honestly.
    real = all(m.provenance == "RESEARCH_MODEL" for m in router.models())
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "mode": "research-model" if real else "development-mock",
        "clinical_models_loaded": real,
        # Who words chat answers: Claude (from the passages) or plain quotes.
        "chat_writer": f"claude:{writer.model}" if writer else "quotes",
        # How passages are found: keywords, and their order by meaning (ADR-013).
        "chat_retrieval": retrieval_mode(),
        # Questions since start-up answered with keywords only because every
        # slot of the meaning search was taken.
        "chat_meaning_busy": meaning_loader.busy,
    }


@app.get("/v1/models", dependencies=[Depends(require_service_token)])
def models(router: Router) -> list[ModelInfo]:
    return router.models()


@app.post("/v1/infer", dependencies=[Depends(require_service_token)])
def infer(request: InferenceRequest, router: Router) -> InferenceResult:
    try:
        return router.infer(request)
    except InsufficientInputsError as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "message": str(err),
                "modulesSkipped": [s.model_dump() for s in err.skipped],
            },
        ) from err


@app.post("/v1/chat/answer", dependencies=[Depends(require_service_token)])
def chat_answer(
    request: ChatAnswerRequest, kb: Knowledge, writer: Writer, meaning: Meaning
) -> ChatAnswerResult:
    """Answers from the best-matching reviewed passages, found by their words and
    ordered by meaning when the meaning search is on (ADR-013): written by Claude
    from them when configured, else quoted (Phase 13). Safety checks, storage
    and the disclaimer are the backend's job."""
    try:
        return answer(kb, request, writer, meaning)
    except LanguageNotAvailableError as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "LANGUAGE_NOT_AVAILABLE",
                "message": "There is no verified content in this language yet",
            },
        ) from err
