#!/usr/bin/env bash
set -euo pipefail
LOG="/var/log/nginx/traffic_ingest.log"
LINES="${LINES:-20000}"
OUT_DIR="/home/lucas/the101game/public"
OUT_TXT="$OUT_DIR/traffic_kpi.txt"
OUT_HTML="$OUT_DIR/traffic/index.html"

mkdir -p "$OUT_DIR/traffic"
DATA="$(tail -n "$LINES" "$LOG" 2>/dev/null || true)"

stamp() { date '+%Y-%m-%d %H:%M:%S %z'; }

if [ -z "$DATA" ]; then
  {
    echo "# the101game — Traffic KPI"
    echo "timestamp	$(stamp)"
    echo "window_last_lines	$LINES"
    echo "requests	0"
    echo "unique_ips	0"
    echo "2xx	0"
    echo "3xx	0"
    echo "4xx	0"
    echo "5xx	0"
    echo "top_paths_count\tpath"
  } | tee "$OUT_TXT"
else
  # Totals
  awk '
    { ip=$1; status=$9; path=$7;
      ips[ip]=1; total++;
      sc=int(status/100);
      if(sc==2) s2++; else if(sc==3) s3++; else if(sc==4) s4++; else if(sc==5) s5++;
      if (path ~ /^\//) paths[path]++
    }
    END{
      u=0; for(i in ips) u++;
      printf("window_last_lines\t%d\n", '"$LINES"');
      printf("requests\t%d\nunique_ips\t%d\n", total+0,u+0);
      printf("2xx\t%d\n3xx\t%d\n4xx\t%d\n5xx\t%d\n", s2+0,s3+0,s4+0,s5+0);
      for(p in paths) printf("%d\t%s\n", paths[p], p) > "/proc/self/fd/3";
    }
  ' 3>"/tmp/paths.$$" <<< "$DATA" | {
    echo "# the101game — Traffic KPI"
    echo "timestamp	$(stamp)"
    cat -
    echo "top_paths_count	path"
    sort -nr -k1,1 "/tmp/paths.$$" | head -5
    rm -f "/tmp/paths.$$"
  } | tee "$OUT_TXT" >/dev/null
fi

# HTML (auto-refresh)
cat > "$OUT_HTML" <<HTML
<!doctype html><meta charset="utf-8">
<title>the101game — Traffic KPI</title>
<meta http-equiv="refresh" content="10">
<style>
 body{font:14px ui-sans-serif,system-ui;max-width:720px;margin:24px auto;padding:0 16px}
 h1{margin:0 0 8px}.muted{color:#666}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
 .card{border:1px solid #eee;border-radius:12px;padding:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
 .big{font-size:28px;font-weight:700} table{width:100%;border-collapse:collapse;margin-top:8px}
 th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left;font-variant-numeric:tabular-nums}
 code{font-family:ui-monospace,monospace}
</style>
<h1>the101game — Traffic KPI</h1>
<div class="muted">Bron: /t/ingest — auto-refresh 10s</div>
<div id="stats" class="kpis"></div>
<div class="card">
  <div style="font-weight:600">Top Paths (venster)</div>
  <table><thead><tr><th>Hits</th><th>Path</th></tr></thead><tbody id="paths"></tbody></table>
</div>
<script>
async function load(){
  const resp = await fetch('/traffic_kpi.txt', {cache:'no-store'}).catch(()=>null);
  if(!resp){ document.getElementById('stats').innerHTML='<div class="card">Geen data…</div>'; return; }
  const txt = await resp.text();
  const rows = txt.trim().split(/\\n/).map(l=>l.split(/\\t/));
  const map = Object.fromEntries(rows.filter(r=>r.length===2));
  const kpis = [['Requests',map['requests']||'0'],['Unieke IPs',map['unique_ips']||'0'],['Window (regels)',map['window_last_lines']||'0'],['2xx',map['2xx']||'0'],['3xx',map['3xx']||'0'],['4xx',map['4xx']||'0']];
  document.getElementById('stats').innerHTML = kpis.map(([k,v])=>'<div class="card"><div class="big">'+v+'</div><div class="muted">'+k+'</div></div>').join('');
  const body = document.getElementById('paths'); body.innerHTML='';
  const start = rows.findIndex(r=>r[0]==='top_paths_count');
  if(start>=0){ for(let i=start+1;i<rows.length;i++){ const r=rows[i]; if(!r[1]) continue; const tr=document.createElement('tr'); tr.innerHTML='<td>'+r[0]+'</td><td><code>'+r[1]+'</code></td>'; body.appendChild(tr);} }
}
load(); setInterval(load, 10000);
</script>
HTML
