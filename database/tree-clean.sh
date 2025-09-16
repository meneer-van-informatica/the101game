#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$PWD}"
OUT="${2:-$ROOT/CLEAN_TREE.txt}"

cd "$ROOT"

IGNORE='node_modules|.git|dist|coverage|tmp|\.cache|\.next|\.parcel-cache|\.turbo|\.vscode|\.idea|*.map|*.log|logs'

if command -v tree >/dev/null 2>&1; then
  tree -a --dirsfirst -L 4 --filelimit 100 \
    -I "$IGNORE" \
    > "$OUT"
else
  echo "[i] 'tree' ontbreekt; toon een platte lijst (apt install tree voor mooi overzicht)" >&2
  # simpele fallback zonder node_modules e.d.
  find . \
    -path './node_modules' -prune -o \
    -path './.git' -prune -o \
    -path './dist' -prune -o \
    -path './coverage' -prune -o \
    -path './tmp' -prune -o \
    -path './.cache' -prune -o \
    -print | sort \
    > "$OUT"
fi

echo "✓ Schone tree geschreven naar: $OUT"
