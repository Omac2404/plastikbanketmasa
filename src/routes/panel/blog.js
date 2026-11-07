'use strict';
const express = require('express');
const { db, logActivity } = require('../../db');
const { requireRole } = require('../../lib/auth');
const { str } = require('../../lib/form');
const { slugify } = require('../../lib/util');
const { slugTaken } = require('./content');

const router = express.Router();

router.get('/blog', (req, res) => {
  const trash = req.query.durum === 'cop';
  const posts = db.prepare(`SELECT p.*, c.name cat_name FROM posts p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.deleted_at IS ${trash ? 'NOT ' : ''}NULL ORDER BY COALESCE(p.published_at, p.updated_at) DESC`).all();
  const counts = db.prepare(`SELECT
    SUM(deleted_at IS NULL) total, SUM(deleted_at IS NULL AND status='published') pub,
    SUM(deleted_at IS NULL AND status='draft') draft, SUM(deleted_at IS NOT NULL) trash FROM posts`).get();
  res.render('panel/posts', { title: 'Blog', posts, counts, trash });
});

router.get('/blog/yeni', (req, res) => {
  res.render('panel/post-edit', {
    title: 'Yeni yazı',
    post: { id: 0, title: '', slug: '', excerpt: '', body: '', cover: '', category_id: null, status: 'draft', published_at: '', seo_title: '', seo_desc: '' },
    cats: db.prepare('SELECT * FROM categories ORDER BY name').all(),
  });
});

router.get('/blog/kategoriler', (req, res) => {
  const cats = db.prepare('SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.deleted_at IS NULL) n FROM categories c ORDER BY name').all();
  res.render('panel/categories', { title: 'Kategoriler', cats });
});

router.post('/blog/kategoriler', (req, res) => {
  const name = str(req.body.name);
  const slug = slugify(req.body.slug || name);
  const id = Number(req.body.id) || 0;
  if (!name || !slug) return res.redirect('/panel/blog/kategoriler?err=' + encodeURIComponent('Kategori adı gerekli.'));
  const clash = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
  if (clash && clash.id !== id) return res.redirect('/panel/blog/kategoriler?err=' + encodeURIComponent('Bu adreste bir kategori zaten var.'));
  if (id) db.prepare('UPDATE categories SET name=?, slug=?, description=? WHERE id=?').run(name, slug, str(req.body.description), id);
  else db.prepare('INSERT INTO categories(name, slug, description) VALUES(?,?,?)').run(name, slug, str(req.body.description));
  logActivity(req.user, id ? 'Kategoriyi düzenledi' : 'Kategori ekledi', name);
  res.redirect('/panel/blog/kategoriler?ok=' + encodeURIComponent('Kategori kaydedildi.'));
});

router.post('/blog/kategoriler/:id/sil', (req, res) => {
  const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (c) { db.prepare('DELETE FROM categories WHERE id = ?').run(c.id); logActivity(req.user, 'Kategoriyi sildi', c.name); }
  res.redirect('/panel/blog/kategoriler?ok=' + encodeURIComponent('Kategori silindi. Yazıları kategorisiz kaldı.'));
});

router.get('/blog/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.redirect('/panel/blog');
  res.render('panel/post-edit', { title: post.title, post, cats: db.prepare('SELECT * FROM categories ORDER BY name').all() });
});

router.post('/blog/:id', (req, res) => {
  const id = Number(req.params.id) || 0;
  const existing = id ? db.prepare('SELECT * FROM posts WHERE id = ?').get(id) : null;
  if (id && !existing) return res.redirect('/panel/blog');
  const back = (msg) => res.redirect((id ? `/panel/blog/${id}` : '/panel/blog/yeni') + '?err=' + encodeURIComponent(msg));
  const title = str(req.body.title);
  if (!title) return back('Başlık boş olamaz.');
  const slug = slugify(req.body.slug || title);
  if (slugTaken(slug, { postId: id })) return back(`"/${slug}" adresi başka bir sayfada kullanılıyor.`);
  const status = req.body.status === 'published' ? 'published' : 'draft';
  let publishedAt = str(req.body.published_at).replace('T', ' ');
  if (publishedAt && publishedAt.length === 16) publishedAt += ':00';
  // Tarih yerel saatle girilir (Türkiye, UTC+3); veritabanında UTC saklanır
  if (publishedAt) {
    const d = new Date(publishedAt.replace(' ', 'T') + '+03:00');
    publishedAt = isNaN(d) ? '' : d.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (status === 'published' && !publishedAt) publishedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const vals = [title, slug, str(req.body.excerpt), str(req.body.body), str(req.body.cover), Number(req.body.category_id) || null, status, publishedAt || null, str(req.body.seo_title), str(req.body.seo_desc), req.user.id];
  let pid = id;
  if (existing) {
    db.prepare("UPDATE posts SET title=?, slug=?, excerpt=?, body=?, cover=?, category_id=?, status=?, published_at=?, seo_title=?, seo_desc=?, updated_by=?, updated_at=datetime('now') WHERE id=?").run(...vals, id);
    logActivity(req.user, 'Yazıyı güncelledi', title);
  } else {
    pid = db.prepare('INSERT INTO posts(title, slug, excerpt, body, cover, category_id, status, published_at, seo_title, seo_desc, updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(...vals).lastInsertRowid;
    logActivity(req.user, 'Yazı ekledi', title);
  }
  res.redirect(`/panel/blog/${pid}?ok=` + encodeURIComponent(status === 'published' ? 'Yazı kaydedildi ve yayında.' : 'Yazı taslak olarak kaydedildi.'));
});

router.post('/blog/:id/cop', (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (p) { db.prepare("UPDATE posts SET deleted_at = datetime('now') WHERE id = ?").run(p.id); logActivity(req.user, 'Yazıyı çöp kutusuna attı', p.title); }
  res.redirect('/panel/blog?ok=' + encodeURIComponent('Yazı çöp kutusuna taşındı.'));
});
router.post('/blog/:id/geri', (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (p) { db.prepare('UPDATE posts SET deleted_at = NULL WHERE id = ?').run(p.id); logActivity(req.user, 'Yazıyı geri aldı', p.title); }
  res.redirect('/panel/blog?ok=' + encodeURIComponent('Yazı geri alındı.'));
});
router.post('/blog/:id/sil', requireRole('admin'), (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ? AND deleted_at IS NOT NULL').get(req.params.id);
  if (p) { db.prepare('DELETE FROM posts WHERE id = ?').run(p.id); logActivity(req.user, 'Yazıyı kalıcı sildi', p.title); }
  res.redirect('/panel/blog?durum=cop&ok=' + encodeURIComponent('Yazı kalıcı olarak silindi.'));
});

module.exports = router;
