#!/usr/bin/env bash
set -euo pipefail
cd ~/the101game

echo "[CLEAN-LITE] start..."

# Virtuele omgeving weghalen
rm -rf myenv

# Logs, backups, tmp
find . -type f -name '*.log' -delete
find . -type f -name '*.tmp' -delete
find . -type f -name '*.bak*' -delete

# Cache dirs
find . -type d -name '__pycache__' -exec rm -rf {} +
find . -type d -name '.pytest_cache' -exec rm -rf {} +

echo "[CLEAN-LITE] klaar."
tree -L 2
