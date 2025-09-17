#!/usr/bin/env bash
set -euo pipefail

REPO=~/the101game

cd "$REPO"

echo "[CLEAN] verwijder ongewenste bestanden..."

# 1) Git en editor rommel
find . -type f -name '*.orig' -delete
find . -type f -name '*.rej' -delete
find . -type f -name '*~' -delete
find . -type f -name '.*.swp' -delete
find . -type f -name '*.bak*' -delete

# 2) Python/Node caches
find . -type d -name '__pycache__' -prune -exec rm -rf {} +
find . -type d -name '.pytest_cache' -prune -exec rm -rf {} +
find . -type f -name '*.pyc' -delete
find . -type f -name '*.pyo' -delete
find . -type d -name 'node_modules' -prune -exec rm -rf {} +

# 3) Log- en dumpbestanden
find . -type f -name '*.log' -delete
find . -type f -name '*.tmp' -delete

# 4) Backups van HTML/JS
find static -type f -name '*.bak-*' -delete || true

echo "[CLEAN] klaar."
git status --short
