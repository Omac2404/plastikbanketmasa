'use strict';
const express = require('express');
const multer = require('multer');
const { db, logActivity } = require('../../db');
const { processUpload, deleteMedia, invalidate, thumb } = require('../../lib/media');
const { str } = require('../../lib/form');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 30, fields: 10 } });

/** Görselin sitede nerelerde kullanıldığını bulur */
function usage(url) {
  const like = '%' + url + '%';
  const out = [];
  for (const r of db.prepare('SELECT id, title FROM pages WHERE data LIKE ?').all(like)) out.push({ label: 'Sayfa: ' + r.title, url: '/panel/sayfalar/' + r.id });
  for (const r of db.prepare('SELECT id, title FROM products WHERE data LIKE ?').all(like)) out.push({ label: 'Ürün: ' + r.title, url: '/panel/urunler/' + r.id });
  for (const r of db.prepare('SELECT id, title FROM posts WHERE (body LIKE ? OR cover = ?) AND deleted_at IS NULL').all(like, url)) out.push({ label: 'Yazı: ' + r.title, url: '/panel/blog/' + r.id });
  for (const r of db.prepare('SELECT key FROM settings WHERE value LIKE ?').all(like)) out.push({ label: 'Ayar: ' + r.key, url: r.key === 'seo' ? '/panel/seo' : '/panel/alanlar' });
  return out;
}

router.get('/medya', (req, res) => {
  const q = str(req.query.q);
  const items = q
    ? db.prepare('SELECT * FROM media WHERE original_name LIKE ? OR alt LIKE ? OR file LIKE ? ORDER BY id DESC').all(`%${q}%`, `%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM media ORDER BY id DESC').all();
  const total = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(size),0) s FROM media').get();
  res.render('panel/media', { title: 'Medya', items, total, q });
});

/* Görsel seçici için JSON liste */
router.get('/medya/api', (req, res) => {
  const items = db.prepare("SELECT id, file, original_name, width, height, alt, mime FROM media ORDER BY id DESC").all()
    .map((m) => ({ ...m, url: '/uploads/' + m.file, thumb: thumb('/uploads/' + m.file, 480) }));
  res.json({ items });
});

router.post('/medya/yukle', (req, res, next) => {
  upload.array('files', 30)(req, res, async (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'Dosya 15 MB sınırını aşıyor.' : 'Yükleme başarısız: ' + err.message });
    // Multipart istekte CSRF başlıktan gelir (verifyCsrf bunu zaten kontrol etti)
    const results = [];
    for (const f of req.files || []) {
      try {
        const name = /[ÃÄÅ]/.test(f.originalname) ? Buffer.from(f.originalname, 'latin1').toString('utf8') : f.originalname;
        const r = await processUpload(f.buffer, name, f.mimetype);
        results.push({ ok: true, ...r, thumb: thumb(r.url, 480) });
      } catch (e) {
        results.push({ ok: false, name: f.originalname, message: e.message });
      }
    }
    const n = results.filter((r) => r.ok).length;
    if (n) logActivity(req.user, 'Medya yükledi', `${n} dosya`);
    res.json({ ok: true, results });
  });
  void next;
});

router.post('/medya/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!m) return res.redirect('/panel/medya');
  db.prepare('UPDATE media SET alt = ? WHERE id = ?').run(str(req.body.alt).slice(0, 250), m.id);
  invalidate();
  if ((req.get('accept') || '').includes('json')) return res.json({ ok: true });
  res.redirect('/panel/medya?ok=' + encodeURIComponent('Açıklama kaydedildi.'));
});

router.get('/medya/:id/kullanim', (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  res.json({ items: m ? usage('/uploads/' + m.file) : [] });
});

router.post('/medya/:id/sil', (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (m) {
    deleteMedia(m.id);
    logActivity(req.user, 'Medya sildi', m.original_name || m.file);
  }
  res.redirect('/panel/medya?ok=' + encodeURIComponent('Dosya silindi.'));
});

module.exports = router;
