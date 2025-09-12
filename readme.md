helemaal. ik voeg ‘kukel’ toe (start op ‘totaal: +1 kukel’), zet ‘blockchain principles’ in readme + site, maak een ‘/blockchain’ pagina met ‘reset chain’ als stopknop, en plaats altijd een zichtbare stopknop. alles mobile-first, pwa-safe, lowercase.

kopieer-en-plak dit blok in powershell:

```powershell
# go to repo
set-location 'e:\the101game'

# 1) update readme.md (voegt kukel + blockchain principles + stopknop toe)
$readme = @'
pwa = ‘progressive web app’. het is een website die zich gedraagt als een app: start schermvullend, werkt (deels) offline, kan geïnstalleerd worden en blijft snel dankzij slimme caching.

kort hoe het werkt

* service worker: een kleine achtergrond-helper die netwerkverkeer onderschept, offline-cache regelt en updates pusht.
* manifest: een json met naam, iconen, thema en start-url zodat je ‘toevoegen aan beginscherm’ krijgt.
* https verplicht: voor veiligheid en toegang tot pwa-features.
* app-shell: minimalistische html/js/css die snel laadt en content daarna bijwerkt.

waarom jij het wilt

* mobile = default: fullscreen, safe-areas netjes, voelt als native.
* snel en veerkrachtig: laad direct uit cache, update stilletjes op de achtergrond.
* installable: icoon op je home-screen zonder app store.
* offline/poor-network: basis blijft bruikbaar, later synchroniseren.

grenzen om te kennen

* ios is strenger: sommige api’s zijn beperkt en audio moet eerst ‘ontgrendeld’ worden door een tik (hebben we ingebouwd).
* opslag is beperkt en door de browser beheerd.
* push/notifications vragen expliciete toestemming en zijn op ios soberder.

voor the101game

* we hebben manifest + service worker + auto-refresh + versie-busting gezet.
* taps geven ‘tik’ via webaudio (na eerste tik ontgrendeld).
* stippy (rode dot) en 10-taps → `/w0l0.html` werken nu ook mobiel.

clippy-modus (pwa)

* betekenis: progressive web app.
* simpel nl: website die als app werkt.
* voorbeeldzin: ‘we maken the101game een pwa zodat het ook offline opent.’
* uitspraak: pie-djoe-ee (engels: ‘pi-double-u-ei’).
* context: webontwikkeling, mobile-first.
* false friend: geen echte app store-app, maar lijkt er wel op.
* ezelsbrug: ‘p’ van ‘progressive’: het wordt steeds beter na eerst laden.

kukel

* start op ‘totaal: +1 kukel (pluskukel)’.
* kukel is de zichtbare teller op de homepage.
* kukel telt lokaal (per device) en kan in de toekomst worden gesynchroniseerd.

blockchain principles

* hash-koppeling: elk block bevat de hash van het vorige block.
* immutability: een bestaand block wordt niet aangepast, alleen nieuwe blocks erbij.
* transparantie: de chain is leesbaar in de browser (local only voor nu).
* reset chain (stopknop): met de stopknop maak je een nieuwe genesis (keten reset).
* mobile first: alles werkt in de webapp-standalone.

routes

* `/` homepage met kukel en een knop naar `/blockchain`.
* `/blockchain` pagina met ‘reset chain’ (stopknop) en voorbeeldchain in localstorage.

keuzemenu
[a] zo laten, pwa is klaar
[b] ‘install app’ knop tonen als de browser installatie toelaat
[c] offline fallback-pagina + ‘je bent offline’ toast
[d] unit-check die sw-versie en js-versie vergelijkt en een groen label toont
'@
set-content -encoding utf8 -path 'readme.md' -value $readme

# 2) homepage: voeg kukel + knop naar /blockchain + stopknop
$idx = 'httpdocs\index.html'
$html = get-content $idx -raw

# voeg een blockchain-knop in de header
if ($html -notmatch "id='to-blockchain'") {
  $html = $html -replace "(</header>)","<a id='to-blockchain' href='/blockchain' style='margin-left:.75rem;text-decoration:none;color:inherit;border:1px solid var(--line);padding:.25rem .5rem;border-radius:.5rem'>blockchain</a>`r`n`$1"
}

# voeg een kukel-strip bovenin main
if ($html -notmatch "id='kukel'") {
  $kukel = @"
<section class='block' id='kukel'>
  <div class='label'>kukel</div>
  <div class='value'><span id='kukel-total'>totaal: +1 kukel (pluskukel)</span></div>
</section>
"@
  $html = $html -replace "(<main[^>]*>)","`$1`r`n$kukel"
}

# voeg een stopknop zichtbaar onderaan
if ($html -notmatch "id='stopknop'") {
  $stop = "<section class='block'><button id='stopknop' style='width:100%;padding:.6rem;border:1px solid var(--line);background:#111;color:var(--fg);border-radius:.5rem'>stopknop</button></section>"
  $html = $html -replace "(</main>)","$stop`r`n`$1"
}

# zorg dat kukel-init en stopknop script aanwezig is
if ($html -notmatch "kukel init") {
  $script = @"
<script>
  // kukel init
  (function(){
    const key='kukel_total';
    const el=document.getElementById('kukel-total');
    let v = parseInt(localStorage.getItem(key)||'0',10);
    if (isNaN(v) || v < 1) { v = 1; localStorage.setItem(key, String(v)); }
    function label(){ return 'totaal: +' + v + ' kukel (pluskukel)'; }
    if (el) el.textContent = label();
    // optionele api om later te verhogen: window.kukelPlus()
    window.kukelPlus = function(n=1){ v+=n; localStorage.setItem(key,String(v)); if(el) el.textContent = label(); return v; }
  })();
  // stopknop: mute alle audio en schakel tik/chime uit indien beschikbaar
  (function(){
    const btn = document.getElementById('stopknop');
    function stopAll(){
      try{ if (window._w0_stop) window._w0_stop(); }catch(e){}
      try{ if (window._w0_mute) window._w0_mute(true); }catch(e){}
    }
    if (btn) {
      btn.addEventListener('click', (e)=>{ e.preventDefault(); stopAll(); alert('gestopt. keten en audio stil.'); });
    }
  })();
</script>
"
  $html = $html -replace "(</body>)","$script`r`n`$1"
}

set-content -encoding utf8 $idx $html

# 3) nav-script: expose een globale stop/mute zodat stopknop werkt
$nav = 'httpdocs\stippy\w0l0-nav.js'
if (test-path $nav) {
  $js = get-content $nav -raw
  if ($js -notmatch "_w0_stop") {
    $js = $js -replace "\)\(\);\s*$","  window._w0_mute=function(on){try{if(outGain){outGain.gain.value = on?0:0.9}}catch(e){}}; window._w0_stop=function(){try{if(ac){ac.close();}}catch(e){}; try{if(outGain){outGain.gain.value=0}}catch(e){}};\n})();"
    set-content -encoding utf8 $nav $js
  }
}

# 4) /blockchain pagina met reset chain (stopknop) en simpele local blockchain
$newdir = 'httpdocs\blockchain'
if (-not (test-path $newdir)) { new-item -itemtype directory -path $newdir | out-null }

$bc = @'
<!doctype html>
<html lang="nl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>blockchain</title>
<style>
  :root{--bg:#000;--fg:#eaeaea;--line:#222;--pad:clamp(12px,3vmin,20px)}
  *{box-sizing:border-box} html,body{margin:0;height:100%;background:var(--bg);color:var(--fg);font:16px/1.5 ui-monospace,consolas,monospace}
  body{min-height:100dvh;display:flex;flex-direction:column}
  main{padding:calc(env(safe-area-inset-top) + var(--pad)) var(--pad) calc(env(safe-area-inset-bottom) + var(--pad)) var(--pad);display:grid;gap:12px}
  .row{display:flex;gap:8px;flex-wrap:wrap}
  button{padding:.6rem .9rem;border:1px solid var(--line);background:#111;color:var(--fg);border-radius:.5rem}
  pre{border:1px solid var(--line);padding:.75rem;border-radius:.5rem;overflow:auto;margin:0}
  .muted{opacity:.7}
</style>
<body>
<main>
  <h1 style="margin:.2rem 0;font-size:1.15rem">blockchain principles</h1>
  <div class="muted">hash-koppeling · immutability · transparantie · reset chain (stopknop) · mobile first</div>
  <div class="row">
    <button id="add">add block</button>
    <button id="reset">reset chain (stopknop)</button>
    <a href="/" style="text-decoration:none"><button>home</button></a>
  </div>
  <div>length: <span id="len">0</span> · head: <span id="head" class="muted">-</span></div>
  <pre id="out"></pre>
</main>
<script>
  // mini blockchain (local only) met sha-256 via subtlecrypto
  const key='the101game_chain';
  async function sha(s){ const enc=new TextEncoder().encode(s); const buf=await crypto.subtle.digest('SHA-256',enc); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('') }
  function load(){ try{ return JSON.parse(localStorage.getItem(key)||'[]') }catch(_){ return [] } }
  function save(c){ localStorage.setItem(key,JSON.stringify(c)) }
  async function genesis(note='genesis'){ const c=[]; const prev='0'.repeat(64); const data={note, ts:Date.now()}; const hash=await sha(JSON.stringify({i:0,prev,data})); c.push({i:0,prev,data,hash}); save(c); return c }
  async function add(data={note:'block'}){ let c=load(); if(!c.length) c=await genesis('auto-genesis'); const i=c.length; const prev=c[c.length-1].hash; const payload={i,prev,data}; const hash=await sha(JSON.stringify(payload)); c.push({i,prev,data,hash}); save(c); return c }
  async function resetChain(){ const c=await genesis('reset by stopknop'); return c }
  function fmt(c){ return JSON.stringify(c,null,2) }
  async function render(){ const c=load(); document.getElementById('len').textContent=String(c.length); document.getElementById('head').textContent=c.length?c[c.length-1].hash.slice(0,16)+'…':'-'; document.getElementById('out').textContent=fmt(c) }
  document.getElementById('add').addEventListener('click', async ()=>{ await add({ts:Date.now()}); render() })
  document.getElementById('reset').addEventListener('click', async ()=>{ await resetChain(); try{ if (window.opener && window.opener._w0_stop) window.opener._w0_stop() }catch(e){} render() })
  (async()=>{ if(!load().length) await genesis('fresh'); render() })()
</script>
</body>
</html>
'@
set-content -encoding utf8 'httpdocs\blockchain\index.html' $bc

# 5) service worker: cache /blockchain ook en bump versie
$swp = 'httpdocs\sw.js'
if (test-path $swp) {
  $s = get-content $swp -raw
  if ($s -notmatch "/blockchain") {
    $s = $s -replace "(const CORE = \[)","`$1 '/', '/index.html', '/w0l0.html', '/stippy/w0l0-nav.js', '/manifest.webmanifest', '/blockchain/', "
  }
  $s = $s -replace "the101game-static-\d+","the101game-static-$(Get-Date -Format yyyyMMddHHmmss)"
  set-content -encoding utf8 $swp $s
}

# 6) commit en push
git add readme.md httpdocs/index.html httpdocs/blockchain/index.html
if (test-path $nav) { git add httpdocs/stippy/w0l0-nav.js }
if (test-path $swp) { git add httpdocs/sw.js }
git commit -m "feat(kukel+blockchain): homepage kukel (+1 start), link naar /blockchain, reset chain stopknop; readme met blockchain principles; stopknop overal"
git push

# 7) deploy naar server
ssh root@82.165.231.86 "mkdir -p /var/www/vhosts/the101game.io/httpdocs/blockchain"
scp "e:\the101game\readme.md"                               root@82.165.231.86:/var/www/vhosts/the101game.io/httpdocs/readme.md
scp "e:\the101game\httpdocs\index.html"                     root@82.165.231.86:/var/www/vhosts/the101game.io/httpdocs/index.html
scp "e:\the101game\httpdocs\blockchain\index.html"          root@82.165.231.86:/var/www/vhosts/the101game.io/httpdocs/blockchain/index.html
if (test-path $nav) { scp "e:\the101game\httpdocs\stippy\w0l0-nav.js" root@82.165.231.86:/var/www/vhosts/the101game.io/httpdocs/stippy/w0l0-nav.js }
if (test-path $swp) { scp "e:\the101game\httpdocs\sw.js" root@82.165.231.86:/var/www/vhosts/the101game.io/httpdocs/sw.js }
```

testen

* open `https://the101game.io` → zie ‘totaal: +1 kukel (pluskukel)’, ‘blockchain’ knop en ‘stopknop’.
* tik 1× om audio te unlocken; tikken zijn hoorbaar; ‘stopknop’ dempt alles.
* klik ‘blockchain’ → op `/blockchain` zie je de chain; klik ‘reset chain (stopknop)’ → nieuwe genesis.
* terug naar home: alles blijft mobile-first en pwa-sync ververst automatisch.

git commit & push

```bash
git add -A
git commit -m 'chore: add kukel ui + blockchain page with reset chain stopknop; update readme; deploy'
git push
```
