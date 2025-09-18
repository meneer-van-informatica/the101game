const express = require('express');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3101;
const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB    = process.env.MONGODB_DB  || 'the101game';
const COOKIE_DAYS = 365;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false }));

let col;
const client = new MongoClient(MONGO);
client.connect().then(async () => {
  col = client.db(DB).collection('traffic');
  await col.createIndex({ ts: -1 });
  await col.createIndex({ p: 1, ts: -1 });
  await col.createIndex({ sid: 1, ts: -1 });
  console.log('[traffic] mongo connected');
}).catch(e => { console.error('[traffic] mongo error', e); process.exit(1); });

function getIP(req){
  const xf = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
  return xf || req.socket.remoteAddress || '';
}

app.get('/t/health', (req,res)=> res.json({ok:true, ts:Date.now()}));

app.get('/t/101.js', (req,res)=>{
  res.type('application/javascript').send(`
(() => {
  const setCookie=(n,v,d)=>{const e=new Date(Date.now()+d*864e5).toUTCString();document.cookie=n+"="+v+"; path=/; SameSite=Lax; expires="+e};
  const getCookie=n=>document.cookie.split('; ').find(r=>r.startsWith(n+'='))?.split('=')[1];
  let u=getCookie('u'); if(!u){u=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)); setCookie('u',u,365)}
  let sid=getCookie('sid'); if(!sid){sid=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)); setCookie('sid',sid,1)}

  const body = {
    t:'pv', u, sid,
    p:location.pathname+location.search,
    r:document.referrer||'',
    ua:navigator.userAgent||'',
    tz:Intl.DateTimeFormat().resolvedOptions().timeZone||'',
    ts:Date.now()
  };
  const url = '/t/ingest';
  if(navigator.sendBeacon){
    const blob = new Blob([JSON.stringify(body)], {type:'application/json'});
    navigator.sendBeacon(url, blob);
  } else {
    fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).catch(()=>{});
  }
})();`);
});

app.get('/t/kpi.js', (req,res)=>{
  res.type('application/javascript').send(`
(()=>{const el=document.createElement('div'); el.id='kpi101';
  Object.assign(el.style,{position:'fixed',top:'10px',right:'10px',zIndex:'99999',
    background:'rgba(0,0,0,.6)',color:'#fff',padding:'8px 10px',border:'1px solid #555',borderRadius:'10px',
    font:'12px/1.2 system-ui',backdropFilter:'blur(3px)'}); el.textContent='traffic…';
  document.body.appendChild(el);
  async function tick(){try{
    const r=await fetch('/t/kpi?json=1',{cache:'no-store'}); const j=await r.json();
    el.textContent=\`now:\${j.now} | 5m:\${j.m5} | 1h:\${j.h1} | active:\${j.active}\`;
  }catch(e){ /* noop */ } setTimeout(tick, 4000);} tick();})();`);
});

app.post('/t/ingest', async (req,res)=>{
  try{
    const b = req.body || {};
    const doc = {
      ts: b.ts ? new Date(b.ts) : new Date(),
      t:  b.t || 'pv',
      u:  (b.u||'').toString().slice(0,64),
      sid:(b.sid||'').toString().slice(0,64),
      p:  (b.p||'/').toString().slice(0,512),
      r:  (b.r||'').toString().slice(0,512),
      ua: (b.ua||'').toString().slice(0,512),
      tz: (b.tz||'').toString().slice(0,64),
      ip: getIP(req)
    };
    await col.insertOne(doc);
    res.json({ok:true});
  }catch(e){ console.error('[ingest]',e); res.status(500).json({ok:false}); }
});

app.get('/t/kpi', async (req,res)=>{
  try{
    const now = Date.now();
    const q = async (ms)=> await col.countDocuments({ t:'pv', ts: { $gt: new Date(now-ms) } });
    const [nowc,m5,h1] = await Promise.all([ q(60*1000), q(5*60*1000), q(60*60*1000) ]);
    const active = await col.distinct('sid', { ts:{ $gt: new Date(now-5*60*1000) } }).then(a=>a.length);
    const top = await col.aggregate([
      { $match: { t:'pv', ts:{ $gt: new Date(now-15*60*1000) } } },
      { $group: { _id:'$p', n:{$sum:1} } }, { $sort:{n:-1} }, { $limit:5 }
    ]).toArray();
    if (req.query.json) return res.json({ ok:true, now:nowc, m5, h1, active, top });
    // simple HTML (debug)
    res.type('html').send('<pre>'+JSON.stringify({now:nowc,m5,h1,active,top},null,2)+'</pre>');
  }catch(e){ console.error('[kpi]',e); res.status(500).json({ok:false}); }
});

app.listen(PORT, ()=> console.log('[traffic] listening on', PORT));
