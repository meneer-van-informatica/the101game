<?php
require __DIR__.'/functions.php';
$c = cfg();

function err($msg, $http=400){
  http_response_code($http);
  echo "<!doctype html><meta charset='utf-8'><title>Koppelen mislukt</title>
  <style>body{font:16px/1.5 system-ui;padding:24px;background:#0b1220;color:#e6edf3}
  .card{max-width:640px;margin:8vh auto;background:#111827;border:1px solid #263248;border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
  .muted{opacity:.75}</style>
  <div class='card'><h1>❌ Koppelen mislukt</h1><p>$msg</p>
  <p class='muted'>Probeer de autorisatielink opnieuw of ververs de pagina.</p></div>";
  exit;
}

if(!isset($_GET['code'])) err("Geen <code>code</code> parameter ontvangen.");

$data = http_build_query([
  'grant_type'=>'authorization_code',
  'code'=>$_GET['code'],
  'redirect_uri'=>$c['redirect_uri']
]);
$ctx = stream_context_create(['http'=>[
  'method'=>'POST',
  'header'=>[
    'Authorization: Basic '.basic_auth(),
    'Content-Type: application/x-www-form-urlencoded'
  ],
  'content'=>$data, 'ignore_errors'=>true
]]);
$res = @file_get_contents('https://accounts.spotify.com/api/token', false, $ctx);
$j = json_decode($res,true);
if(empty($j['access_token']) || empty($j['refresh_token'])){
  err("Token-uitwisseling faalde.<br><small class='muted'>Spotify antwoord: "
      .htmlspecialchars(substr($res ?? '',0,400))."</small>");
}

save_tokens([
  'access_token'=>$j['access_token'],
  'refresh_token'=>$j['refresh_token'],
  'expires_at'=> time() + (int)($j['expires_in']??3600)
]);
?>
<!doctype html>
<meta charset="utf-8">
<title>Spotify gekoppeld</title>
<style>
  :root{--ok:#22c55e;--fg:#e6edf3;--bg:#0b1220;--card:#111827}
  body{font:16px/1.6 system-ui;margin:0;background:var(--bg);color:var(--fg)}
  .wrap{max-width:720px;margin:8vh auto;padding:24px}
  .card{background:var(--card);border:1px solid #263248;border-radius:12px;padding:20px;
        box-shadow:0 10px 30px rgba(0,0,0,.35)}
  .row{display:flex;gap:10px;align-items:center}
  .dot{width:10px;height:10px;border-radius:50%;background:#f59e0b;animation:pulse 1s infinite}
  @keyframes pulse{50%{opacity:.2}}
  .ok .dot{background:var(--ok);animation:none}
  .muted{opacity:.75}
  .btn{display:inline-block;margin-top:14px;padding:8px 12px;border-radius:8px;
       background:#1f2937;color:#fff;text-decoration:none;border:1px solid #334155}
</style>
<div class="wrap">
  <div class="card">
    <h1>✅ Spotify gekoppeld</h1>
    <p class="muted">Tokens zijn opgeslagen. We doen een snelle check…</p>
    <div id="steps">
      <div class="row" id="s1"><span class="dot"></span> Token opgeslagen</div>
      <div class="row" id="s2"><span class="dot"></span> Verbinding testen</div>
      <div class="row" id="s3"><span class="dot"></span> Huidige track ophalen</div>
    </div>
    <p id="out" class="muted" style="margin-top:12px">Bezig…</p>
    <a class="btn" href="/spotify/now.php" target="_blank">Open now.php</a>
    <a class="btn" href="/" style="margin-left:8px">Terug naar homepage</a>
  </div>
</div>
<script>
(async function(){
  // markeer stap 1 direct
  document.getElementById('s1').classList.add('ok');
  try{
    // kleine pauze voor UX
    await new Promise(r=>setTimeout(r,400));
    document.getElementById('s2').classList.add('ok');
    // vraag JSON status op
    const r = await fetch('/spotify/now.php?mode=json&t='+Date.now(), {cache:'no-store'});
    const ok = r.ok; const j = ok ? await r.json() : null;
    document.getElementById('s3').classList.add(ok ? 'ok' : '');
    document.getElementById('out').textContent = ok && j && j.text
      ? j.text
      : 'Gekoppeld, maar nog geen afspelen gedetecteerd (of onvoldoende rechten).';
  }catch(e){
    document.getElementById('out').textContent = 'Koppeling gelukt, maar test faalde: '+(e.message||e);
  }
})();
</script>
