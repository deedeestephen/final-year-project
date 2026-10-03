# Chapter 5: Conclusion and Recommendations

## 5.1 Introduction

This chapter evaluates the project against the proposal's five objectives and four research questions, compares the plan with the outcome, states the limitations, and gives recommendations and future work. It uses only what was built and measured, and says where an objective depends on work that could not be done.

## 5.2 Summary of the Work

The project built a working prototype of every layer of the proposed architecture. A Flutter app lets clinicians register patients and record screenings with or without internet, in an encrypted database on the phone, with each change applied exactly once and conflicting edits never silently overwritten. It also gives patients their results, health information that can be read aloud, messages, consent management and an assistant that accepts typed or spoken questions, and lets pathologists review slides. A React website serves administrators. A NestJS backend enforces authentication, role-based access, facility scoping, separation of duties and a hash-chained audit log, and exports de-identified HL7 FHIR R4 records. A Python service holds the AI pipeline, with labelled mock models in place of the five trained models, and the assistant's retrieval over a reviewed knowledge base. Each of the nineteen phases closed with an automated quality gate; every package met the 80% coverage minimum, and measured response times met the proposal's targets on a development laptop.

## 5.3 Evaluation Against the Objectives

Table 5.1 summarises the evaluation; the sections that follow explain each judgement.

Table 5.1: Evaluation of the objectives

| Objective | Judgement | Main evidence | Main shortfall |
|---|---|---|---|
| 1. Secure, offline-first app (AES-256, TLS 1.3, RBAC, FHIR R4) | Largely met | Encrypted phone database confirmed on the device; exactly-once synchronisation under load; TLS 1.3 only; 75 routes under checked rules; FHIR export with 0 validator errors | Flutter, not React Native; Android only; push off until a Firebase project exists; SmartCare Pro reached only through a stand-in |
| 2. Multi-modal AI engine (AUC-ROC ≥ 0.90) | Partly met | Router, contract, queue, explanations, registry and fairness check built and tested; 545 ms P95 with mock models | No trained model; no accuracy figure; no real Grad-CAM or SHAP output |
| 3. RAG chatbot, English and Zambian languages, within 2 s | Met for English retrieval and speed; partly met overall | 514 ms P95 under 100 users; MedCPT (768 dimensions) choosing the article from reviewed passages; measured retrieval gains; safety rules; voice and read-aloud | No Bemba or Nyanja; knowledge base not signed off; no usability test |
| 4. Data collection and training methodology | Not met in the prototype | An integration guide for trained models and their evaluations | No data collected; methodology not applied |
| 5. Ethics, privacy and compliance framework | Partly met | Consent per purpose, Safe Harbor tests per identifier class, de-identified AI inputs, tamper-evident audit, separation of duties, labelled mocks, evaluation-gated metrics | No ethics approval, data-protection review or legal review; no real explainability or bias figures |

### 5.3.1 Objective 1: the mobile application

The objective is largely met. The phone's database is encrypted with SQLCipher (AES-256), and the on-device test confirms the cipher is in use. Offline capture was verified in unit tests, a live workflow, on the emulator and under load (Section 4.3.5). TLS 1.3 was proved against the real nginx configuration, RBAC is checked on every route, and the FHIR R4 export passed the official validator with no errors.

Four shortfalls remain. The app uses Flutter rather than React Native, which changes the framework but not the requirements (ADR-001). Only Android was built and tested, because an iOS build needs a Mac. Push notifications are built and tested with stand-ins but stay off until the owner creates a Firebase project, so real delivery is untested. Interoperability is one-way and simulated: the export works against a SmartCare Pro stand-in, while receiving data needs identified data and a data-sharing agreement. On the development computer the system runs over plain HTTP locally; TLS 1.3 applies at the reverse proxy that a deployment would place in front of the backend.

### 5.3.2 Objective 2: the AI inference engine

This is the largest gap between proposal and prototype. The architecture is built and tested: broker, queue with time-outs, contract, router, fusion step, registry, explanation pipeline and fairness check. The pipeline met the 3-second target with 545 ms at the 95th percentile under load. However, no trained model exists. Every module is a labelled mock whose numbers come from a hash of the job identifier, so the prototype produces no probability, Gleason prediction or heatmap, the AUC-ROC target cannot be assessed, and no accuracy figure can be claimed. The latency result also says nothing about real inference. The models are being trained separately, and an integration guide describes how each replaces its mock by changing only the AI service.

### 5.3.3 Objective 3: the chatbot

The objective is met for English retrieval and response time, and partly met overall. The proposal asked for biomedical embeddings of 768 dimensions; the prototype uses MedCPT, a PubMedBERT retriever with 768-dimensional vectors (Jin et al., 2023), combined with BM25. On the developer's question sets the hybrid answered 20 of 24 everyday-word questions correctly (18 with keywords alone) and refused 11 of 12 off-topic questions (9 before), within 514 ms at the 95th percentile under load (Section 4.3.6). The safety rules passed a 34-prompt red-team set.

Some departures are deliberate and documented: the assistant never interprets a patient's own results; it scores by MedCPT's dot product rather than cosine similarity, ranks every keyword match rather than the top five, and keeps its 32 vectors in a file rather than a vector database; and it quotes reviewed passages rather than using a fine-tuned generator, with Claude available to write from them if enabled. The genuine shortfalls are that Bemba and Nyanja are unavailable until human-verified translations exist, that the small knowledge base has not been signed off by a clinician and does not yet cover the practical barriers of the Health Belief Model, and that the think-aloud test with users of limited literacy has not been held.

### 5.3.4 Objective 4: data collection and model training

This objective is not met in the prototype. Collecting clinical data requires data-sharing agreements and ethics approval from the ZCAS Ethics Review Board and the NHRA, and neither was available. None of the methodology could therefore be applied: specialist-led correction of PCa and BPH misclassification, normalisation, registration, augmentation, transfer learning, stratified 5-fold cross-validation and external validation. The project produced only the receiving end: an integration guide specifying the weights, model card, input and output specification and evaluation file (with held-out results and per-group figures) that each trained model must bring, plus a fairness check, evaluation endpoint and report screens to use them.

### 5.3.5 Objective 5: the ethics, privacy and compliance framework

The technical part of this objective is met and tested; the formal part is not. Built and tested are the measures listed under research question 4, together with a Safe Harbor test for each of the eighteen identifier classes, de-identified scan copies and a keyed pseudonym for the AI, and a log review that found no secrets or patient details. Outstanding are ethics approval; a data-protection review under Zambia's Data Protection Act (2021) covering the third parties some features involve (the phone's speech service, Firebase and, if enabled, Anthropic); a legal review of data residency, which is documented but not implemented; and real data for the explainability and bias mechanisms.

## 5.4 Answers to the Research Questions

**Research question 1: how can a multi-modal AI engine be designed for Zambia's constraints?** The prototype's answer is architectural. Isolate the engine in its own service behind a versioned contract, so that models can change without touching the rest of the system. Let a router run whatever modules the inputs allow, which suits a setting without mpMRI and with incomplete inputs. Run jobs through a queue with time-outs and one job per patient. De-identify inputs before they leave the backend, label every output with its provenance, and show no metric without a stored evaluation. Whether trained models would meet the clinical and latency targets on Zambian data remains open (Section 5.3.2).

**Research question 2: which data strategies work best for scarce, misclassified and non-standard Zambian data?** The prototype cannot answer this empirically, because no data was collected and no model trained. The proposal's strategies remain the plan. The project contributes the specification of what a trained model must report, including per-group figures, so that the effect on subgroups will be visible.

**Research question 3: how can an offline-capable architecture serve both connected and disconnected facilities?** This is answered most fully. Work is saved first in an encrypted database on the phone and queued in an outbox. Each change carries an idempotency key, so a change sent twice is applied once. Batches are retried with exponential back-off, stale edits return as conflicts for the clinician to resolve, and files wait in an upload queue that survives lost connections and restarts. Tests, a live workflow and a load run verified this. Two limits remain: AI analysis and the assistant still need a connection, as the proposal acknowledged, and offline behaviour was tested on an emulator, not in a rural facility.

**Research question 4: which ethical, fairness, explainability and regulatory measures are needed?** The prototype implements consent per purpose with withdrawal at any time; minimum necessary access; de-identification before data leaves the core system; a hash-chained audit trail; provenance and a mock label on every AI output; evaluation-gated metrics with fairness gaps above 0.05 flagged; an explanation or stated reason for every AI output; no interpretation of results for patients; safety rules before any assistant answer; and a data-protection review for every outside processor. Only ethics and legal review, user testing and real data can show whether these suffice.

## 5.5 Plan Versus Outcome

Comparing Figure 1.1 with Figure 1.2: of the proposal's nine phases, planning (1), design (2), app and chatbot development (5), integration (6), the security audit (8, as an internal review) and documentation (9) were completed. Data collection (3), model training (4) and user acceptance testing (7) were not, because each depends on approvals, agreements or participants outside the project's control. The implementation took far less time than planned (23 September to 2 October 2026, by the Git history), probably largely because of the AI coding assistant recorded in the development log and security review. The order of the work also changed at the owner's request, and several features not in the plan were added in response to the owner's evaluation of each iteration.

## 5.6 Limitations

1. **The AI models are development mocks.** No diagnostic result is produced, and no accuracy, sensitivity, specificity or AUC figure can be reported.
2. **All data is synthetic.** Behaviour with real clinical data, including incomplete and misclassified records, is untested.
3. **The knowledge base is a draft** of 32 passages that awaits a clinician's sign-off and does not yet address all Health Belief Model constructs.
4. **English only.** Bemba and Nyanja are switched off until human-verified translations exist.
5. **No user acceptance testing.** No participant has used the system, there is no SUS score against the target of 75, and no screen-reader user has tested it.
6. **One laptop.** All measurements were taken on one laptop running every component, and the main performance runs predate the move to the installed database servers.
7. **Android only, mostly on an emulator.** No iOS build exists; speech recognition was not confirmed with a real voice; push was not tested with real Firebase.
8. **Simulated integration.** SmartCare Pro was reached only through a stand-in, and receiving data was not built.
9. **Small evaluation sets.** The assistant's thresholds were tuned on 65 developer-written questions and 10 section checks, which guard against regressions but do not prove quality. One section check is still wrong (9 of 10).
10. **An internal security review**, not an independent penetration test, with eight residual risks open and some findings of the 2 October review (for example the lockout answer that shows an account exists) still open for the owner.

## 5.7 Recommendations

Before any use with real patients, the following are recommended.

1. **Obtain ethics approval** from the ZCAS Ethics Review Board and the NHRA, then **run the user acceptance test** with the prepared kit and report the SUS score per group against the target of 75.
2. **Train and evaluate the models** with the proposal's methodology, integrate them through the integration guide with per-group evaluation figures, and re-run the performance tests with real inference.
3. **Have a qualified clinician sign off the knowledge base**, and extend it to the practical barriers of cost, distance and fear of biopsy.
4. **Commission human-verified Bemba and Nyanja translations** before enabling those languages.
5. **Carry out a data-protection review** under the Data Protection Act (2021) covering the speech service, Firebase and Claude, and a legal review of data residency.
6. **Close the residual security risks**: remove label and macro images from slides before slides reach the AI (R-1); choose an SMS or e-mail provider for password resets (R-2); add a second factor for administrators (R-3); provision managed keys, encrypted object storage and backups, and database TLS (R-4); detect burned-in text in DICOM pixels (R-5); share exports only under a data-sharing agreement, since de-identified data is not anonymous (R-6); commission an independent penetration test to OWASP ASVS level 2 (R-7); and never run the demonstration seed against production (R-8). Also switch on MongoDB access control, which is off in the development installation.
7. **Create the Firebase project** and test push delivery on a real phone, and **confirm speech recognition with a real voice**.

## 5.8 Future Work

- **A controlled clinical pilot** at CDH and UTH, measuring turnaround time, AI-versus-clinician performance, adoption and outcomes.
- **Federated learning** across Zambian institutions, without centralising patient records.
- **On-device inference** with compressed models, so that basic AI support works without a connection.
- **New imaging modalities**, mpMRI and later PSMA PET/MRI, as they become available.
- **Longitudinal outcome tracking**, and AI-literacy training for clinicians.
- **Two-way SmartCare Pro integration**, and FHIR Bulk Data export at national scale.
- **National-scale audit logging**, chaining rows in batches or per facility to remove the single-lock bottleneck measured in Section 4.3.5.
- **Production deployment** with Kubernetes, monitoring and alerts (UC-10), and measured uptime against the 99.5% target.
- **Population analytics (UC-11)** and **model retraining with A/B testing (UC-12)**.
- **An iOS build**, resumable uploads for large files, Bemba and Nyanja voices, and real user questions added to the retrieval evaluation sets.

## 5.9 Conclusion

The project set out to build a working prototype of an AI-driven mHealth platform for prostate cancer diagnosis in Zambia and to evaluate it honestly against the approved proposal. It built every layer of the proposed architecture and showed, in tested software, that the hard engineering problems of the setting can be solved: safe offline capture where connectivity fails, strict protection and de-identification of health data, a traceable audit trail, an AI pipeline that never presents mock output as real, and a patient assistant that answers only from reviewed content, quickly, by text or voice.

The prototype does not yet show that the platform improves diagnosis. That depends on work outside a software project: trained and validated models, real data under ethical approval, clinical review of the content, verified translations, and testing with the people the system is meant to serve. The proposal ended with the men who die each year from a disease that could be found earlier. This project does not yet change that number, but it provides a tested foundation for validated models and clinical evaluation.
