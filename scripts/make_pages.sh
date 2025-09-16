#!/usr/bin/env bash
# Genereer SRT + labs skeletons voor een range
# Gebruik:
#   ./scripts/make_pages.sh nl 0 9
#   ./scripts/make_pages.sh en 0 9
# Voor ALLES (0..5199): pas de range aan naar 0 5199 (duurt even!)

set -euo pipefail
LANG_CODE="${1:-nl}"
START="${2:-0}"
END="${3:-9}"   # inclusief

ROOT="/the101game/static"
PAGES_DIR="$ROOT/pages/$LANG_CODE"
LABS_DIR="$ROOT/labs/$LANG_CODE"

mkdir -p "$PAGES_DIR" "$LABS_DIR"

pad4() { printf "%04d" "$1"; }

for (( i=START; i<=END; i++ )); do
  n="$(pad4 "$i")"

  # SRT template
  srt="$PAGES_DIR/$n.srt"
  if [[ ! -f "$srt" ]]; then
    cat > "$srt" <<SRT
1
00:00:00,000 --> 00:00:01,000
${LANG_CODE^^} · PAGE $n / 5200

2
00:00:01,000 --> 00:00:02,000
Titel van les $n

3
00:00:02,000 --> 00:00:04,000
Je kunt deze SRT aanpassen om de tekst/steps van de les te sturen.

4
00:00:04,000 --> 00:00:06,000
Links zie je code, rechts de uitvoering (als er een lab-bestand bestaat).

SRT
    echo "made $srt"
  fi

  # Labs placeholders (maak 1 van de 2; kies wat je wil gebruiken)
  js="$LABS_DIR/$n.js"
  html="$LABS_DIR/$n.html"

  if [[ ! -f "$js" ]]; then
    cat > "$js" <<'JS'
document.body.style.margin="0";
const d=document.createElement('div');
d.style.cssText="padding:14px;color:#e9eef2;font-family:system-ui;background:#141a22;min-height:100vh";
d.innerHTML="<h2>JS Lab</h2><p>Pas <code>.js</code> aan om de uitvoering rechts te veranderen.</p>";
document.body.appendChild(d);
JS
    echo "made $js"
  fi

  if [[ ! -f "$html" ]]; then
    cat > "$html" <<'HTML'
<!doctype html><meta charset="utf-8">
<title>HTML Lab</title>
<style>body{margin:0;background:#141a22;color:#e9eef2;font-family:system-ui;padding:14px}</style>
<h2>HTML Lab</h2>
<p>Pas <code>.html</code> aan om de uitvoering rechts te veranderen.</p>
HTML
    echo "made $html"
  fi
done

echo "Done. Pages in $PAGES_DIR, labs in $LABS_DIR"

