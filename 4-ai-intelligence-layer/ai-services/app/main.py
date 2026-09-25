from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status

from app.auth import require_service_token
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


@app.get("/v1/health")
def health(router: Router) -> dict[str, object]:
    # Until trained and evaluated models are registered, report mock mode honestly.
    real = all(m.provenance == "RESEARCH_MODEL" for m in router.models())
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "mode": "research-model" if real else "development-mock",
        "clinical_models_loaded": real,
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
