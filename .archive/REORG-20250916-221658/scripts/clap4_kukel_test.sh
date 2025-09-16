#!/usr/bin/env bash
set -euo pipefail
alias="${1:-lmw}"
curl -s -X POST http://127.0.0.1:8080/api/kukel/click -H 'content-type: application/json' -d "{\"alias\":\"$alias\"}"
echo
