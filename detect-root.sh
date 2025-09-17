#!/usr/bin/env bash
set -euo pipefail
LIVE_HASH="$(curl -fsSL https://the101game.io/ | sha256sum | awk '{print $1}')"
mapfile -t ROOTS < <(nginx -T 2>/dev/null | awk '/^\s*root\s+[^;]+;/{gsub(/;/,"",$2); print $2}' | sort -u)
for R in "${ROOTS[@]}"; do
  [ -f "$R/index.html" ] || continue
  H="$(sha256sum "$R/index.html" | awk '{print $1}')"
  if [ "$H" = "$LIVE_HASH" ]; then
    echo "$R"
    exit 0
  fi
done
exit 1
