from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status

from app.auth import require_service_token
from app.chat.answer import (
    ChatAnswerRequest,
    ChatAnswerResult,
    LanguageNotAvailableError,
    answer,
)
from app.chat.generate import ClaudeWriter
from app.chat.kb import KnowledgeBase, KnowledgeBaseError, default_knowledge_base
from app.config import Settings, get_settings
from app.contract import InferenceRequest, InferenceResult, ModelInfo
from app.router import InsufficientInputsError, ModelRouter, default_router

SERVICE_NAME = "pca-mhealth-ai-services"

app = FastAPI(
    title="PCa mHealth AI Services",
    version="0.1.0",
    description=(
        "AI Intelligence Layer (L4). Research prototype. No output is a clinical diagnosis. "
        "Only the backend may call it (service token)."
    ),
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
def chat_answer(request: ChatAnswerRequest, kb: Knowledge, writer: Writer) -> ChatAnswerResult:
    """Answers from the best-matching reviewed passages: written by Claude from
    them when configured, else quoted (Phase 13). Safety checks, storage and
    the disclaimer are the backend's job."""
    try:
        return answer(kb, request, writer)
    except LanguageNotAvailableError as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "LANGUAGE_NOT_AVAILABLE",
                "message": "There is no verified content in this language yet",
            },
        ) from err
