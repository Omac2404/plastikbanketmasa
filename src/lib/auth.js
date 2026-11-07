'use strict';
const crypto = require('crypto');
const { db } = require('../db');
const { SECRET, IS_PROD } = require('../config');

const COOKIE = 'pbm_panel';
const TTL_MS = 1000 * 60 * 60 * 10; // 10 saat

const ROLES = {
  superadmin: { label: 'Süper admin', level: 3 },
  admin: { label: 'Yönetici', level: 2 },
  editor: { label: 'Editör', level: 1 },
};

/* ---------- parola ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [algo, s, k] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const key = crypto.scryptSync(String(pw), Buffer.from(s, 'base64'), 64, { N: 16384, r: 8, p: 1 });
    const want = Buffer.from(k, 'base64');
    return want.length === key.length && crypto.timingSafeEqual(want, key);
  } catch { return false; }
}

/* ---------- çerez ---------- */
function sign(v) { return v + '.' + crypto.createHmac('sha256', SECRET).update(v).digest('base64url'); }
function unsign(signed) {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const v = signed.slice(0, i);
  const a = Buffer.from(sign(v)); const b = Buffer.from(signed);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? v : null;
}
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setCookie(res, value, maxAgeMs) {
  const parts = [`${COOKIE}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (IS_PROD) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

/* ---------- oturum ---------- */
function createSession(res, userId) {
  const id = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO sessions(id, user_id, csrf, expires) VALUES(?,?,?,?)').run(id, userId, csrf, Date.now() + TTL_MS);
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(userId);
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  setCookie(res, sign(id), TTL_MS);
}
function destroySession(req, res) {
  const id = unsign(parseCookies(req)[COOKIE]);
  if (id) db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  setCookie(res, '', 0);
}

const sessStmt = db.prepare(`SELECT s.id sid, s.csrf, s.expires, u.id, u.name, u.email, u.username, u.role, u.active
  FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`);

function loadUser(req, res, next) {
  req.user = null;
  const id = unsign(parseCookies(req)[COOKIE]);
  if (id) {
    const row = sessStmt.get(id);
    if (row && row.expires > Date.now() && row.active) {
      req.user = row;
      req.csrfToken = row.csrf;
      // kayan süre: yarı ömrü geçtiyse uzat
      if (row.expires - Date.now() < TTL_MS / 2) {
        db.prepare('UPDATE sessions SET expires = ? WHERE id = ?').run(Date.now() + TTL_MS, id);
        setCookie(res, sign(id), TTL_MS);
      }
    }
  }
  res.locals.user = req.user;
  res.locals.csrf = req.csrfToken || '';
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.method === 'GET') return res.redirect('/panel/giris?next=' + encodeURIComponent(req.originalUrl));
    return res.status(401).send('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
  }
  next();
}

function requireRole(min) {
  return (req, res, next) => {
    if (!req.user || ROLES[req.user.role].level < ROLES[min].level) {
      return res.status(403).render('panel/error', { title: 'Yetki yok', message: 'Bu bölüm için yetkiniz bulunmuyor.' });
    }
    next();
  };
}

/** Panel POST isteklerinde CSRF kontrolü (form alanı ya da başlık) */
function verifyCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  // multipart formlarda gövde henüz ayrıştırılmadığı için belirteç adreste de gelebilir
  const sent = String((req.body && req.body._csrf) || req.get('x-csrf-token') || req.query._csrf || '');
  const want = req.csrfToken || '';
  const ok = want && sent.length === want.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(want));
  if (!ok) return res.status(403).send('Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.');
  next();
}

/* ---------- basit hız sınırlayıcı ---------- */
function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
    h.n += 1;
    return h.n <= max;
  };
}

module.exports = { ROLES, hashPassword, verifyPassword, createSession, destroySession, loadUser, requireAuth, requireRole, verifyCsrf, rateLimiter };
