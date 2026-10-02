<!--
DRAFT NOTE (this comment is not printed in the Word document).
This draft was prepared with AI assistance (Claude, an AI model made by Anthropic) from the project's own documentation in this repository: the approved research proposal, the architecture and decision records, the development log, the requirements traceability matrix, the performance, security and testing documents, the operations manual and the user acceptance testing kit. It is a starting point, not a finished submission. The student must read it in full, correct and rewrite it where necessary, fill every placeholder in square brackets, and check it against ZCAS University's rules on the use of AI tools (and declare that use as those rules require) before it is submitted.
-->

<!-- titlepage -->
ZCAS UNIVERSITY

SCHOOL OF COMPUTING, TECHNOLOGY AND APPLIED SCIENCES

**An Artificial Intelligence-Driven Mobile Health Platform for Enhanced Prostate Cancer Diagnosis and Detection within the Zambian Healthcare System**

Final-Year Project Report

Bachelor of Science in Computer Science

Course: [COURSE NAME AND CODE]

Student name: [STUDENT NAME]

Student number: [STUDENT NUMBER]

Supervisor: [SUPERVISOR]

Date of submission: [DATE OF SUBMISSION]
<!-- /titlepage -->

# Declaration

I, [STUDENT NAME], declare that this report describes the final-year project that I carried out at ZCAS University, and that it has not been submitted for any other award. The work of others has been acknowledged where it is used, and every source is cited in the text and listed in the references. The use of artificial intelligence tools in building the software and in preparing this report is declared in the statement below.

[DECLARATION WORDING: replace this paragraph with the exact declaration that the ZCAS undergraduate project guide requires, if it differs]

[AI USE STATEMENT: to be written by the student in line with ZCAS rules. For accuracy: the project's development log and security review record that much of the code, the tests and the documentation were written by an AI coding assistant (Claude) working under the student's direction, with the design choices recorded as the owner's decisions; this report was drafted with AI assistance from that documentation.]

Signature: [STUDENT SIGNATURE]

Date: [DATE]

Supervisor: [SUPERVISOR NAME, SIGNATURE AND DATE]

# Acknowledgements

[ACKNOWLEDGEMENTS: to be written by the student]

# Abstract

Prostate cancer is the leading cause of cancer death among men in Zambia. The country records about 65.4 new cases and 37.6 deaths per 100,000 men each year, fewer than one in ten health facilities offer a specialised diagnostic service, and diagnosis took an average of 83.4 days in 2023. The approved research proposal answered this with a design for an artificial intelligence-driven mobile health platform. This project built a working research prototype of that design and evaluated it against the proposal's requirements.

The work followed Design Science Research and an iterative prototyping method. It was carried out in nineteen build phases, and each phase was closed by an automated quality gate. The prototype has four parts. A Flutter phone app lets clinicians register patients and record screenings without internet access, in an AES-256 encrypted database that synchronises safely later. A React website serves administrators. A NestJS backend enforces sign-in, role-based access control, a tamper-evident audit log and a de-identified HL7 FHIR R4 export. A Python service holds the complete AI analysis pipeline and a patient-education assistant. The assistant answers only from a reviewed knowledge base, finds passages by keyword (BM25) and orders them by meaning (MedCPT), and supports voice questions and read-aloud.

On a development laptop with synthetic data, the AI pipeline answered within 545 ms at the 95th percentile under 500 active users (target 3 s), the assistant within 514 ms (target 2 s), and 2,000 offline changes were saved with none lost or duplicated. The FHIR export passed the official validator with no errors, and every package exceeded 80% test coverage.

The limits are stated plainly. The AI models are labelled development mocks, so no clinical accuracy can be claimed. All data is synthetic. The knowledge base awaits clinical sign-off, and Bemba and Nyanja are not yet available. User acceptance testing and the usability score await ethics approval. Push notifications await a Firebase project, and no iOS build was made. The prototype shows that the proposed architecture is feasible; its clinical value remains to be shown.

**Keywords:** mobile health, prostate cancer, Zambia, offline-first, artificial intelligence, retrieval-augmented generation, HL7 FHIR, design science research.

<!-- toc -->

# List of Abbreviations

| Abbreviation | Meaning |
|---|---|
| ADR | Architecture decision record |
| AES | Advanced Encryption Standard (AES-256: with a 256-bit key) |
| AI | Artificial intelligence |
| ANN | Artificial neural network |
| API | Application programming interface |
| AUC-ROC | Area under the receiver operating characteristic curve |
| BM25 | A standard keyword-ranking function used in search engines |
| BPH | Benign prostatic hyperplasia |
| CDH | Cancer Diseases Hospital, Lusaka |
| CNN | Convolutional neural network |
| DFD | Data flow diagram |
| DICOM | Digital Imaging and Communications in Medicine (the file format of medical scans) |
| DRE | Digital rectal examination |
| DSR | Design Science Research |
| ECTA | Electronic Communications and Transactions Act (Zambia) |
| ERD | Entity-relationship diagram |
| FCM | Firebase Cloud Messaging |
| FHIR | Fast Healthcare Interoperability Resources (HL7 standard; R4 is Release 4) |
| FR | Functional requirement |
| GCM | Galois/Counter Mode (an authenticated mode of AES) |
| Grad-CAM | Gradient-weighted Class Activation Mapping |
| HBM | Health Belief Model |
| HL7 | Health Level Seven International |
| HMAC | Keyed-hash message authentication code |
| ISUP | International Society of Urological Pathology |
| JWT | JSON Web Token |
| LOINC | Logical Observation Identifiers Names and Codes |
| MedCPT | A biomedical text-retrieval model from the US National Center for Biotechnology Information |
| mHealth | Mobile health |
| MIL | Multiple-instance learning |
| mpMRI | Multiparametric magnetic resonance imaging |
| NFR | Non-functional requirement |
| NHRA | National Health Research Authority (Zambia) |
| NRC | National Registration Card (the Zambian identity card) |
| P95 | 95th percentile (95% of measured times were at or below this value) |
| PCa | Prostate cancer |
| PI-RADS | Prostate Imaging Reporting and Data System |
| PSA | Prostate-specific antigen |
| RAG | Retrieval-augmented generation |
| RBAC | Role-based access control |
| REST | Representational state transfer |
| SHAP | SHapley Additive exPlanations |
| SUS | System Usability Scale |
| TAM | Technology Acceptance Model |
| TLS | Transport Layer Security |
| TRUS | Transrectal ultrasound |
| UAT | User acceptance testing |
| UC | Use case |
| UTH | University Teaching Hospital, Lusaka |
| WCAG | Web Content Accessibility Guidelines |
| WSI | Whole-slide image |
| ZAMMDA | The regulator named in the research proposal for AI medical devices [CHECK: the proposal does not expand this abbreviation; confirm the regulator's correct name and abbreviation] |
