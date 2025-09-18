const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
module.exports = function attachFolio(app, dbPath){
  const db = new sqlite3.Database(dbPath);
  const run = (sql,p=[])=>new Promise((res,rej)=>db.run(sql,p,function(e){e?rej(e):res(this)}));
  const all = (sql,p=[])=>new Promise((res,rej)=>db.all(sql,p,(e,r)=>e?rej(e):res(r)));

  app.post('/api/folio/notebook', async (req,res)=>{
    try{ const {title="My Filofax"}=req.body||{};
      const r=await run(`INSERT INTO notebooks(title) VALUES(?)`,[title]);
      res.json({ok:true,id:r.lastID});
    }catch(e){res.status(500).json({error:String(e)})}
  });

  app.post('/api/folio/page', async (req,res)=>{
    try{ const {notebook_id=1,title="Nieuwe pagina"}=req.body||{};
      const [m]=await all(`SELECT COALESCE(MAX(order_index),-1)+1 AS next FROM pages WHERE notebook_id=?`,[notebook_id]);
      const r=await run(`INSERT INTO pages(notebook_id,title,order_index) VALUES(?,?,?)`,[notebook_id,title,m.next]);
      res.json({ok:true,id:r.lastID});
    }catch(e){res.status(500).json({error:String(e)})}
  });

  app.get('/api/folio/pages', async (req,res)=>{
    try{ const {notebook_id=1}=req.query;
      const rows=await all(`SELECT p.*,(SELECT COUNT(*) FROM page_blocks pb WHERE pb.page_id=p.id) blocks
                            FROM pages p WHERE notebook_id=? ORDER BY order_index ASC`,[notebook_id]);
      res.json({rows});
    }catch(e){res.status(500).json({error:String(e)})}
  });

  app.post('/api/folio/pages/swap', async (req,res)=>{
    try{ const {a_id,b_id}=req.body||{};
      await run(`WITH a AS(SELECT order_index i FROM pages WHERE id=?),
                       b AS(SELECT order_index i FROM pages WHERE id=?)
                 UPDATE pages SET order_index=CASE id
                    WHEN ? THEN (SELECT i FROM b)
                    WHEN ? THEN (SELECT i FROM a) END
                 WHERE id IN (?,?)`,[a_id,b_id,a_id,b_id,a_id,b_id]);
      res.json({ok:true});
    }catch(e){res.status(500).json({error:String(e)})}
  });

  app.post('/api/folio/block', async (req,res)=>{
    try{ const {page_id,type="text",content={}}=req.body||{};
      const r=await run(`INSERT INTO blocks(type,content_json) VALUES(?,?)`,[type,JSON.stringify(content)]);
      const [m]=await all(`SELECT COALESCE(MAX(order_index),-1)+1 AS next FROM page_blocks WHERE page_id=?`,[page_id]);
      await run(`INSERT INTO page_blocks(page_id,block_id,order_index) VALUES(?,?,?)`,[page_id,r.lastID,m.next]);
      res.json({ok:true,id:r.lastID});
    }catch(e){res.status(500).json({error:String(e)})}
  });

  app.get('/api/folio/page/:id/blocks', async (req,res)=>{
    try{ const rows=await all(`SELECT b.id,b.type,b.content_json,pb.order_index
                              FROM page_blocks pb JOIN blocks b ON b.id=pb.block_id
                              WHERE pb.page_id=? ORDER BY pb.order_index ASC`,[req.params.id]);
      res.json({rows:rows.map(r=>({...r,content:JSON.parse(r.content_json)}))});
    }catch(e){res.status(500).json({error:String(e)})}
  });

  app.post('/api/folio/page/:id/blocks/reorder', async (req,res)=>{
    const {order=[]}=req.body||{};
    try{ await run('BEGIN'); for(let i=0;i<order.length;i++){
        await run(`UPDATE page_blocks SET order_index=? WHERE page_id=? AND block_id=?`,[i,req.params.id,order[i]]);
      } await run('COMMIT'); res.json({ok:true});
    }catch(e){ await run('ROLLBACK'); res.status(500).json({error:String(e)})}
  });

  app.post('/api/folio/block/:id', async (req,res)=>{
    try{ const id=req.params.id; const {content={},author="you"}=req.body||{};
      const json=JSON.stringify(content);
      const [{next}]=await all(`SELECT COALESCE(MAX(rev),0)+1 AS next FROM block_revisions WHERE block_id=?`,[id]);
      const [prev]=await all(`SELECT hash FROM block_revisions WHERE block_id=? AND rev=?`,[id,next-1]);
      const prev_hash=prev?.hash||null;
      const hash=crypto.createHash('sha256').update((prev_hash||'')+json).digest('hex');
      await run(`INSERT INTO block_revisions(block_id,rev,prev_hash,hash,author,content_json) VALUES(?,?,?,?,?,?)`,
        [id,next,prev_hash,hash,author,json]);
      await run(`UPDATE blocks SET content_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[json,id]);
      res.json({ok:true,rev:next});
    }catch(e){res.status(500).json({error:String(e)})}
  });
};
