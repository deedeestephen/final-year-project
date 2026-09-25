"""Development MOCK providers.

They exist so the whole pipeline (backend broker, storage, report screens) can
be built and tested before any trained model is available. Their outputs are
DERIVED ONLY FROM A HASH OF THE JOB ID, never from the patient's clinical
values or images, so they cannot be mistaken for a real assessment: the same
job always gives the same numbers, and changing a PSA value changes nothing.
Every result they take part in is labelled MOCK with the fixed disclaimer.
"""

import hashlib
import random
from uuid import UUID

from app.contract import Architecture, InferenceInputs, InferenceRequest, ModelInfo
from app.providers.base import ModuleOutput

MOCK_VERSION = "mock-0.1"


def _draw(job_id: UUID, module: str) -> random.Random:
    """A generator seeded by the job id and module name only (not security relevant)."""
    seed = hashlib.sha256(f"{job_id}:{module}".encode()).digest()
    return random.Random(int.from_bytes(seed[:8], "big"))  # noqa: S311 - not cryptographic


def _info(module: str, architecture: Architecture) -> ModelInfo:
    return ModelInfo(
        name=module,
        architecture=architecture,
        version=MOCK_VERSION,
        provenance="MOCK",
        evaluation=None,
    )


class MockUNetSegmentation:
    module = "unet_segmentation"
    info = _info(module, "UNET")

    def unavailable_reason(self, inputs: InferenceInputs) -> str | None:
        if not any(i.modality in ("MRI", "TRUS") for i in inputs.imaging):
            return "No MRI or TRUS imaging to segment"
        # A mask is an image of the prostate; the mock will not draw a fake one.
        return "The development mock does not produce segmentation masks"

    def run(self, request: InferenceRequest, upstream: dict[str, ModuleOutput]) -> ModuleOutput:
        raise NotImplementedError("the mock U-Net never runs")


class MockResNet50Imaging:
    module = "resnet50_imaging"
    info = _info(module, "RESNET50")

    def unavailable_reason(self, inputs: InferenceInputs) -> str | None:
        return None if inputs.imaging else "No imaging study was provided"

    def run(self, request: InferenceRequest, upstream: dict[str, ModuleOutput]) -> ModuleOutput:
        rng = _draw(request.jobId, self.module)
        return ModuleOutput(probability=round(rng.uniform(0.05, 0.95), 2))


class MockAnnClinical:
    module = "ann_clinical"
    info = _info(module, "ANN")

    def unavailable_reason(self, inputs: InferenceInputs) -> str | None:
        if inputs.clinical is None or not inputs.clinical.has_findings():
            return "No PSA, DRE or PI-RADS finding was provided"
        return None

    def run(self, request: InferenceRequest, upstream: dict[str, ModuleOutput]) -> ModuleOutput:
        rng = _draw(request.jobId, self.module)
        return ModuleOutput(probability=round(rng.uniform(0.05, 0.95), 2))


class MockPatchCnnMilHistopathology:
    module = "patch_cnn_mil_histopathology"
    info = _info(module, "PATCH_CNN_MIL")

    def unavailable_reason(self, inputs: InferenceInputs) -> str | None:
        return None if inputs.histopathology else "No histopathology slide was provided"

    def run(self, request: InferenceRequest, upstream: dict[str, ModuleOutput]) -> ModuleOutput:
        rng = _draw(request.jobId, self.module)
        return ModuleOutput(gleason_grade_group=rng.randint(1, 5))


class MockXgboostFusion:
    module = "xgboost_fusion"
    info = _info(module, "XGBOOST_FUSION")

    def unavailable_reason(self, inputs: InferenceInputs) -> str | None:
        return None  # decided by the router, from what the other modules produced

    def run(self, request: InferenceRequest, upstream: dict[str, ModuleOutput]) -> ModuleOutput:
        rng = _draw(request.jobId, self.module)
        return ModuleOutput(probability=round(rng.uniform(0.05, 0.95), 2))


def mock_modules() -> list[
    MockUNetSegmentation | MockResNet50Imaging | MockAnnClinical | MockPatchCnnMilHistopathology
]:
    return [
        MockUNetSegmentation(),
        MockResNet50Imaging(),
        MockAnnClinical(),
        MockPatchCnnMilHistopathology(),
    ]
