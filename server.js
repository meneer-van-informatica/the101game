// server.js — static + alias API
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = Number(process.env.PORT || 3002);

app.disable('x-powered-by');
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || 'devsecret'));

// --- static
const STATIC_DIR = path.join(__dirname, 'static');
app.use('/', express.static(STATIC_DIR, {
  etag: true, lastModified: true, maxAge: 0
}));
app.get('/', (_, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

// --- helpers
const clean = s => String(s || '').trim().toLowerCase();
const ok3   = s => /^[a-z0-9]{3}$/.test(s);
const cookieOpts = (req) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure: !!isHttps,
    maxAge: 365 * 24 * 60 * 60 * 1000
  };
};

// --- API
app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.post('/api/alias/claim', (req, res) => {
  const alias = clean(req.body?.alias);
  if (!ok3(alias)) return res.status(400).json({ ok: false, error: 'bad_alias' });
  res.cookie('alias', alias, cookieOpts(req));
  // ook een niet-httponly variant als je die elders wilt lezen
  res.cookie('alias_public', alias, { ...cookieOpts(req), httpOnly: false });
  res.json({ ok: true, alias });
});

app.get('/api/alias/whoami', (req, res) => {
  const alias = clean(req.cookies?.alias || req.cookies?.alias_public || req.signedCookies?.alias);
  if (!ok3(alias)) return res.status(404).json({ ok: false });
  res.json({ ok: true, alias });
});

// optioneel: logout endpoint dat je HTML ooit riep
app.post('/api/profile/logout', (req, res) => {
  res.clearCookie('alias');
  res.clearCookie('alias_public');
  res.json({ ok: true });
});

// catch-all
app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

app.listen(PORT, () => console.log(`the101game listening on :${PORT}`));

