'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { DATA_DIR } = require('./config');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'site.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  pass TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  expires INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  data TEXT NOT NULL DEFAULT '{}',
  seo_title TEXT DEFAULT '',
  seo_desc TEXT DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'masa',
  status TEXT NOT NULL DEFAULT 'published',
  sort INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL DEFAULT '{}',
  seo_title TEXT DEFAULT '',
  seo_desc TEXT DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  body TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  seo_title TEXT DEFAULT '',
  seo_desc TEXT DEFAULT '',
  deleted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  file TEXT NOT NULL UNIQUE,
  original_name TEXT,
  mime TEXT,
  width INTEGER,
  height INTEGER,
  size INTEGER,
  alt TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS menus (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY,
  form TEXT NOT NULL DEFAULT 'iletisim',
  data TEXT NOT NULL,
  page TEXT,
  ip TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  starred INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  target TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mail_log (
  id INTEGER PRIMARY KEY,
  recipient TEXT,
  subject TEXT,
  status TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, published_at);
CREATE INDEX IF NOT EXISTS idx_sub_created ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_act_created ON activity(created_at);
`);

const json = (s, fallback) => {
  if (s == null || s === '') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};

/* ---------- settings (key/value, JSON encoded) ---------- */
const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

function getSetting(key, fallback = null) {
  const r = getSettingStmt.get(key);
  return r ? json(r.value, fallback) : fallback;
}
function setSetting(key, value) {
  setSettingStmt.run(key, JSON.stringify(value));
}
function allSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = json(r.value, null);
  return out;
}

/* ---------- activity ---------- */
const actStmt = db.prepare('INSERT INTO activity(user_id, user_name, action, target) VALUES(?, ?, ?, ?)');
function logActivity(user, action, target = '') {
  actStmt.run(user ? user.id : null, user ? user.name : 'Sistem', action, String(target || '').slice(0, 300));
  db.prepare("DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 2000)").run();
}

module.exports = { db, json, getSetting, setSetting, allSettings, logActivity };
