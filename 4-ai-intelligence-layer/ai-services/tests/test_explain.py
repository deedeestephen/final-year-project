import base64
import struct
import zlib
from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.contract import (
    MAX_ARTIFACT_BASE64,
    Explanation,
    ExplanationArtifact,
    InferenceRequest,
)
from app.explain.base import MOCK_UNAVAILABLE_REASON
from app.main import app
from app.providers.base import ModuleOutput
from app.providers.mock import MockAnnClinical, MockXgboostFusion
from app.router import ModelRouter

TOKEN = "test-service-token-0123456789"  # noqa: S105 - test-only value
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def tiny_png() -> bytes:
    """A valid 1x1 grey PNG, built here so no binary fixture is needed."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", 1, 1, 8, 0, 0, 0, 0)
    pixels = zlib.compress(b"\x00\x80")
    return (
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixels) + chunk(b"IEND", b"")
    )


@pytest.fixture
def client() -> Iterator[TestClient]:
    app.dependency_overrides[get_settings] = lambda: Settings(service_token=TOKEN)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_mock_modules_never_get_an_invented_explanation(client: TestClient) -> None:
    body = client.post(
        "/v1/infer",
        headers=AUTH,
        json={
            "jobId": str(uuid4()),
            "patientRef": "pseudo_ref_0001",
            "inputs": {
                "clinical": {"psaNgMl": 5.0, "dreFinding": "NORMAL"},
                "imaging": [{"storageKey": "imaging/2026/09/a.dcm", "modality": "MRI"}],
                "histopathology": [{"storageKey": "slides/2026/09/b.tif"}],
            },
        },
    ).json()
    kinds = {e["module"]: e["kind"] for e in body["explanations"]}
    assert kinds == {
        "resnet50_imaging": "GRADCAM",
        "ann_clinical": "SHAP",
        "patch_cnn_mil_histopathology": "MIL_ATTENTION",
        "xgboost_fusion": "SHAP",
    }
    for explanation in body["explanations"]:
        assert explanation["unavailableReason"] == MOCK_UNAVAILABLE_REASON
        assert explanation["artifact"] is None
        assert explanation["values"] is None
        assert explanation["storageKey"] is None


def test_only_modules_that_ran_are_explained(client: TestClient) -> None:
    body = client.post(
        "/v1/infer",
        headers=AUTH,
        json={
            "jobId": str(uuid4()),
            "patientRef": "pseudo_ref_0001",
            "inputs": {"clinical": {"psaNgMl": 5.0}},
        },
    ).json()
    assert {e["module"] for e in body["explanations"]} == {"ann_clinical", "xgboost_fusion"}


class _TestHeatmapExplainer:
    """Test double standing in for a real Grad-CAM on a trained model."""

    kind = "GRADCAM"

    def explain(self, module: str, request: InferenceRequest, output: ModuleOutput) -> Explanation:
        return Explanation(
            kind="GRADCAM",
            module=module,
            artifact=ExplanationArtifact(
                contentType="image/png",
                dataBase64=base64.b64encode(tiny_png()).decode(),
            ),
        )


def test_a_real_explainer_can_return_an_image() -> None:
    router = ModelRouter(
        [MockAnnClinical()],
        MockXgboostFusion(),
        {"ann_clinical": _TestHeatmapExplainer()},
    )
    result = router.infer(
        InferenceRequest.model_validate(
            {
                "jobId": str(uuid4()),
                "patientRef": "pseudo_ref_0001",
                "inputs": {"clinical": {"psaNgMl": 4.0}},
            }
        )
    )
    [explanation] = result.explanations
    assert explanation.artifact is not None
    assert base64.b64decode(explanation.artifact.dataBase64).startswith(b"\x89PNG")


def test_explanation_images_are_limited_in_type_and_size() -> None:
    with pytest.raises(ValidationError):
        ExplanationArtifact.model_validate({"contentType": "image/jpeg", "dataBase64": "abcdefgh"})
    with pytest.raises(ValidationError):
        ExplanationArtifact(contentType="image/png", dataBase64="A" * (MAX_ARTIFACT_BASE64 + 1))
    with pytest.raises(ValidationError):
        Explanation(
            kind="GRADCAM",
            module="resnet50_imaging",
            artifact=ExplanationArtifact(contentType="image/png", dataBase64="abcdefgh"),
            unavailableReason="both is not allowed",
        )
