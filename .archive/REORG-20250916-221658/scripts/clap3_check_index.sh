#!/usr/bin/env bash
set -euo pipefail
: "${THE101_URI:?THE101_URI niet gezet}"
if command -v mongosh >/dev/null 2>&1; then MS=(mongosh --quiet "$THE101_URI"); else MS=(mongo --quiet "$THE101_URI"); fi
if "${MS[@]}" --eval 'db.aliases.getIndexes().forEach(i=>{ if(i.name==="alias_unique") print("HIT") })' | grep -q HIT; then
  echo "✅ alias_unique aanwezig"
else
  echo "❌ alias_unique ontbreekt" && exit 1
fi
