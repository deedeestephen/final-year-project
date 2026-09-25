"""The Model Router (proposal §3.3.3): runs every module the inputs allow,
records why the others were skipped, and fuses the module probabilities."""

from collections.abc import Sequence

from app.contract import (
    MOCK_DISCLAIMER,
    RESEARCH_DISCLAIMER,
    Explanation,
    InferenceOutputs,
    InferenceRequest,
    InferenceResult,
    ModelInfo,
    SkippedModule,
)
from app.explain.base import KIND_FOR_MODULE, Explainer, UnavailableExplainer
from app.providers.base import ModelProvider, ModuleOutput
from app.providers.mock import MockXgboostFusion, mock_modules


class InsufficientInputsError(Exception):
    """No module could run on the inputs (HTTP 422)."""

    def __init__(self, skipped: list[SkippedModule]) -> None:
        super().__init__("No module could run on these inputs")
        self.skipped = skipped


class ModelRouter:
    def __init__(
        self,
        modules: Sequence[ModelProvider],
        fusion: ModelProvider,
        explainers: dict[str, Explainer] | None = None,
    ) -> None:
        self._modules = list(modules)
        self._fusion = fusion
        self._explainers = explainers or {}

    def models(self) -> list[ModelInfo]:
        return [m.info for m in [*self._modules, self._fusion]]

    def infer(self, request: InferenceRequest) -> InferenceResult:
        used: list[ModelProvider] = []
        skipped: list[SkippedModule] = []
        outputs: dict[str, ModuleOutput] = {}

        for module in self._modules:
            reason = module.unavailable_reason(request.inputs)
            if reason:
                skipped.append(SkippedModule(module=module.module, reason=reason))
                continue
            outputs[module.module] = module.run(request, dict(outputs))
            used.append(module)

        if not used:
            raise InsufficientInputsError(skipped)

        probability: float | None = None
        interval: tuple[float, float] | None = None
        if any(o.probability is not None for o in outputs.values()):
            fused = self._fusion.run(request, dict(outputs))
            used.append(self._fusion)
            probability = fused.probability
            if probability is not None:
                interval = (
                    max(0.0, round(probability - 0.1, 2)),
                    min(1.0, round(probability + 0.1, 2)),
                )
        else:
            skipped.append(
                SkippedModule(
                    module=self._fusion.module,
                    reason="No module produced a probability to combine",
                )
            )

        gleason = next(
            (o.gleason_grade_group for o in outputs.values() if o.gleason_grade_group is not None),
            None,
        )
        mask = next(
            (o.segmentation_mask_key for o in outputs.values() if o.segmentation_mask_key),
            None,
        )
        explanations: list[Explanation] = []
        for module in used:
            explainer = self._explainers.get(module.module)
            if explainer is not None:
                output = outputs.get(module.module) or ModuleOutput(probability=probability)
                explanations.append(explainer.explain(module.module, request, output))

        # One mock module is enough to make the whole result a mock.
        is_mock = any(m.info.provenance == "MOCK" for m in used)

        return InferenceResult(
            jobId=request.jobId,
            provenance="MOCK" if is_mock else "RESEARCH_MODEL",
            disclaimer=MOCK_DISCLAIMER if is_mock else RESEARCH_DISCLAIMER,
            modelVersions={m.module: m.info.version for m in used},
            outputs=InferenceOutputs(
                pcaProbability=probability,
                probabilityInterval=interval,
                gleasonGradeGroup=gleason,
                segmentationMaskKey=mask,
                modulesUsed=[m.module for m in used],
                modulesSkipped=skipped,
            ),
            explanations=explanations,
        )


def default_router() -> ModelRouter:
    """Development: every module is a labelled mock until trained models are registered,
    and a mock module never gets an invented explanation."""
    explainers: dict[str, Explainer] = {
        module: UnavailableExplainer(kind) for module, kind in KIND_FOR_MODULE.items()
    }
    return ModelRouter(mock_modules(), MockXgboostFusion(), explainers)
