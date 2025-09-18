const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const ROOT = __dirname;
const PORT = 5051;
const TOKEN = process.env.ADMIN_TOKEN || '';

function auth(q) { return TOKEN && q.get('token') === TOKEN; }

function respond(res, code, body, headers={}) {
  res.writeHead(code, Object.assign({'Content-Type':'application/json'}, headers));
  res.end(JSON.stringify(body));
}

http.createServer((req, res) => {
  const { pathname, searchParams } = new url.URL(req.url, 'http://x');
  if (pathname === '/' || pathname === '/index.html') {
    // serve admin UI
    const p = path.join(ROOT, 'static', 'admin', 'index.html');
    return fs.createReadStream(p).pipe(res);
  }
  if (pathname === '/admin/stop' && req.method === 'POST') {
    if (!auth(searchParams)) return respond(res, 401, {ok:false, err:'no/Bad token'});
    fs.closeSync(fs.openSync(path.join(ROOT,'.OFFLINE'),'w'));
    return respond(res, 200, {ok:true, mode:'offline'});
  }
  if (pathname === '/admin/start' && req.method === 'POST') {
    if (!auth(searchParams)) return respond(res, 401, {ok:false, err:'no/Bad token'});
    try { fs.unlinkSync(path.join(ROOT,'.OFFLINE')); } catch(e) {}
    return respond(res, 200, {ok:true, mode:'online'});
  }
  respond(res, 404, {ok:false, err:'not found'});
}).listen(PORT, '127.0.0.1', () => console.log(`[admin] on :${PORT}`));
