from fastapi import FastAPI

SERVICE_NAME = "pca-mhealth-ai-services"

app = FastAPI(
    title="PCa mHealth AI Services",
    version="0.1.0",
    description=(
        "AI Intelligence Layer (L4). Research prototype. No output is a clinical diagnosis."
    ),
)


@app.get("/v1/health")
def health() -> dict[str, object]:
    # Until trained and evaluated models are registered, report mock mode honestly.
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "mode": "development-mock",
        "clinical_models_loaded": False,
    }
