'use strict';
const path = require('path');
const express = require('express');
const compression = require('compression');
const { PORT, ROOT, UPLOAD_DIR, IS_PROD } = require('./config');
const { db } = require('./db');
const { loadUser } = require('./lib/auth');
const { seed } = require('./seed');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Easypanel / Traefik arkasında
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));
if (IS_PROD) app.set('view cache', true);
app.locals.assetVersion = Date.now().toString(36);

app.use(compression());

/* ---------- güvenlik başlıkları ---------- */
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (IS_PROD) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

/* ---------- statik dosyalar ---------- */
const longCache = { maxAge: IS_PROD ? '30d' : 0, immutable: IS_PROD };
app.use('/assets', express.static(path.join(ROOT, 'public'), { maxAge: IS_PROD ? '7d' : 0 }));
app.use('/uploads', express.static(UPLOAD_DIR, longCache));
app.use('/fonts/league-spartan', express.static(path.join(ROOT, 'node_modules/@fontsource-variable/league-spartan/files'), longCache));
app.use('/fonts/montserrat', express.static(path.join(ROOT, 'node_modules/@fontsource-variable/montserrat/files'), longCache));

app.use(express.urlencoded({ extended: false, limit: '2mb', parameterLimit: 5000 }));
app.use(express.json({ limit: '2mb' }));
app.use(loadUser);

/* ---------- eski adreslerin sonundaki "/" işaretini kaldır (301) ---------- */
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && req.path.length > 1 && req.path.endsWith('/')) {
    const q = req.originalUrl.slice(req.path.length);
    return res.redirect(301, req.path.replace(/\/+$/, '') + q);
  }
  next();
});

app.get('/healthz', (req, res) => {
  db.prepare('SELECT 1').get();
  res.type('text').send('ok');
});

app.use('/panel', require('./routes/panel'));
app.use('/', require('./routes/site'));

/* ---------- hata yakalayıcı ---------- */
app.use((err, req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  const isPanel = req.originalUrl.startsWith('/panel');
  res.status(err.status || 500);
  if (isPanel) return res.render('panel/error', { title: 'Hata', message: IS_PROD ? 'Beklenmeyen bir hata oluştu.' : err.message });
  res.type('html').send('<!doctype html><meta charset="utf-8"><title>Hata</title><p style="font-family:sans-serif;padding:40px">Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.</p>');
});

(async () => {
  await seed();
  app.listen(PORT, () => console.log(`Plastik Banket Masa çalışıyor: http://localhost:${PORT}`));
})().catch((e) => { console.error(e); process.exit(1); });

module.exports = app;
