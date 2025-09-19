# VERS NULL:HAON
from flask import Flask, request, jsonify, make_response, Response, redirect
import time, threading, uuid, re, os, hashlib, random, string, json, tempfile, math

app = Flask(__name__)

# ---------------- Config (deterministisch) ----------------
VERS            = "NULL:HAON"
ROUND_SECONDS   = 60
TTL_SECONDS     = 12           # sessie verdwijnt voorspelbaar
TOK_INTERVAL_S  = 10           # elke 10s
TOK_WINDOW_S    = 10           # 10s om te klikken
MIN_PULSE_GAP_S = 0.9          # ~1 Hz per sid
CODE_RE         = re.compile(r"^[A-Z]{4}$")

APPDIR  = os.path.dirname(os.path.abspath(__file__))
DATAD   = os.path.join(APPDIR, "data")
WALLET  = os.path.join(DATAD, "wallet.json")
TAGSF   = os.path.join(DATAD, "tags.json")
ADMINF  = os.path.join(APPDIR, "admin.secret")

os.makedirs(DATAD, exist_ok=True)

# ---------------- State ----------------
_sessions = {}                # sid -> {code, joined_at, last_seen, tok_next, tok_active, tok_deadline}
_lock = threading.RLock()
_round_started = time.time()
_rev = 1

# ---------------- Utils ----------------
def _now(): return time.time()
def _mmss(sec): 
    sec = max(0,int(sec)); m,s = divmod(sec,60); 
    return f"{m:02d}:{s:02d}"

def _json_load(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f: return json.load(f)
    except Exception:
        return default

def _json_dump_atomic(path, obj):
    d = json.dumps(obj, ensure_ascii=False, separators=(",",":"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", dir=os.path.dirname(path))
    with os.fdopen(fd, "w", encoding="utf-8") as f: f.write(d)
    os.replace(tmp, path)

# wallet (kukel)
def _wallet_get(alias):
    w = _json_load(WALLET, {})
    return int(w.get(alias, 0))

def _wallet_add(alias, delta):
    if not alias: return
    w = _json_load(WALLET, {})
    w[alias] = int(w.get(alias, 0)) + int(max(0, delta))
    _json_dump_atomic(WALLET, w)

# tags (alias -> #nnnn)
def _tags_load():
    t = _json_load(TAGSF, None)
    if not t or not isinstance(t, dict): t = {"seq": 1, "tags": {}}
    t.setdefault("seq", 1); t.setdefault("tags", {})
    return t

def _tags_save(t): _json_dump_atomic(TAGSF, t)

def _tag_get(alias, create=True):
    if not alias: return 0
    t = _tags_load()
    if alias in t["tags"]: return int(t["tags"][alias])
    if not create: return 0
    tag = int(t["seq"]); t["seq"] = tag + 1; t["tags"][alias] = tag
    _tags_save(t)
    return tag

def _tag_str(alias):
    tag = _tag_get(alias, create=False)
    return f"#{tag:04d}" if tag>0 else "#0000"

# ---------------- Sessions / TOK ----------------
def _get_or_create_session(sid, now=None):
    now = now or _now()
    s = _sessions.get(sid)
    if not s:
        s = {"last_seen": now, "joined_at": now, "code": None,
             "tok_next": now + TOK_INTERVAL_S, "tok_active": False, "tok_deadline": 0.0}
        _sessions[sid] = s
    return s

def _sweep(now=None):
    now = now or _now()
    dead = [sid for sid,d in list(_sessions.items()) if now - d.get("last_seen",0) > TTL_SECONDS]
    for sid in dead:
        s = _sessions.pop(sid, None)
        if not s: continue
        code = s.get("code")
        if code: _wallet_add(code, now - s.get("joined_at", now))

def _active_count(now=None):
    now = now or _now()
    return sum(1 for d in _sessions.values() if now - d.get("last_seen",0) <= TTL_SECONDS and d.get("code"))

def _tleft(now=None):
    now = now or _now()
    return max(0, ROUND_SECONDS - int(now - _round_started))

def _tok_enforce(s, now):
    # Alleen aliassen krijgen TOK-gating
    if not s.get("code"):
        s["tok_active"]=False; s["tok_deadline"]=0.0; s["tok_next"]=max(s.get("tok_next", now+TOK_INTERVAL_S), now+TOK_INTERVAL_S)
        return (False, int(s["tok_next"]-now))
    # active maken?
    if not s["tok_active"] and now >= s["tok_next"]:
        s["tok_active"]=True; s["tok_deadline"]=now + TOK_WINDOW_S
    if s["tok_active"]:
        left = max(0, math.ceil(s["tok_deadline"] - now))
        if left <= 0:
            # venster gemist -> kill sessie voorspelbaar
            return ("KILL", 0)
        return (True, left)
    return (False, max(0, int(s["tok_next"] - now)))

def _round_reset_locked(now):
    global _round_started, _rev
    for s in list(_sessions.values()):
        if s.get("code"): _wallet_add(s["code"], now - s.get("joined_at", now))
    _sessions.clear()
    _round_started = now
    _rev += 1

def _janitor():
    while True:
        time.sleep(1)
        now = _now()
        with _lock:
            if now - _round_started >= ROUND_SECONDS:
                _round_reset_locked(now)
            else:
                killers=[]
                for sid, s in list(_sessions.items()):
                    st,_ = _tok_enforce(s, now)
                    if st == "KILL":
                        if s.get("code"): _wallet_add(s["code"], now - s.get("joined_at", now))
                        killers.append(sid)
                for sid in killers: _sessions.pop(sid, None)
                _sweep(now)
threading.Thread(target=_janitor, daemon=True).start()

# ---------------- Root / health ----------------
@app.get("/")
def _root_redirect(): return redirect("/plain.md", code=302)

@app.get("/kpi/healthz")
def _healthz(): return ("ok\n", 200, {"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"})

# ---------------- API: pulse / click / login / logout ----------------
@app.route("/kpi/pulse", methods=["POST","GET"])
def pulse():
    sid = request.cookies.get("sid") or uuid.uuid4().hex
    now = _now()
    with _lock:
        sdat = _get_or_create_session(sid, now)
        prev = sdat.get("last_seen", 0.0)
        # throttle ~1 Hz
        if now - prev < MIN_PULSE_GAP_S:
            resp = make_response(("", 204, {"X-Pulse-Skip":"1","Cache-Control":"no-store"}))
            resp.set_cookie("sid", sid, max_age=86400, secure=True, httponly=False, samesite="Lax")
            return resp
        sdat["last_seen"]=now
        state, left = _tok_enforce(sdat, now)
        if state == "KILL":
            if sdat.get("code"): _wallet_add(sdat["code"], now - sdat.get("joined_at", now))
            _sessions.pop(sid, None)
            res = make_response(jsonify({"kicked": True, "count": _active_count(now), "vers": VERS}))
            res.set_cookie("sid","",max_age=0); res.headers["Cache-Control"]="no-store"; return res
        code = sdat.get("code"); kukel = _wallet_get(code) if code else 0
        tag  = _tag_get(code, create=False) if code else 0
        res = make_response(jsonify({
            "sid": sid, "count": _active_count(now), "ttl": TTL_SECONDS, "rev": _rev, "tleft": _tleft(now),
            "tok": {"active": (state is True), "left": int(left)},
            "alias": code, "kukel": kukel, "tag": tag, "vers": VERS
        }))
    res.set_cookie("sid", sid, max_age=86400, secure=True, httponly=False, samesite="Lax")
    res.headers["Cache-Control"]="no-store"
    return res

@app.post("/kpi/click")
def click_add_kukel():
    sid = request.cookies.get("sid")
    if not sid: return jsonify({"ok": False, "error":"NO_SID"}), 400
    now = _now()
    with _lock:
        S = _sessions.get(sid)
        if not S: return jsonify({"ok": False, "error":"NO_SESSION"}), 404
        code = S.get("code")
        if not code or not CODE_RE.match(code): return jsonify({"ok": False, "error":"NO_ALIAS"}), 403
        st, left = _tok_enforce(S, now)
        if st is not True:
            return jsonify({"ok": False, "error":"TOK_INACTIVE","left": int(left)}), 409
        # +1 kukel, sluit TOK tot volgende interval
        _wallet_add(code, 1)
        S["tok_active"]=False; S["tok_deadline"]=0.0; S["tok_next"]= now + TOK_INTERVAL_S
        kukel = _wallet_get(code)
        tag   = _tag_get(code, create=False)
        return jsonify({"ok": True, "alias": code, "kukel": kukel, "tok": {"active": False, "left": TOK_INTERVAL_S}, "tag": tag})

def _suggest_alt(code):
    letters = string.ascii_uppercase
    for _ in range(40):
        i=random.randrange(4); alt=list(code); alt[i]=random.choice(letters.replace(alt[i],"")); alt="".join(alt)
        if not any(d.get("code")==alt for d in _sessions.values()): return alt
    return None

@app.post("/kpi/join")
@app.post("/kpi/login")
def join():
    code = (request.form.get("code") if request.form else None) or (request.json or {}).get("code")
    if not code or not CODE_RE.match(code.upper()): return jsonify({"ok": False, "error":"CODE_INVALID"}), 400
    code = code.upper(); now=_now()
    with _lock:
        if any(d.get("code")==code for d in _sessions.values()):
            return jsonify({"ok": False, "error":"CODE_TAKEN", "alt": _suggest_alt(code)}), 409
        sid = request.cookies.get("sid") or uuid.uuid4().hex
        s = _get_or_create_session(sid, now)
        s.update(code=code, joined_at=now, last_seen=now, tok_active=False, tok_deadline=0.0, tok_next=now + TOK_INTERVAL_S)
        _tag_get(code, create=True)
        res = make_response(jsonify({"ok": True, "sid": sid, "code": code, "count": _active_count(now), "tleft": _tleft(now), "vers": VERS}))
    res.set_cookie("sid", sid, max_age=86400, secure=True, httponly=False, samesite="Lax")
    res.headers["Cache-Control"]="no-store"
    return res

@app.post("/kpi/leave")
@app.post("/kpi/logout")
def leave():
    sid = request.cookies.get("sid")
    now = _now()
    with _lock:
        if sid and sid in _sessions:
            s = _sessions.pop(sid)
            if s.get("code"): _wallet_add(s.get("code"), now - s.get("joined_at", now))
    return jsonify({"ok": True})

@app.post("/kpi/exit")
def exit_now():
    sid = request.cookies.get("sid")
    now = _now()
    with _lock:
        if sid and sid in _sessions:
            s = _sessions.pop(sid)
            if s.get("code"): _wallet_add(s.get("code"), now - s.get("joined_at", now))
    res = make_response(jsonify({"ok": True, "exit": True}))
    res.set_cookie("sid","",max_age=0)
    return res

# ---------------- Board / Round ----------------
@app.get("/kpi/board")
def board():
    now=_now()
    with _lock:
        items=[]
        for sid, d in _sessions.items():
            if now - d.get("last_seen",0) > TTL_SECONDS: continue
            code=d.get("code"); 
            if not code: continue
            age=int(now - d.get("joined_at", now))
            st, left = _tok_enforce(d, now)
            tok = int(left) if st is True else None
            kukel=_wallet_get(code)
            items.append({"code":code, "age_s":age, "tok":tok, "kukel": kukel})
        items.sort(key=lambda x:(-x["age_s"], x["code"]))
        return jsonify({"board": items, "count": len(items), "rev": _rev, "tleft": _tleft(now), "vers": VERS})

@app.get("/kpi/round")
def round_info():
    with _lock:
        return jsonify({"tleft": _tleft(), "rev": _rev, "round": ROUND_SECONDS, "ttl": TTL_SECONDS,
                        "tok_interval": TOK_INTERVAL_S, "tok_window": TOK_WINDOW_S, "vers": VERS})

# ---------------- Lobby (UI) ----------------
@app.get("/lobby")
def lobby_html():
    html = """<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>the101game — TRALIAS (BASIC)</title>
<style>
  html,body{margin:0;background:#000;color:#e6e6e6}
  main{position:fixed;inset:0;padding:10px;z-index:0}
  .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .top{justify-content:space-between;margin-bottom:10px;font: clamp(16px,3.5vw,22px) ui-monospace,monospace}
  .left,.right{display:flex;gap:12px;align-items:center}
  form#login{display:flex;gap:8px;align-items:center}
  input#code{width:5.5ch;font: inherit;text-transform:uppercase;background:#0b0b0b;color:#fff;border:1px solid #334;border-radius:6px;padding:6px 8px}
  button{font:inherit;padding:6px 10px;border-radius:8px;border:1px solid #334;background:#111;color:#ddd}
  button[disabled]{opacity:.45;filter:grayscale(1);cursor:not-allowed}
  #board{margin-top:12px;white-space:pre;font: clamp(14px,2.8vw,18px) ui-monospace,monospace}
  .mut{color:#9aa3b2}
</style>
<main>
  <div class="row top">
    <div class="left">
      <b>TRALIAS</b>
      <span id="round"   class="mut">ROUND T-00:60</span>
      <span id="traffic" class="mut">TRAFFIC 00000</span>
      <span id="vers"    class="mut">VERS NULL:HAON</span>
    </div>
    <div class="right">
      <form id="login" autocomplete="off">
        <span class="mut">ALIAS</span>
        <input id="code" name="code" maxlength="4" pattern="[A-Z]{4}" placeholder="ABCD" required autofocus />
        <button type="submit">JOIN</button>
        <button id="exitBtn" type="button" hidden>EXIT</button>
      </form>
      <span id="me" class="mut" hidden>YOU <b id="meAlias">----</b> <span id="meTag">#0000</span> KUKEL <b id="meKukel">0</b></span>
      <button id="tokBtn" disabled>TOK...</button>
    </div>
  </div>
  <pre id="board">loading…</pre>
</main>
<script>
(function(){
  // --- basics ---
  const roundEl=document.getElementById('round');
  const trafficEl=document.getElementById('traffic');
  const tokBtn=document.getElementById('tokBtn');
  const boardEl=document.getElementById('board');
  const form=document.getElementById('login');
  const codeInp=document.getElementById('code');
  const exitBtn=document.getElementById('exitBtn');
  const meBox=document.getElementById('me');
  const meAlias=document.getElementById('meAlias');
  const meKukel=document.getElementById('meKukel');
  const meTag=document.getElementById('meTag');

  // Uppercase-only, 4 chars, letters A-Z
  codeInp.addEventListener('input', ()=>{
    let v=codeInp.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
    if (v!==codeInp.value) codeInp.value=v;
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const code=(codeInp.value||'').toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) return;
    try{
      const r=await fetch('/kpi/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'code='+encodeURIComponent(code)});
      const j=await r.json();
      if (j.ok){
        meAlias.textContent=j.code;
        meTag.textContent='#'+String(j.tag||0).padStart(4,'0');
        meBox.hidden=false; exitBtn.hidden=false;
      }else if (j.error==='CODE_TAKEN' && j.alt){
        codeInp.value=j.alt;
      }
    }catch(_){}
  });

  exitBtn.addEventListener('click', async ()=>{
    try{ await fetch('/kpi/exit',{method:'POST'}); }catch(_){}
    meBox.hidden=true; exitBtn.hidden=true; codeInp.value=''; codeInp.focus();
  });

  tokBtn.addEventListener('click', async ()=>{
    if (tokBtn.disabled) return;
    tokBtn.disabled=true; tokBtn.textContent='...';
    try{
      const r=await fetch('/kpi/click',{method:'POST'}); const j=await r.json();
      if (j && j.ok){
        meKukel.textContent=String(j.kukel||0);
      }
    }catch(_){}
  });

  function mm(s){ s=Math.max(0,parseInt(s||0,10)); var M=('0'+Math.floor(s/60)).slice(-2), S=('0'+(s%60)).slice(-2); return M+':'+S; }

  async function pulse(){
    try{
      const r=await fetch('/kpi/pulse',{method:'POST',cache:'no-store'});
      if (r.status===204) return;
      const j=await r.json();
      roundEl.textContent='ROUND T-'+mm(j.tleft||0);
      trafficEl.textContent='TRAFFIC '+String(j.count||0).padStart(5,'0');
      if (j.alias){ meAlias.textContent=j.alias; meBox.hidden=false; exitBtn.hidden=false; }
      if (typeof j.kukel==='number') meKukel.textContent=String(j.kukel);
      if (typeof j.tag==='number')   meTag.textContent='#'+String(j.tag).padStart(4,'0');
      const tok=j.tok||{};
      if (tok.active){ tokBtn.disabled=false; tokBtn.textContent='TOK +1'; }
      else { tokBtn.disabled=true; tokBtn.textContent = tok.left?('WAIT '+String(tok.left)+'s'):'TOK...'; }
    }catch(_){}
  }

  async function pullBoard(){
    try{
      const r=await fetch('/kpi/board',{cache:'no-store'}); const j=await r.json();
      const rows = (j.board||[]).map((o,i)=>{
        const tok = (o.tok==null?'--':(String(o.tok).padStart(2,'0')+'s'));
        return String(i+1).padStart(2,' ')+'  '+o.code+'  time '+mm(o.age_s||0)+'  tok '+tok+'  kukel '+(o.kukel||0);
      });
      boardEl.textContent = (rows.length? rows.join('
') : '(empty)')+'
';
    }catch(_){}
  }

  let next=performance.now();
  function step(ts){
    const hidden=document.visibilityState==='hidden';
    const interval=hidden?4000:1000;
    if (ts>=next){ pulse(); pullBoard(); next=ts+interval; }
    requestAnimationFrame(step);
  }
  window.addEventListener('visibilitychange', ()=>{ next=performance.now(); });
  window.addEventListener('pagehide', ()=>{ try{ navigator.sendBeacon('/kpi/logout','1'); }catch(_){} });
  requestAnimationFrame(step);
})();
</script>"""
    return Response(html, mimetype="text/html; charset=utf-8")# --- compat: oude URL → nieuwe lobby ---
@app.get("/kpi/screen")
def screen_html_compat():
    return redirect("/lobby", code=302)


# ---------------- PLAINTEXT / MARKDOWN ----------------
_last_plain_etag = None
@app.get("/plain.md")
def plain_md():
    now = _now()
    sid = request.cookies.get("sid")
    with _lock:
        sdat = _sessions.get(sid) if sid else None
        alias = (sdat or {}).get("code")
        you_tag = _tag_str(alias) if alias else "#0000"
        you_kukel = _wallet_get(alias) if alias else 0
        cnt   = _active_count(now)
        tleft = _tleft(now)

        rows=[]
        for d in _sessions.values():
            if now - d.get("last_seen",0) > TTL_SECONDS: continue
            code=d.get("code")
            if not code: continue
            age = int(now - d.get("joined_at", now))
            st, left = _tok_enforce(d, now)
            tok = ("--" if st is not True else f"{int(left):02d}s")
            kuk = _wallet_get(code)
            rows.append((code, age, tok, kuk))
        rows.sort(key=lambda x:(-x[1], x[0]))

    lines=[]
    lines.append("# TRALIAS — PLAINTEXT")
    lines.append("")
    you_line = f"YOU: **{alias or '----'}** {you_tag}  KUKEL **{you_kukel}**"
    head = f"**TRAFFIC:** {cnt:05d}   **ROUND:** T-{_mmss(tleft)}   {you_line}"
    lines.append(head)
    lines.append("")
    lines.append("| # | ALIAS | TIME | TOK | KUKEL |")
    lines.append("| -:|:----- | ----:| ---:| -----:|")
    for i,(c,a,t,k) in enumerate(rows, start=1):
        lines.append(f"| {i} | {c} | {_mmss(a)} | {t} | {k} |")
    body = "\n".join(lines) + "\n"

    global _last_plain_etag
    et = hashlib.md5(body.encode("utf-8")).hexdigest()
    if request.headers.get("If-None-Match")==et:
        r = make_response("", 304)
    else:
        r = Response(body, mimetype="text/markdown; charset=utf-8")
        r.set_etag(et)
    r.headers["Cache-Control"]="no-store"
    return r

# ---------------- COMPAT: /kpi/wallet?alias=ABCD ----------------
@app.get("/kpi/wallet")
def wallet_get_compat():
    alias = request.args.get("alias","").upper()
    if not alias or not CODE_RE.match(alias):
        return jsonify({"ok": False, "error":"CODE_INVALID"}), 400
    return jsonify({"ok": True, "alias": alias, "kukel": _wallet_get(alias)})

# ---------------- COMPAT: /kpi/traffic/read[?json=1] -------------
@app.get("/kpi/traffic/read")
def traffic_read_compat():
    now = _now()
    with _lock:
        cnt = _active_count(now)
    if request.args.get("json"):
        return jsonify({"ok": True, "traffic": cnt})
    body = f"the101game — Traffic KPI\nTraffic: {cnt:05d}\n"
    return Response(body, mimetype="text/plain; charset=utf-8")
