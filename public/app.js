/* =========================================================
   app.js – THE101GAME · ACCORDEON MUZIEK ENGINE (KISS)
   DAAC: DECOMPOSE · ABSTRACT · ALGO · CATEGORIZE
   FORMULE: ACCORDEON = MELODIE + INZET + STRATEGIE * Y + TALENT
   ========================================================= */

/* =========================
   D · DECOMPOSE
   onderdelen van de app
   =========================
   1) audio-engine: init, playTone, stopAll
   2) state: impact, strategie Y, talent, metrics
   3) map: keuzes → noten voor melodie en inzet (bas)
   4) ui-binding: knoppen, toetsen, impactmeter, blockchain call
   5) services: throttle, clamp, log
*/

/* global window, document, fetch */

'use strict';

/* ---------- 1) audio-engine ---------- */
const ACC_AUDIO = {
  ctx: null,
  master: null,
  started: false,
  voices: new Set()
};

function initAudio() {
  if (!ACC_AUDIO.ctx) {
    ACC_AUDIO.ctx = new (window.AudioContext || window.webkitAudioContext)();
    ACC_AUDIO.master = ACC_AUDIO.ctx.createGain();
    ACC_AUDIO.master.gain.value = 0.9;
    ACC_AUDIO.master.connect(ACC_AUDIO.ctx.destination);
  }
  if (ACC_AUDIO.ctx.state === 'suspended') ACC_AUDIO.ctx.resume();
  ACC_AUDIO.started = true;
}

function playTone(type, freq, ms, vol) {
  if (!ACC_AUDIO.started) initAudio();
  const ctx = ACC_AUDIO.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;           // 'sine' voor melodie, 'square' voor inzet
  osc.frequency.value = freq;

  const now = ctx.currentTime;
  const g = gain.gain;
  const attack = 0.005;
  const release = 0.08;
  const dur = Math.max(0.05, ms / 1000);

  g.setValueAtTime(0, now);
  g.linearRampToValueAtTime(vol, now + attack);
  g.setValueAtTime(vol, now + dur - release);
  g.linearRampToValueAtTime(0.0001, now + dur);

  osc.connect(gain);
  gain.connect(ACC_AUDIO.master);
  osc.start(now);
  osc.stop(now + dur + 0.02);

  ACC_AUDIO.voices.add(osc);
  osc.onended = () => ACC_AUDIO.voices.delete(osc);
}

function stopAllAudio() {
  ACC_AUDIO.voices.forEach(v => { try { v.stop(0); } catch (e) {} });
  ACC_AUDIO.voices.clear();
  if (ACC_AUDIO.ctx && ACC_AUDIO.ctx.state !== 'closed') {
    // zacht uitfaden
    try {
      const now = ACC_AUDIO.ctx.currentTime;
      ACC_AUDIO.master.gain.cancelScheduledValues(now);
      ACC_AUDIO.master.gain.setTargetAtTime(0, now, 0.05);
    } catch (e) {}
  }
}

/* ---------- 2) state ---------- */
const ACC_STATE = {
  impact: 0,           // score die je eerder al gebruikt
  Y: 1.0,              // strategie multiplier
  talent: 0,           // spelervermogen 0..10
  lastChoiceAt: 0,     // ms timestamp
  metrics: {
    clicks: 0,
    notesMelodie: 0,
    notesInzet: 0,
    maxStreak: 0,
    streak: 0
  }
};

/* ---------- 3) mapping: keuzes → toonhoogten ---------- */
/* frequenties in Hz, eenvoudig pentatonisch voor melodie, lage kwinten voor inzet */
const NOTES = {
  melodie: { A: 440, B: 494, C: 523.25, D: 587.33, E: 659.25 },
  inzet:   { A: 110, B: 123.47, C: 130.81, D: 146.83, E: 164.81 }
};

/* impactregels zoals eerder: A:+1, B:-1, C:+2, D:+3, E:-2 */
const IMPACT_RULE = { A: 1, B: -1, C: 2, D: 3, E: -2 };

/* =========================
   A · ABSTRACT
   interface van het systeem
   =========================
   api:
   - ACC.play(choice)      → speelt MELODIE + INZET, telt impact, schrijft metrics
   - ACC.setStrategy(y)    → zet strategie multiplier Y
   - ACC.setTalent(t)      → zet talent 0..10
   - ACC.stop()            → stopt alle audio
   - ACC.send(choice)      → optionele fetch naar backend blockchain
   - ACC.bindUI()          → bind knoppen en toetsen
*/

const ACC = {
  play: onChoice,
  setStrategy: y => { ACC_STATE.Y = clamp(y, 0.2, 3); uiHint('strategie', ACC_STATE.Y); },
  setTalent: t => { ACC_STATE.talent = clamp(Math.round(t), 0, 10); uiHint('talent', ACC_STATE.talent); },
  stop: () => { stopAllAudio(); stopBackgroundTagIfAny(); },
  send: sendChoiceSafe,
  bindUI
};

/* =========================
   A · ALGO
   stap-voor-stap logica
   ========================= */

/* hoofdpad: een keuze speelt accordeon en werkt status bij */
function onChoice(choice) {
  const ch = String(choice || '').toUpperCase();
  if (!NOTES.melodie[ch]) return;

  ACC_STATE.metrics.clicks += 1;
  ACC_STATE.streakUpdate = streakTick();

  // 1) update impact
  ACC_STATE.impact += (IMPACT_RULE[ch] || 0);
  updateImpactMeter();

  // 2) bereken componenten volgens formule
  // MELODIE: toonhoogte uit mapping
  const fMel = NOTES.melodie[ch];

  // INZET: lage toon, iets korter en pulserend
  const fBas = NOTES.inzet[ch];

  // STRATEGIE * Y: beïnvloedt duur en ritme
  const Y = ACC_STATE.Y;
  const baseMs = 180;                      // basissustain
  const durMel = Math.round(baseMs * (0.8 + 0.4 * Y));  // 144..276 ms
  const durBas = Math.round(durMel * 0.7);

  // TALENT: micro detune en volumeaccent
  const talent = ACC_STATE.talent;         // 0..10
  const detuneCents = (talent - 5) * 2;    // -10..+10 cents
  const volMel = 0.25 + 0.05 * talent / 10;
  const volBas = 0.18 + 0.04 * talent / 10;

  // 3) speel MELODIE + INZET
  const fMelAdj = fMel * Math.pow(2, detuneCents / 1200);
  const fBasAdj = fBas * Math.pow(2, -detuneCents / 2400);

  playTone('sine',   fMelAdj, durMel, volMel);
  ACC_STATE.metrics.notesMelodie += 1;

  // inzet alleen iedere twee kliks, geeft ruimte aan ritme
  if (ACC_STATE.metrics.clicks % 2 === 1) {
    playTone('square', fBasAdj, durBas, volBas);
    ACC_STATE.metrics.notesInzet += 1;
  }

  // 4) optioneel: stuur naar backend blockchain (fire-and-forget)
  sendChoiceSafe(ch);

  // 5) ui-hint
  uiShowMetrics();
}

/* optioneel fetch, maar nooit breken als backend er niet is */
function sendChoiceSafe(choice) {
  try {
    fetch('/add_block/' + choice)
      .then(r => r.json())
      .then(() => {})
      .catch(() => {});
  } catch (e) {}
}

/* streak bijhouden om talent of Y later adaptief te kunnen maken */
function streakTick() {
  const now = Date.now();
  const dt = now - (ACC_STATE.lastChoiceAt || now);
  ACC_STATE.lastChoiceAt = now;
  if (dt < 1200) {
    ACC_STATE.metrics.streak += 1;
  } else {
    ACC_STATE.metrics.streak = 1;
  }
  ACC_STATE.metrics.maxStreak = Math.max(ACC_STATE.metrics.maxStreak, ACC_STATE.metrics.streak);
  return ACC_STATE.metrics.streak;
}

/* impactmeter bijwerken als het element bestaat */
function updateImpactMeter() {
  const el = document.getElementById('impactMeter');
  if (!el) return;
  el.textContent = 'Impact: ' + ACC_STATE.impact;
  if (ACC_STATE.impact > 5) el.style.color = 'green';
  else if (ACC_STATE.impact < 0) el.style.color = 'red';
  else el.style.color = 'white';
}

/* als er een <audio id='backgroundMusic'> is, pauzeer en reset */
function stopBackgroundTagIfAny() {
  const tag = document.getElementById('backgroundMusic');
  if (!tag) return;
  try { tag.pause(); tag.currentTime = 0; } catch (e) {}
}

/* toetsen en knoppen koppelen */
function bindUI() {
  // knoppen A..E zoals je eerdere html
  ['A', 'B', 'C', 'D', 'E'].forEach(ch => {
    const btn = document.getElementById('option' + ch);
    if (btn) btn.addEventListener('click', () => ACC.play(ch), { passive: true });
  });

  // simpele toetsen: a,s,d,f,g
  const keyMap = { a: 'A', s: 'B', d: 'C', f: 'D', g: 'E' };
  window.addEventListener('keydown', e => {
    const ch = keyMap[(e.key || '').toLowerCase()];
    if (ch) { ACC.play(ch); e.preventDefault(); }
  });

  // sliders voor strategie en talent indien aanwezig
  const elY = document.getElementById('strategyY');
  if (elY) elY.addEventListener('input', () => ACC.setStrategy(parseFloat(elY.value)));

  const elT = document.getElementById('talent');
  if (elT) elT.addEventListener('input', () => ACC.setTalent(parseFloat(elT.value)));

  // stopknop indien aanwezig
  const stopBtn = document.getElementById('stopAll');
  if (stopBtn) stopBtn.addEventListener('click', ACC.stop);
}

/* =========================
   C · CATEGORIZE
   module-uitvoer en helpers
   ========================= */

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

const uiHint = throttle((k, v) => {
  const el = document.getElementById('hint_' + k);
  if (el) el.textContent = String(v);
}, 120);

function uiShowMetrics() {
  const el = document.getElementById('metricsPanel');
  if (!el) return;
  const m = ACC_STATE.metrics;
  el.innerHTML =
    'clicks: ' + m.clicks +
    ' · melodie: ' + m.notesMelodie +
    ' · inzet: ' + m.notesInzet +
    ' · streak: ' + m.streak +
    ' · max: ' + m.maxStreak +
    ' · Y: ' + ACC_STATE.Y.toFixed(2) +
    ' · talent: ' + ACC_STATE.talent +
    '';
}

/* simpele throttle om ui te sparen */
function throttle(fn, ms) {
  let t = 0, lastArgs = null, lastThis = null, pending = false;
  return function throttled() {
    lastArgs = arguments; lastThis = this;
    const now = Date.now();
    if (!pending) {
      pending = true;
      const wait = Math.max(0, ms - (now - t));
      setTimeout(() => {
        t = Date.now(); pending = false;
        fn.apply(lastThis, lastArgs);
      }, wait);
    }
  };
}

/* init bij user gesture voor audiopolicy en directe werking */
window.addEventListener('pointerdown', () => initAudio(), { once: true, passive: true });
document.addEventListener('DOMContentLoaded', () => { bindUI(); updateImpactMeter(); });

/* export voor console debuggen */
window.ACC = ACC;

/* utility voor externe stop, compatibel met jouw eerdere stopGame() */
function stopGame() { ACC.stop(); }
