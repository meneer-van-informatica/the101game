/* the101game — Arena (Tok + 101 Test Fight) */
require('dotenv').config();
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { MongoClient } = require('mongodb');
const { customAlphabet } = require('nanoid');
const path = require('path');
const url = require('url');

const PORT = Number(process.env.PORT || 3100);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/the101game';
const MONGODB_DB  = process.env.MONGODB_DB  || 'the101game';
const BASE = '/arena';
const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

// WS registry available to routes
const wsByAlias = new Map();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

(async () => {
  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  const db = mongo.db(MONGODB_DB);

  const toks   = db.collection('toks');
  const fights = db.collection('fights');
  await Promise.all([
    toks.createIndex({ toAlias:1, ts:-1 }),
    toks.createIndex({ fromAlias:1, ts:-1 }),
    fights.createIndex({ code:1 }, { unique:true })
  ]);

  // Static UI
  app.use(BASE, express.static(path.join(__dirname, 'public'), { extensions:['html'] }));
  app.get(`${BASE}/health`, (req,res)=>res.json({ ok:true, ts:Date.now() }));

  // --- Tok me ---
  app.post(`${BASE}/api/tok`, async (req, res) => {
    const { fromAlias='anon', toAlias, text='' } = req.body || {};
    if (!toAlias || typeof toAlias !== 'string') return res.status(400).json({ ok:false, err:'toAlias required' });
    const doc = { fromAlias, toAlias, text:String(text).slice(0,280), ts:new Date() };
    const r = await toks.insertOne(doc);
    const set = wsByAlias.get(toAlias);
    if (set) {
      const payload = JSON.stringify({ type:'tok', tok:{ id:r.insertedId, ...doc } });
      for (const ws of set) { try { ws.send(payload); } catch(_){} }
    }
    res.json({ ok:true, id:r.insertedId });
  });

  app.get(`${BASE}/api/inbox`, async (req, res) => {
    const alias = String(req.query.alias||'').trim();
    if (!alias) return res.status(400).json({ ok:false, err:'alias required' });
    const list = await toks.find({ toAlias:alias }).sort({ ts:-1 }).limit(50).toArray();
    res.json({ ok:true, alias, toks:list });
  });

  // --- 101 Test Fight (simple matchmaking) ---
  const queue = new Map(); // level -> [aliases]
  app.post(`${BASE}/api/match`, async (req, res) => {
    const { alias='anon', level=0 } = req.body || {};
    const L = Number(level)||0;
    const arr = queue.get(L) || [];
    if (arr.length > 0) {
      const other = arr.shift(); queue.set(L, arr);
      const code = nano();
      const fight = { code, level:L, players:[other, alias], status:'open', createdAt:new Date() };
      await fights.insertOne(fight);
      for (const a of fight.players) {
        const set = wsByAlias.get(a);
        if (set) {
          const msg = JSON.stringify({ type:'match', fight });
          for (const ws of set) { try { ws.send(msg); } catch(_){} }
        }
      }
      return res.json({ ok:true, matched:true, fight });
    }
    arr.push(alias); queue.set(L, arr);
    res.json({ ok:true, matched:false, queued:{ level:L, size:arr.length }});
  });

  // HTTP server + WebSocket
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer:true });

  function bindAlias(alias, ws){
    const key = (alias||'anon').slice(0,24);
    if (!wsByAlias.has(key)) wsByAlias.set(key, new Set());
    const set = wsByAlias.get(key); set.add(ws);
    ws.on('close', ()=>{ set.delete(ws); if (set.size===0) wsByAlias.delete(key); });
  }

  wss.on('connection', (ws, req) => {
    const q = url.parse(req.url, true).query;
    bindAlias((q.alias||'anon').toString(), ws);
    ws.send(JSON.stringify({ type:'hello', t:Date.now() }));
    ws.on('message', (buf)=>{
      let m; try{ m = JSON.parse(buf.toString()); } catch { return; }
      if (m.type === 'ping') ws.send(JSON.stringify({ type:'pong', t:Date.now() }));
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const p = (url.parse(req.url).pathname || '');
    if (p.startsWith(`${BASE}/ws`)) {
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  server.listen(PORT, () => console.log(`Arena on ${PORT} base=${BASE}`));
})();
