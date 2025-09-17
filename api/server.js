const express = require('express');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'the101game';

const app = express();
app.use(express.json());

let client, db, aliases;
async function init() {
  client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(DB_NAME);
  aliases = db.collection('aliases');
}

app.get('/api/health', async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ ok: true, mongo: true });
  } catch {
    res.status(500).json({ ok: false, mongo: false });
  }
});

app.get('/api/aliases/count', async (_req, res) => {
  try {
    const c = await aliases.countDocuments({});
    res.json({ ok: true, count: c });
  } catch {
    res.status(500).json({ ok: false, count: null });
  }
});

app.post('/api/alias', async (req, res) => {
  try {
    const alias = String(req.body?.alias || '').toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(alias)) return res.status(400).json({ ok: false, error: 'invalid alias' });
    await aliases.insertOne({ alias, ts: new Date() });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

init()
  .then(() => app.listen(PORT, () => console.log('alias API on :' + PORT)))
  .catch((e) => { console.error('Mongo init failed:', e); process.exit(1); });
