# app.py — W0L1 · THE ENGINE / DE MOTOR
# -------------------------------------
# Eén motor voor the101game.io (EN) en the101game.nl (NL)
# Genesis-Blockchain + Impact + Audio-parameters
# Flask 2.2.x · Python 3.11 · SQLAlchemy voor persistente keten
# -------------------------------------

import json
import os
import threading
import time
from dataclasses import dataclass
from hashlib import sha256
from typing import Dict, Any, Optional

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

# -------------------------
# CONFIG · CONSTANTS
# -------------------------

VERSION = "W0L1"
APP_NAME_EN = "THE ENGINE"
APP_NAME_NL = "DE MOTOR"
DEFAULT_DB = os.environ.get("ENGINE_DB", "sqlite:///engine.db")

IMPACT_RULE = {"A": 1, "B": -1, "C": 2, "D": 3, "E": -2}
CHOICES = set(IMPACT_RULE.keys())

# Audio-formule parameters (spiegelen met jouw app.js)
BASE_MS = 180  # basissustain in ms
Y_MIN, Y_MAX = 0.2, 3.0
TALENT_MIN, TALENT_MAX = 0, 10

# === MINIMAL HOMEPAGE HTML ===
MIN_HTML = """
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>HALLO MAMA!</title>
  <meta name="color-scheme" content="dark">
  <style>
    :root{ --bg:#000; --fg:#fff; --line:#fff; --accent:#ffd400; --ok:#00e676; }
    *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent }
    html,body{
      height:100%; margin:0; background:var(--bg); color:var(--fg);
      font: clamp(16px,2.5vw,20px)/1.25 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial;
    }
    .wrap{ min-height:100%; display:grid; place-items:center; padding:12vh 6vw }
    .box{
      display:flex; flex-direction:column; align-items:center; gap:24px;
      border:1px solid var(--line); border-radius:10px; padding:10vh 8vw;
      width:min(92vw,1000px);
    }
    h1{ margin:0; font-weight:800; text-transform:uppercase; letter-spacing:.5px;
        font-size:clamp(28px,8vw,80px); text-align:center; }
    p{ margin:0; opacity:.9; text-align:center; max-width:60ch }
    .row{ display:flex; gap:14px; flex-wrap:wrap; justify-content:center }
    a.btn, button{
      appearance:none; background:transparent; color:var(--fg);
      border:2px solid var(--accent); border-radius:8px;
      padding:.75em 1.1em; font-weight:700; letter-spacing:.3px;
      text-decoration:none; cursor:pointer; outline:none;
    }
    a.btn:hover, button:hover{ filter:brightness(1.1) }
    a.btn:active, button:active, .active{ border-color:var(--ok); color:var(--ok) }
    a.btn:focus-visible, button:focus-visible{ outline:2px solid var(--accent); outline-offset:2px }
    hr{ width:100%; border:0; border-top:1px solid var(--line); opacity:.35; margin:10px 0 0 0 }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="box">
      <h1>Test</h1>
      <p>Minimal mode · zwart scherm · witte lijnen · gele randen · groen bij klik.</p>
      <div class="row">
        <a class="btn" href="/" id="okBtn">OK</a>
        <button id="metronomeBtn">Klik</button>
      </div>
      <hr>
    </section>
  </main>

  <script>
  (function(){
    // --- WebAudio metronoom (1 tik per seconde), geen externe audio ---
    let AC = null;              // AudioContext
    let schedulerTimer = null;  // setInterval id
    let nextTickTime = 0;       // in AC.currentTime
    const scheduleAhead = 0.2;  // plan 200ms vooruit
    const lookaheadMs  = 50;    // elke 50ms checken

    function ensureAC(){
      if (AC) return AC;
      AC = new (window.AudioContext || window.webkitAudioContext)();
      return AC;
    }

    // Kort klikje: 1kHz, ~35ms, snelle decay -> 'metronoom' feel
    function scheduleClick(atTime){
      const ac = ensureAC();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "square";           // lekker snappy
      osc.frequency.value = 1000;

      // Envelope: snelle attack, snelle decay
      const g = gain.gain;
      g.setValueAtTime(0.0001, atTime);
      g.exponentialRampToValueAtTime(0.6, atTime + 0.002);
      g.exponentialRampToValueAtTime(0.0001, atTime + 0.035);

      osc.connect(gain).connect(ac.destination);
      osc.start(atTime);
      osc.stop(atTime + 0.05);
    }

    function startMetronome(){
      const ac = ensureAC();
      // sommige browsers vereisen expliciet resume na user gesture
      if (ac.state === "suspended") { ac.resume().catch(()=>{}); }

      // Start op de eerstvolgende hele seconde (kleine offset om tik hoorbaar te garanderen)
      const now = ac.currentTime;
      nextTickTime = Math.ceil(now) + 0.05;

      if (schedulerTimer) clearInterval(schedulerTimer);
      schedulerTimer = setInterval(() => {
        const ct = ac.currentTime;
        while (nextTickTime < ct + scheduleAhead) {
          scheduleClick(nextTickTime);
          nextTickTime += 1.0; // elke seconde
        }
      }, lookaheadMs);
    }

    function stopMetronome(){
      if (schedulerTimer){ clearInterval(schedulerTimer); schedulerTimer = null; }
    }

    // --- UI binding (toggle) ---
    const metBtn = document.getElementById('metronomeBtn');
    metBtn.addEventListener('click', () => {
      const active = metBtn.classList.toggle('active');
      if (active) startMetronome(); else stopMetronome();
    });

    // OK blijft gewoon reloaden (anchor met href="/")
    // Tip: wil je SPA-achtig gedrag, preventDefault + locatie.replace, maar nu niet nodig.
  })();
  </script>
</body>
</html>
"""

# -------------------------
# FLASK & DB INIT
# -------------------------

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = DEFAULT_DB
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me-in-prod")
db = SQLAlchemy(app)

_append_lock = threading.Lock()

# -------------------------
# I18N · HOST → LANGUAGE
# -------------------------

STRINGS = {
    "en": {
        "title": f"{VERSION} – {APP_NAME_EN} / {APP_NAME_NL}",
        "tagline": "Play the impact. See the chain.",
        "impact": "Impact",
        "engine_header": f"{VERSION} · {APP_NAME_EN}",
        "recent": "Recent Blocks",
        "cta_a": "A", "cta_b": "B", "cta_c": "C", "cta_d": "D", "cta_e": "E",
        "oops": "Invalid choice.",
        "verify_ok": "Chain OK", "verify_bad": "Chain INVALID",
    },
    "nl": {
        "title": f"{VERSION} – {APP_NAME_EN} / {APP_NAME_NL}",
        "tagline": "Speel de impact. Zie de keten.",
        "impact": "Impact",
        "engine_header": f"{VERSION} · {APP_NAME_NL}",
        "recent": "Recente Blokken",
        "cta_a": "A", "cta_b": "B", "cta_c": "C", "cta_d": "D", "cta_e": "E",
        "oops": "Ongeldige keuze.",
        "verify_ok": "Keten OK", "verify_bad": "Keten ONGELDIG",
    },
}

def get_lang() -> str:
    q = (request.args.get("lang") or "").lower()
    if q in ("nl", "en"):
        return q
    host = (request.host or "").split(":")[0].lower()
    if host.endswith(".nl") or host == "the101game.nl":
        return "nl"
    return "en"

# -------------------------
# DB MODELS
# -------------------------

class Block(db.Model):
    __tablename__ = "blocks"
    id = db.Column(db.Integer, primary_key=True)
    ts = db.Column(db.Float, nullable=False)        # epoch seconds
    prev_hash = db.Column(db.String(64), nullable=False)
    data = db.Column(db.Text, nullable=False)       # JSON payload
    hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    impact_total = db.Column(db.Integer, nullable=False, default=0)

    def to_dict(self) -> Dict[str, Any]:
        payload = json.loads(self.data)
        return {
            "index": self.id, "ts": self.ts, "prev_hash": self.prev_hash,
            "hash": self.hash, "impact_total": self.impact_total, "payload": payload,
        }

# -------------------------
# ENGINE STATE
# -------------------------

@dataclass
class EngineState:
    impact_total: int = 0

ENGINE = EngineState()

def _calc_hash(index: int, ts: float, data_json: str, prev_hash: str) -> str:
    raw = f"{index}|{ts:.6f}|{data_json}|{prev_hash}"
    return sha256(raw.encode("utf-8")).hexdigest()

def _ensure_genesis() -> None:
    if Block.query.count() > 0:
        last = Block.query.order_by(Block.id.desc()).first()
        ENGINE.impact_total = int(last.impact_total or 0)
        return
    genesis_payload = {"type": "genesis", "version": VERSION, "note": "The chain begins."}
    ts = time.time()
    data_json = json.dumps(genesis_payload, separators=(",", ":"))
    h = _calc_hash(0, ts, data_json, "0")
    b = Block(id=0, ts=ts, prev_hash="0", data=data_json, hash=h, impact_total=0)
    db.session.add(b)
    db.session.commit()
    ENGINE.impact_total = 0

def _audio_params(choice: str, y: float, talent: int) -> Dict[str, Any]:
    y = max(Y_MIN, min(Y_MAX, y))
    talent = max(TALENT_MIN, min(TALENT_MAX, int(talent)))
    dur_mel = round(BASE_MS * (0.8 + 0.4 * y))       # ms
    dur_bas = round(dur_mel * 0.7)
    detune_cents = (talent - 5) * 2                  # -10..+10
    vol_mel = round(0.25 + 0.05 * talent / 10, 3)
    vol_bas = round(0.18 + 0.04 * talent / 10, 3)
    return {
        "choice": choice, "y": y, "talent": talent,
        "dur_mel_ms": dur_mel, "dur_bas_ms": dur_bas,
        "detune_cents": detune_cents, "vol_mel": vol_mel, "vol_bas": vol_bas,
    }

def append_block(choice: str, y: float, talent: int, meta: Optional[Dict[str, Any]] = None) -> Block:
    if choice not in CHOICES:
        raise ValueError("invalid choice")
    delta = IMPACT_RULE[choice]
    with _append_lock:
        last = Block.query.order_by(Block.id.desc()).first()
        index = (last.id + 1) if last else 1
        ENGINE.impact_total = (ENGINE.impact_total or 0) + delta
        payload = {
            "type": "choice", "choice": choice, "impact_delta": delta,
            "impact_after": ENGINE.impact_total, "audio": _audio_params(choice, y, talent),
            "meta": meta or {},
        }
        ts = time.time()
        data_json = json.dumps(payload, separators=(",", ":"))
        prev_hash = last.hash if last else "0"
        h = _calc_hash(index, ts, data_json, prev_hash)
        b = Block(id=index, ts=ts, prev_hash=prev_hash, data=data_json, hash=h,
                  impact_total=ENGINE.impact_total)
        db.session.add(b)
        db.session.commit()
        return b

def verify_chain(limit: Optional[int] = None) -> Dict[str, Any]:
    q = Block.query.order_by(Block.id.asc())
    blocks = q.all() if not limit else q.limit(limit).all()
    ok = True
    bad_at = None
    prev_h = "0"
    for b in blocks:
        h = _calc_hash(b.id, b.ts, b.data, b.prev_hash)
        if b.hash != h or b.prev_hash != prev_h:
            ok = False; bad_at = b.id; break
        prev_h = b.hash
    return {"ok": ok, "bad_at": bad_at, "count": len(blocks)}

# -------------------------
# ROUTES · PAGES
# -------------------------

@app.route("/")
def index():
    return MIN_HTML

# -------------------------
# ROUTES · API
# -------------------------

@app.post("/api/choice")
def api_choice():
    try:
        payload = request.get_json(silent=True) or {}
        choice = str(payload.get("choice", "")).upper()
        y = float(payload.get("y", 1.0))
        talent = int(payload.get("talent", 0))
        meta = payload.get("meta") or {}
        block = append_block(choice, y, talent, meta)
        return jsonify(_state_response(recent_n=12, latest=block))
    except ValueError:
        return jsonify({"error": STRINGS[get_lang()]["oops"]}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.get("/api/state")
def api_state():
    return jsonify(_state_response(recent_n=12))

@app.get("/api/chain")
def api_chain():
    try:
        limit = int(request.args.get("limit", "50"))
    except Exception:
        limit = 50
    q = Block.query.order_by(Block.id.desc()).limit(max(1, min(500, limit)))
    blocks = [b.to_dict() for b in q.all()]
    return jsonify({"items": blocks, "count": len(blocks)})

@app.get("/api/verify")
def api_verify():
    v = verify_chain()
    s = STRINGS[get_lang()]
    v["message"] = s["verify_ok"] if v["ok"] else s["verify_bad"]
    return jsonify(v)

@app.get("/add_block/<choice>")
def add_block_compat(choice: str):
    choice = (choice or "").upper()
    try:
        block = append_block(choice, 1.0, 0, meta={"compat": True})
    except ValueError:
        return jsonify({"error": STRINGS[get_lang()]["oops"]}), 400
    return jsonify(_state_response(recent_n=12, latest=block))

# -------------------------
# HELPERS
# -------------------------

def _state_response(recent_n: int = 10, latest: Optional[Block] = None) -> Dict[str, Any]:
    last = latest or Block.query.order_by(Block.id.desc()).first()
    q = Block.query.order_by(Block.id.desc()).limit(recent_n)
    recent = [b.to_dict() for b in q.all()]
    return {
        "version": VERSION, "engine": "the101game",
        "impact_total": ENGINE.impact_total,
        "chain_length": (last.id + 1) if last else 1,
        "latest_index": last.id if last else 0,
        "recent": list(reversed(recent)),
    }

# -------------------------
# BOOTSTRAP
# -------------------------

@app.before_first_request
def _bootstrap():
    db.create_all()
    _ensure_genesis()

# -------------------------
# MAIN
# -------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    app.run(host="0.0.0.0", port=port, debug=True)
