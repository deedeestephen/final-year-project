"""The interface every model module implements (proposal §3.3.3 modules 1-5).

A real research model and a development mock are interchangeable behind this
interface; the model router never needs to know which one it is talking to,
but every result says which it was (`ModelInfo.provenance`).
"""

from dataclasses import dataclass
from typing import Protocol

from app.contract import InferenceInputs, InferenceRequest, ModelInfo


@dataclass(frozen=True)
class ModuleOutput:
    probability: float | None = None
    gleason_grade_group: int | None = None
    segmentation_mask_key: str | None = None


class ModelProvider(Protocol):
    #: Stable module name used in `modulesUsed`, `modulesSkipped` and `modelVersions`.
    module: str
    info: ModelInfo

    def unavailable_reason(self, inputs: InferenceInputs) -> str | None:
        """Why this module cannot run on these inputs, or None when it can."""
        ...

    def run(self, request: InferenceRequest, upstream: dict[str, ModuleOutput]) -> ModuleOutput:
        """Runs the module. `upstream` holds the outputs of modules that already ran."""
        ...
