#!/usr/bin/env bash
set -euo pipefail
lang="${1:-nl}"
from="${2:-0}"
to="${3:-9}"
BASE="static/pages/$lang"
mkdir -p "$BASE"
for i in $(seq -w $(printf "%04d" "$from") $(printf "%04d" "$to")); do
  f="$BASE/$i.srt"
  [ -f "$f" ] || cat > "$f" <<EOF
1
00:00:00,000 --> 00:00:03,000
[$lang] PAGE $i — MVP placeholder
EOF
done
echo "Genereerd: $BASE/{$(printf "%04d" "$from")}..$(printf "%04d" "$to")).srt"
