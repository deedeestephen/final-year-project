from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.contract import MOCK_DISCLAIMER, InferenceResult
from app.main import app

TOKEN = "test-service-token-0123456789"  # noqa: S105 - test-only value
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def client() -> Iterator[TestClient]:
    app.dependency_overrides[get_settings] = lambda: Settings(service_token=TOKEN)
    yield TestClient(app)
    app.dependency_overrides.clear()


def request_body(**inputs: object) -> dict[str, object]:
    return {"jobId": str(uuid4()), "patientRef": "pseudo_ref_0001", "inputs": inputs}


CLINICAL = {"ageYears": 64, "psaNgMl": 6.2, "dreFinding": "NORMAL", "piradsScore": 3}
MRI = [{"storageKey": "imaging/2026/09/abc.dcm", "modality": "MRI"}]
SLIDE = [{"storageKey": "slides/2026/09/def.tif", "stain": "H&E"}]


# --- authentication ------------------------------------------------------------


def test_health_is_public_and_honest_about_mock_mode(client: TestClient) -> None:
    body = client.get("/v1/health").json()
    assert body["mode"] == "development-mock"
    assert body["clinical_models_loaded"] is False


def test_protected_endpoints_need_the_service_token(client: TestClient) -> None:
    assert client.get("/v1/models").status_code == 401
    assert client.get("/v1/models", headers={"Authorization": "Bearer wrong"}).status_code == 401
    res = client.post("/v1/infer", json=request_body(clinical=CLINICAL))
    assert res.status_code == 401


def test_refuses_to_work_without_a_configured_token() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(service_token="")
    try:
        res = TestClient(app).get("/v1/models", headers={"Authorization": "Bearer "})
        assert res.status_code == 503
    finally:
        app.dependency_overrides.clear()


# --- registry ------------------------------------------------------------------


def test_model_registry_lists_every_module_as_mock_without_metrics(client: TestClient) -> None:
    models = client.get("/v1/models", headers=AUTH).json()
    assert {m["architecture"] for m in models} == {
        "UNET",
        "RESNET50",
        "ANN",
        "PATCH_CNN_MIL",
        "XGBOOST_FUSION",
    }
    assert all(m["provenance"] == "MOCK" and m["version"] == "mock-0.1" for m in models)
    # Performance numbers only ever come from a stored evaluation run.
    assert all(m["evaluation"] is None for m in models)


# --- inference -----------------------------------------------------------------


def test_every_mock_result_carries_the_exact_disclaimer(client: TestClient) -> None:
    res = client.post(
        "/v1/infer",
        headers=AUTH,
        json=request_body(clinical=CLINICAL, imaging=MRI, histopathology=SLIDE),
    )
    assert res.status_code == 200
    body = res.json()
    InferenceResult.model_validate(body)  # matches the contract
    assert body["provenance"] == "MOCK"
    assert body["disclaimer"] == MOCK_DISCLAIMER
    assert body["disclaimer"] == "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT."
    outputs = body["outputs"]
    assert 0 <= outputs["pcaProbability"] <= 1
    low, high = outputs["probabilityInterval"]
    assert 0 <= low <= outputs["pcaProbability"] <= high <= 1
    assert 1 <= outputs["gleasonGradeGroup"] <= 5
    assert set(outputs["modulesUsed"]) == {
        "resnet50_imaging",
        "ann_clinical",
        "patch_cnn_mil_histopathology",
        "xgboost_fusion",
    }
    assert body["modelVersions"]["ann_clinical"] == "mock-0.1"


def test_mock_never_draws_a_segmentation_mask(client: TestClient) -> None:
    body = client.post("/v1/infer", headers=AUTH, json=request_body(imaging=MRI)).json()
    assert body["outputs"]["segmentationMaskKey"] is None
    skipped = {s["module"]: s["reason"] for s in body["outputs"]["modulesSkipped"]}
    assert (
        skipped["unet_segmentation"] == "The development mock does not produce segmentation masks"
    )


def test_mock_output_depends_on_the_job_only_not_on_clinical_values(client: TestClient) -> None:
    job = str(uuid4())
    low = {"jobId": job, "patientRef": "pseudo_ref_0001", "inputs": {"clinical": {"psaNgMl": 0.4}}}
    high = {"jobId": job, "patientRef": "pseudo_ref_0001", "inputs": {"clinical": {"psaNgMl": 90}}}
    a = client.post("/v1/infer", headers=AUTH, json=low).json()
    b = client.post("/v1/infer", headers=AUTH, json=high).json()
    # Same job, very different PSA: the mock gives the same number, so it cannot
    # be read as an assessment of the patient.
    assert a["outputs"]["pcaProbability"] == b["outputs"]["pcaProbability"]


def test_skipped_modules_say_why(client: TestClient) -> None:
    body = client.post("/v1/infer", headers=AUTH, json=request_body(clinical=CLINICAL)).json()
    skipped = {s["module"]: s["reason"] for s in body["outputs"]["modulesSkipped"]}
    assert skipped == {
        "unet_segmentation": "No MRI or TRUS imaging to segment",
        "resnet50_imaging": "No imaging study was provided",
        "patch_cnn_mil_histopathology": "No histopathology slide was provided",
    }
    assert body["outputs"]["gleasonGradeGroup"] is None


def test_slides_alone_give_a_grade_group_but_no_probability(client: TestClient) -> None:
    body = client.post("/v1/infer", headers=AUTH, json=request_body(histopathology=SLIDE)).json()
    assert body["outputs"]["pcaProbability"] is None
    assert body["outputs"]["probabilityInterval"] is None
    assert body["outputs"]["gleasonGradeGroup"] is not None
    reasons = {s["module"]: s["reason"] for s in body["outputs"]["modulesSkipped"]}
    assert reasons["xgboost_fusion"] == "No module produced a probability to combine"


def test_no_usable_inputs_is_422(client: TestClient) -> None:
    res = client.post(
        "/v1/infer",
        headers=AUTH,
        json=request_body(clinical={"ageYears": 60, "familyHistory": True}),
    )
    assert res.status_code == 422
    assert res.json()["detail"]["message"] == "No module could run on these inputs"


@pytest.mark.parametrize(
    "body",
    [
        {"patientRef": "pseudo_ref_0001", "inputs": {}},  # no job id
        request_body(clinical={"psaNgMl": -1}),
        request_body(clinical={"piradsScore": 6}),
        request_body(imaging=[{"storageKey": "../etc/passwd", "modality": "MRI"}]),
        request_body(imaging=[{"storageKey": "imaging/a.dcm", "modality": "XRAY"}]),
        request_body(clinical=CLINICAL, name="SYNTHETIC Patient"),  # unexpected field
        {"jobId": str(uuid4()), "patientRef": "Mwansa Banda", "inputs": {}},  # not a pseudonym
    ],
)
def test_rejects_invalid_or_identifying_requests(
    client: TestClient, body: dict[str, object]
) -> None:
    assert client.post("/v1/infer", headers=AUTH, json=body).status_code == 422
