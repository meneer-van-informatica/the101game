require('dotenv').config({ path: __dirname + '/.env' });
const http = require('http');
const url  = require('url');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');

/* ===== constants ===== */
const TICK_MS = 16, BROADCAST_MS = 33;
const WIDTH=800, HEIGHT=500, PAD_H=90, PAD_W=12, BALL_R=7;
const PADDLE_SPEED = 6;
const SPEED = {0:6, 1:8, 2:9, 3:10};
const ENEMY_R = 8, ENEMY_Y = 22, ENEMY_VX = {2:4, 3:6};
const ADVANCE_AT = 4;

/* ===== mongo (retry in background, never exit) ===== */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018';
const MONGODB_DB  = process.env.MONGODB_DB  || 'the101game';
let db=null, matches=null;
let connected = false;
async function connectMongo() {
  while (!connected) {
    try {
      const cli = new MongoClient(MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 2000 });
      await cli.connect();
      db = cli.db(MONGODB_DB);
      matches = db.collection('pong_matches');
      await matches.createIndex({ started_at: -1 });
      connected = true;
      console.log('[mongo] connected');
    } catch (e) {
      console.error('[mongo] connect failed, retrying in 3s:', String(e.message||e));
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}
connectMongo(); // fire-and-forget

/* ===== http + ws ===== */
const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname === '/pong/api/leaderboard') {
    try {
      if (!connected || !matches) {
        res.writeHead(200, {'content-type':'application/json'});
        return res.end(JSON.stringify({ ok:true, top: [], note:'db_offline' }));
      }
      const top = await matches.aggregate([
        { $match: { winner: { $in: ['left','right'] } } },
        { $group: { _id: '$winner', wins: { $sum: 1 } } },
        { $project: { _id: 0, side: '$_id', wins: 1 } },
        { $sort: { wins: -1 } }
      ]).toArray();
      res.writeHead(200, {'content-type':'application/json'});
      return res.end(JSON.stringify({ ok:true, top }));
    } catch (e) {
      res.writeHead(500, {'content-type':'application/json'});
      return res.end(JSON.stringify({ ok:false, error: String(e) }));
    }
  }
  if (u.pathname === '/pong/health') {
    res.writeHead(200, {'content-type':'text/plain'}); return res.end('ok');
  }
  res.writeHead(404); res.end('Not Found');
});
const wss = new WebSocket.Server({ server });

/* ===== game state ===== */
let currentLevel = 0; // 0..3, at 3 first to 4 wins then new match
const state = {
  l:{ y: HEIGHT/2 - PAD_H/2, up:false, down:false },
  r:{ y: HEIGHT/2 - PAD_H/2, up:false, down:false },
  b:{ x: WIDTH/2, y: HEIGHT/2, vx: SPEED[0], vy: SPEED[0]*0.6 },
  e:null,
  s:{ l:0, r:0 },
  level: 0
};
const clients = new Map(); // ws -> {role, ip}
function assignRole() {
  const roles = [...clients.values()].map(v=>v.role);
  if (!roles.includes('left')) return 'left';
  if (!roles.includes('right')) return 'right';
  return 'spec';
}
function fwdIp(req){ return (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket.remoteAddress; }

/* ===== minimal persistence helpers (no-crash if db offline) ===== */
let currentMatchId = null;
async function ensureMatch() {
  if (!connected || !matches) return null;
  if (currentMatchId) return currentMatchId;
  const left = [...clients.entries()].find(([,c]) => c.role==='left')?.[1]?.ip || null;
  const right= [...clients.entries()].find(([,c]) => c.role==='right')?.[1]?.ip || null;
  const r = await matches.insertOne({ started_at:new Date(), level:0, players:{left,right}, scores:{l:0,r:0}, events:[] });
  currentMatchId = r.insertedId;
  return currentMatchId;
}
async function record(ev){ if (!connected || !matches) return; if (!currentMatchId) await ensureMatch(); await matches.updateOne({ _id: currentMatchId }, { $push: { events: ev } }); }
async function incScore(side){
  if (!connected || !matches) return;
  if (!currentMatchId) await ensureMatch();
  const f = {}; f['scores.'+side] = 1;
  await matches.updateOne({ _id: currentMatchId }, { $inc: f, $push: { events: {t:'score', side, at:new Date(), level: currentLevel } } });
}

/* ===== helpers ===== */
function resetBall(dir = (Math.random()<0.5?-1:1)) {
  const spd = SPEED[currentLevel] || SPEED[0];
  state.b.x = WIDTH/2; state.b.y = HEIGHT/2;
  const angle = (Math.random()*0.6 - 0.3);
  state.b.vx = spd * dir;
  state.b.vy = spd * angle;
}
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function maybeSpawnEnemy() {
  if (currentLevel >= 2 && !state.e) { state.e = { x: WIDTH/2, y: ENEMY_Y, vx: ENEMY_VX[currentLevel]||ENEMY_VX[2] }; }
  if (currentLevel < 2 && state.e) state.e = null;
}
function enemyStep() {
  if (!state.e) return;
  state.e.x += state.e.vx;
  if (state.e.x < ENEMY_R && state.e.vx < 0) state.e.vx *= -1;
  if (state.e.x > WIDTH-ENEMY_R && state.e.vx > 0) state.e.vx *= -1;
}
function collideEnemyBall() {
  if (!state.e) return false;
  const dx = state.b.x - state.e.x, dy = state.b.y - state.e.y, R = BALL_R + ENEMY_R;
  return (dx*dx + dy*dy) <= R*R;
}
async function onEnemyHit() {
  const side = (state.b.vx > 0) ? 'l' : 'r';
  await incScore(side);
  await record({ t:'enemy_hit', side, at:new Date(), level: currentLevel });
  resetBall(state.b.vx > 0 ? -1 : 1);
}
async function levelUp() {
  currentLevel++; state.level = currentLevel;
  await record({ t:'level_up', level: currentLevel, at: new Date() });
  state.s.l = 0; state.s.r = 0;
  maybeSpawnEnemy();
  resetBall();
}

/* ===== ws ===== */
wss.on('connection', (ws, req) => {
  const role = assignRole();
  clients.set(ws, { role, ip: fwdIp(req) });
  ws.send(JSON.stringify({ t:'hello', role }));

  ws.on('message', (data) => {
    try{
      const msg = JSON.parse(data);
      if (msg.t==='input') {
        const who = clients.get(ws)?.role;
        const p = who==='left' ? state.l : who==='right' ? state.r : null;
        if (p) { p.up=!!msg.up; p.down=!!msg.down; }
      } else if (msg.t==='reset') {
        state.s.l=0; state.s.r=0; currentLevel=0; state.level=0; state.e=null; resetBall();
        record({t:'reset', at:new Date()});
      } else if (msg.t==='ping') {
        ws.send(JSON.stringify({t:'pong', ts: msg.ts}));
      }
    } catch {}
  });
  ws.on('close', () => { clients.delete(ws); });
});

/* ===== tick + broadcast (throttled) ===== */
let lastBroadcast = 0;
function tick() {
  if (state.l.up)   state.l.y -= PADDLE_SPEED;
  if (state.l.down) state.l.y += PADDLE_SPEED;
  if (state.r.up)   state.r.y -= PADDLE_SPEED;
  if (state.r.down) state.r.y += PADDLE_SPEED;
  state.l.y = clamp(state.l.y, 0, HEIGHT-PAD_H);
  state.r.y = clamp(state.r.y, 0, HEIGHT-PAD_H);

  state.b.x += state.b.vx; state.b.y += state.b.vy;

  if (state.b.y < BALL_R && state.b.vy < 0) state.b.vy *= -1;
  if (state.b.y > HEIGHT-BALL_R && state.b.vy > 0) state.b.vy *= -1;

  if (state.b.x - BALL_R < 20+PAD_W && state.b.y > state.l.y && state.b.y < state.l.y+PAD_H && state.b.vx < 0) {
    state.b.vx *= -1; const rel = (state.b.y - (state.l.y+PAD_H/2)) / (PAD_H/2); state.b.vy = (SPEED[currentLevel]||SPEED[0]) * rel;
  }
  if (state.b.x + BALL_R > WIDTH-20-PAD_W && state.b.y > state.r.y && state.b.y < state.r.y+PAD_H && state.b.vx > 0) {
    state.b.vx *= -1; const rel = (state.b.y - (state.r.y+PAD_H/2)) / (PAD_H/2); state.b.vy = (SPEED[currentLevel]||SPEED[0]) * rel;
  }

  (async () => {
    if (state.b.x < -BALL_R*2) { state.s.r++; await incScore('r'); resetBall(1); }
    if (state.b.x > WIDTH+BALL_R*2) { state.s.l++; await incScore('l'); resetBall(-1); }
    if (currentLevel < 3 && (state.s.l===ADVANCE_AT || state.s.r===ADVANCE_AT)) { await levelUp(); }
    if (currentLevel===3 && (state.s.l===ADVANCE_AT || state.s.r===ADVANCE_AT)) {
      if (connected && matches) {
        const winner = state.s.l===ADVANCE_AT ? 'left' : 'right';
        await ensureMatch();
        await matches.updateOne({ _id: currentMatchId }, { $set: { winner, ended_at:new Date() } });
        await record({ t:'match_end', winner, at:new Date() });
      }
      currentMatchId = null; currentLevel=0; state.level=0; state.s.l=0; state.s.r=0; state.e=null; resetBall();
    }
  })();

  maybeSpawnEnemy(); enemyStep();
  if (collideEnemyBall()) { onEnemyHit(); }

  const now = Date.now();
  if (now - lastBroadcast >= BROADCAST_MS) {
    lastBroadcast = now;
    const pack = JSON.stringify({ t:'state', state: {
      l:{y:state.l.y}, r:{y:state.r.y},
      b:{x:state.b.x,y:state.b.y,vx:state.b.vx,vy:state.b.vy},
      e: state.e ? {x:state.e.x,y:state.e.y} : null,
      s:state.s, level: currentLevel,
      dim:{w:WIDTH,h:HEIGHT}
    }});
    for (const ws of wss.clients) { if (ws.readyState===1) ws.send(pack); }
  }
}
setInterval(tick, TICK_MS);

const PORT = 3000;
server.listen(PORT, '127.0.0.1', () => console.log('Pong HTTP/WS on', PORT));
