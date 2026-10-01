# Rebuilding the operations manual and the report figures

The [operations manual](../../operations-manual.md) and the list of [figures for the final-year report](../../report-figures.md) are written by hand. Their pictures, diagrams and PDFs, and the manual's web page, are **made by this tool**, from the documents and from the project's own code. When the code or a document changes, run the tool again and the pictures show the new code.

| What | Where | Made by |
|---|---|---|
| The manual's text | `docs/operations-manual.md` | you, in an editor |
| The pictures (code, terminal, admin website, phone) | `docs/report/img/` | this tool |
| The manual's PDF | `docs/report/PCa-mHealth-operations-manual.pdf` | this tool |
| The manual's web page (open it in a browser) | `docs/report/operations-manual.html` | this tool |
| The diagrams' sources (UML, data flow, architecture) | `docs/report/diagrams/*.puml` | you, in an editor (PlantUML text) |
| The generated diagrams' sources (database, API, timeline) | `docs/report/diagrams/generated/` | this tool, from the schema, the access matrix and Git |
| The diagrams (PNG for Word, SVG for Figma or Canva) | `docs/report/figures/` | this tool |
| The figures list and its PDF | `docs/report-figures.md`, `docs/report/PCa-mHealth-report-figures.pdf` | you; this tool |

## What you need

- **Python 3.10 or newer** (`py --version`). The first run makes a Python environment in `docs/report/tools/.venv` and installs three packages from `requirements.txt` (Markdown, Pygments, Pillow). That needs the internet once.
- **Node 22 or newer** (`node --version`), which the backend needs anyway.
- **Google Chrome or Microsoft Edge.** It runs without a window. If neither is found, set its path first: `$env:CHROME = "C:\path\to\chrome.exe"`.
- **Java 17 or newer** (`java -version`) for the diagrams. The first `diagrams` run downloads PlantUML and, on Windows, a portable Graphviz into `docs/report/tools/.cache`, and checks their SHA-256 sums (`contents.py`). Nothing is installed in Windows.
- For some steps, more (see the table of steps below).

## How to run it

In PowerShell, from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File docs\report\tools\report.ps1 <step> <step> ...
```

**Which steps to run:**

| What changed | Run |
|---|---|
| Only the text of the manual | `pdf html` |
| Code that a code picture shows (`check` tells you which) | `code images pdf html` |
| You want a new code picture | add it to `contents.py`, put `report/img/code-<name>.png` into the manual the way the other pictures are put in, then `code images pdf html` |
| The look of the app | `app images pdf html` |
| The look of the admin website | `admin images pdf html` |
| A diagram (`.puml`), the database schema, a route or a permission | `diagrams figures` |
| Only the text of the figures list | `figures` |
| Everything, for example before handing in | start the system (`dev-up.ps1`), run `all` (about 10 minutes), then retake the two emulator pictures (below) and run `images pdf html figures` |

**The steps:**

| Step | What it does | What it needs |
|---|---|---|
| `terminals` | runs the commands of the five terminal pictures (health checks, `psql`, `prisma migrate status`, `docker compose ps`, the backend quality gate) and photographs their real output | the system running (`dev-up.ps1`); takes a few minutes because of the gate |
| `code` | cuts the code excerpts listed in `contents.py` from the files, colours them and photographs them | Chrome |
| `admin` | photographs the backend's API explorer, then the admin website's dashboard, Users list and delete dialog | the backend on `localhost:3000` and the admin website on `localhost:5173` |
| `app` | draws eight phone screens with the app's own code | Flutter, the AI service's `.venv`, the built backend (`npx nest build`) |
| `diagrams` | writes the generated diagram sources (database diagrams from `schema.prisma`, the API map from `docs/access-matrix.md`, the timeline from Git), then draws every `.puml` into `docs/report/figures` as PNG and SVG | Java |
| `phone NAME` | saves what the emulator or phone shows now, as `NAME` | the emulator running, or a phone connected (`adb devices`) |
| `images` | shrinks the new pictures into `docs/report/img` | — |
| `pdf` | makes the manual's PDF, with page numbers | Chrome |
| `html` | makes the manual's web page | — |
| `figures` | makes the figures PDF from `docs/report-figures.md`; wide diagrams get landscape pages | Chrome |
| `all` | `terminals code admin app diagrams images pdf html figures`, in that order | all of the above |
| `check` | says which code pictures and diagrams are out of date, and whether the PDFs and the web page are older than their text | only Python |

Each step stops with a plain message when something it needs is missing (see the last section).

### The two emulator pictures

`app-home-device` and `app-article-device` are screenshots of the real app on the emulator, so they are taken by hand:

1. Start the emulator and the app (manual, section 10.2) and sign in as the synthetic patient.
2. On the patient home screen: `report.ps1 phone app-home-device`
3. Open **Learn**, then an article, then **Listen**: `report.ps1 phone app-article-device`
4. `report.ps1 images pdf html`

## Is the manual up to date?

```powershell
powershell -ExecutionPolicy Bypass -File docs\report\tools\report.ps1 check
```

It compares each code picture with the code (the same lines, and the same text in them) and the PDF and web page with the manual. The quality gate's `docs` target runs it as well. It only **warns**: code that has moved on is not a fault in the code, but the pictures should be retaken before the manual is handed to anyone.

## Before you commit

1. Look at the new pictures in `docs/report/img` (in Explorer, *Extra large icons*).
2. Open the PDF and the web page and page through them.
3. Commit the pictures, the PDF, the web page and `docs/report/tools/state.json` together. `state.json` records what each code picture showed, for `check`.

## Where the content of the pictures comes from

| Pictures | Content |
|---|---|
| Code (`code-…`) | the project's files, cut where `contents.py` says, with their real line numbers |
| Terminal (`term-…`) | the real output of the commands, on this PC, when the step ran. The tool refuses to use output that contains a value from `.env` |
| Admin website (`admin-…`) | the real website. The browser answers its calls to the API with synthetic data from `shoot-admin.mjs`, so no real account appears; the dashboard's numbers are made up for the picture |
| Phone screens drawn by the app (`app-…`) | the app's real code and fonts with synthetic data. The chat answer is the AI service's real answer to the question in `contents.py`, and the casual replies are the backend's real small-talk replies. In the voice picture, a stand-in plays the part of the phone's speech service |
| Emulator (`app-…-device`) | screenshots of the real app on the emulator |
| API explorer (`web-api-explorer`) | the running backend's own description of its API (no data) |
| Diagrams (`docs/report/figures`) | drawn by hand in `docs/report/diagrams` from the code (each one names the files it shows), or generated: the database diagrams from `schema.prisma`, the API map from `docs/access-matrix.md` and the AI contract, the actual timeline from `git log` |

## Editing a diagram

The diagrams are written in PlantUML, a plain-text language for UML: `actor`, `usecase`, `class`, `participant`, `->` for a message, and so on (manual: https://plantuml.com). Open a `.puml` file in `docs/report/diagrams` in any editor, change it, and run `report.ps1 diagrams figures`. `style.iuml` holds the colours and fonts of all of them. Do not edit the files in `generated/`: they are rewritten from the code each time. To add a diagram, make a new `.puml` whose first line is `@startuml <file name>`, and add it to `docs/report-figures.md`.

To restyle a diagram in **Figma** or **Canva**, import its `.svg` from `docs/report/figures`: every box, line and label stays editable.

## The files

| File | What it is |
|---|---|
| `report.ps1` | the way to start it: sets up `.venv`, then runs `report.py` |
| `report.py` | the steps |
| `contents.py` | **what the pictures show**: the code excerpts, the terminal commands, the phone screens, the database diagram parts, the API groups, the pinned PlantUML and Graphviz. Edit this one |
| `diagrams.py` | writes the generated diagram sources (database, API, timeline) |
| `templates/` | the look: the code windows, the PDFs (`print.css`, `print-cover.html`, `figures-cover.html`) and the web page (`web.css`, `web-page.html`) |
| `chrome.mjs` | starts Chrome without a window and drives it |
| `shoot-pages.mjs`, `shoot-admin.mjs`, `print-pdf.mjs` | the photographs and the PDFs |
| `state.json` | what the last run made (for `check`) |
| `work/`, `.cache/` | pages and raw screenshots made on the way, and the downloaded drawing tools; not in Git, and safe to delete |
| `1-presentation-layer/mobile-app/tool/report/app_screens_test.dart` | draws the phone screens (step `app`) |

## When something goes wrong

| Message | What to do |
|---|---|
| *Chrome or Edge was not found* | install Google Chrome, or set `$env:CHROME` to the browser's `.exe` file |
| *no line matches '…', so the picture code-… cannot be made* | the code changed so much that the excerpt's first line is gone. Open `contents.py` and give that entry a new `start` |
| *"curl.exe …" failed* or *"npx prisma migrate status" failed* | the system is not running: `dev-up.ps1` |
| *The admin website is not running* | `dev-up.ps1` (it starts the admin website) |
| *The built backend is missing or older than its code* | `cd 3-application-logic\backend; npx nest build` |
| *… contains a value from .env, so it was not used* | a command printed a password or key. Nothing was saved. Find out why before going on (for example, a `.env` value with a `$` that is not in single quotes) |
| *adb could not take a screenshot* | start the emulator, or connect the phone. With more than one device: `$env:ANDROID_SERIAL = "emulator-5554"` |
| *pip could not install the packages* | the first run needs the internet |
| *… no longer gets a small-talk reply* | the backend's small talk changed: pick other messages for `CASUAL` in `contents.py` |
| *PlantUML found errors in the diagrams above* | the message names the file and line. In activity diagrams a `;` ends a step, so do not use one inside a step's text |
| *API route …: add '…' to API_GROUPS* | a new kind of route was added: put its first path segment in a group in `contents.py` |
| *java was not found* | install Java 17 or newer (for example Eclipse Temurin), or set `JAVA_HOME` |
