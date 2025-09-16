#!/usr/bin/env bash
set -euo pipefail
: "${THE101_URI:?THE101_URI niet gezet (exporteer hem of zet /etc/default/the101game)}"
if command -v mongosh >/dev/null 2>&1; then MS=(mongosh --quiet "$THE101_URI"); else MS=(mongo --quiet "$THE101_URI"); fi
if "${MS[@]}" --eval 'db.runCommand({ping:1}).ok ? print("ok") : print("no")' | grep -q ok; then
  echo "✅ Mongo verbonden"
else
  echo "❌ Mongo niet bereikbaar" && exit 1
fi
