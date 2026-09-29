"""Docs link check (quality gate): every relative link in the repository's
Markdown files must point to a file or folder that exists."""
import os
import re
import sys
from urllib.parse import unquote

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SKIP = {'node_modules', '.git', 'build', '.dart_tool', 'var', 'dist', 'coverage', '.venv', '__pycache__', '.idea', '.gradle'}
LINK = re.compile(r'\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)')
bad = []
checked = 0
for dirpath, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP]
    for f in files:
        if not f.endswith('.md'):
            continue
        path = os.path.join(dirpath, f)
        text = open(path, encoding='utf8', errors='replace').read()
        # Ignore links inside fenced code blocks.
        text = re.sub(r'```.*?```', '', text, flags=re.S)
        for m in LINK.finditer(text):
            target = m.group(1)
            if re.match(r'^[a-z]+:', target) or target.startswith('#') or target.startswith('mailto:'):
                continue
            target = unquote(target.split('#')[0])
            if not target:
                continue
            full = os.path.normpath(os.path.join(dirpath, target))
            checked += 1
            if not os.path.exists(full):
                bad.append((os.path.relpath(path, ROOT), m.group(1)))
print(f'checked {checked} relative links')
for b in bad:
    print('BROKEN', b[0], '->', b[1])
sys.exit(1 if bad else 0)
