'use strict';
const express = require('express');
const { db, json, getSetting, setSetting, logActivity } = require('../../db');
const { requireRole } = require('../../lib/auth');
const { pageSchemas, globalSchema, productSchema, PRODUCT_CATEGORIES } = require('../../schemas');
const { readSections, str } = require('../../lib/form');
const { slugify } = require('../../lib/util');

const router = express.Router();

const RESERVED = new Set(['panel', 'uploads', 'assets', 'fonts', 'blog', 'iletisim', 'sitemap.xml', 'robots.txt', 'healthz', 'category', 'author']);

/** Bir adresin başka bir kayıtta kullanılıp kullanılmadığını kontrol eder */
function slugTaken(slug, except = {}) {
  if (RESERVED.has(slug)) return true;
  const p = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
  if (p && p.id !== except.pageId) return true;
  const pr = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
  if (pr && pr.id !== except.productId) return true;
  const po = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug);
  if (po && po.id !== except.postId) return true;
  return false;
}
router.slugTaken = slugTaken;

const schemaFor = (page) => pageSchemas[page.key.startsWith('legal:') ? 'legal' : page.key];

/* ---------- sayfalar ---------- */
router.get('/sayfalar', (req, res) => {
  const pages = db.prepare('SELECT p.*, u.name editor FROM pages p LEFT JOIN users u ON u.id = p.updated_by ORDER BY CASE WHEN slug = \'\' THEN 0 ELSE 1 END, key LIKE \'legal:%\', title').all();
  res.render('panel/pages', { title: 'Sayfalar', pages, schemaFor });
});

router.get('/sayfalar/:id', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
  if (!page) return res.redirect('/panel/sayfalar');
  const schema = schemaFor(page);
  res.render('panel/page-edit', { title: page.title, page, schema, data: json(page.data, {}) });
});

router.post('/sayfalar/:id', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
  if (!page) return res.redirect('/panel/sayfalar');
  const schema = schemaFor(page);
  const data = readSections(req.body, schema);
  const title = str(req.body._title) || page.title;
  let slug = page.slug;
  // Ana sayfa ve sabit sayfaların adresi değiştirilemez; yasal metinlerinki değiştirilebilir
  if (page.key.startsWith('legal:') && req.body._slug != null) {
    const s = slugify(req.body._slug);
    if (s && s !== page.slug) {
      if (slugTaken(s, { pageId: page.id })) return res.redirect(`/panel/sayfalar/${page.id}?err=` + encodeURIComponent('Bu adres başka bir sayfada kullanılıyor.'));
      slug = s;
    }
  }
  const status = req.body._status === 'draft' && page.slug !== '' ? 'draft' : 'published';
  db.prepare("UPDATE pages SET title=?, slug=?, status=?, data=?, seo_title=?, seo_desc=?, updated_at=datetime('now'), updated_by=? WHERE id=?")
    .run(title, slug, status, JSON.stringify(data), str(req.body._seo_title), str(req.body._seo_desc), req.user.id, page.id);
  logActivity(req.user, 'Sayfayı güncelledi', title);
  res.redirect(`/panel/sayfalar/${page.id}?ok=` + encodeURIComponent('Değişiklikler kaydedildi ve sitede yayında.'));
});

/* ---------- ortak alanlar (header, footer, iletişim bilgileri, sosyal medya) ---------- */
router.get('/alanlar', (req, res) => {
  const data = {};
  for (const s of globalSchema.sections) data[s.key] = getSetting(s.key, {}) || {};
  res.render('panel/globals', { title: 'Ortak alanlar', schema: globalSchema, data });
});

router.post('/alanlar', (req, res) => {
  const data = readSections(req.body, globalSchema);
  for (const s of globalSchema.sections) setSetting(s.key, { ...(getSetting(s.key, {}) || {}), ...data[s.key] });
  logActivity(req.user, 'Ortak alanları güncelledi', 'Header, footer, iletişim');
  res.redirect('/panel/alanlar?ok=' + encodeURIComponent('Ortak alanlar kaydedildi.'));
});

/* ---------- ürünler ---------- */
router.get('/urunler', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY sort, id').all().map((p) => ({ ...p, d: json(p.data, {}) }));
  res.render('panel/products', { title: 'Ürünler', products, CATS: PRODUCT_CATEGORIES });
});

router.get('/urunler/yeni', (req, res) => {
  res.render('panel/product-edit', { title: 'Yeni ürün', product: { id: 0, title: '', slug: '', category: 'masa', status: 'draft', sort: 100, seo_title: '', seo_desc: '' }, schema: productSchema, data: {}, CATS: PRODUCT_CATEGORIES });
});

router.get('/urunler/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/panel/urunler');
  res.render('panel/product-edit', { title: product.title, product, schema: productSchema, data: json(product.data, {}), CATS: PRODUCT_CATEGORIES });
});

router.post('/urunler/:id', (req, res) => {
  const id = Number(req.params.id) || 0;
  const existing = id ? db.prepare('SELECT * FROM products WHERE id = ?').get(id) : null;
  if (id && !existing) return res.redirect('/panel/urunler');
  const title = str(req.body._title);
  const back = (msg) => res.redirect((id ? `/panel/urunler/${id}` : '/panel/urunler/yeni') + '?err=' + encodeURIComponent(msg));
  if (!title) return back('Ürün adı boş olamaz.');
  const slug = slugify(req.body._slug || title);
  if (!slug) return back('Geçerli bir adres girin.');
  if (slugTaken(slug, { productId: id })) return back(`"/${slug}" adresi başka bir sayfada kullanılıyor.`);
  const category = PRODUCT_CATEGORIES.some(([k]) => k === req.body._category) ? req.body._category : 'masa';
  const status = req.body._status === 'draft' ? 'draft' : 'published';
  const sort = Number(req.body._sort) || 0;
  const data = JSON.stringify(readSections(req.body, productSchema));
  let pid = id;
  if (existing) {
    db.prepare("UPDATE products SET title=?, slug=?, category=?, status=?, sort=?, data=?, seo_title=?, seo_desc=?, updated_at=datetime('now'), updated_by=? WHERE id=?")
      .run(title, slug, category, status, sort, data, str(req.body._seo_title), str(req.body._seo_desc), req.user.id, id);
    logActivity(req.user, 'Ürünü güncelledi', title);
  } else {
    pid = db.prepare('INSERT INTO products(title, slug, category, status, sort, data, seo_title, seo_desc, updated_by) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(title, slug, category, status, sort, data, str(req.body._seo_title), str(req.body._seo_desc), req.user.id).lastInsertRowid;
    logActivity(req.user, 'Ürün ekledi', title);
  }
  res.redirect(`/panel/urunler/${pid}?ok=` + encodeURIComponent(status === 'published' ? 'Ürün kaydedildi ve sitede yayında.' : 'Ürün taslak olarak kaydedildi.'));
});

router.post('/urunler/:id/kopyala', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.redirect('/panel/urunler');
  let slug = p.slug + '-kopya'; let i = 2;
  while (slugTaken(slug)) slug = `${p.slug}-kopya-${i++}`;
  const nid = db.prepare("INSERT INTO products(title, slug, category, status, sort, data, seo_title, seo_desc, updated_by) VALUES(?,?,?,'draft',?,?,?,?,?)")
    .run(p.title + ' (kopya)', slug, p.category, p.sort + 1, p.data, p.seo_title, p.seo_desc, req.user.id).lastInsertRowid;
  logActivity(req.user, 'Ürünü kopyaladı', p.title);
  res.redirect(`/panel/urunler/${nid}?ok=` + encodeURIComponent('Kopya taslak olarak oluşturuldu.'));
});

router.post('/urunler/:id/sil', requireRole('admin'), (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (p) {
    db.prepare('DELETE FROM products WHERE id = ?').run(p.id);
    logActivity(req.user, 'Ürünü sildi', p.title);
  }
  res.redirect('/panel/urunler?ok=' + encodeURIComponent('Ürün silindi.'));
});

router.post('/urunler-sira', (req, res) => {
  const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean);
  const st = db.prepare('UPDATE products SET sort = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => st.run(i * 10, id)))();
  res.json({ ok: true });
});

module.exports = router;
