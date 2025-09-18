/* PONG v2 — levels, wallet (kukels), aliases, pancake, scoreboard */
require('dotenv').config({ override:true });
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT||'3000',10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DBNAME = process.env.MONGODB_DB || 'the101game';

const app = express();
app.use(express.json());
app.use('/', express.static(path.join(__dirname,'public'), { maxAge: '3600s' }));

// ---- Mongo ----
const client = new MongoClient(MONGODB_URI);
let db, Players, Stats, Levels;
const LEVELS = JSON.parse(fs.readFileSync(path.join(__dirname,'data','levels.json'),'utf8'));

// ---- Helpers ----
const now = ()=>new Date();
const aliasSan = s => String(s||'').trim().slice(0,24).replace(/[^\w\-]/g,'_') || 'test';

// ---- API ----
app.get('/health', (req,res)=> res.json({ok:true, ts:Date.now()}));

app.get('/pong/api/me', async (req,res)=>{
  const alias = aliasSan(req.headers['x-alias'] || req.query.alias || 'test');
  const p = await Players.findOneAndUpdate(
    { alias }, { $setOnInsert:{ alias, kukels:0, createdAt:now() } }, { upsert:true, returnDocument:'after' }
  );
  res.json({ ok:true, alias: p.value.alias, kukels: p.value.kukels||0 });
});

app.post('/pong/api/alias', async (req,res)=>{
  const alias = aliasSan(req.body?.alias);
  const p = await Players.findOneAndUpdate(
    { alias }, { $setOnInsert:{ alias, kukels:0, createdAt:now() } }, { upsert:true, returnDocument:'after' }
  );
  res.json({ ok:true, alias:p.value.alias, kukels:p.value.kukels||0 });
});

app.get('/pong/api/leaderboard', async (req,res)=>{
  const top = await Players.find({}, { projection:{_id:0, alias:1, kukels:1} })
                           .sort({ kukels:-1, alias:1 }).limit(10).toArray();
  res.json({ ok:true, top });
});

app.get('/pong/api/levels', (req,res)=> res.json({ ok:true, levels: LEVELS }));

// ---- Game State ----
const S = {
  levelIdx: 0,
  players: new Map(), // ws-> {alias, padY}
  paddles: [{x:1,y:8,h:4},{x:40,y:8,h:4}],
  ball: {x:21,y:10,vx:1,vy:1},
  enemy: null,
  scores: {A:0,B:0},
  lastTick: Date.now(),
  listeners: new Set(), // all websockets
};

function setLevel(i){
  S.levelIdx = Math.max(0, Math.min(LEVELS.length-1, i));
  const L = LEVELS[S.levelIdx];
  // enemy setup
  if(L.enemy){
    S.enemy = { x: (Math.random()<0.5?10:31), y: L.enemy.y, dir: 1, speed: L.enemy.speed };
  } else S.enemy = null;
  broadcast({ type:'state', state: view('Level '+L.code) });
}

function view(msg){
  const L = LEVELS[S.levelIdx];
  return {
    msg, level: L.code,
    ball: {...S.ball},
    enemy: S.enemy ? {x:S.enemy.x|0, y:S.enemy.y|0} : null,
    paddles: S.paddles.map(p=>({x:p.x,y:p.y,h:p.h}))
  };
}

async function reward(alias, amount=1){
  if(!alias) return;
  await Players.updateOne({alias}, {$inc:{kukels:amount}});
  const p = await Players.findOne({alias},{projection:{_id:0,alias:1,kukels:1}});
  if(p) broadcastToAlias(alias, {type:'me', kukels:p.kukels});
}

function pancakeList(){
  const names = Array.from(S.listeners).map(ws=>ws._alias).filter(Boolean);
  names.sort();
  return names;
}
function broadcast(obj){
  const s = JSON.stringify(obj);
  for(const ws of Array.from(S.listeners)) try{ ws.send(s); }catch(_){}
}
function broadcastToAlias(alias,obj){
  const s = JSON.stringify(obj);
  for(const ws of Array.from(S.listeners)) if(ws._alias===alias) try{ ws.send(s);}catch(_){}
}

// ---- WS ----
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer:true });

server.on('upgrade', (req, socket, head)=>{
  if(!req.url.startsWith('/pong/ws')) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws)=> wss.emit('connection', ws, req));
});

wss.on('connection', async (ws, req)=>{
  const u = new URL(req.url, `http://${req.headers.host}`);
  const alias = aliasSan(u.searchParams.get('alias') || 'test');
  ws._alias = alias;
  S.listeners.add(ws);
  await Players.updateOne({alias}, {$setOnInsert:{alias,kukels:0,createdAt:now()}}, {upsert:true});
  ws.send(JSON.stringify({type:'pancake', list:pancakeList()}));
  ws.send(JSON.stringify({type:'state', state:view('joined: '+alias)}));
  ws.on('message', (buf)=>{
    let m={}; try{ m=JSON.parse(String(buf)); }catch(_){}
    if(m.t==='move'){
      // simple: map first N clients to paddles
      const idx = Array.from(S.listeners).indexOf(ws) % 2; // 0 or 1
      const p = S.paddles[idx];
      p.y = Math.max(1, Math.min( H-1-p.h, p.y + (m.dy||0) ));
    }
  });
  ws.on('close', ()=>{
    S.listeners.delete(ws);
    broadcast({type:'pancake', list:pancakeList()});
  });
});

// ---- Game loop (very simple physics) ----
const W=42,H=20;
function tick(){
  const L = LEVELS[S.levelIdx];
  // enemy motion
  if(S.enemy){
    S.enemy.x += S.enemy.speed * (S.enemy.dir||1);
    if(S.enemy.x < 2){ S.enemy.x=2; S.enemy.dir=+1; }
    if(S.enemy.x > W-3){ S.enemy.x=W-3; S.enemy.dir=-1; }
  }
  // ball move
  S.ball.x += S.ball.vx;
  S.ball.y += S.ball.vy;
  // walls
  if(S.ball.y<=1 || S.ball.y>=H-2) S.ball.vy *= -1;
  // paddle collisions
  for(const p of S.paddles){
    if(S.ball.x===p.x && S.ball.y>=p.y && S.ball.y<p.y+p.h){
      S.ball.vx *= -1;
    }
  }
  // enemy collision → counts against players (lose point → level advance trigger)
  if(S.enemy && Math.round(S.enemy.x)===S.ball.x && Math.round(S.enemy.y)===S.ball.y){
    S.scores.B++; // penalty to B for demo
  }
  // goals
  if(S.ball.x<=1){ S.scores.B++; S.ball={x:21,y:10,vx:1,vy:1}; }
  if(S.ball.x>=W-2){ S.scores.A++; S.ball={x:21,y:10,vx:-1,vy:1}; }

  // level progress (nextAt)
  const mx = Math.max(S.scores.A, S.scores.B);
  if(mx >= (L.nextAt||4)){
    // reward every connected alias
    for(const ws of Array.from(S.listeners)) reward(ws._alias, 1);
    S.scores={A:0,B:0};
    setLevel(S.levelIdx+1);
  }
  broadcast({ type:'state', state:view() });
}
setInterval(tick, 1000/15);

// ---- Start ----
(async ()=>{
  await client.connect();
  db = client.db(DBNAME);
  Players = db.collection('players');
  Stats   = db.collection('stats');
  Levels  = db.collection('levels'); // (optional future use)
  await Players.createIndex({ alias:1 }, { unique:true });
  await Players.createIndex({ kukels:-1 });

  const srv = server.listen(PORT, ()=>console.log(`Pong HTTP/WS on ${PORT}`));
  srv.headersTimeout = 65_000;
})();
