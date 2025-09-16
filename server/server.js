const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3002;
const app = express();
app.use(express.json());

// [CONFIG] contact emails (TEST NULL)
const CONTACT_TO = (process.env.CONTACT_TO ||
  "dbn@fioretti.nl,lucas@the101game.io")
  .split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
app.get("/api/config/contact-to", (req,res)=>res.json({ to: CONTACT_TO }));

app.use("/api/test", aliasRateLimit);
app.use("/api/profile", aliasRateLimit);
app.use(express.static('/the101game/static', { maxAge: 0 }));

// favicon (ico fallback -> svg)
app.get("/favicon.ico", (req,res)=>res.redirect(302, "/favicon.svg"));


// favicon (ico fallback -> svg)
app.get("/favicon.ico", (req,res)=>res.redirect(302, "/favicon.svg"));


// favicon (ico fallback -> svg)
app.get("/favicon.ico", (req,res)=>res.redirect(302, "/favicon.svg"));


// ---- Helpers (idempotent, globaal) -----------------------------------------
const __H = (global.__the101helpers ||= {});
__H.cleanAlias ||= (s => (s||'').toString().trim().slice(0,24));
__H.nowIso     ||= (() => new Date().toISOString());
__H.mem        ||= (global.mem ||= new Map());              // alias -> doc
__H.ideas      ||= (global.ideas ||= []);                   // ideeënbus (array)
__H.write      ||= async function(alias, patch){
  const a = __H.cleanAlias(alias);
  const cur = __H.mem.get(a) || { alias:a, kukel:0, lastSeenAt:null, page:0, online:false };
  Object.assign(cur, patch);
  __H.mem.set(a, cur);
  return cur;
};
if (!global.cleanAlias) global.cleanAlias = __H.cleanAlias;
if (!global.write)      global.write      = __H.write;
// ----------------------------------------------------------------------------

// ---- Health / smoke ---------------------------------------------------------
app.get('/healthz', (req,res)=> res.json({ok:true, time:__H.nowIso()}));

// ---- Demo status endpoint gebruikt door je loader ---------------------------
app.get('/get-test-status', (req,res)=>{
  const alias = __H.cleanAlias(req.query.alias||'');
  const status = alias.toLowerCase().startsWith('ok') ? 'ready' : 'pending';
  res.json({ status });
});

// ---- Profielen / presence ---------------------------------------------------
app.post('/api/profile/hello', async (req,res)=>{
  const { alias, page=0, consentOnline=false } = (req.body||{});
  const a = __H.cleanAlias(alias);
  if (!a) return res.status(400).json({ ok:false, error:'alias required' });
  const now = __H.nowIso();
  const doc = await __H.write(a, {
    page: Number.isFinite(+page) ? +page : 0,
    online: !!consentOnline,
    lastSeenAt: now,
    lastLoginAt: now
  });
  res.json({ ok:true, profile: doc });
});

app.get('/api/profile', (req,res)=>{
  const a = __H.cleanAlias(req.query.alias||'');
  if (!a) return res.status(400).json({ ok:false, error:'alias required' });
  const doc = __H.mem.get(a) || null;
  res.json({ ok:true, profile: doc });
});

app.post('/api/profile/logout', async (req,res)=>{
  const a = __H.cleanAlias((req.body||{}).alias);
  if (!a) return res.status(400).json({ ok:false, error:'alias required' });
  const doc = await __H.write(a, { online:false, lastLogoutAt: __H.nowIso() });
  res.json({ ok:true, profile: doc });
});

// ---- Aliassen + KUKEL gifts -------------------------------------------------
app.get('/api/aliases', (req,res)=>{
  const arr = [...__H.mem.values()].slice(0,2000)
    .map(({alias,kukel,online,lastSeenAt,page})=>({alias,kukel,online,lastSeenAt,page}));
  res.json({ ok:true, aliases: arr });
});

app.post('/api/kukel/gift', async (req,res)=>{
  const { from, to, amount } = (req.body||{});
  const f = __H.cleanAlias(from), t = __H.cleanAlias(to);
  const amt = Math.floor(Number(amount));
  if (!f || !t || f===t) return res.status(400).json({ ok:false, error:'bad from/to' });
  if (!(amt>=1))        return res.status(400).json({ ok:false, error:'bad amount' });

  const F = await __H.write(f, {}); const T = await __H.write(t, {});
  if ((F.kukel||0) < amt) return res.status(400).json({ ok:false, error:'insufficient balance' });

  F.kukel = (F.kukel||0) - amt;
  T.kukel = (T.kukel||0) + amt;
  await __H.write(f, F); await __H.write(t, T);

  res.json({ ok:true, from:{alias:f,kukel:F.kukel}, to:{alias:t,kukel:T.kukel} });
});

// ---- Ideeënbus --------------------------------------------------------------
app.get('/api/ideas', (req,res)=>{
  const limit = Math.min(200, Math.max(1, Number(req.query.limit||50)));
  res.json({ ok:true, ideas: __H.ideas.slice(-limit) });
});
app.get('/api/ideas/stats', (req,res)=>{
  const tot = __H.ideas.length;
  const kinds = __H.ideas.reduce((m,it)=> (m[it.kind]=(m[it.kind]||0)+1, m), {});
  res.json({ ok:true, total: tot, kinds });
});
app.post('/api/ideas', (req,res)=>{
  const { alias, kind='tip', text='' } = (req.body||{});
  const a = __H.cleanAlias(alias);
  const k = ['tip','top'].includes((kind||'').toLowerCase()) ? kind.toLowerCase() : 'tip';
  const t = (text||'').toString().trim();
  if (!a || !t) return res.status(400).json({ ok:false, error:'alias and text required' });
  const item = { id: (__H.ideas.length+1), alias:a, kind:k, text:t, time: __H.nowIso() };
  __H.ideas.push(item);
  res.json({ ok:true, idea:item });
});

// ---- Socket.IO (lichtgewicht lobby) ----------------------------------------
const http = createServer(app);
const io = new Server(http, { cors: { origin: true, methods: ['GET','POST'] } });

// [compat] helpers
global.__the101helpers = global.__the101helpers || {};
global.H = global.H || global.__the101helpers;

// [helpers: read()]
if (!H.read) H.read = async function(alias){
  const a = (H.cleanAlias?H.cleanAlias:(s=>String(s||"").trim().slice(0,24)))(alias);
  if (global.players){ return await global.players.findOne({ alias:a }, { projection:{ _id:0 } }); }
  else { const m=(global.mem ||= new Map()); return m.get(a)||null; }
}

// [compat] helpers alias
global.__the101helpers = global.__the101helpers || {};
global.H = global.H || global.__the101helpers;


// [compat] helpers alias
global.__the101helpers = global.__the101helpers || {};
global.H = global.H || global.__the101helpers;


io.on('connection', (socket)=>{
  // markeer basic presence zodra client 'hello' emit
  socket.on('hello', async (p={})=>{
    const a = __H.cleanAlias(p.alias||'');
    if (!a) return;
    await __H.write(a, { online: !!p.online, lastSeenAt: __H.nowIso() });
    socket.join('lobby');
    io.to('lobby').emit('presence', { alias:a, online:true, at: __H.nowIso() });
  });
  socket.on('disconnect', ()=> {
    // laat presence aan API kant doen; hier geen zware writes
  });
});

// ---- Start ------------------------------------------------------------------
http.listen(PORT, ()=> {
  console.log('the101game realtime on :' + PORT);
});

// --- profile: page progress --------------------------------------------------
app.post('/api/profile/page', async (req,res)=>{
  try{
    const { alias, page } = (req.body||{});
    const a = (global.cleanAlias||((s)=> (s||'').toString().trim().slice(0,24)))(alias);
    const p = Number(page);
    if (!a || !Number.isFinite(p) || p < -1) return res.status(400).json({ ok:false, error:'bad alias/page' });
    const now = (global.__the101helpers?.nowIso ? global.__the101helpers.nowIso() : new Date().toISOString());
    const doc = (global.write ? await global.write(a, { page:p, lastSeenAt: now }) : { alias:a, page:p, lastSeenAt: now });
    res.json({ ok:true, profile:{ alias:a, page:doc.page, lastSeenAt:doc.lastSeenAt } });
  } catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});

// --- favicon: avoid 404 noise ------------------------------------------------
app.get('/favicon.ico', (req,res)=> res.status(204).end());

// --- profile: login/logout + admin check ------------------------------------
app.post('/api/profile/login', async (req,res)=>{
  try{
    const alias = H.cleanAlias(req.body?.alias);
    if (!alias) return res.status(400).json({ ok:false, error:'no alias' });
    const doc = await H.write(alias, { lastLoginAt: H.nowIso(), online:true });
    res.json({ ok:true, profile:doc });
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});

app.post('/api/profile/logout', async (req,res)=>{
  try{
    // sendBeacon kan text/plain sturen; probeer JSON te parsen indien nodig
    let body = req.body;
    if (!body || typeof body !== 'object') {
      let raw = '';
      req.on('data', c => raw += c);
      req.on('end', async ()=>{
        try{ body = JSON.parse(raw||'{}'); }catch(_){}
        const alias = H.cleanAlias(body?.alias);
        if (alias){ await H.write(alias, { lastLogoutAt: H.nowIso(), online:false }); }
        res.json({ ok:true });
      });
      return;
    }
    const alias = H.cleanAlias(body?.alias);
    if (alias){ await H.write(alias, { lastLogoutAt: H.nowIso(), online:false }); }
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});

app.get('/api/admin/is-admin', (req,res)=>{
  const a = H.cleanAlias(req.query.alias);
  const isAdmin = !!a && (a.toLowerCase()==='lmw' || a.toLowerCase()==='admin');
  res.json({ ok:true, admin:isAdmin });
});

// favicon stil; vermijd 404 spam
app.get('/favicon.ico', (req,res)=> res.status(204).end());

// health probe
app.get('/health', (req,res)=>res.json({ ok:true, ts:Date.now() }));

// === [RATELIMIT v1] In-memory limiter (per IP) ===============================
const __RL = (global.__the101_rl ||= {
  hour: new Map(), day: new Map()
});
function prune(map, now, windowMs){
  for (const [k, arr] of map) {
    const keep = arr.filter(ts => now - ts <= windowMs);
    if (keep.length) map.set(k, keep); else map.delete(k);
  }
}
function hit(map, key, limit, windowMs){
  const now = Date.now();
  const arr = map.get(key) || [];
  // drop oude hits
  const recent = arr.filter(ts => now - ts <= windowMs);
  recent.push(now);
  map.set(key, recent);
  return recent.length <= limit;
}
// 3x per uur, 3x per dag (IP-based)
const RL_HOURLY_LIMIT = 3, RL_DAILY_LIMIT = 3;
const HOUR = 60*60*1000, DAY = 24*HOUR;

function aliasRateLimit(req, res, next){
  // Alleen POSTs naar /api/profile/(login|hello|register|page)
  if (req.method !== 'POST') return next();
  const p = req.path || '';
  if (!/^\/?(login|hello|register|page)$/.test(p)) return next();

  const ip = (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket.remoteAddress || '?.ip';

  // daily cap
  prune(__RL.day, Date.now(), DAY);
  if (!hit(__RL.day, ip, RL_DAILY_LIMIT, DAY)){
    res.setHeader('Retry-After', '86400');
    return res.status(429).json({ ok:false, error:'rate_limited_daily', limit:RL_DAILY_LIMIT });
  }
  // hourly cap
  prune(__RL.hour, Date.now(), HOUR);
  if (!hit(__RL.hour, ip, RL_HOURLY_LIMIT, HOUR)){
    res.setHeader('Retry-After', '3600');
    return res.status(429).json({ ok:false, error:'rate_limited_hourly', limit:RL_HOURLY_LIMIT });
  }
  return next();
}
// Mount vóór je profiel-routes

// === TEST NULL ===============================================================
app.get('/api/test/null/status', async (req,res)=>{
  try{
    const alias = (req.query.alias||'').toString();
    const profile = await H.read(alias);
    res.json({ ok:true, alias: alias.trim(), hasEmail: !!(profile && profile.email) });
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});

app.post('/api/test/null/submit', async (req,res)=>{
  try{
    const { alias, email } = req.body || {};
    const a = (H.cleanAlias?H.cleanAlias:(s=>String(s||"").trim().slice(0,24)))(alias);
    const e = String(email||'').trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
    if (!a || !valid) return res.status(400).json({ ok:false, error:'bad_input' });
    await (H.write?H.write:async()=>{})(a, { email:e, emailVerified:false, lastEmailAt:new Date().toISOString() });
    res.json({ ok:true, saved:true });
  }catch(err){ res.status(500).json({ ok:false, error:String(err.message||err) }); }
});

// health
app.get('/api/health', (req,res)=> res.json({ ok:true, uptime: process.uptime() }));
// ============================================================================

// [FEEDBACK v1] ---------------------------------------------------------------
{
  const FEED_WEIGHTS = { BACK: -1, UP: +1, FORWARD: 0.1 };

  // simple in-memory rate limiter: key=(ip|alias):verb, window=1h, limit=3
  const _RL = (global.__rl ||= new Map());
  function allow(key, limit=3, windowMs=3600_000) {
    const now = Date.now();
    const b = _RL.get(key) || [];
    const fresh = b.filter(t => now - t < windowMs);
    if (fresh.length >= limit) return false;
    fresh.push(now);
    _RL.set(key, fresh);
    return true;
  }

  // in-memory aggregate (also merge into player doc)
  const agg = (global.__feedback ||= { byPage: new Map(), recent: [] });
  function bump(page, kind) {
    const rec = agg.byPage.get(page) || { back:0, up:0, forward:0, score:0 };
    if (kind==='BACK')   rec.back++;
    if (kind==='UP')     rec.up++;
    if (kind==='FORWARD')rec.forward++;
    rec.score = (rec.up * 1) + (rec.forward * 0.1) + (rec.back * -1);
    agg.byPage.set(page, rec);
    return rec;
  }

  // POST /api/feedback/submit  { page, kind, note? }
  app.post('/api/feedback/submit', async (req,res)=>{
    try{
      const { page, kind, note='' } = req.body || {};
      const k = String(kind||'').toUpperCase();
      const pg = Number(page);
      if (!Number.isFinite(pg) || pg<0) return res.status(400).json({ ok:false, error:'bad_page' });
      if (!['BACK','UP','FORWARD'].includes(k)) return res.status(400).json({ ok:false, error:'bad_kind' });

      const ip = (req.headers['x-forwarded-for']||req.socket.remoteAddress||'').toString().split(',')[0].trim();
      const alias = ((req.session&&req.session.user&&req.session.user.alias) || (req.session&&req.session.alias) || '').trim().toLowerCase();
      const key = `${ip}|${alias||'anon'}|fb|${pg}`;

      if (!allow(key, 3, 3600_000)) return res.status(429).json({ ok:false, error:'rate_limited' });

      // persist minimal breadcrumb on profile (anti-spam per page/kind)
      const prof = (alias? await (H.read?H.read(alias):null) : null) || {};
      const already = (((prof.feedbackGiven||{})[pg]||{})[k]||0) >= 1;
      const patch = { 
        feedbackGiven: { ...(prof.feedbackGiven||{}), [pg]: { ...((prof.feedbackGiven||{})[pg]||{}), [k]: (already?1:1) } }, 
        lastFeedbackAt: new Date().toISOString()
      };
      if (alias && H.write) await H.write(alias, patch);

      // aggregate (always)
      const rec = bump(pg, k);
      agg.recent.unshift({ at:new Date().toISOString(), page:pg, kind:k, alias: alias||null, ip, note: String(note||'').slice(0,200) });
      if (agg.recent.length>100) agg.recent.length = 100;

      res.json({ ok:true, page:pg, kind:k, weights: FEED_WEIGHTS, summary: rec });
    }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
  });

  // GET /api/feedback/summary?page=2
  app.get('/api/feedback/summary', (req,res)=>{
    const pg = Number(req.query.page);
    if (!Number.isFinite(pg)) return res.status(400).json({ ok:false, error:'bad_page' });
    const rec = agg.byPage.get(pg) || { back:0, up:0, forward:0, score:0 };
    res.json({ ok:true, page:pg, summary:rec });
  });
}
// ----------------------------------------------------------------------------
