"""What the operations manual shows. Edit this file to add, move or remove a
picture, then run the steps again (README.md says which).

Paths are relative to the project folder.
"""

from typing import NamedTuple

B = "3-application-logic/backend/"
A = "4-ai-intelligence-layer/ai-services/app/"
M = "1-presentation-layer/mobile-app/lib/"
W = "1-presentation-layer/admin-panel-web/src/"

#: Links from the web page to the other documents.
GITHUB_DOCS = "https://github.com/deedeestephen/final-year-project/blob/main/docs/"


class Code(NamedTuple):
    """A code screenshot, saved as docs/report/img/code-<name>.png.

    `start` is a line number, or a regular expression: the excerpt starts at
    the first line that matches it (after the first line that matches `after`,
    when given). `lines` is how many lines are shown; blank lines at the end
    are left out. `language` is a Pygments lexer name.
    """

    name: str
    file: str
    start: int | str
    lines: int
    language: str
    after: str | None = None


CODE = [
    Code("backend-main", B + "src/main.ts", 1, 25, "typescript"),
    Code("backend-guards", B + "src/app.module.ts", r"^  providers: \[", 13, "typescript"),
    Code("backend-permissions-guard", B + "src/gateway/access/permissions.guard.ts", r"async canActivate", 17, "typescript"),
    Code("backend-delete-route", B + "src/services/users/users.controller.ts", r"Only accounts without clinical history", 17, "typescript"),
    Code("backend-delete-service", B + "src/services/users/users.service.ts", r"^  async delete\(", 56, "typescript"),
    # Pygments has no Prisma lexer; TypeScript colours it well enough.
    Code("backend-prisma-user", B + "prisma/schema.prisma", r"^model User \{", 30, "typescript"),
    Code("db-audit-chain", "5-data-persistence/postgresql/migrations/20260923203337_constraints_and_audit/migration.sql",
         r"CREATE OR REPLACE FUNCTION audit_logs_before_insert", 18, "postgresql"),
    Code("db-copy-mongo", B + "tools/copy-mongo.ts", r"for \(const info of collections\)", 38, "typescript"),
    Code("docker-compose", "6-infrastructure/docker/docker-compose.yml", 1, 50, "yaml"),
    Code("dev-up-databases", "6-infrastructure/scripts/dev-up.ps1", r"# The databases installed on this PC", 14, "powershell"),
    Code("env-example", ".env.example", r"^# --- PostgreSQL ---", 21, "ini"),
    Code("chat-safety-rules", B + "src/services/chatbot/chat-safety.ts", r"^export function checkQuestion", 37, "typescript"),
    Code("chat-small-talk", B + "src/services/chatbot/chat-safety.ts", r"name: 'how-are-you'", 30, "typescript"),
    Code("chat-answer-flow", B + "src/services/chatbot/chatbot.service.ts", r"Safety check, then the quoted answer", 58, "typescript"),
    Code("ai-retrieve", A + "chat/retrieve.py", r"^class Retriever", 50, "python"),
    Code("ai-answer", A + "chat/answer.py", r"^def answer\(", 54, "python"),
    Code("ai-claude-instructions", A + "chat/generate.py", r"^SYSTEM: dict", 16, "python"),
    Code("ai-knowledge-base", "4-ai-intelligence-layer/knowledge-base/en/patient-learn.json", 1, 26, "json"),
    Code("app-main", M + "main.dart", r"^Future<void> main\(\)", 15, "dart"),
    Code("app-env", M + "core/config/app_env.dart", 1, 19, "dart"),
    Code("app-chat-controller", M + "features/chat/application/chat_controller.dart", r"^class ChatController", 36, "dart"),
    Code("app-voice", M + "features/chat/application/voice_input.dart", r"^  Future<void> listen\(", 29, "dart",
         after=r"^class PhoneSpeechService"),
    Code("app-read-aloud", M + "shared/audio/read_aloud.dart", r"^class ReadAloudController", 30, "dart"),
    Code("app-bot-painter", M + "shared/widgets/assistant_avatar.dart", r"  void paint\(Canvas canvas, Size size\)", 44, "dart"),
    Code("admin-delete-dialog", W + "pages/UsersPages.tsx", r"\{confirmDelete && \(", 34, "tsx"),
]


class Run(NamedTuple):
    """One command in a terminal screenshot.

    `shown` is the command as the picture shows it (as typed in PowerShell);
    `argv` is how the tool runs it. The first word of `argv` is looked up on
    the PATH and in the usual install folders (report.py, PROGRAMS).
    """

    folder: str
    shown: str
    argv: list[str]
    #: When given, only the output lines that match this regular expression
    #: are shown (the picture says so).
    keep: str | None = None


class Terminal(NamedTuple):
    """A terminal screenshot, saved as docs/report/img/term-<name>.png."""

    name: str
    title: str
    runs: list[Run]


COMPOSE = r"6-infrastructure\docker\docker-compose.yml"

TERMINALS = [
    Terminal("health", "Is everything up?", [
        Run(".", "curl.exe -s http://localhost:3000/api/v1/health",
            ["curl", "-s", "http://localhost:3000/api/v1/health"]),
        Run(".", "curl.exe -s http://127.0.0.1:8000/v1/health",
            ["curl", "-s", "http://127.0.0.1:8000/v1/health"]),
    ]),
    Terminal("tables", "psql: the tables in PostgreSQL 18", [
        Run(".", r'& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U pca -d pca_mhealth -c "\dt"',
            ["psql", "-h", "localhost", "-U", "pca", "-d", "pca_mhealth", "-c", r"\dt"]),
    ]),
    Terminal("migrate", "Prisma: is the database schema up to date?", [
        Run(B.rstrip("/"), "npx prisma migrate status", ["npx", "prisma", "migrate", "status"]),
    ]),
    Terminal("docker", "Docker: what runs in containers", [
        Run(".", f'docker compose -f {COMPOSE} --env-file .env ps --format "table {{{{.Service}}}}\\t{{{{.Status}}}}\\t{{{{.Ports}}}}"',
            ["docker", "compose", "-f", COMPOSE, "--env-file", ".env", "ps",
             "--format", r"table {{.Service}}\t{{.Status}}\t{{.Ports}}"]),
    ]),
    Terminal("gate", "The quality gate for the backend", [
        Run(".", r"powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\quality-gate.ps1 backend",
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
             r"6-infrastructure\scripts\quality-gate.ps1", "backend"],
            keep=r"^(==>|\s+(PASS|FAIL|SKIP):|Tests:|QUALITY GATE)"),
    ]),
]

#: How each kind of picture is stored in docs/report/img, by name prefix:
#: (format, colours for PNG or JPEG quality, largest width in pixels).
IMAGE_KINDS = {
    "code-": ("png", 48, None),
    "term-": ("png", 48, None),
    "admin-": ("png", 128, 1280),
    "app-": ("jpg", 86, 540),
}

#: The phone screens drawn by the app's own code (see
#: 1-presentation-layer/mobile-app/tool/report/app_screens_test.dart).
APP_SCREENS = [
    "app-signin", "app-chat-empty", "app-chat-answer", "app-chat-casual",
    "app-chat-history", "app-chat-recording", "app-learn", "app-clinician",
]

#: The question asked in the "answer" phone screen, and the casual messages
#: in the "casual chat" screen. Their replies come from the real code.
CHAT_QUESTION = "What does a PSA test measure?"
CASUAL = ["Hi, how are you?", "I'm a bit scared about the test", "tell me a joke"]
