# Chapter 2: Literature Review

## 2.1 Introduction

This chapter reviews the knowledge on which the project was built: the epidemiology of prostate cancer worldwide and in Zambia, the diagnostic pathway and its weaknesses, mHealth in resource-constrained African settings, AI in healthcare, and AI applied to prostate cancer imaging, histopathology and biomarkers. Because the implementation added a patient assistant and a planned usability evaluation, it also reviews the clinical reporting standards the system records, conversational agents and retrieval, and usability measurement. It ends with the theoretical framework and the research gaps, and shows how far the prototype addresses each gap.

## 2.2 Global Epidemiology of Prostate Cancer

The GLOBOCAN 2020 estimates recorded 1,414,259 new prostate cancer diagnoses and 375,304 deaths worldwide, which makes it the second most frequently diagnosed cancer in men and the fifth leading cause of male cancer death (Sung et al., 2021). In the United States alone, 268,490 new cases and 34,500 deaths were reported in 2022 (National Cancer Institute, 2022).

These totals hide a large disparity in outcomes. Five-year survival is about 98% in the United States but below 50% in many countries of sub-Saharan Africa, mainly because late presentation is the norm (Rebbeck et al., 2013). Age is the strongest risk factor, and ancestry the second: men of African descent show higher incidence, more aggressive disease and worse survival, probably through a combination of genetic susceptibility, unequal access to screening and socio-economic factors (Rebbeck et al., 2013).

This has a direct consequence for AI. A model trained mainly on European or North American patients risks performing worse in exactly the population that needs it most. Obermeyer et al. (2019) showed that a commercially deployed clinical algorithm systematically under-served Black patients because of bias in its training data. An AI component for Zambia must therefore be evaluated on the population it serves, with performance reported by subgroup.

## 2.3 Prostate Cancer in Zambia

### 2.3.1 Epidemiological profile

WHO data for 2020 place Zambia's incidence at 65.4 per 100,000 men per year and mortality at 37.6 per 100,000, which makes prostate cancer the most common cancer and the leading cause of cancer death among Zambian men (WHO, 2020). Award (2022) reports about 561 recorded deaths a year, almost certainly an undercount given the incompleteness of the national registry.

### 2.3.2 The diagnostic pathway and its failures

The pathway begins at primary or secondary care with DRE and PSA testing, and abnormal findings lead to transrectal ultrasound (TRUS)-guided biopsy. Multiparametric MRI and PSMA PET/CT, the international standards for locating tumours before biopsy and for staging, are absent from the Zambian health system (Lombe et al., 2024). Without imaging guidance, biopsy yield falls and the risk of false negatives and complications rises. The infection rate after transrectal biopsy is about 10% in Zambian facilities, against 1–2% in high-income settings, reflecting constraints on sterile technique and the local prevalence of multi-drug-resistant organisms (Lombe et al., 2024). That risk also deters men from seeking confirmation of a suspected diagnosis.

Lombe et al. (2024) also documented the misclassification of prostate cancer as BPH in outpatient registers. Individual patients are placed on a benign pathway, and the registry receives inaccurate data. An AI system trained on raw Zambian data without a correction protocol would learn this error.

### 2.3.3 Zambia's digital health infrastructure

Zambia has infrastructure on which a new system can build. The SmartCare Pro electronic health record, developed through a partnership between the Government of Zambia and IHM Southern Africa's TuSo Business Dynamics, gives patients unique identifiers usable from any connected facility, and the Digital Health Strategy 2022–2026 commits the country to digital technologies for universal health coverage (Ministry of Health Zambia, 2022). A new tool should therefore exchange data with SmartCare Pro through an agreed standard rather than create another isolated record, which is why the prototype includes an HL7 FHIR R4 export.

## 2.4 Mobile Health in Resource-Constrained African Contexts

Mobile health has a substantial evidence base. Fiordelli et al. (2013) mapped a decade of mHealth research, which reports positive outcomes in areas such as antenatal care, HIV treatment adherence, malaria surveillance and chronic disease management, and countries in the region, including Kenya, South Africa and Nigeria, have used mHealth for cancer screening and diagnostic support. Kaplan (2006) identified mobile phone penetration as the critical enabling condition for mHealth in developing countries, a condition that Zambia increasingly meets.

Connectivity is the main constraint. Rural and peri-urban areas face intermittent or absent internet connectivity, which can undermine systems that depend on it (Aranda-Jan et al., 2014). The proposal therefore specified an offline-first design, in which data entry works on the device and data is synchronised when a connection returns. Offline-first design brings its own engineering problems: a change whose answer was lost may be sent again, two devices may change the same patient during the same gap, and data held on a phone must be protected if the phone is lost. Section 3.4 shows how the prototype deals with each.

## 2.5 Artificial Intelligence and Machine Learning in Healthcare

Machine learning includes supervised learning from labelled examples, unsupervised learning from unlabelled data, and semi-supervised learning, which combines the two and suits healthcare, where labels are scarce and expensive (Beam & Kohane, 2018). Deep learning, with multi-layered neural networks, dominates medical image analysis because it learns features directly from raw images (LeCun et al., 2015).

Two convolutional architectures matter for this project. U-Net is an encoder–decoder network whose skip connections preserve fine spatial detail, designed for biomedical segmentation with limited training data (Ronneberger et al., 2015), which suits the delineation of prostate lesions. ResNet-50 uses identity skip connections that let gradients flow through many layers, which addresses the vanishing-gradient problem of deep networks (He et al., 2016); its balance of capacity and cost suits classification under the proposal's 3-second target. Transfer learning, which fine-tunes a network pre-trained on a large dataset, has been reported to improve medical imaging models trained on small datasets (Tajbakhsh et al., 2016), which matters where local datasets are small.

The gap between research performance and clinical readiness is well documented. Overfitting is the main risk with small datasets; differences in imaging protocols between sites make models less portable (Woznicki et al., 2020); algorithmic bias produces systematic differences between groups (Obermeyer et al., 2019); and opaque outputs are a barrier to clinician trust and regulatory approval (Rudin, 2019). The proposal answered the last point with Grad-CAM heatmaps for imaging models and SHAP values for the clinical model. The World Health Organization has issued guidance on the ethics and governance of AI for health (WHO, 2021). Within that wider discussion, the prototype applied two principles of its own: AI output is never presented with more authority than its evidence supports, and every output shows where it came from. In practice, every AI result carries its provenance, mock output is always labelled, and no accuracy figure is shown without a stored evaluation.

## 2.6 AI Applications in Prostate Cancer Diagnosis

**MRI.** Fehr et al. (2015) combined texture features from apparent diffusion coefficient (ADC) and T2-weighted MRI and reached 93% classification accuracy. Saha et al. (2021) applied 3D CNNs to biparametric MRI from 2,732 patients with strong lesion detection. Woznicki et al. (2020) reported that combining a radiomics model with PI-RADS and clinical parameters raised the AUC from 0.69 (PI-RADS alone) to 0.84. Litjens et al. (2017) evaluated computer-aided detection of prostate cancer in MRI and released a public dataset, which the proposal planned to use for pre-training. The absence of mpMRI in Zambia defines the gap: the proposal planned TRUS-based analysis in the near term while designing for MRI later.

**Histopathology.** Automated Gleason grading responds directly to Zambia's shortage of pathologists. Ström et al. (2020) trained a model on biopsy slides from 1,247 men and reached an AUC of 0.997 for separating benign from malignant cores, with grading comparable to an international expert panel. Nagpal et al. (2019) reported a grading accuracy of 0.70 on prostatectomy slides, against a mean of 0.61 for expert pathologists. Pixel-level annotation of whole-slide images needs specialist time that is not available at scale; multiple-instance learning allows training with slide-level labels only (Campanella et al., 2019), and attention-based MIL pooling weights the tiles that matter most, which also highlights the regions behind a grade (Ilse et al., 2018). These works explain the choice of a patch-CNN with MIL.

**PSA and biomarkers.** Djavan et al. (2002) showed that a neural network applied to borderline PSA values of 4–10 ng/mL achieved better specificity and positive predictive value than conventional thresholds at the same sensitivity. Finne et al. (2000) eliminated 33% of false-positive PSA results at 95% sensitivity, and Remzi et al. (2003) predicted repeat-biopsy outcomes with 68% specificity at 95% sensitivity. Fewer false positives would mean fewer unnecessary biopsies, with their infection risk.

**TRUS.** Because TRUS-guided biopsy will remain the main confirmatory pathway in Zambia for some time, AI support for TRUS has direct value. Moradi et al. (2009) used support vector machines and random forests to improve cancer detection in TRUS images, and Karimi et al. (2019) developed accurate and robust deep learning segmentation of the prostate in ultrasound images.

## 2.7 Clinical Reporting Standards Used by the System

A diagnostic support system must record findings in clinicians' terms. The prototype's data model and its clinician reference content follow four published standards and measures.

- **ISUP grade groups** summarise Gleason grading in five groups, from grade group 1 (Gleason score 6 or less) to grade group 5 (Gleason score 9 or 10), as agreed at the 2014 ISUP consensus conference (Epstein et al., 2016). In the prototype, the server computes the grade group from the pathologist's two Gleason patterns.
- **PI-RADS version 2.1** reports prostate MRI with an assessment category from 1 (very low likelihood of clinically significant cancer) to 5 (very high) (Turkbey et al., 2019). The prototype records the radiologist's category and sends it to the AI analysis as an input.
- **PSA density**, PSA divided by prostate volume, adjusts PSA for the size of the gland (Benson et al., 1992).
- **The free-to-total PSA ratio**: in men with a total PSA of 4–10 ng/mL and a benign-feeling prostate, a lower percentage of free PSA was associated with a higher risk of cancer (Catalona et al., 1998).

The prototype calculates both PSA measures when a record is read, and enforces the valid ranges of PSA, PI-RADS, Gleason patterns and grade groups as database constraints.

## 2.8 Conversational Agents and Retrieval for Patient Education

Patient education influences whether men come for screening and complete the diagnostic pathway. Laranjo et al. (2018) systematically reviewed conversational agents in healthcare and found positive outcomes in delivering health information, supporting adherence and encouraging behaviour change. Safety is central: a wrong answer can mislead a patient. Open-ended text generation produces fluent but sometimes invented answers. Retrieval-augmented generation conditions the answer on passages retrieved from a knowledge base, which improves factual accuracy in knowledge-intensive tasks (Lewis et al., 2020).

Two retrieval families are relevant. Lexical retrieval, of which BM25 is the standard ranking function, scores passages by the words they share with the question; it needs no model, runs quickly and every match can be explained, but it fails when the question and the right passage use different words, or when an unrelated question shares one word with a passage. Dense retrieval compares meaning through vectors. MedCPT is a dense retriever for biomedical text, based on PubMedBERT and trained on 255 million query–article pairs from PubMed search logs, with separate encoders for questions and articles that produce 768-dimensional vectors (Jin et al., 2023). Dense retrieval alone has its own weakness for a safety-critical assistant: a nearest passage always exists, so there is no natural point at which to say that no reviewed information is available. Section 3.5.7 describes how the prototype combines the two.

Language and literacy also matter. Many older Zambian men read little English, and some cannot read at all. The proposal's answer was a knowledge base in English, Bemba and Nyanja; the prototype added voice input and read-aloud, and kept the two Zambian languages switched off until human-verified translations exist.

## 2.9 Usability Evaluation

The proposal set a target of a System Usability Scale (SUS) score of at least 75 (NFR-04). The SUS has ten statements answered on a five-point scale and scored to a value between 0 and 100 (Brooke, 1996); it is short, free to use and widely reported. The proposal asked for at least five participants per user group, and Nielsen and Landauer (1993) showed that about five users find most usability problems of a given kind. Think-aloud protocols and thematic analysis of interviews explain why tasks succeed or fail.

## 2.10 Theoretical Framework

The **Technology Acceptance Model** (TAM) holds that perceived usefulness and perceived ease of use are the main determinants of technology adoption (Davis, 1989). In the prototype, TAM informed concrete choices that support trust: clinical values in neutral colours, with no suggestion of good or bad that the system cannot justify; a provenance banner at the top of every AI screen; a list of the AI modules that ran and the reasons others were skipped; and offline states always written in words ("Saved on device", "Synced", "Needs attention").

The **Health Belief Model** (HBM) identifies perceived susceptibility, severity, barriers and benefits as the determinants of health behaviour (Becker, 1974). It explains why awareness alone is not enough: men who see the diagnostic process as burdensome, risky or inaccessible will not seek evaluation. The proposal asked the chatbot's knowledge base to address each construct. The prototype's knowledge base covers some themes (who is at higher risk, and what screening can and cannot tell a person) but not yet the practical barriers of cost, distance and fear of biopsy, a gap returned to in Chapter 5.

## 2.11 Summary of Research Gaps

Table 2.1 restates the proposal's six research gaps and records how far the prototype addresses each.

Table 2.1: Research gaps and how far the prototype addresses them

| # | Gap identified in the proposal | How far the prototype addresses it |
|---|---|---|
| 1 | No integrated multi-modal AI system for prostate cancer diagnosis in a sub-Saharan African context | Partly: the pipeline for five modules and their fusion is built and tested; the models are labelled mocks |
| 2 | AI models not validated on Black African populations | Not empirically: no model was trained; a fairness check by age, region, stage and equipment is ready for real evaluations |
| 3 | No patient-facing mHealth platform combining AI support with a multilingual chatbot in Zambia | For English: patient app with results, education, messages, consent and an assistant with voice and read-aloud; Bemba and Nyanja await translations |
| 4 | No strategies for Zambia-specific data quality problems (misclassification, incomplete records, non-standard TRUS) | Not empirically: no data was collected; the data model enforces valid ranges, and the correction protocol is future work |
| 5 | No ethical and regulatory framework for AI clinical decision support in Zambia | Partly: consent gating, de-identification, tamper-evident audit, separation of duties and labelled mocks built and tested; legal and ethics approvals outstanding |
| 6 | No offline-first architecture for rural facilities in prostate cancer AI design | Addressed and tested: encrypted offline capture, exactly-once synchronisation and conflict detection, measured under load |

## 2.12 Chapter Summary

The literature shows a strong evidence base for AI in prostate cancer imaging, histopathology and biomarkers, and for mHealth in African settings. It also shows the risks: small and unrepresentative datasets, bias, poor portability and opaque outputs. What did not exist was an integrated system designed for the Zambian context from the start. Chapter 3 describes how the system was analysed and designed to fill that space.
