#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
echo "[offline] repo: $ROOT_DIR"

# backup huidige landing page
if [ -f static/index.html ]; then
  cp -a static/index.html "static/index.html.bak-$STAMP"
  echo "[offline] backup -> static/index.html.bak-$STAMP"
fi

# simpele onderhoudspagina
cat > static/index.html <<'HTML'
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="favicon.svg">
  <link rel="stylesheet" href="css/mvp.css">
  <title>the101game — onderhoud</title>
</head>
<body>
  <main>
    <h1>Onderhoud</h1>
    <p>the101game is tijdelijk offline voor onderhoud.</p>
    <p>Probeer het later opnieuw. Dank!</p>
  </main>
  <footer><small>&copy; the101game</small></footer>
</body>
</html>
HTML

chmod 644 static/index.html

# stop eventuele runtimes (zacht proberen)
pkill -f "server.js" >/dev/null 2>&1 || true
pkill -f "app.py"    >/dev/null 2>&1 || true

# markeer offline
touch .OFFLINE

echo "[offline] klaar."
