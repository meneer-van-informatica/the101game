// /the101game/server/server.js  (FULL FILE, CLEAN)
// start: deps
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { MongoClient } = require('mongodb');

// env
const PORT = Number(process.env.PORT || 8080);
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'devsecret';
const COOKIE_NAME = process.env.COOKIE_NAME || 'alias';
const THE101_URI = process.env.THE101_URI || ''; // optional; mem fallback if empty
const STATIC_DIR = path.join(__dirname, '..', 'static');

// app
const app = express();
app.use(helmet({
  contentSecurityPolicy: false, // keep simple for now
}));
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));
app.disable('x-powered-by');

// tiny ip helper
function ipOf(req){ return (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket.remoteAddress || '?'; }

// limiter (3 requests / hour / IP for claim & kukel add)
const limiter3ph = rateLimit({
  windowMs: 60*60*1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipOf,
});

// static
app.use(express.static(STATIC_DIR, { extensions: ['html'] }));

// alias helpers
function cleanAlias(s){ return String(s||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,16); }
function cleanAlias3(s){ return cleanAlias(s).slice(0,3); }
function getAliasFromReq(req){
  const raw = (req.body && req.body.alias) || (req.query && req.query.alias) ||
              (req.signedCookies && req.signedCookies[COOKIE_NAME]) ||
              (req.cookies && req.cookies[COOKIE_NAME]) || '';
  return cleanAlias(raw);
}
function cookieOpts(req){
  const secure = (req.headers['x-forwarded-proto']||'') === 'https' || !!process.env.FORCE_SECURE_COOKIE;
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    maxAge: 365*24*60*60*1000,
  };
}

// health
app.get('/api/health', (req,res)=> res.json({ ok:true, uptime: Number(process.uptime().toFixed(3)) }));

// whoami (reads cookie only)
app.get('/api/alias/whoami', (req,res)=>{
  const alias = getAliasFromReq(req);
  if (!alias) return res.status(404).json({ ok:false, error:'no_alias_cookie' });
  res.json({ ok:true, alias });
});

// claim (sets cookie)
app.post('/api/alias/claim', limiter3ph, (req,res)=>{
  try{
    const want = cleanAlias(req.body && req.body.alias);
    if (!want || want.length < 3) return res.status(400).json({ ok:false, error:'bad_alias' });
    res.cookie(COOKIE_NAME, want, cookieOpts(req));
    res.json({ ok:true, alias: want });
  }catch(e){
    res.status(500).json({ ok:false, error: String(e && e.message || e) });
  }
});

// ==== kukel store (mongo or memory) ====
let client=null, col=null;              // mongo
const mem = new Map();                  // fallback

async function ensureMongo(){
  if (!THE101_URI) return false;
  if (col) return true;
  client = new MongoClient(THE101_URI, { maxPoolSize: 5 });
  await client.connect();
  const db = client.db(); // from URI
  col = db.collection('players');
  await col.createIndex({ alias:1 }, { unique:true });
  await col.createIndex({ kukel:-1 });
  return true;
}

async function readKukel(alias){
  if (await ensureMongo().catch(()=>false)) {
    const doc = await col.findOne({ alias }, { projection:{ _id:0, alias:1, kukel:1 } });
    return (doc && typeof doc.kukel === 'number') ? doc.kukel : 0;
  }
  return (mem.get(alias)?.kukel) || 0;
}
async function addKukel(alias, delta){
  if (await ensureMongo().catch(()=>false)) {
    const r = await col.findOneAndUpdate(
      { alias },
      { $inc:{ kukel: delta }, $setOnInsert:{ alias, kukel: 0 } },
      { upsert:true, returnDocument: 'after', projection:{ _id:0, alias:1, kukel:1 } }
    );
    return Number(r.value?.kukel || 0);
  }
  const cur = mem.get(alias) || { alias, kukel: 0 };
  cur.kukel = Number(cur.kukel || 0) + Number(delta);
  mem.set(alias, cur);
  return cur.kukel;
}

// kukel get
app.get('/api/kukel/get', async (req,res)=>{
  try{
    const alias = cleanAlias3(getAliasFromReq(req));
    if (alias.length !== 3) return res.status(400).json({ ok:false, error:'no_alias' });
    const kukel = await readKukel(alias);
    res.json({ ok:true, alias, kukel });
  }catch(e){ res.status(500).json({ ok:false, error:String(e && e.message || e) }); }
});

// kukel add (+1, -1, +0.1)
app.post('/api/kukel/add', limiter3ph, async (req,res)=>{
  try{
    const alias = cleanAlias3(getAliasFromReq(req));
    if (alias.length !== 3) return res.status(400).json({ ok:false, error:'no_alias' });
    const delta = Number(req.body && req.body.delta);
    if (!Number.isFinite(delta) || delta < -1 || delta > 1) return res.status(400).json({ ok:false, error:'bad_delta' });
    const kukel = await addKukel(alias, delta);
    res.json({ ok:true, alias, kukel });
  }catch(e){ res.status(500).json({ ok:false, error:String(e && e.message || e) }); }
});

// 404 json for /api
app.use('/api', (req,res)=> res.status(404).json({ ok:false, error:'not_found' }));

// boot
(async ()=>{
  if (THE101_URI) {
    ensureMongo().catch(err=> console.error('[mongo] disabled (connect failed):', err?.message || err));
  } else {
    console.warn('[mongo] THE101_URI empty → using in-memory store');
  }
  app.listen(PORT, ()=> console.log(`the101game listening on :${PORT}`));
})();

