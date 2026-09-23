from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_service_up() -> None:
    res = client.get("/v1/health")

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "pca-mhealth-ai-services"


def test_health_does_not_claim_clinical_models() -> None:
    # Until trained and evaluated models are registered, the service must say so.
    body = client.get("/v1/health").json()

    assert body["clinical_models_loaded"] is False
    assert body["mode"] == "development-mock"
