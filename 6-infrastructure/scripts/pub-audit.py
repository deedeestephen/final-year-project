"""Checks the mobile app's Dart/Flutter packages (pubspec.lock) for known
vulnerabilities in the OSV database (https://osv.dev), the pub.dev ecosystem's
advisory source. Only package names and versions are sent.

Exit codes: 0 no known vulnerabilities, 1 vulnerabilities found,
3 the OSV service could not be reached (the quality gate then skips).
Usage: python 6-infrastructure/scripts/pub-audit.py [path/to/pubspec.lock]
"""

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LOCK = ROOT / "1-presentation-layer" / "mobile-app" / "pubspec.lock"
LOCK = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_LOCK


def packages(lock_text: str) -> list[dict[str, str]]:
    found: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for line in lock_text.splitlines():
        name = re.match(r"^  ([a-zA-Z0-9_]+):\s*$", line)
        if name:
            current = {"name": name.group(1)}
            continue
        if current is None:
            continue
        source = re.match(r"^    source: (\S+)", line)
        if source:
            current["source"] = source.group(1)
        version = re.match(r'^    version: "?([^"\s]+)"?', line)
        if version:
            current["version"] = version.group(1)
            found.append(current)
            current = None
    return [p for p in found if p.get("source") == "hosted"]


def main() -> int:
    hosted = packages(LOCK.read_text(encoding="utf8"))
    queries = [
        {"package": {"ecosystem": "Pub", "name": p["name"]}, "version": p["version"]}
        for p in hosted
    ]
    body = json.dumps({"queries": queries}).encode()
    request = urllib.request.Request(
        "https://api.osv.dev/v1/querybatch", data=body, headers={"Content-Type": "application/json"}
    )
    try:
        # A fixed https address, never a user-supplied one.
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
            results = json.load(response)["results"]
    except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as err:
        print(f"OSV could not be reached: {err}")
        return 3
    hits = [(p, r.get("vulns", [])) for p, r in zip(hosted, results, strict=True) if r.get("vulns")]
    print(f"{len(hosted)} Dart/Flutter packages checked against OSV.")
    for p, vulns in hits:
        print(f"  {p['name']} {p['version']}: {', '.join(v['id'] for v in vulns)}")
    if not hits:
        print("No known vulnerabilities.")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
