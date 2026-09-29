# Integrating the trained models (from Kaggle to the app)

This is for when the five models are trained. The rest of the system is already built around them:
- the backend AI broker
- the job queue
- the report storage
- the explanation pipeline
- the app's AI screens

Today every module is a **labelled development mock**. Swapping in a real model changes **only the AI service** (`4-ai-intelligence-layer/ai-services`). The backend, database and app stay as they are, because they already follow the contract (`2-api-gateway/openapi/ai-contract.yaml`).

## 1. What to bring back from Kaggle, per model

For every model, save these four things. Keep them together in one folder per model version.

1. **The trained weights.**
   - Neural networks: prefer **ONNX** (runs with `onnxruntime`, no GPU or PyTorch needed on the server). TorchScript is the fallback.
   - XGBoost: the model's **JSON** (`booster.save_model("model.json")`).
2. **A `model-card.md`**: what it does, the training data (name, licence, date, how many cases), what it must not be used for, and its known weaknesses.
3. **The exact input and output spec** (the table below, filled in). A model given its inputs slightly differently from training gives wrong answers without any error.
4. **`evaluation.json`**: results on a **held-out test set** that was never used for training or tuning (section 3).

| Module (name in the system) | Architecture | Input the system will give it | What it must return |
|---|---|---|---|
| `unet_segmentation` | U-Net | MRI or TRUS image (DICOM). Write down: image size, channels, intensity normalisation, DICOM windowing, orientation | a prostate mask (PNG, same size as the input) |
| `resnet50_imaging` | ResNet-50 (transfer learning) | the image (same preprocessing notes), and whether it uses the U-Net mask | probability of clinically significant cancer (0–1) |
| `ann_clinical` | ANN | clinical values, **in this order**: age, PSA, free PSA, DRE finding, PI-RADS, prostate volume, biopsy history, family history. Write down the scaling (mean/std or min/max), how DRE and biopsy history are encoded, and **what the model does when a value is missing** | probability (0–1) |
| `patch_cnn_mil_histopathology` | Patch-CNN + MIL | whole-slide image (TIFF/SVS/NDPI). Write down: magnification (e.g. 20×), patch size, tissue detection, stain normalisation | ISUP grade group (1–5) and, if possible, the attention per patch |
| `xgboost_fusion` | XGBoost | the other modules' outputs plus clinical values: list the exact feature names and order | final probability (0–1), and an uncertainty interval if you have one |

The field names the backend already sends are in `ClinicalInputs` in the AI contract (`ageYears`, `psaNgMl`, `freePsaNgMl`, `dreFinding`, `piradsScore`, `prostateVolumeMl`, `biopsyHistory`, `familyHistory`).

## 2. Explanations (Grad-CAM and SHAP)
- **ResNet-50 → Grad-CAM:** note the name of the last convolutional layer. If you export to ONNX, also export that layer's output (activations) so the heatmap can be computed on the server.
- **ANN and XGBoost → SHAP:** save a small **background sample** (about 100 training rows, no personal data) for the SHAP explainer.
- **Patch-CNN + MIL:** the attention weights per patch are the explanation.

The pipeline to store and show these images already exists: it is Phase 12, and the heatmap must be a PNG.

## 3. `evaluation.json`: the only numbers the app will ever show
The app says **"Evaluation data not yet available."** until a stored evaluation exists. It never invents accuracy. Save:
```json
{
  "testSet": { "name": "…", "cases": 0, "positives": 0, "source": "…", "date": "2026-…" },
  "overall": { "auc": 0.0, "auc95ci": [0.0, 0.0], "sensitivity": 0.0, "specificity": 0.0, "threshold": 0.5 },
  "byGroup": {
    "age": { "<50": { "auc": 0.0, "cases": 0 }, "50-64": {}, ">=65": {} },
    "region": { "urban": {}, "peri-urban": {}, "rural": {} },
    "stage": { "…": {} },
    "equipment": { "…": {} }
  },
  "notes": "calibration, known failure cases"
}
```
The groups follow the proposal (§3.7): age < 50, 50–64 and ≥ 65; urban, peri-urban and rural; disease stage; imaging equipment.

The `byGroup` figures feed the fairness check (FR-11) in `GET /api/v1/ai/models/{id}/evaluation` (`src/services/ai/fairness.ts`):
- For each dimension it compares the AUC of the groups and **flags a gap above 0.05**, the proposal's threshold for remediation.
- A group with fewer than **30 test cases**, or with a missing AUC or case count, is listed with the reason and left out of the comparison. So always store `cases`, and if a group has very few cases, store the count rather than leaving the group out.

**When the first real evaluation is stored:** the app's AI report still shows a fixed "Evaluation data not yet available." line. It should then fetch each model's evaluation and show the figures and any fairness flag. This is part of switching off the mocks.

## 4. How it plugs in (developer steps)
1. Add the model folder under `ai-services/models/<module>/<version>/`. Large weights stay out of git (use git LFS or a download step). A model file is never committed with patient data inside.
2. Write a provider class next to `app/providers/mock.py` that implements the `ModelProvider` protocol (`app/providers/base.py`): `unavailable_reason(inputs)` and `run(request, upstream)`. Set `provenance="RESEARCH_MODEL"` and the real version string.
3. Write the real explainer (`app/explain/base.py`, `Explainer` protocol) that returns a PNG `artifact` or SHAP `values`.
4. Register them in `default_router()` (`app/router.py`) in place of the mocks. A module without a trained model keeps its mock (still labelled).
5. The file itself: the backend sends storage keys. The AI service will need read access to the same object storage (MinIO/S3) with a **read-only** key. This is the one new setting.
6. Store `evaluation.json` in `ai_models.evaluation` for that model version (an admin step, audited).
7. Add the heavy dependencies (`onnxruntime`, `xgboost`, `shap`, `numpy`) to `pyproject.toml`, and add tests that run each model on synthetic inputs.

The disclaimer changes automatically: a result made only by research models carries the research disclaimer instead of "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT." Any remaining mock module keeps the whole result labelled MOCK.

## 4a. Files the models receive (Phase 15)

- **Scans:** the AI receives only **de-identified copies** of scans. They are the same DICOM files with identifying header values blanked, dates reduced to the year and UIDs replaced; the pixels are unchanged. Models must not rely on patient names, IDs or full dates in the header.
- **Slides:** slides are **not sent** to the AI yet. Whole-slide images can contain a photo of the slide label, and slide de-identification is not built. Before the Patch-CNN + MIL model is switched on, build slide de-identification: remove the label and macro images, and scrub TIFF text tags such as ImageDescription (see [security-review.md](security-review.md) R-1). Then include slides in `AiService.request` again.

## 5. Before switching off a mock (checklist)
- [ ] Evaluated on a held-out test set; `evaluation.json` stored.
- [ ] The input spec was checked against how the backend sends values: run the same synthetic case through Kaggle and through the service and compare the outputs.
- [ ] A clinician has reviewed the model card and example outputs.
- [ ] Development and testing still use **synthetic or properly licensed, de-identified data only**. No real patient data leaves the clinic system.
- [ ] De-identification of DICOM headers before AI use (Phase 15) is done.
- [ ] Ethics approval covers using the model's output as decision support.
