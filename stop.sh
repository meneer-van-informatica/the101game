#!/usr/bin/env bash
set -euo pipefail
sudo touch /etc/nginx/.OFFLINE
echo "[STOP] .OFFLINE aan"
sudo nginx -t && sudo systemctl reload nginx
