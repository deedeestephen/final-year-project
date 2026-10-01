# User acceptance testing (UAT): the plan

This kit is for the user acceptance test that the research proposal describes (§3.8.2, NFR-04, NFR-11). It turns that design into sessions you can run: who takes part, what they do, what you record, and how you analyse it. The printable version of every document is `docs/uat/PCa-mHealth-UAT-kit.pdf`.

| Document | What it is for |
|---|---|
| This plan | Aims, participants, ethics, preparation, how a session runs, how to analyse the results |
| [Information sheet and consent form](information-and-consent.md) | Given to every participant before the session |
| [Tasks: patients](tasks-patient.md) | Tasks, what success looks like, and the observer's record |
| [Tasks: clinicians](tasks-clinician.md) | For urologists, general practitioners, nurses and radiographers (the app's clinician role) |
| [Tasks: pathologists](tasks-pathologist.md) | |
| [Tasks: administrators](tasks-administrator.md) | For the admin website (optional: the proposal's UAT does not include administrators) |
| [System Usability Scale (SUS)](sus-questionnaire.md) | The ten statements, how to read them aloud, and how to score them |
| [Results template](results-template.md) | Tables for the report's Chapter 4 (test output) |

## 1. Aims

1. Can each kind of user complete the main tasks of their role without help? (task success, time, errors, help needed)
2. Is the system easy to use? The proposal's target is a **SUS score of at least 75** (NFR-04).
3. Can people with limited reading skills use the assistant and the Learn section by **voice and read-aloud**? (think-aloud, proposal §3.8.2)
4. What should change before the next prototype iteration? (problems ranked by severity)

## 2. Before any participant: ethics

**No session with real participants may start before written approval** from the ZCAS University Ethics Review Board and, for health-facility staff and patients, the Zambia National Health Research Authority (NHRA). This is what the proposal commits to (§3.7.1).

- **Only synthetic data.** Participants use test accounts and made-up patients prepared by you. Nobody enters their own or a real patient's details. Tell them so before they start, and stop them politely if they begin to.
- **Consent first.** Every participant reads (or is read) the [information sheet](information-and-consent.md) and signs or thumb-prints the consent form, with a witness for those who cannot read.
- **What you record about participants:** a code (for example P-03, C-07), their role, years in the role, how often they use a smartphone, and the language they prefer. No names on the record sheets; the list linking codes to names is kept separately and locked.
- **Audio recording** of think-aloud sessions only if the participant ticks that box on the consent form. Otherwise, take notes.
- **Patients** are told that the app gives general information only, that the AI results in the prototype are not real, and that nothing they see is about their own health.

## 3. Participants

The proposal asks for **at least five people in each user group**, from Cancer Diseases Hospital (CDH), University Teaching Hospital (UTH), and at least one rural or peri-urban facility.

| Group in the proposal | Account they use in the app | Task sheet |
|---|---|---|
| Urologists, general practitioners, nursing staff | Clinician | [tasks-clinician.md](tasks-clinician.md) |
| Radiologists (or radiographers) | Clinician (uploading scans, reading the AI report) | [tasks-clinician.md](tasks-clinician.md), tasks C-6 to C-8 |
| Pathologists | Pathologist | [tasks-pathologist.md](tasks-pathologist.md) |
| Patients (men aged 40 and over, including some with limited reading skills) | Patient | [tasks-patient.md](tasks-patient.md) |
| Administrators (optional) | Admin website | [tasks-administrator.md](tasks-administrator.md) |

Five users per group find most usability problems of a kind (Nielsen and Landauer, 1993); more are better for the SUS average.

## 4. Preparation (the day before)

- [ ] Everything starts: `powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\dev-up.ps1` ends with READY.
- [ ] The demo data exists and passwords are known (`SEED_DEMO_PASSWORD` in `.env`; see the operations manual §14).
- [ ] **One fresh account per participant**, made on the admin website (Users › New account), named with the participant's code, for example *P-03 Test*. Patients' accounts are linked to a synthetic patient record (Patient accounts › Link).
- [ ] The test files are on the phone: `npm run fixtures` in `3-application-logic\backend`, then copy `synthetic-mri.dcm` and `synthetic-slide.tif` from `test\fixtures\files` to the phone's Downloads.
- [ ] The phone (or phones) charged, the app installed (operations manual §10.2) and the **volume up** for read-aloud. Leave the microphone permission unanswered if you want to see how participants handle Android's question; otherwise allow it beforehand.
- [ ] For the "no internet" tasks: you know how to switch **Airplane mode** on and off on that phone.
- [ ] Printed: the information sheet, consent forms, the task sheet for each participant, the SUS form, a stopwatch or phone timer.

## 5. A session (about 45 minutes, one participant)

| Step | Minutes | What happens |
|---|---|---|
| Welcome and consent | 5 | Explain the aim (testing the system, not the person). Information sheet, consent form. |
| Background questions | 3 | Role, years, smartphone use, preferred language (on the task sheet). |
| Practice | 2 | One easy task (sign in), so the think-aloud feels normal. |
| Tasks | 20–25 | The participant does the tasks on their sheet, thinking aloud. The facilitator reads each task as written and does not help unless asked twice. The observer times each task and records the result. |
| SUS | 5 | The ten statements, read aloud if the participant prefers. |
| Interview | 5–10 | The questions at the end of the task sheet. |
| Close | 1 | Thank them; reset the phone (sign out, switch Airplane mode off). |

**Think-aloud:** ask the participant to say what they are looking for, what they expect to happen, and what surprises them. If they fall silent for a while, say only *"What are you thinking now?"* Do not explain the screen.

**Help levels** (record one per task): **0** no help; **1** a hint ("look at the top of the screen"); **2** the facilitator showed them; **X** gave up.

**Success:** the task's success criterion on the sheet is met with help level 0 or 1.

## 6. Analysis

1. **Task success rate** per task and group: tasks completed with help 0 or 1 ÷ participants.
2. **Time on task**: median and range per task (only successful attempts).
3. **SUS**: score each form as in [sus-questionnaire.md](sus-questionnaire.md); report the mean, the standard deviation and the range per group and overall, and compare with the target of 75.
4. **Problems found**: list every problem seen or reported, how many participants met it, and its severity (Nielsen's scale: 0 not a problem, 1 cosmetic, 2 minor, 3 major, 4 catastrophic). Fix 3s and 4s before the next iteration.
5. **Think-aloud and interviews**: thematic analysis. Read the notes, give each remark a short code (for example *trust in the AI label*, *voice not understood*, *offline confusion*), group the codes into themes, and count how many participants mention each theme. Quote a few remarks (by code, never by name).
6. Put the results in the [results template](results-template.md) and in Chapter 4 of the report. Report what was found, including tasks that failed: they are the point of the test.

## 7. What this test cannot show

- The AI results are **labelled mock output**, so the test can show whether people understand and trust the report's layout and labels, not whether the AI is right.
- The knowledge base is a **draft** that a clinician has not yet signed off; note any answer a participant finds wrong or unclear, and give the list to the reviewing clinician.
- The app is **in English**. Patients who prefer Bemba or Nyanja can be helped by an interpreter, and the session notes should say so; this is evidence for the translation work the proposal plans.
