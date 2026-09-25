from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.contract import MOCK_DISCLAIMER, Explanation, InferenceOutputs, InferenceResult


def result(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "jobId": str(uuid4()),
        "provenance": "MOCK",
        "disclaimer": MOCK_DISCLAIMER,
        "modelVersions": {"ann_clinical": "mock-0.1"},
        "outputs": InferenceOutputs().model_dump(),
        "explanations": [],
    }
    base.update(overrides)
    return base


def test_a_mock_result_without_the_mock_disclaimer_is_invalid() -> None:
    with pytest.raises(ValidationError):
        InferenceResult.model_validate(result(disclaimer="Looks fine."))
    InferenceResult.model_validate(result())


def test_an_explanation_is_an_artifact_or_a_reason_never_both_or_neither() -> None:
    Explanation(kind="GRADCAM", module="resnet50_imaging", unavailableReason="No model")
    Explanation(kind="GRADCAM", module="resnet50_imaging", storageKey="xai/2026/09/a.png")
    Explanation(kind="SHAP", module="ann_clinical", values={"psaNgMl": 0.12})
    with pytest.raises(ValidationError):
        Explanation(kind="SHAP", module="ann_clinical")
    with pytest.raises(ValidationError):
        Explanation(
            kind="SHAP",
            module="ann_clinical",
            values={"psaNgMl": 0.1},
            unavailableReason="No model",
        )
