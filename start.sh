#!/usr/bin/env bash
set -euo pipefail
sudo rm -f /etc/nginx/.OFFLINE
echo "[STAR] .OFFLINE uit"
sudo nginx -t && sudo systemctl reload nginx
