PRAGMA foreign_keys = ON;

-- Gebruikers + vaste tag (#nnnn)
CREATE TABLE IF NOT EXISTS tags (
  tag_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  alias    TEXT    UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  alias     TEXT    PRIMARY KEY,
  tag_id    INTEGER UNIQUE NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
);

-- Sessies (actief online)
CREATE TABLE IF NOT EXISTS sessions (
  sid          TEXT PRIMARY KEY,
  alias        TEXT NULL,
  joined_at    INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  tok_next     INTEGER NOT NULL,
  tok_deadline INTEGER NOT NULL,
  tok_active   INTEGER NOT NULL CHECK (tok_active IN (0,1)),
  FOREIGN KEY (alias) REFERENCES users(alias) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_alias ON sessions(alias);

-- Kukel-wallet (opgeteld in seconden)
CREATE TABLE IF NOT EXISTS wallet (
  alias  TEXT PRIMARY KEY,
  kukel  INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (alias) REFERENCES users(alias) ON DELETE CASCADE
);

-- Rondes + events (SRT/log)
CREATE TABLE IF NOT EXISTS rounds (
  round_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  mode       TEXT    NOT NULL,
  banner     TEXT
);

CREATE TABLE IF NOT EXISTS events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NULL,
  ts       INTEGER NOT NULL,
  type     TEXT    NOT NULL,
  sid      TEXT    NULL,
  alias    TEXT    NULL,
  FOREIGN KEY (round_id) REFERENCES rounds(round_id) ON DELETE SET NULL,
  FOREIGN KEY (sid)      REFERENCES sessions(sid)   ON DELETE SET NULL,
  FOREIGN KEY (alias)    REFERENCES users(alias)    ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS events_by_round ON events(round_id, ts);
