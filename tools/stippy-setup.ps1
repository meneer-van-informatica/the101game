param(
  [string]$Root = 'E:\the101game\httpdocs'
)
$ErrorActionPreference = 'Stop'
Set-Location $Root

# zorg voor mappen
$specs = Join-Path (Get-Location) 'specs'
$tools = Join-Path (Get-Location) 'tools'
if(-not (Test-Path $specs)){ New-Item -ItemType Directory -Path $specs | Out-Null }
if(-not (Test-Path $tools)){ New-Item -ItemType Directory -Path $tools | Out-Null }

# footer.spec
$footer = @'
<div id='km' style='padding:12px;border-top:1px dashed #fff;text-align:center'>
  <div><span data-ts></span></div>
  <div>KM — choose language</div>
  <div>tip: press 0 or 1 · dogs vs. cats fights for kukels</div>
  <div>dogs vs. cats — kukels</div>
  <div>dogs: 0 · cats: 0 · total kukels: <span data-kukel>0</span></div>
  <div>genesis (index) = <span data-block>0</span> kukel — w0l0 = 1 kukel</div>
  <div>lang: <span data-lang>EN</span></div>
</div>
'@
Set-Content -LiteralPath (Join-Path $specs 'footer.spec') -Value $footer -Encoding utf8

# index.srt met stilte
$srt = @'
1
00:00:00,000 --> 00:00:02,400
[STIPPY] welkom bij the one oh one game

2
00:00:03,000 --> 00:00:05,000
[STIPPY] kies taal met nul of een

3
00:00:05,000 --> 00:00:06,800
[STIPPY] honden en katten strijden om kukels

4
00:00:07,200 --> 00:00:09,000
[STIPPY] genesis is nul kukel, w0l0 is een
'@
Set-Content -LiteralPath (Join-Path $specs 'index.srt') -Value $srt -Encoding utf8

# injectie in index.html
$idx = Join-Path (Get-Location) 'index.html'
if(-not (Test-Path $idx)){ throw 'index.html ontbreekt' }
$raw = Get-Content -LiteralPath $idx -Raw

$snippet = @'
<!-- stippy ui: captions + 10s ascii + rode stip -->
<div id='stippy-ui' style='position:fixed;left:0;right:0;bottom:0;display:grid;gap:6px;justify-items:center;padding:10px;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);z-index:9999'>
  <div id='stippy-dot' style='width:18px;height:18px;border-radius:50%;background:#f00;transition:transform .12s ease;transform:scale(.7)'></div>
  <div id='stippy-caption' style='color:#fff;font:14px/1.4 ui-monospace,consolas,monospace;text-align:center;white-space:pre-wrap'></div>
  <pre id='stippy-chrono' style='margin:0;color:#fff;font:14px/1.2 ui-monospace,consolas,monospace'>[##########] 10</pre>
</div>
<script>
(function(){
  const cap  = document.getElementById('stippy-caption');
  const dot  = document.getElementById('stippy-dot');
  const chrono = document.getElementById('stippy-chrono');
  if(!cap || !dot || !chrono) return;
  function parseSRT(txt){
    const cues = [];
    const blocks = txt.replace(/\r/g,'').split(/\n\s*\n/);
    for(const b of blocks){
      const lines = b.trim().split('\n');
      if(lines.length < 2) continue;
      const m = lines[1].match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/);
      if(!m) continue;
      const s = (+m[1])*3600 + (+m[2])*60 + (+m[3]) + (+m[4])/1000;
      const e = (+m[5])*3600 + (+m[6])*60 + (+m[7]) + (+m[8])/1000;
      const text = lines.slice(2).join('\n');
      cues.push({s,e,text});
    }
    return cues.sort((a,b)=>a.s-b.s);
  }
  function asciiBar(rem,total,len){
    const left = Math.max(0, Math.min(total, Math.ceil(rem)));
    const fill = Math.round((rem/total)*len);
    const bar  = '#'.repeat(fill) + '-'.repeat(Math.max(0, len-fill));
    return '[' + bar + '] ' + String(left).padStart(2,'0');
  }
  async function load(){
    try{
      const r = await fetch('/specs/index.srt?v=' + Date.now(), {cache:'no-store'});
      const txt = await r.text();
      const cues = parseSRT(txt);
      const total = 10.0, len = 10;
      const t0 = performance.now();
      function tick(){
        const t = (performance.now() - t0) / 1000;
        const rem = Math.max(0, total - t);
        const c = cues.find(q => t >= q.s && t < q.e);
        cap.textContent = c ? c.text : '';
        dot.style.transform = c ? 'scale(1.8)' : 'scale(0.7)';
        chrono.textContent = asciiBar(rem, total, len);
        if(t < total + 0.25) requestAnimationFrame(tick);
      }
      tick();
    }catch(_){
      cap.textContent = '[stippy offline]';
      dot.style.transform = 'scale(0.7)';
      chrono.textContent = '[----------] 00';
    }
  }
  (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', load, {once:true}) : load();
})();
</script>
'@

if($raw -notmatch 'id=''stippy-ui'''){
  $raw = [regex]::Replace($raw,'</body>',$snippet + "`r`n</body>",1,[System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  Set-Content -LiteralPath $idx -Value $raw -Encoding utf8
}

Write-Host 'stippy setup done.'
