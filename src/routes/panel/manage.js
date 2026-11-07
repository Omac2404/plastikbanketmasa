'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const Database = require('better-sqlite3');
const { db, json, getSetting, setSetting, logActivity } = require('../../db');
const { BACKUP_DIR } = require('../../config');
const { requireRole, hashPassword, verifyPassword, ROLES } = require('../../lib/auth');
const { str } = require('../../lib/form');
const mail = require('../../lib/mail');

const router = express.Router();
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const ICONS = [['whatsapp', 'WhatsApp'], ['phone', 'Telefon'], ['mail', 'E-posta'], ['pin', 'Konum'], ['instagram', 'Instagram'], ['arrow', 'Ok']];
const VIS = [['all', 'Her ekranda'], ['mobile', 'Yalnızca mobilde'], ['desktop', 'Yalnızca masaüstünde']];

/* ---------- menüler ---------- */
router.get('/menuler', requireRole('admin'), (req, res) => {
  const menus = db.prepare('SELECT * FROM menus ORDER BY rowid').all().map((m) => ({ ...m, list: json(m.items, []) }));
  res.render('panel/menus', { title: 'Menüler', menus, edit: req.query.m || '' });
});

router.get('/menuler/:key', requireRole('admin'), (req, res) => {
  const menu = db.prepare('SELECT * FROM menus WHERE key = ?').get(req.params.key);
  if (!menu) return res.redirect('/panel/menuler');
  const links = [
    ...db.prepare("SELECT title, CASE WHEN slug = '' THEN '/' ELSE '/' || slug END url FROM pages ORDER BY title").all().map((r) => ({ ...r, kind: 'Sayfa' })),
    ...db.prepare("SELECT title, '/' || slug url FROM products ORDER BY sort").all().map((r) => ({ ...r, kind: 'Ürün' })),
    ...db.prepare("SELECT title, '/' || slug url FROM posts WHERE deleted_at IS NULL ORDER BY title").all().map((r) => ({ ...r, kind: 'Yazı' })),
  ];
  res.render('panel/menu-edit', { title: menu.label, menu, items: json(menu.items, []), links, nested: menu.key === 'header' });
});

router.post('/menuler/:key', requireRole('admin'), (req, res) => {
  const menu = db.prepare('SELECT * FROM menus WHERE key = ?').get(req.params.key);
  if (!menu) return res.redirect('/panel/menuler');
  const labels = [].concat(req.body.label || []);
  const urls = [].concat(req.body.url || []);
  const levels = [].concat(req.body.level || []);
  const items = labels.map((l, i) => ({ label: str(l), url: str(urls[i]) || '/', level: Number(levels[i]) === 1 ? 1 : 0 })).filter((x) => x.label);
  if (items.length && items[0].level === 1) items[0].level = 0;
  db.prepare('UPDATE menus SET items = ? WHERE key = ?').run(JSON.stringify(items), menu.key);
  logActivity(req.user, 'Menüyü düzenledi', menu.label);
  res.redirect(`/panel/menuler/${menu.key}?ok=` + encodeURIComponent('Menü kaydedildi.'));
});

/* ---------- site öğeleri (yüzen butonlar, mobil alt menü) ---------- */
router.get('/ogeler', requireRole('admin'), (req, res) => {
  res.render('panel/widgets', { title: 'Site öğeleri', widgets: getSetting('widgets', {}) || {}, ICONS, VIS });
});

router.post('/ogeler', requireRole('admin'), (req, res) => {
  const which = req.body.which === 'mobilebar' ? 'mobilebar' : 'floating';
  const w = getSetting('widgets', {}) || {};
  const icons = [].concat(req.body.icon || []);
  const labels = [].concat(req.body.label || []);
  const urls = [].concat(req.body.url || []);
  const vis = [].concat(req.body.visibility || []);
  const items = icons.map((ic, i) => ({ icon: ICONS.some(([k]) => k === ic) ? ic : 'arrow', label: str(labels[i]), url: str(urls[i]), visibility: VIS.some(([k]) => k === vis[i]) ? vis[i] : 'all' })).filter((x) => x.label);
  w[which] = { ...(w[which] || {}), enabled: !!req.body.enabled, items: which === 'mobilebar' ? items.slice(0, 5) : items };
  if (which === 'floating') w.floating.position = req.body.position === 'left' ? 'left' : 'right';
  setSetting('widgets', w);
  logActivity(req.user, 'Site öğelerini düzenledi', which === 'floating' ? 'Yüzen butonlar' : 'Mobil alt menü');
  res.redirect('/panel/ogeler?ok=' + encodeURIComponent('Kaydedildi.'));
});

/* ---------- form başvuruları ---------- */
router.get('/formlar', (req, res) => {
  const f = req.query.f || 'gelen';
  const where = { gelen: 'archived = 0', okunmamis: 'archived = 0 AND is_read = 0', yildizli: 'starred = 1', arsiv: 'archived = 1' }[f] || 'archived = 0';
  const subs = db.prepare(`SELECT * FROM submissions WHERE ${where} ORDER BY id DESC LIMIT 500`).all().map((s) => ({ ...s, d: json(s.data, {}) }));
  const c = db.prepare('SELECT COUNT(*) total, SUM(is_read = 0 AND archived = 0) unread, SUM(starred) starred, SUM(archived) archived FROM submissions').get();
  res.render('panel/forms', { title: 'Form başvuruları', subs, f, c, forms: getSetting('forms', {}) || {} });
});

router.post('/formlar/:id/islem', (req, res) => {
  const s = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  const back = '/panel/formlar' + (req.body.f ? '?f=' + encodeURIComponent(req.body.f) : '');
  if (!s) return res.redirect(back);
  const a = req.body.a;
  if (a === 'okundu') db.prepare('UPDATE submissions SET is_read = 1 - is_read WHERE id = ?').run(s.id);
  if (a === 'yildiz') db.prepare('UPDATE submissions SET starred = 1 - starred WHERE id = ?').run(s.id);
  if (a === 'arsiv') db.prepare('UPDATE submissions SET archived = 1 - archived, is_read = 1 WHERE id = ?').run(s.id);
  if (a === 'sil') { db.prepare('DELETE FROM submissions WHERE id = ?').run(s.id); logActivity(req.user, 'Form başvurusunu sildi', json(s.data, {}).ad); }
  if ((req.get('accept') || '').includes('json')) return res.json({ ok: true });
  res.redirect(back);
});

router.get('/formlar.csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM submissions ORDER BY id DESC').all();
  const cols = ['ad', 'telefon', 'eposta', 'konu', 'mesaj', 'kvkk'];
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [['Tarih', 'Ad soyad', 'Telefon', 'E-posta', 'Konu', 'Mesaj', 'KVKK', 'Sayfa', 'Okundu'].map(esc).join(';')];
  for (const r of rows) {
    const d = json(r.data, {});
    lines.push([r.created_at, ...cols.map((k) => d[k]), r.page, r.is_read ? 'evet' : 'hayır'].map(esc).join(';'));
  }
  res.set('Content-Disposition', `attachment; filename="form-basvurulari-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.type('text/csv; charset=utf-8').send('﻿' + lines.join('\r\n'));
});

router.post('/formlar/ayarlar', requireRole('admin'), (req, res) => {
  setSetting('forms', { notify_to: str(req.body.notify_to), success: str(req.body.success) });
  logActivity(req.user, 'Form ayarlarını düzenledi', '');
  res.redirect('/panel/formlar?ok=' + encodeURIComponent('Form ayarları kaydedildi.'));
});

/* ---------- SEO ---------- */
router.get('/seo', requireRole('admin'), (req, res) => {
  res.render('panel/seo', { title: 'SEO', seo: getSetting('seo', {}) || {} });
});
router.post('/seo', requireRole('admin'), (req, res) => {
  const b = req.body;
  setSetting('seo', {
    title_tpl: str(b.title_tpl) || '%page% | %site%',
    description: str(b.description),
    og_image: str(b.og_image),
    favicon: str(b.favicon),
    site_url: str(b.site_url).replace(/\/+$/, ''),
    indexable: !!b.indexable,
    gtm_id: str(b.gtm_id).toUpperCase().replace(/[^A-Z0-9-]/g, ''),
  });
  logActivity(req.user, 'SEO ayarlarını düzenledi', '');
  res.redirect('/panel/seo?ok=' + encodeURIComponent('SEO ayarları kaydedildi.'));
});

/* ---------- kullanıcılar ---------- */
router.get('/kullanicilar', requireRole('superadmin'), (req, res) => {
  res.render('panel/users', { title: 'Kullanıcılar', users: db.prepare('SELECT * FROM users ORDER BY id').all(), edit: null });
});
router.get('/kullanicilar/:id', requireRole('superadmin'), (req, res) => {
  const edit = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!edit) return res.redirect('/panel/kullanicilar');
  res.render('panel/users', { title: 'Kullanıcılar', users: db.prepare('SELECT * FROM users ORDER BY id').all(), edit });
});
router.post('/kullanicilar/:id', requireRole('superadmin'), (req, res) => {
  const id = Number(req.params.id) || 0;
  const b = req.body;
  const back = (m) => res.redirect(`/panel/kullanicilar${id ? '/' + id : ''}?err=` + encodeURIComponent(m));
  const name = str(b.name), email = str(b.email).toLowerCase(), username = str(b.username).toLowerCase() || null;
  const role = ROLES[b.role] ? b.role : 'editor';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return back('Ad ve geçerli bir e-posta gerekli.');
  if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) return back('Kullanıcı adı en az 3 karakter olmalı; harf, rakam, nokta, tire içerebilir.');
  const clash = db.prepare('SELECT id FROM users WHERE (lower(email) = ? OR (username IS NOT NULL AND lower(username) = ?)) AND id != ?').get(email, username || '\u0000', id);
  if (clash) return back('Bu e-posta veya kullanıcı adı başka bir hesapta kullanılıyor.');
  if (b.password && String(b.password).length < 8) return back('Parola en az 8 karakter olmalı.');
  if (id) {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!u) return res.redirect('/panel/kullanicilar');
    const active = u.id === req.user.id ? 1 : (b.active ? 1 : 0);
    const newRole = u.id === req.user.id ? u.role : role; // kendi rolünü düşüremez
    db.prepare('UPDATE users SET name=?, email=?, username=?, role=?, active=? WHERE id=?').run(name, email, username, newRole, active, id);
    if (b.password) {
      db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(hashPassword(b.password), id);
      if (id !== req.user.id) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
    if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    logActivity(req.user, 'Kullanıcıyı düzenledi', name);
  } else {
    if (!b.password) return back('Yeni kullanıcı için parola gerekli.');
    db.prepare('INSERT INTO users(name, email, username, pass, role) VALUES(?,?,?,?,?)').run(name, email, username, hashPassword(b.password), role);
    logActivity(req.user, 'Kullanıcı ekledi', name);
  }
  res.redirect('/panel/kullanicilar?ok=' + encodeURIComponent('Kullanıcı kaydedildi.'));
});
router.post('/kullanicilar/:id/sil', requireRole('superadmin'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (u && u.id !== req.user.id) { db.prepare('DELETE FROM users WHERE id = ?').run(u.id); logActivity(req.user, 'Kullanıcıyı sildi', u.name); }
  res.redirect('/panel/kullanicilar?ok=' + encodeURIComponent('Kullanıcı silindi.'));
});

/* ---------- hesabım ---------- */
router.get('/hesap', (req, res) => res.render('panel/account', { title: 'Hesabım' }));
router.post('/hesap', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const b = req.body;
  const name = str(b.name) || u.name;
  if (b.new_password) {
    if (!verifyPassword(b.current_password || '', u.pass)) return res.redirect('/panel/hesap?err=' + encodeURIComponent('Mevcut parola hatalı.'));
    if (String(b.new_password).length < 8) return res.redirect('/panel/hesap?err=' + encodeURIComponent('Yeni parola en az 8 karakter olmalı.'));
    if (b.new_password !== b.new_password2) return res.redirect('/panel/hesap?err=' + encodeURIComponent('Yeni parolalar birbiriyle aynı değil.'));
    db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(hashPassword(b.new_password), u.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(u.id, req.user.sid);
    logActivity(req.user, 'Parolasını değiştirdi', u.name);
  }
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, u.id);
  res.redirect('/panel/hesap?ok=' + encodeURIComponent('Hesap bilgileri kaydedildi.'));
});

/* ---------- ayarlar ---------- */
router.get('/ayarlar', requireRole('admin'), (req, res) => {
  res.render('panel/settings', { title: 'Ayarlar', s: getSetting('site', {}) || {} });
});
router.post('/ayarlar', requireRole('admin'), (req, res) => {
  const b = req.body;
  const cur = getSetting('site', {}) || {};
  setSetting('site', {
    ...cur,
    name: str(b.name) || 'Plastik Banket Masa',
    panel_name: str(b.panel_name),
    accent: /^#[0-9a-f]{6}$/i.test(b.accent || '') ? b.accent : '#FF7A28',
    maintenance: !!b.maintenance,
    maintenance_text: str(b.maintenance_text),
  });
  logActivity(req.user, 'Genel ayarları düzenledi', b.maintenance ? 'Bakım modu açık' : '');
  res.redirect('/panel/ayarlar?ok=' + encodeURIComponent('Ayarlar kaydedildi.'));
});

router.get('/ayarlar/eposta', requireRole('admin'), (req, res) => {
  res.render('panel/smtp', { title: 'E-posta', smtp: getSetting('smtp', {}) || {}, log: db.prepare('SELECT * FROM mail_log ORDER BY id DESC LIMIT 15').all() });
});
router.post('/ayarlar/eposta', requireRole('admin'), (req, res) => {
  const b = req.body;
  const cur = getSetting('smtp', {}) || {};
  setSetting('smtp', {
    host: str(b.host), port: str(b.port), secure: !!b.secure, user: str(b.user),
    pass: b.pass ? String(b.pass) : cur.pass, // boş bırakılırsa eski parola korunur
    from: str(b.from), from_name: str(b.from_name),
  });
  logActivity(req.user, 'E-posta ayarlarını düzenledi', '');
  res.redirect('/panel/ayarlar/eposta?ok=' + encodeURIComponent('E-posta ayarları kaydedildi.'));
});
router.post('/ayarlar/eposta/test', requireRole('admin'), async (req, res) => {
  const to = str(req.body.to) || req.user.email;
  try {
    await mail.send({ to, subject: 'Plastik Banket Masa paneli: test e-postası', text: 'Bu bir test e-postasıdır. SMTP ayarlarınız çalışıyor.' });
    res.redirect('/panel/ayarlar/eposta?ok=' + encodeURIComponent(`Test e-postası ${to} adresine gönderildi.`));
  } catch (e) {
    res.redirect('/panel/ayarlar/eposta?err=' + encodeURIComponent('Gönderilemedi: ' + e.message));
  }
});

/* ---------- yedekleme ---------- */
const backupName = () => 'yedek-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.db';
const listBackups = () => fs.readdirSync(BACKUP_DIR).filter((f) => /^[\w.-]+\.db$/.test(f))
  .map((f) => ({ f, size: fs.statSync(path.join(BACKUP_DIR, f)).size, t: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
  .sort((a, b) => b.t - a.t);

router.get('/ayarlar/yedek', requireRole('superadmin'), (req, res) => {
  res.render('panel/backup', { title: 'Yedekleme', backups: listBackups() });
});
router.post('/ayarlar/yedek', requireRole('superadmin'), async (req, res) => {
  const name = backupName();
  await db.backup(path.join(BACKUP_DIR, name));
  const all = listBackups();
  for (const old of all.slice(10)) fs.unlinkSync(path.join(BACKUP_DIR, old.f));
  logActivity(req.user, 'Yedek aldı', name);
  res.redirect('/panel/ayarlar/yedek?ok=' + encodeURIComponent('Yedek alındı: ' + name));
});
router.get('/ayarlar/yedek/:f', requireRole('superadmin'), (req, res) => {
  const f = path.basename(req.params.f);
  const full = path.join(BACKUP_DIR, f);
  if (!/^[\w.-]+\.db$/.test(f) || !fs.existsSync(full)) return res.redirect('/panel/ayarlar/yedek');
  res.download(full, f);
});
router.post('/ayarlar/yedek/:f/sil', requireRole('superadmin'), (req, res) => {
  const f = path.basename(req.params.f);
  if (/^[\w.-]+\.db$/.test(f)) { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch { /* yok */ } }
  res.redirect('/panel/ayarlar/yedek?ok=' + encodeURIComponent('Yedek silindi.'));
});

const TABLES = ['users', 'settings', 'pages', 'products', 'categories', 'posts', 'media', 'menus', 'submissions', 'activity', 'mail_log'];
function restoreFrom(file) {
  const src = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const have = new Set(src.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name));
    for (const t of ['users', 'settings', 'pages']) if (!have.has(t)) throw new Error('Dosya bu siteye ait bir yedek değil.');
  } finally { src.close(); }
  db.prepare('ATTACH DATABASE ? AS src').run(file);
  try {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      for (const t of TABLES) {
        const cols = db.prepare(`PRAGMA main.table_info(${t})`).all().map((c) => c.name);
        const srcCols = new Set(db.prepare(`PRAGMA src.table_info(${t})`).all().map((c) => c.name));
        if (!srcCols.size) continue;
        const common = cols.filter((c) => srcCols.has(c)).join(', ');
        db.prepare(`DELETE FROM main.${t}`).run();
        db.prepare(`INSERT INTO main.${t} (${common}) SELECT ${common} FROM src.${t}`).run();
      }
      db.prepare('DELETE FROM main.sessions').run();
    })();
  } finally {
    db.pragma('foreign_keys = ON');
    db.prepare('DETACH DATABASE src').run();
  }
}

router.post('/ayarlar/yedek/:f/geri-yukle', requireRole('superadmin'), async (req, res) => {
  const f = path.basename(req.params.f);
  const full = path.join(BACKUP_DIR, f);
  if (!/^[\w.-]+\.db$/.test(f) || !fs.existsSync(full)) return res.redirect('/panel/ayarlar/yedek');
  try {
    await db.backup(path.join(BACKUP_DIR, 'once-' + backupName())); // güvenlik için önce mevcut durumu yedekle
    restoreFrom(full);
    require('../../lib/media').invalidate();
    res.redirect('/panel/giris');
  } catch (e) {
    res.redirect('/panel/ayarlar/yedek?err=' + encodeURIComponent('Geri yüklenemedi: ' + e.message));
  }
});

const backupUpload = multer({ dest: BACKUP_DIR, limits: { fileSize: 200 * 1024 * 1024, files: 1 } });
router.post('/ayarlar/yedek-yukle', requireRole('superadmin'), backupUpload.single('file'), (req, res) => {
  if (!req.file) return res.redirect('/panel/ayarlar/yedek?err=' + encodeURIComponent('Dosya seçilmedi.'));
  const target = path.join(BACKUP_DIR, 'yuklenen-' + backupName());
  fs.renameSync(req.file.path, target);
  try {
    const t = new Database(target, { readonly: true, fileMustExist: true });
    t.prepare('SELECT COUNT(*) FROM pages').get();
    t.close();
  } catch {
    fs.unlinkSync(target);
    return res.redirect('/panel/ayarlar/yedek?err=' + encodeURIComponent('Yüklenen dosya geçerli bir site yedeği değil.'));
  }
  logActivity(req.user, 'Yedek dosyası yükledi', path.basename(target));
  res.redirect('/panel/ayarlar/yedek?ok=' + encodeURIComponent('Yedek listeye eklendi. Geri yüklemek için listeden seçin.'));
});

/* ---------- aktivite ---------- */
router.get('/aktivite', requireRole('admin'), (req, res) => {
  res.render('panel/activity', { title: 'Aktivite', rows: db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 300').all() });
});

module.exports = router;
