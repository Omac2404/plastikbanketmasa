'use strict';
const express = require('express');
const { db, json, getSetting, logActivity } = require('../../db');
const { verifyPassword, createSession, destroySession, requireAuth, verifyCsrf, rateLimiter, ROLES } = require('../../lib/auth');
const util = require('../../lib/util');
const media = require('../../lib/media');
const mail = require('../../lib/mail');

const router = express.Router();

/* panel sayfaları arama motorlarına kapalı, önbelleğe alınmaz */
router.use((req, res, next) => {
  res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' });
  const site = getSetting('site', {}) || {};
  Object.assign(res.locals, util, {
    img: media.img, thumb: media.thumb, ROLES,
    site,
    accent: /^#[0-9a-f]{6}$/i.test(site.accent || '') ? site.accent : '#FF7A28',
    current: req.originalUrl.split('?')[0],
    flash: req.query.ok ? String(req.query.ok) : '',
    flashErr: req.query.err ? String(req.query.err) : '',
    can: (min) => !!req.user && ROLES[req.user.role].level >= ROLES[min].level,
    unread: 0,
  });
  next();
});

/* ---------- giriş ---------- */
const loginLimit = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

router.get('/giris', (req, res) => {
  if (req.user) return res.redirect('/panel');
  res.render('panel/login', { error: '', next: req.query.next || '', login: '' });
});

router.post('/giris', (req, res) => {
  const id =String(req.body.login || '').trim().toLowerCase();
  const pw = String(req.body.password || '');
  const nextUrl = String(req.body.next || '');
  const fail = (error) => res.status(401).render('panel/login', { error, next: nextUrl, login: id });
  if (!loginLimit(req.ip)) return fail('Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin.');
  const u = db.prepare('SELECT * FROM users WHERE (lower(email) = ? OR lower(username) = ?) AND active = 1').get(id, id);
  if (!u || !verifyPassword(pw, u.pass)) return fail('Kullanıcı adı veya parola hatalı.');
  createSession(res, u.id);
  logActivity(u, 'Giriş yaptı', u.name);
  res.redirect(nextUrl.startsWith('/panel') && !nextUrl.startsWith('//') ? nextUrl : '/panel');
});

router.post('/cikis', requireAuth, verifyCsrf, (req, res) => {
  destroySession(req, res);
  res.redirect('/panel/giris');
});

/* ---------- bundan sonrası oturum ister ---------- */
router.use(requireAuth);
router.use(verifyCsrf);
router.use((req, res, next) => {
  res.locals.unread = db.prepare('SELECT COUNT(*) n FROM submissions WHERE is_read = 0 AND archived = 0').get().n;
  next();
});

router.get('/', (req, res) => {
  const count = (sql) => db.prepare(sql).get().n;
  res.render('panel/dashboard', {
    title: 'Gösterge paneli',
    stats: {
      pages: count("SELECT COUNT(*) n FROM pages"),
      products: count("SELECT COUNT(*) n FROM products WHERE status='published'"),
      posts: count("SELECT COUNT(*) n FROM posts WHERE status='published' AND deleted_at IS NULL"),
      drafts: count("SELECT COUNT(*) n FROM posts WHERE status='draft' AND deleted_at IS NULL"),
      media: count('SELECT COUNT(*) n FROM media'),
    },
    subs: db.prepare('SELECT * FROM submissions WHERE archived = 0 ORDER BY id DESC LIMIT 5').all().map((s) => ({ ...s, d: json(s.data, {}) })),
    recent: db.prepare(`SELECT 'Sayfa' kind, title, '/panel/sayfalar/' || id url, updated_at FROM pages
      UNION ALL SELECT 'Ürün', title, '/panel/urunler/' || id, updated_at FROM products
      UNION ALL SELECT 'Yazı', title, '/panel/blog/' || id, updated_at FROM posts WHERE deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 6`).all(),
    activity: db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 8').all(),
    smtpOk: mail.isConfigured(),
  });
});

/* Markdown önizleme (editör "Önizle" sekmesi) */
router.post('/onizleme', (req, res) => {
  res.type('html').send(util.md(String(req.body.md || '')));
});

router.use(require('./content'));
router.use(require('./blog'));
router.use(require('./media'));
router.use(require('./manage'));

router.use((req, res) => res.status(404).render('panel/error', { title: 'Bulunamadı', message: 'Aradığınız panel sayfası yok.' }));

module.exports = router;
