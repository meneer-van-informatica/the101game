# app.py — W0L1 · THE ENGINE / DE MOTOR
# -------------------------------------
# één motor voor the101game.io (EN) en the101game.nl (NL)
# genesis-blockchain + impact + audio-parameters
# flask 2.2.x · python 3.11 · sqlalchemy voor persistente keten
# -------------------------------------

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass
from hashlib import sha256
from typing import Dict, Any, Optional, Callable

from flask import Flask, request, jsonify, redirect
from flask_sqlalchemy import SQLAlchemy

# -------------------------
# config · constants
# -------------------------

VERSION = 'W0L1'
APP_NAME_EN = 'THE ENGINE'
APP_NAME_NL = 'DE MOTOR'
DEFAULT_DB = os.environ.get('ENGINE_DB', 'sqlite:///engine.db')
SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me-in-prod')

IMPACT_RULE = {'A': 1, 'B': -1, 'C': 2, 'D': 3, 'E': -2}
CHOICES = set(IMPACT_RULE.keys())

# audio-formule parameters
BASE_MS = 180
Y_MIN, Y_MAX = 0.2, 3.0
TALENT_MIN, TALENT_MAX = 0, 10

# request limieten
MAX_JSON_BYTES = 4096
POST_RATE_PER_MIN = 60  # simpele limiet per ip

# === w0l0 html (lmw) ===
W0L0_HTML = r'''
<!doctype html>
<html lang='nl'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'>
  <title>W0L0 · THE101GAME · LMW</title>
  <meta name='color-scheme' content='dark light'>
  <style>
    :root{ --bg:#0a0a0a; --fg:#eaeaea; --line:#2a2a2a; --ink:#00ff66; --accent:#ffd400; }
    *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent }
    html,body{ margin:0; background:var(--bg); color:var(--fg);
      font: clamp(16px,2.4vw,20px)/1.45 system-ui,Segoe UI,Roboto,Arial }
    header,main,footer{ max-width:960px; margin:0 auto; padding:16px; }
    header{ border-bottom:2px solid var(--line) }
    h1{ margin:4px 0 0 0; letter-spacing:.5px }
    article{ border:1px solid var(--line); border-radius:8px; padding:18px; margin:16px 0 }
    h2{ margin:6px 0 8px 0; border-left:4px solid var(--ink); padding-left:8px }
    pre{ white-space:pre-wrap; background:#0f0f0f; border:1px solid var(--line); padding:12px; border-radius:6px }
    code{ font-family:Consolas,Menlo,monospace }
    .meta{ display:flex; gap:12px; flex-wrap:wrap; opacity:.85 }
    a, .btn{ color:#7fd1ff; text-decoration:none; border:1px solid var(--line); padding:6px 10px; border-radius:6px }
    nav{ display:flex; gap:10px; flex-wrap:wrap; margin-top:10px }
  </style>
</head>
<body>
  <header>
    <h1>W0L0 · bericht van lmw</h1>
    <nav>
      <a href='/'>home</a>
      <a href='/api/w0l0'>json</a>
      <a href='/api/verify'>verify</a>
      <a href='/api/chain?limit=12'>chain</a>
    </nav>
  </header>
  <main>
    <article>
      <h2>hoi allemaal,</h2>
      <pre>
dit is mijn eerste mail en onze eerste classroom-post. nieuwe ronde, nieuwe kansen. we houden het simpel en leuk.

challenge 0 (kiss): captain mailt mij een elftal

doel: we vormen teams en maken een handle die bij je past
locatie: gmail via je schoolaccount
deadline: maandag 8 september 23:59 (amsterdam)
beloning: 1 kukel per compleet elftal

wat stuur je
1 regel per speler in dit format:
naam, handle, rugnummer, positie, geslacht

regels
handle: 3 t/m 16 tekens, a-z, 0-9, streepje of underscore oké, geen spaties, uniek in je team
rugnummer: 1 t/m 99, elk nummer maar 1 keer in je team
positie: gk, def, mid, att
geen privé-info in handles

voorbeelden
aisha karim, s0laris, 7, mid, v
jay den boer, night_owl, 1, gk, m

per klas
4h: zacht landen. maak 1 eigen regel en mail die. onderwerp: challenge 0 – 4h – jouw naam
4v: idem 4h. buddy-check elkaars handle. onderwerp: challenge 0 – 4v – jouw naam
5h: maak een mini-elftal van 5 spelers. check unieke handles en nummers. onderwerp: challenge 0 – 5h – mini-elftal
5v: productie. lever 11 regels voor een compleet elftal. onderwerp: challenge 0 – 5v – elftal
6v: productie plus datakwaliteit. lever 11 regels en voeg 3 checks toe in bullets. onderwerp: challenge 0 – 6v – elftal + checks

tip workflow
1 lees de regels hardop met je buddy
2 kies je handle met het k-9-model: kort, spreekbaar, uniek
3 bouw je regels in notepad en plak in je mail
4 laat je buddy laatste check doen en stuur op tijd

netiquette
1 duidelijke onderwerpregel
1 korte eerste zin die zegt wat je inlevert
1 afsluiter met je naam en klas

captains
noem jezelf expliciet captain in de mail en zet je teamnaam in de onderwerpregel

ik kijk uit naar jullie eerste inzendingen. de eerste pannenkoek mislukt altijd. dat is prima. morgen weer een nieuwe.

met vriendelijke groet,
meneer de bruin
      </pre>
      <div class='meta'>
        <span>label: w0l0</span>
        <span>mode: kiss</span>
        <span>bron: lmw</span>
      </div>
    </article>
  </main>
  <footer>
    <small>&copy; 2025 the101game · eenvoud wint</small>
  </footer>
</body>
</html>
'''

# === minimal homepage html (fallback) ===
MIN_HTML = r'''
<!doctype html>
<html lang='nl'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'>
  <title>THE101GAME · MINIMAL</title>
  <meta name='color-scheme' content='dark'>
  <style>
    :root{ --bg:#000; --fg:#fff; --line:#fff; --accent:#ffd400; --ok:#00e676 }
    *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent }
    html,body{ height:100%; margin:0; background:var(--bg); color:var(--fg);
      font: clamp(16px,2.5vw,20px)/1.25 system-ui,Segoe UI,Roboto,Ubuntu,Arial }
    .wrap{ min-height:100%; display:grid; place-items:center; padding:12vh 6vw }
    .box{ display:flex; flex-direction:column; align-items:center; gap:24px;
      border:1px solid var(--line); border-radius:10px; padding:10vh 8vw; width:min(92vw,1000px) }
    h1{ margin:0; font-weight:800; text-transform:uppercase; letter-spacing:.5px;
        font-size:clamp(28px,8vw,80px); text-align:center }
    a.btn{ color:var(--fg); border:2px solid var(--accent); padding:.75em 1.1em; text-decoration:none; border-radius:8px }
    nav{ display:flex; gap:12px; flex-wrap:wrap }
  </style>
</head>
<body>
  <main class='wrap'>
    <section class='box'>
      <h1>THE101GAME</h1>
      <nav>
        <a class='btn' href='/w0l0'>w0l0</a>
        <a class='btn' href='/api/verify'>verify</a>
        <a class='btn' href='/api/chain?limit=10'>chain</a>
      </nav>
    </section>
  </main>
</body>
</html>
'''

# -------------------------
# flask & db init
# -------------------------

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DEFAULT_DB
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = SECRET_KEY
db = SQLAlchemy(app)

_append_lock = threading.Lock()
_rate: Dict[str, list[float]] = {}

# -------------------------
# i18n · host → language
# -------------------------

STRINGS = {
    'en': {
        'title': f'{VERSION} – {APP_NAME_EN} / {APP_NAME_NL}',
        'tagline': 'Play the impact. See the chain.',
        'impact': 'Impact',
        'engine_header': f'{VERSION} · {APP_NAME_EN}',
        'recent': 'Recent Blocks',
        'oops': 'Invalid choice.',
        'verify_ok': 'Chain OK', 'verify_bad': 'Chain INVALID',
    },
    'nl': {
        'title': f'{VERSION} – {APP_NAME_EN} / {APP_NAME_NL}',
        'tagline': 'Speel de impact. Zie de keten.',
        'impact': 'Impact',
        'engine_header': f'{VERSION} · {APP_NAME_NL}',
        'recent': 'Recente Blokken',
        'oops': 'Ongeldige keuze.',
        'verify_ok': 'Keten OK', 'verify_bad': 'Keten ONGELDIG',
    },
}

def get_lang() -> str:
    q = (request.args.get('lang') or '').lower()
    if q in ('nl', 'en'):
        return q
    host = (request.host or '').split(':')[0].lower()
    if host.endswith('.nl') or host == 'the101game.nl':
        return 'nl'
    return 'en'

# -------------------------
# db models
# -------------------------

class Block(db.Model):
    __tablename__ = 'blocks'
    id = db.Column(db.Integer, primary_key=True)
    ts = db.Column(db.Float, nullable=False)
    prev_hash = db.Column(db.String(64), nullable=False)
    data = db.Column(db.Text, nullable=False)
    hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    impact_total = db.Column(db.Integer, nullable=False, default=0)

    def to_dict(self) -> Dict[str, Any]:
        payload = json.loads(self.data)
        return {
            'index': self.id, 'ts': self.ts, 'prev_hash': self.prev_hash,
            'hash': self.hash, 'impact_total': self.impact_total, 'payload': payload,
        }

# -------------------------
# engine state
# -------------------------

@dataclass
class EngineState:
    impact_total: int = 0

ENGINE = EngineState()

def _calc_hash(index: int, ts: float, data_json: str, prev_hash: str) -> str:
    raw = f'{index}|{ts:.6f}|{data_json}|{prev_hash}'
    return sha256(raw.encode('utf-8')).hexdigest()

def _ensure_genesis() -> None:
    if Block.query.count() > 0:
        last = Block.query.order_by(Block.id.desc()).first()
        ENGINE.impact_total = int(last.impact_total or 0)
        return
    genesis_payload = {'type': 'genesis', 'version': VERSION, 'note': 'the chain begins'}
    ts = time.time()
    data_json = json.dumps(genesis_payload, separators=(',', ':'))
    h = _calc_hash(0, ts, data_json, '0')
    b = Block(id=0, ts=ts, prev_hash='0', data=data_json, hash=h, impact_total=0)
    db.session.add(b)
    db.session.commit()
    ENGINE.impact_total = 0

def _audio_params(choice: str, y: float, talent: int) -> Dict[str, Any]:
    y = max(Y_MIN, min(Y_MAX, y))
    talent = max(TALENT_MIN, min(TALENT_MAX, int(talent)))
    dur_mel = round(BASE_MS * (0.8 + 0.4 * y))
    dur_bas = round(dur_mel * 0.7)
    detune_cents = (talent - 5) * 2
    vol_mel = round(0.25 + 0.05 * talent / 10, 3)
    vol_bas = round(0.18 + 0.04 * talent / 10, 3)
    return {
        'choice': choice, 'y': y, 'talent': talent,
        'dur_mel_ms': dur_mel, 'dur_bas_ms': dur_bas,
        'detune_cents': detune_cents, 'vol_mel': vol_mel, 'vol_bas': vol_bas,
    }

def append_block(choice: str, y: float, talent: int, meta: Optional[Dict[str, Any]] = None) -> Block:
    if choice not in CHOICES:
        raise ValueError('invalid choice')
    delta = IMPACT_RULE[choice]
    with _append_lock:
        last = Block.query.order_by(Block.id.desc()).first()
        index = (last.id + 1) if last else 1
        ENGINE.impact_total = (ENGINE.impact_total or 0) + delta
        payload = {
            'type': 'choice', 'choice': choice, 'impact_delta': delta,
            'impact_after': ENGINE.impact_total, 'audio': _audio_params(choice, y, talent),
            'meta': meta or {},
        }
        ts = time.time()
        data_json = json.dumps(payload, separators=(',', ':'))
        prev_hash = last.hash if last else '0'
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
    prev_h = '0'
    for b in blocks:
        h = _calc_hash(b.id, b.ts, b.data, b.prev_hash)
        if b.hash != h or b.prev_hash != prev_h:
            ok = False; bad_at = b.id; break
        prev_h = b.hash
    return {'ok': ok, 'bad_at': bad_at, 'count': len(blocks)}

# -------------------------
# helpers · security
# -------------------------

def _client_ip() -> str:
    xff = request.headers.get('x-forwarded-for', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.remote_addr or '0.0.0.0'

def _rate_limit(bucket: Dict[str, list[float]], key: str, limit: int, window_s: int) -> bool:
    now = time.time()
    lst = bucket.setdefault(key, [])
    # drop old
    cutoff = now - window_s
    while lst and lst[0] < cutoff:
        lst.pop(0)
    if len(lst) >= limit:
        return False
    lst.append(now)
    return True

@app.after_request
def _secure_headers(resp):
    resp.headers['x-content-type-options'] = 'nosniff'
    resp.headers['x-frame-options'] = 'SAMEORIGIN'
    resp.headers['referrer-policy'] = 'no-referrer'
    resp.headers['content-security-policy'] = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self'; connect-src 'self'"
    return resp

# -------------------------
# routes · pages
# -------------------------

@app.get('/')
def index():
    host = (request.host or '').split(':')[0].lower()
    if host.endswith('.io') or host == 'the101game.io':
        return W0L0_HTML
    return MIN_HTML

@app.get('/w0l0')
def w0l0_page():
    return W0L0_HTML

# -------------------------
# routes · api
# -------------------------

@app.post('/api/choice')
def api_choice():
    try:
        # body limiet
        raw = request.get_data(cache=False, as_text=False)
        if raw and len(raw) > MAX_JSON_BYTES:
            return jsonify({'error': 'payload te groot'}), 413
        # rate limit per ip
        if not _rate_limit(_rate, f'choice:{_client_ip()}', POST_RATE_PER_MIN, 60):
            return jsonify({'error': 'te veel verzoeken'}), 429
        payload = request.get_json(silent=True) or {}
        choice = str(payload.get('choice', '')).upper()
        y = float(payload.get('y', 1.0))
        talent = int(payload.get('talent', 0))
        meta = payload.get('meta') or {}
        block = append_block(choice, y, talent, meta)
        return jsonify(_state_response(recent_n=12, latest=block))
    except ValueError:
        return jsonify({'error': STRINGS[get_lang()]['oops']}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.get('/api/state')
def api_state():
    return jsonify(_state_response(recent_n=12))

@app.get('/api/chain')
def api_chain():
    try:
        limit = int(request.args.get('limit', '50'))
    except Exception:
        limit = 50
    q = Block.query.order_by(Block.id.desc()).limit(max(1, min(500, limit)))
    blocks = [b.to_dict() for b in q.all()]
    return jsonify({'items': blocks, 'count': len(blocks)})

@app.get('/api/verify')
def api_verify():
    v = verify_chain()
    s = STRINGS[get_lang()]
    v['message'] = s['verify_ok'] if v['ok'] else s['verify_bad']
    return jsonify(v)

@app.get('/add_block/<choice>')
def add_block_compat(choice: str):
    choice = (choice or '').upper()
    try:
        block = append_block(choice, 1.0, 0, meta={'compat': True})
    except ValueError:
        return jsonify({'error': STRINGS[get_lang()]['oops']}), 400
    return jsonify(_state_response(recent_n=12, latest=block))

@app.get('/api/w0l0')
def api_w0l0():
    return jsonify({
        'label': 'w0l0',
        'author': 'lmw',
        'html': True,
        'body': W0L0_HTML[:2048]  # preview om json klein te houden
    })

# -------------------------
# helpers
# -------------------------

def _state_response(recent_n: int = 10, latest: Optional[Block] = None) -> Dict[str, Any]:
    last = latest or Block.query.order_by(Block.id.desc()).first()
    q = Block.query.order_by(Block.id.desc()).limit(recent_n)
    recent = [b.to_dict() for b in q.all()]
    return {
        'version': VERSION, 'engine': 'the101game',
        'impact_total': ENGINE.impact_total,
        'chain_length': (last.id + 1) if last else 1,
        'latest_index': last.id if last else 0,
        'recent': list(reversed(recent)),
    }

# -------------------------
# health
# -------------------------

@app.get('/healthz')
def healthz():
    return jsonify({'ok': True, 'version': VERSION})

@app.get('/readyz')
def readyz():
    try:
        db.session.execute(db.text('select 1'))
        return jsonify({'ready': True})
    except Exception as e:
        return jsonify({'ready': False, 'error': str(e)}), 500

# -------------------------
# bootstrap
# -------------------------

@app.before_first_request
def _bootstrap():
    db.create_all()
    _ensure_genesis()

# -------------------------
# main
# -------------------------

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '3000'))
    app.run(host='0.0.0.0', port=port, debug=False)
