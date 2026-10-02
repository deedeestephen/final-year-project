# Chapter 1: Introduction

## 1.1 Background of the Study

Every year, more than five hundred and sixty Zambian men die from prostate cancer (PCa). The figure comes from the World Health Organization's 2020 cancer statistics, and it almost certainly undercounts the true toll, because Zambia's health information systems are incomplete (World Health Organization [WHO], 2020). By both incidence and mortality, prostate cancer is now the leading male cancer in Zambia.

Zambia records 65.4 new prostate cancer cases per 100,000 men each year, which places it among the highest-burden countries in sub-Saharan Africa (Sung et al., 2021). Mortality stands at 37.6 per 100,000. In high-income countries the gap between incidence and mortality is wide, because early detection is the norm. In Zambia the gap is narrow, because most men are diagnosed after the window for curative treatment has closed. The average delay of 83.4 days from the first clinic visit to a confirmed diagnosis is a central driver of late presentation and high mortality (Lombe et al., 2024).

The core problem is one of infrastructure rather than biology. Prostate-specific antigen (PSA) testing, digital rectal examination (DRE), multiparametric magnetic resonance imaging (mpMRI) and biopsy, used together, can find the disease at a stage at which survival approaches 99% (Siegel et al., 2023). Yet fewer than 10% of Zambian health facilities offer any specialised prostate cancer diagnostic service (WHO, 2020). Multiparametric MRI is not available in the Zambian health system, and transrectal biopsy carries an infection rate of about 10% in Zambian facilities, against 1–2% elsewhere (Lombe et al., 2024).

Artificial intelligence (AI) offers one response to this gap. Machine learning models have matched or exceeded specialist performance in medical image interpretation, histopathological grading and biomarker-based risk assessment (Topol, 2019), and a model on a server can serve many mobile devices without a matching increase in specialists. Mobile phone use in Zambia is high, and the national SmartCare Pro electronic health record already links facilities (Ministry of Health Zambia, 2022). The conditions for an AI-supported mobile health (mHealth) intervention therefore exist.

The approved research proposal set out the design of such a platform: a cross-platform mobile application, a multi-modal AI inference engine and a patient-education chatbot, arranged in a six-layer architecture. This report describes the research prototype that was built from that design, how it was designed, implemented and tested, and how far it meets the proposal's objectives.

## 1.2 Problem Statement

The problem is not the absence of a single diagnostic tool. It is the presence of several system failures at once, which together make it likely that a man with early, curable prostate cancer stays undiagnosed until the disease is advanced. The proposal identified five.

1. **Diagnostic delay.** The average time from first presentation to diagnosis was 83.4 days in 2023 (Lombe et al., 2024). Pathway improvements cut this to 23 days in some facilities, but the gains were local.
2. **Geographic inaccessibility.** With fewer than 10% of facilities offering specialised care, specialist evaluation is out of reach for most Zambian men, particularly outside Lusaka (WHO, 2020).
3. **Misclassification at the point of entry.** Prostate cancer cases are documented as benign prostatic hyperplasia (BPH) in outpatient registers, which places patients on a benign pathway and distorts national data (Lombe et al., 2024). An AI model trained on such records without correction would repeat the error.
4. **The diagnostic modality gap.** In the borderline PSA range of 4–10 ng/mL, false-positive rates can reach 75%, which leads to unnecessary biopsies (Djavan et al., 2002). Without mpMRI to guide biopsy, its yield is lower and its risks higher.
5. **Variability between clinicians.** Gleason grading shows notable disagreement between and within pathologists, particularly for intermediate grades (Ström et al., 2020), and in Zambia non-specialists often grade biopsies.

A practical system must also work where connectivity is intermittent, protect health data under Zambian law, and earn the trust of clinicians and patients. These constraints shaped every design decision in this report.

## 1.3 Aim and Objectives

### 1.3.1 Aim

The aim of the project was to design and build a working research prototype of the AI-driven mHealth platform specified in the approved proposal, for the earlier diagnosis and detection of prostate cancer in the Zambian health system, and to evaluate the prototype against the proposal's requirements.

### 1.3.2 Objectives

The proposal set five objectives. They are reproduced as approved, so that Chapter 5 can evaluate the work against them.

1. To design a cross-platform React Native mobile application implementing AES-256 encrypted offline-first data capture, TLS 1.3 API communication, role-based access control (RBAC), and HL7 FHIR R4 interoperability for secure multi-modal patient data management.
2. To architect a multi-modal AI inference engine comprising a U-Net convolutional neural network (CNN) for lesion segmentation, a ResNet-50 CNN for classification using transfer learning (targeting an AUC-ROC of at least 0.90), an artificial neural network (ANN) for clinical biomarker analysis, and a deep-learning patch-CNN with multiple-instance learning (MIL) for automated Gleason grading, integrated through an XGBoost multi-modal fusion layer.
3. To design a natural language processing (NLP) chatbot based on retrieval-augmented generation (RAG), grounded in a curated medical vector-database knowledge base, delivering evidence-based patient education and diagnostic guidance in English and Zambian indigenous languages within 2-second response times.
4. To develop a data collection, pre-processing, augmentation and AI model training methodology, incorporating transfer learning, fairness-aware training and stratified 5-fold cross-validation, tailored to the data quality and demographic constraints of the Zambian health context.
5. To formulate an ethical, privacy and regulatory compliance framework, encompassing informed consent, AES-256 de-identification, algorithmic bias monitoring, Grad-CAM explainability, SHAP value reporting and alignment with Zambian cyberlaw, embedded as a foundational design requirement.

One change was made to objective 1: the mobile application was built with Flutter rather than React Native, by the owner's decision at the start of the build (ADR-001). Section 3.2.4 explains why every requirement of the objective still applies.

## 1.4 Research Questions

1. How can a multi-modal AI inference engine be architecturally designed to process heterogeneous prostate cancer data streams within the specific infrastructural, data quality and demographic constraints of the Zambian health system?
2. What data collection, pre-processing and augmentation strategies are most effective for training generalisable AI models, given the documented scarcity, misclassification and non-standardisation of locally available prostate cancer datasets in Zambia?
3. How can an offline-capable mHealth platform architecture reliably deliver AI-augmented diagnostic support both in urban facilities with stable connectivity and in rural facilities with intermittent or absent internet access?
4. What ethical, fairness, explainability and regulatory design measures are required to ensure equitable and trustworthy deployment of AI-driven clinical decision support within Zambia's emerging digital health governance landscape?

## 1.5 Implementation Plan

### 1.5.1 The plan in the proposal

The proposal planned a twelve-month project in nine phases (Table 1.1 and Figure 1.1). Phases 4 and 5 were to run in parallel, and the ethics and security work (Phase 8) alongside implementation. The plan gives months, not dates.

Table 1.1: The nine phases of the proposal's twelve-month plan

| Phase | Activity | Planned months |
|---|---|---|
| 1 | Planning and requirements analysis | M1–M2 |
| 2 | System architecture and design | M2–M4 |
| 3 | Data collection and preparation | M3–M6 |
| 4 | AI model development and training | M4–M8 |
| 5 | Mobile app and chatbot development | M5–M8 |
| 6 | System integration and API wiring | M7–M9 |
| 7 | User acceptance testing | M8–M10 |
| 8 | Ethical compliance and security audit | M3–M10 |
| 9 | Evaluation, writing and documentation | M9–M12 |

![Figure 1.1: Planned timeline (from the research proposal)](../report/figures/gantt-planned.png)

### 1.5.2 The build plan that was followed

At the start of the build, the proposal's phases were broken down into nineteen smaller build phases, numbered 0 to 18 (Table 1.2). A phase was finished only when its quality gate passed (formatting, static analysis, tests, build and security checks), the documentation and the requirements traceability matrix were updated, and the work was committed.

Table 1.2: The build phases of the development plan

| Phase | Name | Main outputs |
|---|---|---|
| 0 | Project analysis | Architecture, plan, traceability matrix, first decision records |
| 1 | Repository and environment | Repository layout, container services, continuous integration, first tests |
| 2 | Database foundation | Schema and migrations, document collections, file storage, append-only audit log, synthetic seed data |
| 3 | Backend foundation | Validation, security headers, rate limits, errors, health checks, OpenAPI, frozen AI contract |
| 4 | Authentication and authorisation | Sign-in, session tokens, lockout, password reset, RBAC |
| 5 | Patients and clinical data | Registration, screening records, consent, facility scoping |
| 6 | Offline-first synchronisation | Sync endpoint with idempotency and conflicts; encrypted phone database |
| 7 | Flutter foundation | Theme, navigation, sign-in screens, API client, secure storage |
| 8 | Patient workflow | Results, education, messages, consent, sign-up |
| 9 | Clinician and pathologist workflow | Consent, scans and slides, AI request and report, slide review |
| 10 | Imaging and files | Streamed upload, file validation, DICOM checks, object storage |
| 11 | AI service foundation | Model router, labelled mock models, registry, broker with time-outs |
| 12 | Explainable AI | Explanation pipeline, "unavailable" states, evaluation endpoint |
| 13 | Chatbot | Knowledge base, retrieval, safety rules, conversations, chat screens |
| 14 | FHIR R4 export | De-identified bundles and a SmartCare Pro stand-in |
| 15 | Security and compliance review | Access matrix, de-identified AI inputs, separation of duties, TLS check |
| 16 | End-to-end tests | Six workflows on the live system, log review |
| 17 | Performance and reliability | Load, stress and synchronisation tests against the targets |
| 18 | Final quality audit | Traceability review, coverage minimums, accessibility tests |

The phases were not completed strictly in number order; for example, the Flutter foundation (7) came before synchronisation (6), and the chatbot (13) after the security review (15). Further work was added at the owner's request after Phase 18: a separate administration website, a redesign of the app, voice questions and read-aloud, a move to the database servers installed on the development computer, an operations manual, the report diagrams, the user acceptance testing kit, a biomedical meaning search for the assistant, and push notifications.

### 1.5.3 The actual timeline

Figure 1.2 shows the actual timeline, drawn from the Git history with one mark per commit. The history records the build from 23 September to 2 October 2026, in 47 commits on the main branch before this report was drafted, far less than the planned twelve months. Two reasons account for most of the difference. The phases that take most of the planned time (data collection, model training and user acceptance testing) could not be carried out, because they need data-sharing agreements, ethics approval and participants (Section 1.6). And the development log and security review record that the software was written with an AI coding assistant working under the student's direction, which is likely to have shortened the implementation. Chapter 5 compares the plan and the outcome.

![Figure 1.2: Actual build timeline (from the Git history)](../report/figures/gantt-actual.png)

## 1.6 Scope and Delimitations

The proposal scoped the study to design and methodology, and placed implementation and clinical evaluation in later phases. This project went further on implementation, building and testing a prototype of every layer, but not on clinical work. The prototype has these boundaries:

- **Synthetic data only.** No real patient data was collected or used anywhere; all records are generated and labelled "SYNTHETIC".
- **No trained AI models.** The five AI modules are labelled development mocks whose outputs come from a hash of the job identifier, not from patient data, and every result carries the label "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT." The pipeline around them is complete. The owner is training the models separately.
- **No clinical validation.** Without trained models, no diagnostic accuracy figure can be reported.
- **English only.** Bemba and Nyanja are switched off until human-verified translations exist.
- **Android only.** No iOS build was made, because building for iOS requires a Mac.
- **No user acceptance testing yet.** A complete kit was prepared, but sessions require ethics approval.
- **A development deployment.** The system runs on one laptop; Kubernetes, a web application firewall and measured uptime were documented, not built.

The geographic focus remains the Zambian health system, with the Cancer Diseases Hospital (CDH) and the University Teaching Hospital (UTH) in Lusaka as the intended first sites.

## 1.7 Significance of the Study

- **Clinical.** A validated version could shorten the diagnostic pathway, extend decision support to facilities without specialists, and support more consistent grading. The prototype does not yet deliver these benefits, but it provides the infrastructure into which validated models can be placed without changing the rest of the system.
- **Health system.** Offline-first capture lets clinicians without reliable internet still record screenings, and the de-identified FHIR R4 export shows how such a tool could feed SmartCare Pro rather than stand alone (Ministry of Health Zambia, 2022).
- **Policy and ethics.** The prototype shows in working code how consent, de-identification, an append-only audit trail, labelled mock output and fairness checks can be built in from the start.
- **Academic.** It contributes a tested reference architecture and documented design decisions for AI-supported mHealth in a low-resource setting, including the offline synchronisation design and a "keywords decide, meaning orders" retrieval design for a safe patient assistant.

## 1.8 Definition of Key Terms

Table 1.3: Definition of key terms

| Term | Definition |
|---|---|
| Convolutional neural network (CNN) | A deep learning architecture that learns spatial features from images; U-Net and ResNet-50 are CNN variants. |
| Multi-modal data fusion | Combining outputs from imaging, clinical and histopathological sources into one prediction, here through an XGBoost meta-learner. |
| AUC-ROC | The area under the receiver operating characteristic curve: a classifier's ability to separate classes across thresholds (1.0 perfect, 0.5 random). |
| Retrieval-augmented generation (RAG) | Answering from passages retrieved from a knowledge base, so that answers can be traced to sources. |
| Gleason score and ISUP grade group | The histopathological grading of prostate cancer; the grade group summarises the Gleason score in five groups. |
| HL7 FHIR R4 | Release 4 of the Fast Healthcare Interoperability Resources standard for exchanging health records. |
| Grad-CAM and SHAP | Explanation methods: Grad-CAM highlights the image regions behind a CNN's output; SHAP values show each input's contribution. |
| Offline-first | Saving data on the device first and sending it to the server when a connection is available. |
| Idempotency key | A unique key sent with each change, so that a change sent twice is applied only once. |
| Development mock | A stand-in for a trained model that returns clearly labelled, non-clinical output. |
| Safe Harbor de-identification | Removal of eighteen classes of identifiers (names, contact details, most dates and others) before data is shared. |
| BM25 and MedCPT | BM25 ranks passages by the words they share with a question; MedCPT is a biomedical model that compares their meaning as 768-number vectors (Jin et al., 2023). |
| Quality gate | The automated checks (formatting, static analysis, tests, coverage, build, security audits) that had to pass before each commit. |

## 1.9 Organisation of the Report

Chapter 2 reviews the literature and states the theoretical framework and research gaps. Chapter 3 presents the system analysis and design: research design, requirements, development method, data and process models, and program, database and interface design. Chapter 4 presents the implementation and testing: system guide, installation manual, testing plan and output, and main function code. Chapter 5 evaluates the work against the objectives and research questions, states its limitations, and gives recommendations and future work. The appendices summarise the requirements traceability, the tests, the user acceptance testing kit and the decision records, and point to the user guide.
