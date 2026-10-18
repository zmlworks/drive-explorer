#!/usr/bin/env bash
# Package the loadable extension (no tests / scripts / git) into a zip.
# Usage: scripts/build-zip.sh [outDir]   (default ../out)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-../out}
python3 - "$OUT" <<'PY'
import json, os, sys, zipfile
out = sys.argv[1]
ver = json.load(open('manifest.json'))['version']
os.makedirs(out, exist_ok=True)
path = os.path.abspath(os.path.join(out, f'drive-explorer-{ver}.zip'))
files = ['manifest.json', 'LICENSE', 'README.md']
for d in ['_locales', 'icons', 'popup', 'src']:
    for root, _, names in os.walk(d):
        files += [os.path.join(root, n) for n in sorted(names)]
with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(files):
        zi = zipfile.ZipInfo(f, date_time=(2026, 10, 18, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        z.writestr(zi, open(f, 'rb').read())
print(path)
PY
