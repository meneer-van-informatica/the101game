const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const sqlite3 = require("sqlite3").verbose();
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3010;
const DB_PATH = path.join(__dirname, "stack.db");

const app = express();
app.use(express.json());
app.use(cors());

// DB: taps history + latest view (KISS)
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(`PRAGMA journal_mode=WAL`);
  db.run(`CREATE TABLE IF NOT EXISTS taps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId TEXT NOT NULL,
    worker   INTEGER,
    x REAL, y REAL,
    ua TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE VIEW IF NOT EXISTS taps_latest AS
    SELECT t1.clientId,
           MAX(t1.updated_at) AS updated_at,
           (SELECT worker FROM taps t2 WHERE t2.clientId=t1.clientId ORDER BY updated_at DESC LIMIT 1) AS worker,
           (SELECT x FROM taps t2 WHERE t2.clientId=t1.clientId ORDER BY updated_at DESC LIMIT 1) AS x,
           (SELECT y FROM taps t2 WHERE t2.clientId=t1.clientId ORDER BY updated_at DESC LIMIT 1) AS y,
           (SELECT ua FROM taps t2 WHERE t2.clientId=t1.clientId ORDER BY updated_at DESC LIMIT 1) AS ua
    FROM taps t1 GROUP BY t1.clientId
  `);
});

// helpers
function storeTap({clientId, worker, x, y, ua}, cb) {
  db.run(
    `INSERT INTO taps(clientId,worker,x,y,ua,updated_at)
     VALUES(?,?,?,?,?,datetime('now'))`,
    [clientId, worker|0, +x, +y, ua||""],
    cb
  );
}

// API
app.get("/api/stack-count", (req,res) => {
  // number of clients with a tap in last 10 minutes (cheap proxy for “active”)
  db.get(`SELECT COUNT(*) AS n FROM taps_latest WHERE updated_at >= datetime('now','-10 minutes')`, (e,row)=>{
    if(e) return res.status(500).json({error:String(e)});
    res.json({n: row?.n|0});
  });
});

app.post("/api/tap", (req,res)=>{
  const {token,x,y,worker,ua} = req.body||{};
  const clientId = String(token||"anon");
  if(Number.isNaN(+x) || Number.isNaN(+y)) return res.status(400).json({ok:false,err:"bad coords"});
  storeTap({clientId,worker,x,y,ua:(ua||req.get("User-Agent")||"")}, (e)=>{
    if(e) return res.status(500).json({ok:false,err:String(e)});
    // broadcast over WS too
    const msg = JSON.stringify({type:"tap",clientId,worker:+worker,x:+x,y:+y,ts:Date.now()});
    wss.clients.forEach(c => { if (c.readyState===1) c.send(msg); });
    res.json({ok:true});
  });
});

app.get("/api/last-taps", (req,res)=>{
  db.all(`SELECT clientId, worker, x, y, ua, updated_at
          FROM taps_latest ORDER BY updated_at DESC LIMIT 100`, (e,rows)=>{
    if(e) return res.status(500).json({error:String(e)});
    res.json({rows});
  });
});

// (Optional) serve a tiny health at /
app.get("/", (_req,res)=>res.type("text/plain").send("The 101 Game stack ok"));

// HTTP + WS
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", ()=> ws.isAlive = true);
  ws.on("message", (buf)=>{
    try {
      const m = JSON.parse(String(buf||""));
      if (m?.type==="tap" && m?.token!=null && m?.x!=null && m?.y!=null) {
        storeTap({clientId:String(m.token), worker:m.worker|0, x:+m.x, y:+m.y, ua:String(m.ua||"ws")}, ()=>{});
        const msg = JSON.stringify({type:"tap",clientId:String(m.token),worker:m.worker|0,x:+m.x,y:+m.y,ts:Date.now()});
        wss.clients.forEach(c => { if (c.readyState===1) c.send(msg); });
      }
    } catch {}
  });
});

// keepalive
setInterval(()=>{
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 30000);

server.listen(PORT, ()=> console.log("stack server on :", PORT));
