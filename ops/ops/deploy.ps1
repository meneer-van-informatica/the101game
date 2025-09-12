param(
  [string]$Host = 'root@the101game.io',
  [string]$Path = '/var/www/the101game',
  [string]$Pm2  = '101'
)

function Fail { param($m) ; Write-Host $m -ForegroundColor Red ; Read-Host 'enter om te sluiten' | Out-Null ; exit 1 }

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) { Fail 'ssh ontbreekt op windows' }

Write-Host 'step 0 • status first' -ForegroundColor Cyan
Get-Location
try { git status 1>$null 2>$null } catch { Write-Host 'git niet gevonden, ga door...' -ForegroundColor Yellow }

Write-Host 'step 1 • push lokaal (optioneel)' -ForegroundColor Cyan
git push 2>$null

$remote = @'
set -e
cd '$Path'
echo "[server] pwd=$(pwd)"
git rev-parse --is-inside-work-tree >/dev/null
git pull --ff-only
if command -v pm2 >/dev/null 2>&1 && pm2 describe '$Pm2' >/dev/null 2>&1 ; then
  pm2 reload '$Pm2'
  pm2 save
else
  echo "[server] pm2 '$Pm2' niet gevonden, skip reload"
fi
echo "[server] done"
'@

# escape enkelquotes voor bash single-quoted string
$escaped = $remote -replace "'", "'\"'\"'"
Write-Host 'step 2 • ssh remote run' -ForegroundColor Cyan
& ssh $Host "bash -lc '$escaped'"

Write-Host 'step 3 • test url: https://the101game.io/w0l1.html' -ForegroundColor Cyan
Read-Host 'enter om te sluiten' | Out-Null
