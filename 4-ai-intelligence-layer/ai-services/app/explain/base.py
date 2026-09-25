"""Explainability (proposal §3.3.3, NFR-09).

Every module that ran gets an explanation: Grad-CAM heatmaps for the imaging
CNNs, SHAP contributions for the clinical ANN and the fusion model, and MIL
attention for histopathology. An explanation is either real (an image or
values computed from a trained model) or an explicit reason why there is none.
Explanations are never invented.
"""

from typing import Literal, Protocol

from app.contract import Explanation, InferenceRequest
from app.providers.base import ModuleOutput

ExplanationKind = Literal["GRADCAM", "SHAP", "MIL_ATTENTION"]

#: Which kind of explanation belongs to which module.
KIND_FOR_MODULE: dict[str, ExplanationKind] = {
    "resnet50_imaging": "GRADCAM",
    "ann_clinical": "SHAP",
    "patch_cnn_mil_histopathology": "MIL_ATTENTION",
    "xgboost_fusion": "SHAP",
}

MOCK_UNAVAILABLE_REASON = (
    "Explanations need a trained research model; none is loaded (development mock)."
)


class Explainer(Protocol):
    kind: ExplanationKind

    def explain(
        self, module: str, request: InferenceRequest, output: ModuleOutput
    ) -> Explanation: ...


class UnavailableExplainer:
    """Used for every mock module: says why there is no explanation."""

    def __init__(self, kind: ExplanationKind, reason: str = MOCK_UNAVAILABLE_REASON) -> None:
        self.kind = kind
        self.reason = reason

    def explain(self, module: str, request: InferenceRequest, output: ModuleOutput) -> Explanation:
        return Explanation(kind=self.kind, module=module, unavailableReason=self.reason)
