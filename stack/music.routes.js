const express = require("express");                 // <-- missing before
const sqlite3 = require("sqlite3").verbose();
const http = require("http");
const https = require("https");

function xfetch(u,opt={}){return new Promise((res,rej)=>{
  const lib = u.startsWith("https")?https:http;
  const r = lib.request(u,{method:opt.method||"GET",headers:opt.headers||{}},rsp=>{
    let b=[]; rsp.on("data",d=>b.push(d)); rsp.on("end",()=>res({status:rsp.statusCode,text:Buffer.concat(b).toString()}));
  }); r.on("error",rej); if(opt.body) r.write(opt.body); r.end();
});}
function kvSet(db,k,v){return new Promise((res,rej)=>db.run(
  "INSERT INTO music_conf(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",[k,String(v)],e=>e?rej(e):res()))}
function kvGet(db,k){return new Promise((res)=>db.get("SELECT v FROM music_conf WHERE k=?", [k], (e,row)=>res(row?.v||"")))}

module.exports = function attachMusic(app, dbPath){
  const db = new sqlite3.Database(dbPath);
  db.serialize(()=>db.run(`CREATE TABLE IF NOT EXISTS music_conf(k TEXT PRIMARY KEY, v TEXT)`));

  app.get("/api/music/now",(req,res)=>{
    Promise.all([kvGet(db,"now_source"),kvGet(db,"now_title"),kvGet(db,"now_state")])
      .then(([source,title,state])=>res.json({source:source||null,title:title||"",state:state||"idle"}));
  });

  // Hue discovery
  app.post("/api/music/hue/discover", async (req,res)=>{
    try{const d=await xfetch("https://discovery.meethue.com/"); res.type("application/json").send(d.text||"[]");}
    catch{res.json([])}
  });

  // Pair (press bridge button, then call)
  app.post("/api/music/hue/pair", express.json(), async (req,res)=>{
    const ip=(req.body?.ip||"").trim(); const dev=(req.body?.devicetype||"The 101 Game#server").trim();
    if(!ip) return res.status(400).json({error:"missing ip"});
    try{
      const r=await xfetch(`http://${ip}/api`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({devicetype:dev})});
      let a=[]; try{a=JSON.parse(r.text)}catch{}
      const user=a?.[0]?.success?.username; if(user) return res.json({ok:true,username:user});
      return res.status(400).json({error:a?.[0]?.error?.description||"pair failed"});
    }catch(e){return res.status(500).json({error:String(e)})}
  });

  // Save config
  app.post("/api/music/hue/config", express.json(), async (req,res)=>{
    const ip=(req.body?.ip||"").trim(), user=(req.body?.username||"").trim(), group=String(req.body?.group??"0");
    if(!ip||!user) return res.status(400).json({error:"ip and username required"});
    try{ await kvSet(db,"hue_ip",ip); await kvSet(db,"hue_user",user); await kvSet(db,"hue_group",group); res.json({ok:true}); }
    catch(e){ res.status(500).json({error:String(e)})}
  });

  // Test flash
  app.post("/api/music/hue/test", express.json(), async (req,res)=>{
    const ip=await kvGet(db,"hue_ip"), user=await kvGet(db,"hue_user"), group=(await kvGet(db,"hue_group"))||"0";
    if(!ip||!user) return res.status(400).json({error:"hue not configured"});
    const u=`http://${ip}/api/${user}/groups/${group}/action`;
    await xfetch(u,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({alert:"select"})});
    res.json({ok:true});
  });

  // Sleep (dim warm, auto-off optional)
  app.post("/api/music/hue/sleep", express.json(), async (req,res)=>{
    const ip=await kvGet(db,"hue_ip"), user=await kvGet(db,"hue_user"), group=(await kvGet(db,"hue_group"))||"0";
    if(!ip||!user) return res.status(400).json({error:"hue not configured"});
    const {bri=30, ct=500, seconds=0}=req.body||{};
    const u=`http://${ip}/api/${user}/groups/${group}/action`;
    await xfetch(u,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      on:true, bri:Math.max(1,Math.min(254,Math.round(bri*2.54))), ct:Math.max(153,Math.min(500,ct)), transitiontime:50
    })});
    if(Number(seconds)>0){
      setTimeout(()=>xfetch(u,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({on:false,transitiontime:20})}).catch(()=>{}), Number(seconds)*1000);
    }
    res.json({ok:true});
  });

  // Volume/stop/panic placeholders (safe no-ops)
  app.post("/api/music/volume", express.json(), (req,res)=>res.json({ok:true,level:Number(req.body?.level||0)}));
  app.post("/api/music/stop",   (req,res)=>res.json({ok:true}));
  app.post("/api/music/panic",  (req,res)=>res.json({ok:true}));
};
