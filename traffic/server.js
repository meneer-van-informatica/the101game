/* the101game — Traffic microservice
 * Endpoints:
 *   GET /t/ingest?did=<uuid>&p=<path>&r=<ref>   -> 200, upserts "active session"
 *   GET /t/kpi?json=1                            -> {"active":{"devices":N,"ttlSec":300},"ok":true}
 *   GET /t/101.js                                -> client pinger (loads early, very small)
 *   GET /t/health                                -> {"ok":true}
 */
require('dotenv').config();
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');
const url = require('url');

const PORT = Number(process.env.PORT || 3101);
const HOST = process.env.HOST || '127.0.0.1';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/the101game';
const MONGODB_DB  = process.env.MONGODB_DB  || 'the101game';
const TTL_SESS = Number(process.env.TTL_SESS || 300);     // 5 min "active"
const TTL_EVT  = Number(process.env.TTL_EVT  || 86400);   // 1 day events

const app = express();
app.set('trust proxy', true);

// Tiny helper
const now = () => new Date();
const ok  = (res,obj={}) => res.json({ok:true,...obj});
const nzc = s => (s||'').slice(0,1024);

let db=null, colSess=null, colEvt=null;
(async ()=>{
  try{
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 1500 });
    await client.connect();
    db = client.db(MONGODB_DB);
    colSess = db.collection('sessions');
    colEvt  = db.collection('events');

    // Indexes (idempotent)
    await colSess.createIndex({ did:1 }, { unique:true });
    await colSess.createIndex({ lastSeen:1 }, { expireAfterSeconds: TTL_SESS });

    await colEvt.createIndex({ ts:1 }, { expireAfterSeconds: TTL_EVT });
    await colEvt.createIndex({ did:1, ts:1 });

    console.log('[traffic] Mongo ready');
  }catch(e){
    console.warn('[traffic] Mongo unavailable, running in memory fallback:', e.message);
  }
})();

// Fallback memory counts if DB is down
const mem = { map:new Map(), ttl: TTL_SESS*1000 };
function memTouch(did){ const t=Date.now(); mem.map.set(did,t); for(const [k,v] of mem.map){ if(t-v>mem.ttl) mem.map.delete(k); } }
function memCount(){ const t=Date.now(); let n=0; for(const [_,v] of mem.map){ if(t-v<=mem.ttl) n++; } return n; }

// --- Static client: /t/101.js (very small, no CORS fuss) -------------------
const CLIENT_JS = `
(()=>{try{
  const LS=window.localStorage, K='t101.did';
  let did=LS.getItem(K);
  if(!did){ did=crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+'-'+Date.now(); LS.setItem(K,did); }
  const p=encodeURIComponent(location.pathname||'/'), r=encodeURIComponent(document.referrer||'');
  const u='/t/ingest?did='+encodeURIComponent(did)+'&p='+p+'&r='+r;
  // send fast; don't block render
  (navigator.sendBeacon && navigator.sendBeacon(u)) || (new Image()).src=u;
}catch(_){}})();
`.trim()+"\n";

app.get('/t/101.js', (req,res)=>{
  res.set('content-type','application/javascript; charset=utf-8');
  res.set('cache-control','no-store');
  res.end(CLIENT_JS);
});

// --- Health -----------------------------------------------------------------
app.get('/t/health', (req,res)=> ok(res,{ts:Date.now(), service:'traffic'}));

// --- KPI JSON ---------------------------------------------------------------
app.get('/t/kpi', async (req,res)=>{
  const json = String(req.query.json||'1')==='1';
  try{
    let devices = 0;
    if(colSess) devices = await colSess.estimatedDocumentCount();
    else devices = memCount();
    const payload = { active:{ devices, ttlSec: TTL_SESS } };
    return json ? ok(res,payload) : res.type('text/plain').end(String(devices));
  }catch(e){
    return json ? res.status(200).json({ ok:true, active:{devices:memCount(), ttlSec:TTL_SESS}, degraded:true })
                : res.type('text/plain').end(String(memCount()));
  }
});

// --- INGEST -----------------------------------------------------------------
app.get('/t/ingest', express.urlencoded({extended:false}), async (req,res)=>{
  const q = req.query || {};
  const did = nzc(q.did||'').replace(/[^-_.a-zA-Z0-9]/g,'').slice(0,64);
  if(!did){ res.status(400).end('missing did'); return; }

  const doc = {
    did,
    ts: now(),
    p: nzc(q.p||req.get('referer')||'/'),
    r: nzc(q.r||''),
    ip: req.ip || req.headers['x-real-ip'] || req.socket.remoteAddress || '',
    ua: nzc(req.headers['user-agent']||''),
  };

  // Touch active session + write one lightweight event
  try{
    if(colSess){
      await colSess.updateOne({did},{ $set:{ did, lastSeen: doc.ts, ua: doc.ua, ip: doc.ip, p: doc.p } }, { upsert:true });
      await colEvt.insertOne(doc);
    }else{
      memTouch(did);
    }
  }catch(_){ memTouch(did); } // fallback silently

  // Fast response, cache-less
  res.set('cache-control','no-store').status(200).type('text/plain').end('ok');
});

// Root (debug)
app.get('/t/', (req,res)=> res.type('text/plain').end('t/ok'));

http.createServer(app).listen(PORT, HOST, ()=> console.log(`[traffic] http://${HOST}:${PORT}/t/health`));
