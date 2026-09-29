"""Line coverage from an lcov file (quality gate, NFR-07).

Usage: python lcov-check.py <lcov.info> <minimum percent>
Generated code (*.g.dart) is left out: it is written by build tools, not by us.
"""
import sys

path, minimum = sys.argv[1], float(sys.argv[2])
found = hit = 0
current = ''
for line in open(path, encoding='utf8'):
    if line.startswith('SF:'):
        current = line[3:].strip()
    elif current.endswith('.g.dart'):
        continue
    elif line.startswith('LF:'):
        found += int(line[3:])
    elif line.startswith('LH:'):
        hit += int(line[3:])
percent = 100 * hit / found if found else 0
print(f'line coverage {percent:.1f}% ({hit}/{found} lines), minimum {minimum:.0f}%')
sys.exit(0 if percent >= minimum else 1)
