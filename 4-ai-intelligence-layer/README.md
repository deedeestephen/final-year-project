# Layer 4: AI Intelligence

The AI service ([`ai-services/`](ai-services/), Python + FastAPI). Only the backend's AI broker may call it, with a service token.

| Part of the diagram | Where it is | Status |
|---|---|---|
| CNN imaging: U-Net (segmentation) + ResNet-50 (classification) | `ai-services/app/providers/` (interface + **mock**) | Mock only: no trained model yet |
| ANN clinical module (PSA, DRE, demographics, PI-RADS) | `ai-services/app/providers/` | Mock only |
| DL histopathology: Patch-CNN + MIL (Gleason grading) | `ai-services/app/providers/` | Mock only |
| XGBoost multi-modal fusion engine | `ai-services/app/providers/`, `app/router.py` (Model Router) | Mock only |
| Grad-CAM explainability, SHAP values | Phase 12 | Honest "unavailable" states until a real model exists |
| Model registry and versioning | `GET /v1/models`, synced into the `ai_models` table | Built |
| Fairness monitoring | Phase 12 ("Evaluation data not yet available") | Planned |
| A/B testing framework | Future work (documented) | Not built |

**Every result from a mock model is labelled "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT."** Mock numbers depend only on the job id, never on the patient's values. The backend refuses any mock result without this label.

The contract with the backend is [`2-api-gateway/openapi/ai-contract.yaml`](../2-api-gateway/openapi/ai-contract.yaml).
