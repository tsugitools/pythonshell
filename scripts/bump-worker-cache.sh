#!/usr/bin/env bash
# Bump the integer cache-bust query on the Pyodide worker URL in index.html.
# Run after editing worker/pyodide-worker.js. Does not run on page load.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INDEX="$ROOT/index.html"

if [[ ! -f "$INDEX" ]]; then
  echo "missing $INDEX" >&2
  exit 1
fi

python3 - "$INDEX" <<'PY'
import pathlib, re, sys

index_path = pathlib.Path(sys.argv[1])
text = index_path.read_text(encoding="utf-8")

pattern = re.compile(
    r"(workerUrl\s*:\s*)(['\"])"
    r"((?:[^'\"]*)worker/pyodide-worker\.js)"
    r"(?:\?v=(\d+))?"
    r"(\2)"
)

def repl(m):
    prefix, quote, base, ver, _ = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
    n = int(ver) + 1 if ver else 1
    return f"{prefix}{quote}{base}?v={n}{quote}"

new_text, count = pattern.subn(repl, text, count=1)
if count != 1:
    sys.exit(f"could not update workerUrl in {index_path}")

index_path.write_text(new_text, encoding="utf-8")

m = re.search(r"worker/pyodide-worker\.js\?v=(\d+)", new_text)
print(f"worker cache bust -> v={m.group(1) if m else '?'}")
PY
