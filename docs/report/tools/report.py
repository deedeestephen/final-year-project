"""Rebuilds the operations manual's pictures, its PDF and its web page, and
the diagrams and figures for the final-year report.

    report.ps1 <step> [<step> ...]     sets up the Python packages, then runs this
    python report.py check             needs nothing but Python

Steps, in the order "all" runs them:
  terminals    run the commands of the terminal pictures and photograph the output
  code         photograph the code excerpts listed in contents.py
  admin        photograph the admin website and the API explorer (both running)
  app          draw the phone screens with the app's own code (flutter test)
  diagrams     draw docs/report/diagrams/*.puml (UML, data flow, database, API)
               into docs/report/figures, with PlantUML and Graphviz
  images       shrink the new pictures into docs/report/img
  pdf          docs/report/PCa-mHealth-operations-manual.pdf
  html         docs/report/operations-manual.html
  figures      docs/report/PCa-mHealth-report-figures.pdf (docs/report-figures.md)
Other steps:
  phone NAME   save what the connected phone or emulator shows, as NAME
  check        which pictures and diagrams are out of date, and whether the
               PDFs and the web page are older than their text

README.md explains each step and what it needs.
"""

import datetime
import glob
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import contents as C  # noqa: E402

ROOT = HERE.parents[2]
DOCS = ROOT / "docs"
MANUAL = DOCS / "operations-manual.md"
REPORT = DOCS / "report"
IMG = REPORT / "img"
PDF = REPORT / "PCa-mHealth-operations-manual.pdf"
WEB = REPORT / "operations-manual.html"
STATE = HERE / "state.json"
TEMPLATES = HERE / "templates"
WORK = HERE / "work"
RAW = WORK / "raw"
CACHE = HERE / ".cache"
DIAGRAMS = REPORT / "diagrams"
FIGURES = REPORT / "figures"
FIGURES_MD = DOCS / "report-figures.md"
FIGURES_PDF = REPORT / "PCa-mHealth-report-figures.pdf"
BACKEND = ROOT / "3-application-logic" / "backend"
AI = ROOT / "4-ai-intelligence-layer" / "ai-services"
MOBILE = ROOT / "1-presentation-layer" / "mobile-app"
APP_OUT = MOBILE / "tool" / "report" / "out"
SELF = r"powershell -ExecutionPolicy Bypass -File docs\report\tools\report.ps1"

#: Where a program is looked for when it is not on the PATH.
PROGRAMS = {
    "psql": ["C:/Program Files/PostgreSQL/*/bin/psql.exe"],
    "docker": ["C:/Program Files/Docker/Docker/resources/bin/docker.exe"],
    "adb": [os.environ.get("LOCALAPPDATA", "") + "/Android/Sdk/platform-tools/adb.exe"],
    "flutter": ["C:/flutter/bin/flutter.bat"],
    "java": [os.environ.get("JAVA_HOME", "") + "/bin/java.exe", "C:/Program Files/Eclipse Adoptium/*/bin/java.exe"],
}


class Stop(Exception):
    """A step cannot go on; the message says what to do."""


# --- small helpers -----------------------------------------------------------


def program(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    for pattern in PROGRAMS.get(name, []):
        # The newest version first (PostgreSQL 18 before 9.6).
        matches = sorted(glob.glob(pattern), key=lambda p: [int(n) for n in re.findall(r"\d+", p)])
        if matches:
            return matches[-1]
    raise Stop(f"{name} was not found. Install it, or add its folder to the PATH.")


def run(argv: list[str], what: str, cwd: Path | None = None) -> None:
    """Runs a command with its output shown as it comes."""
    done = subprocess.run(argv, cwd=cwd)
    if done.returncode != 0:
        raise Stop(f"{what} failed (exit code {done.returncode}). Its messages are above.")


def node(script: str, *args: str) -> None:
    run([program("node"), str(HERE / script), *args], f"node {script}")


def git(*args: str) -> str:
    done = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    return done.stdout.strip() if done.returncode == 0 else ""


def digest(text: str) -> str:
    return hashlib.sha256(text.replace("\r\n", "\n").encode("utf8")).hexdigest()[:16]


def today() -> str:
    return datetime.date.today().isoformat()


def long_date(iso: str) -> str:
    d = datetime.date.fromisoformat(iso)
    return f"{d.day} {d:%B %Y}"


def load_state() -> dict:
    return json.loads(STATE.read_text(encoding="utf8")) if STATE.exists() else {}


def save_state(state: dict) -> None:
    STATE.write_text(json.dumps(state, indent=1, ensure_ascii=False) + "\n", encoding="utf8", newline="\n")


def code_version(state: dict) -> str:
    """Which code the pictures show, for the cover: "commit 1a2b3c4"."""
    code = state.get("code")
    if not code:
        return "unknown"
    text = f"commit {code['commit']}"
    return text + " with uncommitted changes" if code.get("uncommitted") else text


def env_file() -> dict[str, str]:
    """The settings in .env (never printed)."""
    values: dict[str, str] = {}
    path = ROOT / ".env"
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf8").splitlines():
        m = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if not m:
            continue
        value = m.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        values[m.group(1)] = value
    return values


def secret_values(env: dict[str, str]) -> list[str]:
    """Values from .env that must never appear in a picture."""
    found = []
    for key, value in env.items():
        url = urlsplit(value) if "://" in value else None
        if url and url.password:
            found += [url.password, unquote(url.password)]
        elif re.search(r"PASSWORD|SECRET|PRIVATE|TOKEN|KEY", key) and len(value) >= 8:
            found.append(value)
    return [s for s in found if len(s) >= 6]


def window(title: str, note: str, inner: str) -> str:
    """A page with one dark "window", photographed by shoot-pages.mjs."""
    css = (TEMPLATES / "code-window.css").read_text(encoding="utf8")
    dots = "".join(f'<span class="dot" style="background:{c}"></span>' for c in ("#ff5f57", "#febc2e", "#28c840"))
    bar = f'<div class="bar">{dots}<span class="path">{html.escape(title)}</span><span class="note">{note}</span></div>'
    return f'<!doctype html><meta charset="utf-8"><style>{css}</style><body><div class="win">{bar}{inner}</div></body>'


def photograph(pages: dict[str, str]) -> None:
    folder = WORK / "pages"
    folder.mkdir(parents=True, exist_ok=True)
    for name, page in pages.items():
        (folder / f"{name}.html").write_text(page, encoding="utf8")
    node("shoot-pages.mjs", str(folder), str(RAW), *pages)


def find_line(lines: list[str], pattern: str, begin: int, code: C.Code) -> int:
    for i in range(begin, len(lines)):
        if re.search(pattern, lines[i]):
            return i
    raise Stop(
        f"{code.file}: no line matches {pattern!r}, so the picture code-{code.name} cannot be made. "
        "The code has changed: update this entry in contents.py."
    )


def cut(code: C.Code) -> tuple[int, list[str]]:
    """The excerpt of a code picture: its first line number and its lines."""
    path = ROOT / code.file
    if not path.exists():
        raise Stop(f"{code.file} no longer exists (picture code-{code.name}): update contents.py.")
    lines = path.read_text(encoding="utf8").replace("\r\n", "\n").split("\n")
    if isinstance(code.start, int):
        first = code.start - 1
    else:
        begin = find_line(lines, code.after, 0, code) if code.after else 0
        first = find_line(lines, code.start, begin, code)
    chunk = lines[first : first + code.lines]
    while chunk and not chunk[-1].strip():
        chunk.pop()
    return first + 1, chunk


def manual_body(markdown_text: str) -> str:
    import markdown

    return markdown.markdown(markdown_text, extensions=["tables", "fenced_code", "toc", "sane_lists"])


# --- the steps ---------------------------------------------------------------


def step_terminals() -> None:
    env = env_file()
    hidden = secret_values(env)
    child_env = dict(os.environ)
    database = urlsplit(env.get("DATABASE_URL", ""))
    if database.password:
        # psql reads its password from here, so it is never typed or shown.
        child_env["PGPASSWORD"] = unquote(database.password)
    pages = {}
    for terminal in C.TERMINALS:
        shown = []
        for step in terminal.runs:
            print(f"  {step.shown}")
            argv = [program(step.argv[0]), *step.argv[1:]]
            done = subprocess.run(
                argv, cwd=ROOT / step.folder, env=child_env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf8", errors="replace", timeout=1200,
            )
            out = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", done.stdout).rstrip()
            if any(s in out for s in hidden):
                raise Stop(f'The output of "{step.shown}" contains a value from .env, so it was not used.')
            if done.returncode != 0:
                print("\n".join(out.splitlines()[-15:]))
                raise Stop(f'"{step.shown}" failed (exit code {done.returncode}). Is everything running (dev-up.ps1)?')
            lines = out.splitlines()
            if step.keep:
                lines = ["(only the summary lines are shown)"] + [line for line in lines if re.search(step.keep, line)]
            folder = ROOT if step.folder == "." else ROOT / step.folder
            prompt = f'<span class="prompt">PS {html.escape(str(folder))}&gt;</span> '
            shown.append(prompt + f'<span class="cmd">{html.escape(step.shown)}</span>\n' + html.escape("\n".join(lines)))
        pages[f"term-{terminal.name}"] = window(terminal.title, "", '<div class="term">' + "\n\n".join(shown) + "</div>")
    photograph(pages)


def step_code() -> None:
    from pygments import highlight
    from pygments.formatters import HtmlFormatter
    from pygments.lexers import get_lexer_by_name

    formatter = HtmlFormatter(nowrap=True, noclasses=True, style="github-dark")
    pages, shots = {}, {}
    for code in C.CODE:
        first, chunk = cut(code)
        marked = highlight("\n".join(chunk), get_lexer_by_name(code.language, stripnl=False), formatter).split("\n")
        rows = "".join(
            f'<tr><td class="n">{first + i}</td><td class="c">{line or " "}</td></tr>'
            for i, line in enumerate(marked[: len(chunk)])
        )
        last = first + len(chunk) - 1
        pages[f"code-{code.name}"] = window(code.file, f"lines {first}–{last}", f'<table class="code">{rows}</table>')
        shots[code.name] = {"file": code.file, "first": first, "last": last, "sha256": digest("\n".join(chunk))}
    photograph(pages)
    state = load_state()
    state["code"] = {
        "date": today(),
        "commit": git("rev-parse", "--short", "HEAD") or "unknown",
        "uncommitted": bool(git("status", "--porcelain", "--", *sorted({c.file for c in C.CODE}))),
        "shots": shots,
    }
    save_state(state)


def step_admin() -> None:
    node("shoot-admin.mjs", str(RAW))


# The AI service's own answer to the question, without Claude (the default).
ANSWER_PY = """
import json, sys
from app.chat.answer import ChatAnswerRequest, answer
from app.chat.kb import default_knowledge_base
result = answer(default_knowledge_base(), ChatAnswerRequest(question=sys.argv[1], audience="patient"))
print(json.dumps(result.model_dump()))
"""

# The backend's own safety checks, small-talk replies and disclaimer.
BACKEND_JS = """
const s = require(process.argv[1]);
const input = JSON.parse(process.argv[2]);
console.log(JSON.stringify({
  disclaimer: s.DISCLAIMER.patient,
  question: s.checkQuestion(input.question, 'patient').safety,
  answer: s.checkAnswer(input.text, input.sources).ok,
  casual: input.casual.map((q, turn) => ({
    question: q, safety: s.checkQuestion(q, 'patient').safety, reply: s.smallTalk(q, 'patient', turn),
  })),
}));
"""


def step_app() -> None:
    python = next((p for p in (AI / ".venv/Scripts/python.exe", AI / ".venv/bin/python") if p.exists()), None)
    if python is None:
        raise Stop("The AI service has no .venv folder: set it up first (section 8 of the manual).")
    done = subprocess.run([str(python), "-c", ANSWER_PY, C.CHAT_QUESTION], cwd=AI, capture_output=True,
                          text=True, encoding="utf8")
    if done.returncode != 0:
        raise Stop("The AI service's answer could not be made:\n" + done.stderr[-1500:])
    result = json.loads(done.stdout)
    if not result["matched"]:
        raise Stop(f'The knowledge base has no answer to "{C.CHAT_QUESTION}": change CHAT_QUESTION in contents.py.')

    safety = BACKEND / "dist" / "services" / "chatbot" / "chat-safety.js"
    source = BACKEND / "src" / "services" / "chatbot" / "chat-safety.ts"
    if not safety.exists() or source.stat().st_mtime > safety.stat().st_mtime:
        raise Stop(r"The built backend is missing or older than its code: cd 3-application-logic\backend; npx nest build")
    given = {"question": C.CHAT_QUESTION, "text": result["text"], "sources": len(result["sources"]), "casual": C.CASUAL}
    done = subprocess.run([program("node"), "-e", BACKEND_JS, str(safety), json.dumps(given)], capture_output=True,
                          text=True, encoding="utf8")
    if done.returncode != 0:
        raise Stop("The backend's replies could not be read:\n" + done.stderr[-1500:])
    backend = json.loads(done.stdout)
    if backend["question"] != "OK" or not backend["answer"]:
        raise Stop(f'The backend would not show the answer to "{C.CHAT_QUESTION}": change CHAT_QUESTION in contents.py.')
    for turn in backend["casual"]:
        if turn["safety"] != "OK" or turn["reply"] is None:
            raise Stop(f'"{turn["question"]}" no longer gets a small-talk reply: change CASUAL in contents.py.')

    APP_OUT.mkdir(parents=True, exist_ok=True)
    chat = {
        "disclaimer": backend["disclaimer"],
        "question": C.CHAT_QUESTION,
        "answer": {
            "text": result["text"],
            "mode": result["mode"],
            "sources": result["sources"],
            "reviewStatus": result["knowledgeBase"]["reviewStatus"],
        },
        "casual": [{"question": t["question"], "reply": t["reply"]} for t in backend["casual"]],
    }
    (APP_OUT / "chat.json").write_text(json.dumps(chat, indent=1, ensure_ascii=False), encoding="utf8")
    run([program("flutter"), "test", "--update-goldens", "tool/report/app_screens_test.dart"],
        "flutter test (the phone screens)", cwd=MOBILE)
    RAW.mkdir(parents=True, exist_ok=True)
    for name in C.APP_SCREENS:
        shutil.copyfile(APP_OUT / f"{name}.png", RAW / f"{name}.png")
        print(f"  {name}.png")


def step_phone(name: str) -> None:
    if not re.fullmatch(r"app-[a-z0-9-]+", name):
        raise Stop("Give the picture a name that starts with app-, for example: phone app-home-device")
    done = subprocess.run([program("adb"), "exec-out", "screencap", "-p"], capture_output=True)
    if done.returncode != 0 or not done.stdout.startswith(b"\x89PNG"):
        message = done.stderr.decode("utf8", "replace").strip() or "no picture came back"
        raise Stop(f"adb could not take a screenshot ({message}). Is the phone or emulator connected (adb devices)?")
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / f"{name}.png").write_bytes(done.stdout)
    print(f"  {name}.png")


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(spec: dict, name: str) -> Path:
    """A pinned download into .cache, used only if its SHA-256 matches."""
    target = CACHE / name
    if target.exists() and file_digest(target) == spec["sha256"]:
        return target
    import urllib.request

    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"  downloading {spec['url']} (once)")
    part = target.with_name(target.name + ".part")
    try:
        urllib.request.urlretrieve(spec["url"], part)
    except OSError as problem:
        raise Stop(f"The download failed ({problem}). Is the internet on?") from problem
    if file_digest(part) != spec["sha256"]:
        part.unlink()
        raise Stop(f"{name} does not have the expected checksum, so it was not used.")
    part.replace(target)
    return target


def graphviz_dot() -> str:
    """Graphviz's dot: on the PATH, or a pinned portable copy on Windows."""
    found = shutil.which("dot")
    if found:
        return found
    if os.name != "nt":
        raise Stop("Graphviz is needed for the diagrams: install it (for example: sudo apt install graphviz).")
    version = C.GRAPHVIZ_WINDOWS["version"]
    archive = download(C.GRAPHVIZ_WINDOWS, f"graphviz-{version}.zip")
    folder = CACHE / f"graphviz-{version}"
    if not folder.exists():
        import zipfile

        with zipfile.ZipFile(archive) as z:
            z.extractall(folder)
    return str(next(folder.rglob("dot.exe")))


def diagram_sources() -> list[Path]:
    return sorted(DIAGRAMS.glob("*.puml")) + sorted((DIAGRAMS / "generated").glob("*.puml"))


def step_diagrams() -> None:
    import diagrams as D

    made = D.generate(ROOT, DIAGRAMS / "generated")
    print(f"  generated: {', '.join(made)}")
    sources = diagram_sources()
    for source in sources:
        first = source.read_text(encoding="utf8").split("\n", 1)[0]
        if first.split()[-1] != source.stem:
            raise Stop(f"{source.name}: its first line must be '@startuml {source.stem}' (the picture takes that name).")
    jar = download(C.PLANTUML, f"plantuml-{C.PLANTUML['version']}.jar")
    env = dict(os.environ, GRAPHVIZ_DOT=graphviz_dot(), PLANTUML_LIMIT_SIZE="8192")
    FIGURES.mkdir(parents=True, exist_ok=True)
    for fmt in ("svg", "png"):
        done = subprocess.run(
            [program("java"), "-jar", str(jar), "-charset", "UTF-8", f"-t{fmt}", "-o", str(FIGURES),
             *(str(s) for s in sources)],
            env=env, capture_output=True, text=True, encoding="utf8", errors="replace",
        )
        if done.returncode != 0:
            print(done.stdout + done.stderr)
            raise Stop("PlantUML found errors in the diagrams above (the line numbers say where).")
    names = {s.stem for s in sources}
    for old in FIGURES.iterdir():
        if old.stem not in names:
            old.unlink()
    from PIL import Image

    for png in sorted(FIGURES.glob("*.png")):
        # Few colours keep lines and text sharp and the files small.
        im = Image.open(png).convert("RGB")
        im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(png, optimize=True)
        print(f"  {png.name}: {im.width} x {im.height}, {round(png.stat().st_size / 1024)} KB")
    state = load_state()
    state["diagrams"] = {
        "date": today(),
        "sources": {s.relative_to(ROOT).as_posix(): digest(s.read_text(encoding="utf8")) for s in DIAGRAMS.glob("*.puml")},
        "inputs": {p: digest((ROOT / p).read_text(encoding="utf8")) for p in D.INPUTS},
    }
    save_state(state)


def step_images() -> None:
    from PIL import Image

    files = sorted(RAW.glob("*.png"))
    if not files:
        raise Stop("There are no new pictures. Run terminals, code, admin, app or phone first.")
    used = set(re.findall(r"report/img/([\w.-]+)", MANUAL.read_text(encoding="utf8")))
    IMG.mkdir(parents=True, exist_ok=True)
    for f in files:
        kind = next((k for prefix, k in C.IMAGE_KINDS.items() if f.stem.startswith(prefix)), None)
        if kind is None:
            print(f"  skipped {f.name}: its name does not start with " + ", ".join(C.IMAGE_KINDS))
            continue
        fmt, amount, width = kind
        im = Image.open(f).convert("RGB")
        if width and im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        out = IMG / f"{f.stem}.{fmt}"
        if fmt == "png":
            # Few colours: screenshots of text stay sharp and small.
            im.quantize(colors=amount, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out, optimize=True)
        else:
            im.save(out, quality=amount, optimize=True, progressive=True)
        note = "" if out.name in used else "   (not used in the manual)"
        print(f"  {out.name}: {round(out.stat().st_size / 1024)} KB{note}")


def landscape_sections(body: str) -> str:
    """Keeps each figure with its heading and text on one page, and puts wide
    diagrams on a landscape page."""
    from PIL import Image

    parts = re.split(r"(?=<h[234])", body)
    for i, part in enumerate(parts):
        if "<img" not in part:
            continue
        kind = "figure"
        m = re.search(r'<img[^>]+src="report/figures/([^"]+\.png)"', part)
        if m and (FIGURES / m.group(1)).exists():
            with Image.open(FIGURES / m.group(1)) as im:
                if im.width / im.height > 1.25:
                    kind = "landscape"
        parts[i] = f'<section class="{kind}">{part}</section>'
    return "".join(parts)


def print_document(markdown_text: str, cover: str, title: str, footer: str, pdf: Path, transform=None) -> None:
    """Markdown → print page (images relative to docs/) → A4 PDF."""
    body = manual_body(markdown_text)
    body = re.sub(r"^<h1[^>]*>.*?</h1>", "", body, count=1, flags=re.S)
    if transform:
        body = transform(body)
    css = (TEMPLATES / "print.css").read_text(encoding="utf8")
    page = (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{html.escape(title)}</title>'
        f'<base href="{DOCS.as_uri()}/"><style>{css}</style></head><body>{cover}{body}</body></html>'
    )
    WORK.mkdir(parents=True, exist_ok=True)
    page_file = WORK / f"{pdf.stem}.html"
    page_file.write_text(page, encoding="utf8")
    node("print-pdf.mjs", str(page_file), str(pdf), footer)
    print(f"  {pdf.relative_to(ROOT)}: {round(pdf.stat().st_size / 1024)} KB")


def step_pdf() -> None:
    state = load_state()
    text = MANUAL.read_text(encoding="utf8")
    cover = (TEMPLATES / "print-cover.html").read_text(encoding="utf8")
    cover = cover.replace("{{date}}", long_date(today())).replace("{{code}}", code_version(state))
    # The PDF does not point to itself.
    print_document(re.sub(r"\nA PDF of this manual is in .*\n", "\n", text), cover,
                   "PCa mHealth operations manual", "PCa mHealth operations manual", PDF)
    state["pdf"] = {"date": today(), "manual": digest(text)}
    save_state(state)


def step_figures() -> None:
    """The figures for the final-year report, with their captions, as a PDF."""
    state = load_state()
    text = FIGURES_MD.read_text(encoding="utf8")
    cover = (TEMPLATES / "figures-cover.html").read_text(encoding="utf8")
    cover = cover.replace("{{date}}", long_date(today())).replace("{{code}}", code_version(state))
    print_document(re.sub(r"\nA PDF of these figures is in .*\n", "\n", text), cover,
                   "PCa mHealth report figures", "PCa mHealth: figures for the report", FIGURES_PDF,
                   transform=landscape_sections)
    state["figures"] = {"date": today(), "document": digest(text)}
    save_state(state)


def step_html() -> None:
    state = load_state()
    text = MANUAL.read_text(encoding="utf8")
    body = manual_body(re.sub(
        r"\nA PDF of this manual is in .*\n",
        "\nThe same manual is in the project as `docs/operations-manual.md`, and as a PDF in `docs/report/`.\n",
        text,
    ))
    # The header and the contents rail replace the title, the intro and the contents list.
    body = re.sub(r"^<h1[^>]*>.*?</h1>", "", body, count=1, flags=re.S)
    body = re.sub(r"<p><strong>Contents</strong></p>\s*<ol>.*?</ol>", "", body, count=1, flags=re.S)
    body = re.sub(r"^\s*<p>This manual explains.*?</p>\s*<ul>.*?</ul>\s*<hr />", "", body, count=1, flags=re.S)
    sections = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body)

    def image(m: re.Match) -> str:
        name = m.group(2).rsplit("/", 1)[-1]
        kind = "phone" if name.startswith("app-") else "web" if name.startswith("admin-") else "shot"
        return f'<img class="{kind}" loading="lazy" decoding="async" alt="{m.group(1)}" src="img/{name}" />'

    body = re.sub(r'<img alt="([^"]*)" src="([^"]+)" />', image, body)

    def phones(m: re.Match) -> str:
        table = m.group(0)
        if 'class="phone"' not in table:
            return f'<div class="scroll">{table}</div>'
        captions = re.findall(r"<th>(.*?)</th>", table)
        images = re.findall(r'<img class="phone"[^>]*/>', table)
        figures = "".join(f"<figure>{i}<figcaption>{c}</figcaption></figure>" for i, c in zip(images, captions))
        return f'<div class="phones">{figures}</div>'

    body = re.sub(r"<table>.*?</table>", phones, body, flags=re.S)
    # Two tables of phones in a row become one row of figures.
    body = body.replace('</div>\n<div class="phones">', "")
    body = re.sub(
        r'<pre><code class="language-[a-z]+">(.*?)</code></pre>',
        lambda m: f'<div class="cmd"><button class="copy" type="button">Copy</button><pre><code>{m.group(1)}</code></pre></div>',
        body, flags=re.S,
    )
    body = re.sub(r"<pre><code>(.*?)</code></pre>", r'<div class="cmd plain"><pre><code>\1</code></pre></div>', body, flags=re.S)
    body = re.sub(r'<p>(<img class="(?:shot|web)"[^>]*/>)</p>', r'<figure class="wide">\1</figure>', body)

    def link(m: re.Match) -> str:
        href = m.group(1)
        if href.startswith("#"):
            return m.group(0)
        target = href if href.startswith("http") else C.GITHUB_DOCS + href
        return f'<a href="{target}" target="_blank" rel="noopener">'

    body = re.sub(r'<a href="([^"]+)">', link, body)
    toc = "".join(f'<li><a href="#{sid}">{html.escape(re.sub("<.*?>", "", title))}</a></li>' for sid, title in sections)
    page = (TEMPLATES / "web-page.html").read_text(encoding="utf8")
    page = page.replace("{{css}}", (TEMPLATES / "web.css").read_text(encoding="utf8"))
    page = page.replace("{{date}}", long_date(today())).replace("{{code}}", code_version(state))
    page = page.replace("{{toc}}", toc).replace("{{body}}", body)
    WEB.write_text(page, encoding="utf8", newline="\n")
    print(f"  {WEB.relative_to(ROOT)}: {len(sections)} sections, {round(len(page) / 1024)} KB")
    state["html"] = {"date": today(), "manual": digest(text)}
    save_state(state)


def step_check() -> int:
    """Warns only: a stale picture is not a fault in the code."""
    state = load_state()
    recorded = state.get("code", {}).get("shots", {})
    changed, broken = [], []
    for code in C.CODE:
        try:
            first, chunk = cut(code)
        except Stop as problem:
            broken.append(str(problem))
            continue
        shot = recorded.get(code.name)
        if shot is None or shot["first"] != first or shot["sha256"] != digest("\n".join(chunk)):
            changed.append(f"code-{code.name} ({code.file})")
    manual = digest(MANUAL.read_text(encoding="utf8"))
    behind = [label for key, label in (("pdf", "the PDF"), ("html", "the web page"))
              if state.get(key, {}).get("manual") != manual]

    if not changed and not broken:
        print(f"  OK: the {len(C.CODE)} code pictures match the code.")
    for problem in broken:
        print(f"  WARN: {problem}")
    if changed:
        print(f"  WARN: {len(changed)} code picture(s) show code that has changed since they were taken:")
        for item in changed:
            print(f"        {item}")
        print(f"        To retake them: {SELF} code images pdf html")
    if behind:
        verb, pronoun = ("were", "them") if len(behind) > 1 else ("was", "it")
        print(f"  WARN: {' and '.join(behind)} {verb} made from an older operations-manual.md.")
        print(f"        To remake {pronoun}: {SELF} pdf html")
    else:
        print("  OK: the PDF and the web page match operations-manual.md.")

    import diagrams as D

    made = state.get("diagrams", {})
    redraw = [s.name for s in sorted(DIAGRAMS.glob("*.puml"))
              if made.get("sources", {}).get(s.relative_to(ROOT).as_posix()) != digest(s.read_text(encoding="utf8"))]
    redraw += [f"{p} (database, API or AI contract)" for p in D.INPUTS
               if made.get("inputs", {}).get(p) != digest((ROOT / p).read_text(encoding="utf8"))]
    if redraw:
        print(f"  WARN: {len(redraw)} diagram source(s) changed since the figures were drawn:")
        for item in redraw:
            print(f"        {item}")
        print(f"        To redraw them: {SELF} diagrams figures")
    else:
        print("  OK: the diagrams match their sources.")
    if FIGURES_MD.exists() and state.get("figures", {}).get("document") != digest(FIGURES_MD.read_text(encoding="utf8")):
        print("  WARN: the figures PDF was made from an older report-figures.md.")
        print(f"        To remake it: {SELF} figures")
    return 0


STEPS = {
    "terminals": step_terminals, "code": step_code, "admin": step_admin, "app": step_app,
    "diagrams": step_diagrams, "images": step_images, "pdf": step_pdf, "html": step_html,
    "figures": step_figures,
}


def main(args: list[str]) -> int:
    # Keep this script's lines in order with the output of the programs it runs.
    sys.stdout.reconfigure(line_buffering=True)
    if not args or args[0] in ("-h", "--help", "help"):
        print(__doc__)
        return 0
    if args[0] == "check":
        return step_check()
    if args[0] == "phone":
        if len(args) != 2:
            print("Usage: phone NAME, for example: phone app-home-device")
            return 2
        steps = [("phone", lambda: step_phone(args[1]))]
    else:
        names = list(STEPS) if args == ["all"] else args
        unknown = [n for n in names if n not in STEPS]
        if unknown:
            print(f"Unknown step: {', '.join(unknown)}. The steps are: {', '.join(STEPS)}, all, phone, check.")
            return 2
        steps = [(n, STEPS[n]) for n in names]
    for name, step in steps:
        print(f"\n==> {name}")
        try:
            step()
        except Stop as problem:
            print(f"\nSTOPPED at {name}: {problem}")
            return 1
    print("\nDone. Look at the pictures in docs/report/img before committing them.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
