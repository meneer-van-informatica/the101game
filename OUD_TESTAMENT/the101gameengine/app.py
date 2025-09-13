# app.py — W0L1 · THE ENGINE / DE MOTOR
# -------------------------------------
# één motor met 'ketting' van levels:
# GENESIS → W0L0 → W0L1 → … → W9L9 → L100
# elke level krijgt links-onder TERUG/GENESIS en rechts-onder NEXT [kosten]
# lexicon.json bepaalt 'model' per level (fallback als bestand ontbreekt)
# -------------------------------------

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass
from hashlib import sha256
from typing import Dict, Any, Optional, List, Tuple

from flask import Flask, request, jsonify
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

BASE_MS = 180
Y_MIN, Y_MAX = 0.2, 3.0
TALENT_MIN, TALENT_MAX = 0, 10

MAX_JSON_BYTES = 4096
POST_RATE_PER_MIN = 60

# -------------------------
# flask & db
# -------------------------

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DEFAULT_DB
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = SECRET_KEY
db = SQLAlchemy(app)

_append_lock = threading.Lock()
_rate: Dict[str, List[float]] = {}

# -------------------------
# i18n
# -------------------------

STRINGS = {
    'en': {
        'title': f'{VERSION} – {APP_NAME_EN} / {APP_NAME_NL}',
        'oops': 'Invalid choice.',
        'verify_ok': 'Chain OK', 'verify_bad': 'Chain INVALID',
        'genesis': 'GENESIS', 'back': 'BACK', 'next': 'NEXT',
        'model': 'Model', 'hook': 'Hook', 'do': 'Do', 'proof': 'Proof', 'enter': 'Press Enter',
        'pick_lang': 'Pick your language',
    },
    'nl': {
        'title': f'{VERSION} – {APP_NAME_EN} / {APP_NAME_NL}',
        'oops': 'Ongeldige keuze.',
        'verify_ok': 'Keten OK', 'verify_bad': 'Keten ONGELDIG',
        'genesis': 'GENESIS', 'back': 'TERUG', 'next': 'VOLGENDE',
        'model': 'Model', 'hook': 'Hook', 'do': 'Doen', 'proof': 'Bewijs', 'enter': 'Enter → volgende',
        'pick_lang': 'Kies je taal',
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

# -------------------------
# security helpers
# -------------------------

def _client_ip() -> str:
    xff = request.headers.get('x-forwarded-for', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.remote_addr or '0.0.0.0'

def _rate_limit(bucket: Dict[str, List[float]], key: str, limit: int, window_s: int) -> bool:
    now = time.time()
    lst = bucket.setdefault(key, [])
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
# chain layout (for-loops)
# -------------------------

def build_chain_codes() -> List[str]:
    codes: List[str] = ['W0L0', 'W0L1']
    for w in range(0, 10):
        for l in range(2, 10):  # L2..L9 per wereld
            codes.append(f'W{w}L{l}')
    codes.append('L100')
    return codes

CHAIN: List[str] = build_chain_codes()
INDEX_BY_CODE: Dict[str, int] = {code: i for i, code in enumerate(CHAIN)}

def neighbors(code: str) -> Tuple[Optional[str], Optional[str]]:
    i = INDEX_BY_CODE.get(code)
    if i is None:
        return None, None
    prev_code = CHAIN[i - 1] if i > 0 else None
    next_code = CHAIN[i + 1] if i + 1 < len(CHAIN) else None
    return prev_code, next_code

# -------------------------
# lexicon load + backup
# -------------------------

def _lexicon_fallback() -> Dict[str, Any]:
    # minimale NL/EN content, model per level centraal
    return {
        'models': {
            'W0L0': {
                'model': 'KISS',
                'title': {'nl': 'KISS – Keep It Simple Stupid', 'en': 'KISS – Keep It Simple Stupid'},
                'hook': {'nl': 'één klik, één tik', 'en': 'one click, one tick'},
                'do': {'nl': 'lees de kaart en klik', 'en': 'read the card and click'},
                'proof': {'nl': 'je hoort de tik', 'en': 'you hear the tick'},
                'next_cost': {'nl': '1 kukel', 'en': '1 kukel'}
            },
            'W0L1': {
                'model': 'TODO',
                'title': {'nl': 'TODO – Technological Order Distribution Office', 'en': 'TODO – Technological Order Distribution Office'},
                'hook': {'nl': 'orde schept rust', 'en': 'order creates calm'},
                'do': {'nl': 'vul één regel in je notepad', 'en': 'write one line in notepad'},
                'proof': {'nl': 'toon de regel aan je buddy', 'en': 'show the line to your buddy'},
                'next_cost': {'nl': '2 kukel', 'en': '2 kukel'}
            }
        }
    }

def load_lexicon(path: str = 'lexicon.json') -> Dict[str, Any]:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        data = _lexicon_fallback()
    # backup
    try:
        os.makedirs('backup', exist_ok=True)
        stamp = time.strftime('%Y%m%d%H%M%S')
        with open(os.path.join('backup', f'lexicon.{stamp}.json'), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    return data

LEXICON: Dict[str, Any] = load_lexicon()

# -------------------------
# html builders
# -------------------------

def _level_strings(code: str, lang: str) -> Dict[str, str]:
    s = STRINGS[lang]
    m = (LEXICON.get('models') or {}).get(code) or {}
    def tr(key: str, default: str) -> str:
        val = m.get(key)
        if isinstance(val, dict):
            return val.get(lang) or val.get('nl') or val.get('en') or default
        return val or default
    return {
        'title': tr('title', code),
        'model': m.get('model') or 'MODEL',
        'hook': tr('hook', ''),
        'do': tr('do', ''),
        'proof': tr('proof', ''),
        'next_cost': tr('next_cost', ''),
        'ui_model': s['model'],
        'ui_hook': s['hook'],
        'ui_do': s['do'],
        'ui_proof': s['proof'],
        'ui_enter': s['enter'],
        'ui_next': s['next'],
        'ui_back': s['back'],
        'ui_genesis': s['genesis'],
    }

def render_level_html(code: str, lang: str) -> str:
    prev_code, next_code = neighbors(code)
    t = _level_strings(code, lang)
    left_label = t['ui_genesis'] if not prev_code else t['ui_back']
    left_href = '/w0l0' if not prev_code else f'/{prev_code.lower()}'
    right_label = f"{t['ui_next']} [{t['next_cost']}]" if next_code else t['ui_next']
    right_href = f'/{(next_code or code).lower()}'

    return f"""<!doctype html>
<html lang='{lang}'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'>
  <title>{code} · {t['title']}</title>
  <meta name='color-scheme' content='dark light'>
  <style>
    :root{{ --bg:#0b0b0b; --fg:#e9e9e9; --line:#2a2a2a; --ink:#00ff66; --accent:#ffd400 }}
    *{{ box-sizing:border-box; -webkit-tap-highlight-color:transparent }}
    html,body{{ margin:0; background:var(--bg); color:var(--fg);
      font: clamp(16px,2.4vw,20px)/1.45 system-ui,Segoe UI,Roboto,Arial }}
    header,main,footer{{ max-width:980px; margin:0 auto; padding:16px }}
    header{{ border-bottom:2px solid var(--line) }}
    h1{{ margin:6px 0 0 0; letter-spacing:.4px }}
    .card{{ border:1px solid var(--line); border-radius:8px; padding:16px; margin-top:16px }}
    h2{{ margin:8px 0; border-left:4px solid var(--ink); padding-left:8px }}
    .grid{{ display:grid; grid-template-columns:1fr; gap:10px }}
    .meta{{ opacity:.85; display:flex; gap:10px; flex-wrap:wrap }}
    .btn{{ position:fixed; bottom:14px; padding:10px 14px; border:2px solid var(--accent);
      border-radius:10px; background:transparent; color:var(--fg); text-decoration:none; font-weight:700 }}
    #left{{ left:14px }}
    #right{{ right:14px }}
    .pill{{ border:1px solid var(--line); border-radius:999px; padding:2px 8px }}
    kbd{{ border:1px solid var(--line); border-radius:4px; padding:2px 6px; background:#111 }}
  </style>
</head>
<body>
  <header>
    <h1>{code} · {t['title']}</h1>
    <div class='meta'>
      <span class='pill'>{t['ui_model']}: {t['model']}</span>
      <span class='pill'>v {VERSION}</span>
    </div>
  </header>
  <main>
    <article class='card grid'>
      <section>
        <h2>{t['ui_hook']}</h2>
        <p>{t['hook']}</p>
      </section>
      <section>
        <h2>{t['ui_do']}</h2>
        <p>{t['do']}</p>
      </section>
      <section>
        <h2>{t['ui_proof']}</h2>
        <p>{t['proof']}</p>
      </section>
      <section>
        <p><small>{t['ui_enter']}</small></p>
      </section>
    </article>
  </main>
  <a id='left' class='btn' href='{left_href}'>{left_label}</a>
  <a id='right' class='btn' href='{right_href}'>{right_label}</a>
  <script>
  (function(){{
    'use strict';
    // enter → NEXT
    document.addEventListener('keydown', function(e){{
      if(e.key === 'Enter'){{ window.location.assign('{right_href}'); }}
    }});
  }})();
  </script>
</body>
</html>"""

# -------------------------
# routes · pages
# -------------------------

@app.get('/')
def index():
    # taalkeuze als root
    s = STRINGS[get_lang()]
    return f"""<!doctype html>
<html lang='{get_lang()}'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>{s['title']}</title>
  <meta name='color-scheme' content='dark light'>
  <style>
    :root{{ --bg:#000; --fg:#fff; --line:#2a2a2a; --accent:#ffd400 }}
    html,body{{ margin:0; background:var(--bg); color:var(--fg);
      font: clamp(16px,2.6vw,20px)/1.4 system-ui,Segoe UI,Roboto,Arial }}
    .wrap{{ min-height:100vh; display:grid; place-items:center; padding:8vh 6vw }}
    .box{{ border:1px solid var(--line); border-radius:10px; padding:8vh 8vw; text-align:center }}
    a.btn{{ display:inline-block; margin:6px; padding:10px 14px; border:2px solid var(--accent);
      border-radius:10px; color:var(--fg); text-decoration:none; font-weight:700 }}
  </style>
</head>
<body>
  <main class='wrap'>
    <section class='box'>
      <h1>THE101GAME</h1>
      <p>{s['pick_lang']}</p>
      <p>
        <a class='btn' href='/w0l0?lang=nl'>NL</a>
        <a class='btn' href='/w0l0?lang=en'>EN</a>
      </p>
    </section>
  </main>
</body>
</html>"""

@app.get('/<code>')
def any_level(code: str):
    c = (code or '').upper()
    if c in INDEX_BY_CODE:
        return render_level_html(c, get_lang())
    # short aliases
    if c in ('W0L0', 'W0L1'):
        return render_level_html(c, get_lang())
    return jsonify({'error': 'unknown level'}), 404

@app.get('/w0l0')
def w0l0_page():
    return render_level_html('W0L0', get_lang())

@app.get('/w0l1')
def w0l1_page():
    return render_level_html('W0L1', get_lang())

# -------------------------
# routes · api
# -------------------------

@app.post('/api/choice')
def api_choice():
    try:
        raw = request.get_data(cache=False, as_text=False)
        if raw and len(raw) > MAX_JSON_BYTES:
            return jsonify({'error': 'payload te groot'}), 413
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
    items = []
    for code in CHAIN:
        prev_code, next_code = neighbors(code)
        items.append({
            'code': code,
            'prev': prev_code,
            'next': next_code,
        })
    return jsonify({'items': items, 'count': len(items)})

@app.get('/api/verify')
def api_verify():
    v = verify_chain()
    s = STRINGS[get_lang()]
    v['message'] = s['verify_ok'] if v['ok'] else s['verify_bad']
    return jsonify(v)

# -------------------------
# append/verify impl
# -------------------------

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
# health + bootstrap + main
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

@app.before_first_request
def _bootstrap():
    db.create_all()
    _ensure_genesis()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '3000'))
    app.run(host='0.0.0.0', port=port, debug=False)
