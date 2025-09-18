/* the101game — Arena (Tok + Test Fight) */
require('dotenv').config();
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { MongoClient } = require('mongodb');
const { customAlphabet } = require('nanoid');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3100;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/the101game';
const MONGODB_DB  = process.env.MONGODB_DB  || 'the101game';
const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// Prefix voor alles in deze service
const BASE = '/arena';

(async () => {
  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  const db = mongo.db(MONGODB_DB);

  const toks   = db.collection('toks');
  const fights = db.collection('fights');

  // Indexen (idempotent)
  await toks.createIndex({ toAlias: 1, ts: -1 });
  await toks.createIndex({ fromAlias: 1, ts: -1 });
  await fights.createIndex({ code: 1 }, { unique: true });

  // Static mini UI
  app.use(BASE, express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

  // Health
  app.get(`${BASE}/health`, (req, res) => res.json({ ok: true, ts: Date.now() }));

  // TOKS
  app.post(`${BASE}/api/tok`, async (req, res) => {
    const { fromAlias='anon', toAlias, text='' } = req.body || {};
    if (!toAlias || typeof toAlias !== 'string') return res.status(400).json({ ok:false, err:'toAlias required' });
    const doc = { fromAlias, toAlias, text: String(text).slice(0, 280), ts: new Date() };
    const r = await toks.insertOne(doc);
    // WS push naar ontvanger
    const set = wsByAlias.get(toAlias);
    if (set) {
      const payload = JSON.stringify({ type:'tok', tok:{ id: r.insertedId, ...doc }});
      for (const ws of set) { try { ws.send(payload); } catch(_){} }
    }
    res.json({ ok: true, id: r.insertedId });
  });

  app.get(`${BASE}/api/inbox`, async (req, res) => {
    const alias = String(req.query.alias || '').trim();
    if (!alias) return res.status(400).json({ ok:false, err:'alias required' });
    const list = await toks.find({ toAlias: alias }).sort({ ts: -1 }).limit(50).toArray();
    res.json({ ok:true, alias, toks: list });
  });

  // MATCHMAKING (super simpel)
  const queue = new Map(); // level -> [aliases...]
  app.post(`${BASE}/api/match`, async (req, res) => {
    const { alias='anon', level=0 } = req.body || {};
    const L = Number(level) || 0;
    const arr = queue.get(L) || [];
    // als er iemand wacht: match
    if (arr.length > 0) {
      const other = arr.shift();
      queue.set(L, arr);
      const code = nano();
      const fight = { code, level: L, players: [other, alias], status:'open', createdAt:new Date() };
      await fights.insertOne(fight);
      // notify beide kanten als online
      for (const a of fight.players) {
        const set = wsByAlias.get(a);
        if (set) {
          const msg = JSON.stringify({ type:'match', fight });
          for (const ws of set) { try { ws.send(msg); } catch(_){} }
        }
      }
      return res.json({ ok:true, matched:true, fight });
    }
    // anders: in queue zetten
    arr.push(alias);
    queue.set(L, arr);
    res.json({ ok:true, matched:false, queued:{ level:L, size:arr.length } });
  });

  app.get(`${BASE}/api/fight/:code`, async (req, res) => {
    const f = await fights.findOne({ code: req.params.code.toUpperCase() });
    if (!f) return res.status(404).json({ ok:false, err:'not found' });
    res.json({ ok:true, fight:f });
  });

  // HTTP server + WS
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // alias -> Set<ws>
  const wsByAlias = new Map();

  function bindAlias(alias, ws) {
    const key = alias || 'anon';
    if (!wsByAlias.has(key)) wsByAlias.set(key, new Set());
    wsByAlias.get(key).add(ws);
    ws.on('close', () => {
      const set = wsByAlias.get(key);
      if (set) { set.delete(ws); if (set.size === 0) wsByAlias.delete(key); }
    });
  }

  wss.on('connection', (ws, req) => {
    const q = url.parse(req.url, true).query;
    const alias = (q.alias || 'anon').toString().slice(0, 24);
    bindAlias(alias, ws);
    ws.send(JSON.stringify({ type:'hello', alias }));
    ws.on('message', (buf) => {
      // Echo voor nu + no-op; later: game events / fight RT
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      if (msg && msg.type === 'ping') ws.send(JSON.stringify({ type:'pong', t: Date.now() }));
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const pathname = url.parse(req.url).pathname || '';
    if (pathname.startsWith(`${BASE}/ws`)) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  server.listen(PORT, () => {
    console.log(`Arena on ${PORT} (base ${BASE})`);
  });
})();
