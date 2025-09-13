param(
  [Parameter(Mandatory=$true)][string]$Server,              # bv. root@the101game.io of jouwuser@...
  [Parameter(Mandatory=$true)][string]$Path,                # bv. /var/www/the101game
  [string]$Pm2 = '101',
  [string]$Key = "$HOME\.ssh\the101game_ed25519"
)

function Fail { param($m) ; Write-Host $m -ForegroundColor Red ; exit 1 }

if (-not (Test-Path -LiteralPath $Key)) { Fail "Key ontbreekt: $Key" }
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) { Fail 'ssh ontbreekt op Windows' }

# sudo alleen als je niet als root inlogt (PS 5.1: gebruik if/else)
$useSudo = ($Server -notmatch '^root@')
if ($useSudo) { $S = 'sudo ' } else { $S = '' }

Write-Host 'deploy • status'
$null = & git push 2>&1  # stil doorschuiven als er niets te pushen is

# 1) Bouw remote script met variabelen inline
$remoteScript = @"
set -e
cd '$Path'
${S}git rev-parse --is-inside-work-tree >/dev/null
${S}git pull --ff-only
if command -v pm2 >/dev/null 2>&1 && ${S}pm2 describe '$Pm2' >/dev/null 2>&1 ; then ${S}pm2 reload '$Pm2'; ${S}pm2 save; else echo '[server] pm2 skip'; fi
echo '[server] done'
"@

# 2) Maak er 1 nette bash-regel van (zonder lege stukken)
$remoteOneLine = ($remoteScript -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }) -join '; '

Write-Host 'deploy • ssh run'
& ssh -i $Key -o StrictHostKeyChecking=accept-new $Server 'bash' '-lc' $remoteOneLine
if ($LASTEXITCODE -ne 0) { Fail 'remote deploy faalde' }

Write-Host 'deploy • ok'
