# voeg toe aan je script
$useSudo = $Server -notmatch '^root@'
$S = $useSudo ? 'sudo ' : ''
$remote = @'
set -e
cd '$Path'
'$S'git rev-parse --is-inside-work-tree >/dev/null
'$S'git pull --ff-only
if command -v pm2 >/dev/null 2>&1 && '$S'pm2 describe '$Pm2' >/dev/null 2>&1 ; then
  '$S'pm2 reload '$Pm2'
  '$S'pm2 save
else
  echo '[server] pm2 '$Pm2' niet gevonden, skip reload'
fi
echo '[server] done'
'@


param(
  [string]$Server = 'root@the101game.io',
  [string]$Path   = '/var/www/the101game',
  [string]$Pm2    = '101'
)

function Fail { param($m) ; Write-Host $m -ForegroundColor Red ; Read-Host 'enter om te sluiten' | Out-Null ; exit 1 }

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) { Fail 'ssh ontbreekt op windows' }

Write-Host 'step - status first'
Get-Location

# optional: utf8 netjes maken (ps 5.1)
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch {}

Write-Host 'step - push lokaal (optioneel)'
$push = & git push 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host 'git push faalde:' -ForegroundColor Yellow
  $push | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
  # niet stoppen; we kunnen vaak gewoon door
} else {
  if ($push) { $push | ForEach-Object { Write-Host $_ } } else { Write-Host 'niets te pushen' }
}

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

Write-Host 'step - ssh remote run'
& ssh $Server 'bash' '-lc' $remote

Write-Host 'step - test url: https://the101game.io/w0l1.html'
Read-Host 'enter om te sluiten' | Out-Null
