# e:\the101game\ops\fix-w0l0-autoplay.ps1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root    = 'e:\the101game'
$W0      = Join-Path $Root 'httpdocs\w0l0.html'
$SW      = Join-Path $Root 'httpdocs\sw.js'
$Remote  = 'root@82.165.231.86'
$Docroot = '/var/www/vhosts/the101game.io/httpdocs'

Set-Location $Root
if (-not (Test-Path $W0)) { throw "missing file: $W0" }

# --- gate css/html/js (idempotent) ---
$gateCss = @'
<style>
#autoplay-gate{position:fixed;inset:0;display:none;place-items:center;background:rgba(0,0,0,.65);z-index:99999}
#autoplay-gate.show{display:grid}
#autoplay-gate .card{color:#eaeaea;background:#0b0b0bcc;border:1px solid #222;border-radius:12px;padding:14px 16px;text-align:center;max-width:320px}
#autoplay-gate .card b{display:block;margin-bottom:6px}
#autoplay-gate .tip{opacity:.8;font-size:.9em}
</style>
'@

$gateHtml = @'
<div id="autoplay-gate" role="dialog" aria-modal="true">
  <div class="card">
    <b>tap to start sound</b>
    <div class="tip">(volume from 0 -> 100 during first block)</div>
  </div>
</div>
'@

$gateJs = @'
<script>
/* autoplay gate */
(function(){
  const gate = document.getElementById('autoplay-gate');
  function showGate(){ gate && gate.classList.add('show'); }
  function hideGate(){ gate && gate.classList.remove('show'); }

  async function tryStartSilently(){
    try{ if (typeof initAudio==='function') initAudio(); if (typeof setVolume==='function') setVolume(0); }catch(_){}
    try{ if (window.ac && ac.resume) await ac.resume(); }catch(_){}
    if (window.ac && ac.state === 'running'){ hideGate(); return true; }
    showGate(); return false;
  }

  function userUnlock(){
    try{ if (typeof initAudio==='function') initAudio(); }catch(_){}
    try{ if (window.ac && ac.resume) ac.resume(); }catch(_){}
    hideGate();
    window.removeEventListener('pointerdown', userUnlock, true);
    window.removeEventListener('keydown', userUnlock, true);
    gate && gate.removeEventListener('click', userUnlock);
  }

  window.addEventListener('pointerdown', userUnlock, true);
  window.addEventListener('keydown', userUnlock, true);
  gate && gate.addEventListener('click', userUnlock, {passive:true});

  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    tryStartSilently();
  } else {
    document.addEventListener('DOMContentLoaded', tryStartSilently, {once:true});
  }
})();
</script>
'@

$txt = Get-Content -Raw -Path $W0

if ($txt -notmatch 'id="autoplay-gate"') {
  # css -> voor </head> (of als geen head: voor </body>)
  if ($txt -match '</head>') {
    $txt = $txt -replace '(</head>)', "$gateCss`$1"
  } elseif ($txt -match '</body>') {
    $txt = $txt -replace '(</body>)', "$gateCss`$1"
  } else {
    throw "w0l0.html heeft geen </head> of </body> om css te plaatsen."
  }
  # html -> voor <div id="wrap"> of direct na <body>
  if ($txt -match '(<div id="wrap")') {
    $txt = $txt -replace '(<div id="wrap")', "$gateHtml`r`n`$1"
  } elseif ($txt -match '(<body[^>]*>)') {
    $txt = $txt -replace '(<body[^>]*>)', "`$1`r`n$gateHtml"
  }
}

if ($txt -notmatch '/\* autoplay gate \*/') {
  if ($txt -match '(</body>)') { $txt = $txt -replace '(</body>)', "$gateJs`$1" }
  else { $txt += "`r`n$gateJs" }
}

Set-Content -Path $W0 -Encoding utf8 -Value $txt

# --- pwa cache bump ---
if (Test-Path $SW) {
  $s = Get-Content -Raw -Path $SW
  $s = $s -replace 'the101game-static-\d+', ('the101game-static-' + (Get-Date -Format yyyyMMddHHmmss))
  Set-Content -Path $SW -Encoding utf8 -Value $s
  git add $SW | Out-Null
}

# --- git ---
git add $W0 | Out-Null
git commit -m "feat(w0l0): autoplay gate (silent start attempt + tap fallback)" | Out-Null
git push | Out-Null

# --- deploy (safe quoting; no host prompts) ---
$sshCommon = @('-o','StrictHostKeyChecking=no','-o','UserKnownHostsFile=/dev/null','-o','ConnectTimeout=10')
$destW0 = "$($Remote):$Docroot/w0l0.html"
& ssh @sshCommon $Remote "mkdir -p $Docroot" | Out-Null
& scp @sshCommon $W0 $destW0 | Out-Null
if (Test-Path $SW) { $destSW = "$($Remote):$Docroot/sw.js"; & scp @sshCommon $SW $destSW | Out-Null }

Write-Host 'OK: autoplay gate patched & deployed.'
