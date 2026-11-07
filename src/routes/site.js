'use strict';
const express = require('express');
const { db, json, getSetting } = require('../db');
const { SITE_URL } = require('../config');
const util = require('../lib/util');
const media = require('../lib/media');
const { rateLimiter } = require('../lib/auth');
const { notifySubmission } = require('../lib/mail');

const router = express.Router();

/* ---------- her istekte ortak veriler ---------- */
function menu(key) {
  const r = db.prepare('SELECT items FROM menus WHERE key = ?').get(key);
  const flat = r ? json(r.items, []) : [];
  // level=1 olan maddeleri bir önceki ana maddenin altına yerleştir
  const tree = [];
  for (const it of flat) {
    if (Number(it.level) === 1 && tree.length) (tree[tree.length - 1].children ||= []).push(it);
    else tree.push({ ...it, children: [] });
  }
  return tree;
}

router.use((req, res, next) => {
  const site = getSetting('site', {});
  const seo = getSetting('seo', {});
  const contact = getSetting('contact', {});
  const L = res.locals;
  Object.assign(L, util, {
    img: media.img, thumb: media.thumb,
    site, seo, contact,
    social: getSetting('social', {}),
    header: getSetting('header', {}),
    footer: getSetting('footer', {}),
    widgets: getSetting('widgets', {}),
    menus: { header: menu('header'), footer_products: menu('footer_products'), footer_company: menu('footer_company'), legal: menu('legal') },
    path: req.path,
    siteUrl: (seo.site_url || SITE_URL).replace(/\/+$/, ''),
    salesPhone: contact.phone_sales || contact.phone,
    wa: util.waHref(contact.whatsapp, contact.whatsapp_text),
    year: new Date().getFullYear(),
    jsonLd: [],
  });
  L.meta = (title, desc, image, opts = {}) => {
    const tpl = seo.title_tpl || '%page% | %site%';
    const siteName = site.name || 'Plastik Banket Masa';
    // Başlık zaten site adını içeriyorsa tekrar eklenmez ("Plastik Banket Masa | Plastik Banket Masa" olmasın)
    const raw = opts.raw || String(title).toLocaleLowerCase('tr').includes(siteName.toLocaleLowerCase('tr'));
    return {
      title: raw ? title : tpl.replace('%page%', title).replace('%site%', siteName),
      desc: util.clip(desc || seo.description || '', 170),
      image: image || seo.og_image || '',
      canonical: L.siteUrl + (req.path === '/' ? '/' : req.path),
      type: opts.type || 'website',
    };
  };
  // Bakım modu: giriş yapmış kullanıcılar siteyi normal görür
  if (site.maintenance && !req.user && req.path !== '/robots.txt') {
    res.status(503).set('Retry-After', '3600');
    return res.render('site/maintenance');
  }
  next();
});

/* ---------- yardımcılar ---------- */
const getPage = (key) => {
  const p = db.prepare("SELECT * FROM pages WHERE key = ? AND status = 'published'").get(key);
  if (p) p.d = json(p.data, {});
  return p;
};
const listProducts = (category) => {
  const rows = category
    ? db.prepare("SELECT * FROM products WHERE status='published' AND category = ? ORDER BY sort, id").all(category)
    : db.prepare("SELECT * FROM products WHERE status='published' ORDER BY sort, id").all();
  return rows.map((r) => ({ ...r, d: json(r.data, {}) }));
};
const latestPosts = (n) => db.prepare(`SELECT p.*, c.name cat_name, c.slug cat_slug FROM posts p LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.status='published' AND p.deleted_at IS NULL AND p.published_at <= datetime('now') ORDER BY p.published_at DESC LIMIT ?`).all(n);

function orgLd(L) {
  const c = L.contact;
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: L.site.name || 'Plastik Banket Masa',
    url: L.siteUrl + '/',
    logo: L.header.logo ? L.siteUrl + L.header.logo : undefined,
    image: L.seo.og_image ? L.siteUrl + L.seo.og_image : undefined,
    telephone: c.phone,
    email: c.email,
    address: { '@type': 'PostalAddress', streetAddress: 'Kemalpaşa Mah. 7416 Sk.', addressLocality: 'Bornova', addressRegion: 'İzmir', postalCode: '35060', addressCountry: 'TR' },
    openingHours: 'Mo-Fr 09:00-18:00',
    sameAs: Object.values(L.social || {}).filter(Boolean),
  };
}

/* ---------- ana sayfa ---------- */
router.get('/', (req, res) => {
  const page = getPage('home');
  if (!page) return res.status(404).render('site/404', { meta: res.locals.meta('Sayfa bulunamadı', '') });
  res.locals.jsonLd.push(orgLd(res.locals));
  res.render('site/home', {
    page, d: page.d,
    products: listProducts(),
    posts: latestPosts(3),
    meta: res.locals.meta(page.seo_title || page.title, page.seo_desc, page.d.hero && page.d.hero.image, { raw: !!page.seo_title }),
  });
});

/* ---------- blog ---------- */
router.get('/blog', (req, res) => {
  const page = getPage('blog') || { d: { intro: { title: 'Blog' } }, title: 'Blog' };
  const cats = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id=c.id AND p.status='published' AND p.deleted_at IS NULL) n FROM categories c ORDER BY name`).all();
  const active = req.query.kategori ? cats.find((c) => c.slug === req.query.kategori) : null;
  const posts = db.prepare(`SELECT p.*, c.name cat_name, c.slug cat_slug FROM posts p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status='published' AND p.deleted_at IS NULL AND p.published_at <= datetime('now') ${active ? 'AND p.category_id = ?' : ''}
    ORDER BY p.published_at DESC`).all(...(active ? [active.id] : []));
  res.render('site/blog', {
    page, d: page.d, posts, cats: cats.filter((c) => c.n > 0), active,
    meta: res.locals.meta(active ? active.name + ' yazıları' : (page.seo_title || page.title), active ? active.description : page.seo_desc),
  });
});
router.get('/category/:slug', (req, res) => res.redirect(301, '/blog?kategori=' + encodeURIComponent(req.params.slug)));
router.get('/author/:slug', (req, res) => res.redirect(301, '/blog'));

/* ---------- iletişim formu ---------- */
const formLimit = rateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });
const FIELD_LABELS = { ad: 'Ad soyad', telefon: 'Telefon', eposta: 'E-posta', konu: 'Konu', mesaj: 'Mesaj', kvkk: 'KVKK onayı' };

router.post('/iletisim/gonder', async (req, res) => {
  const b = req.body || {};
  const wantsJson = (req.get('accept') || '').includes('application/json');
  const back = (b._back && String(b._back).startsWith('/') ? String(b._back).split('#')[0] : '/iletisim');
  const fail = (msg, field) => wantsJson ? res.status(400).json({ ok: false, message: msg, field }) : res.redirect(303, back + '?form=hata#form');

  // bot tuzağı: görünmez alan doluysa sessizce başarılı say
  if (b.website) return wantsJson ? res.json({ ok: true }) : res.redirect(303, back + '?form=tamam#form');
  if (!formLimit(req.ip)) return fail('Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin veya bizi arayın.');

  const data = {
    ad: String(b.ad || '').trim().slice(0, 120),
    telefon: String(b.telefon || '').trim().slice(0, 30),
    eposta: String(b.eposta || '').trim().slice(0, 160),
    mesaj: String(b.mesaj || '').trim().slice(0, 3000),
  };
  if (b.konu) data.konu = String(b.konu).trim().slice(0, 120);
  if (data.ad.length < 2) return fail('Lütfen adınızı yazın.', 'ad');
  if (data.telefon.replace(/\D/g, '').length < 10) return fail('Lütfen size ulaşabileceğimiz bir telefon numarası yazın.', 'telefon');
  if (data.eposta && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.eposta)) return fail('E-posta adresi geçerli görünmüyor.', 'eposta');
  if (!b.kvkk) return fail('Devam etmek için KVKK aydınlatma metnini onaylayın.', 'kvkk');
  if (!data.eposta) delete data.eposta;
  data.kvkk = 'Onaylandı';

  db.prepare('INSERT INTO submissions(form, data, page, ip) VALUES(?,?,?,?)').run('iletisim', JSON.stringify(data), back, req.ip);
  notifySubmission(data, FIELD_LABELS).catch((e) => console.warn('[form] e-posta gönderilemedi:', e.message));
  const msg = (getSetting('forms', {}) || {}).success || 'Mesajınız bize ulaştı. En kısa sürede dönüş yapacağız.';
  return wantsJson ? res.json({ ok: true, message: msg }) : res.redirect(303, back + '?form=tamam#form');
});

/* ---------- sitemap & robots ---------- */
router.get('/robots.txt', (req, res) => {
  const L = res.locals;
  res.type('text/plain');
  if (L.seo.indexable === false) return res.send('User-agent: *\nDisallow: /\n');
  res.send(`User-agent: *\nDisallow: /panel\nAllow: /\n\nSitemap: ${L.siteUrl}/sitemap.xml\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const base = res.locals.siteUrl;
  const urls = [];
  for (const p of db.prepare("SELECT slug, updated_at FROM pages WHERE status='published'").all()) urls.push([p.slug ? '/' + p.slug : '/', p.updated_at]);
  for (const p of db.prepare("SELECT slug, updated_at FROM products WHERE status='published'").all()) urls.push(['/' + p.slug, p.updated_at]);
  for (const p of db.prepare("SELECT slug, updated_at FROM posts WHERE status='published' AND deleted_at IS NULL AND published_at <= datetime('now')").all()) urls.push(['/' + p.slug, p.updated_at]);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(([u, d]) => `  <url><loc>${base}${util.escapeHtml(u)}</loc><lastmod>${String(d).slice(0, 10)}</lastmod></url>`).join('\n')
    + '\n</urlset>';
  res.type('application/xml').send(xml);
});

/* ---------- tek seviyeli adres çözümleyici: sayfa > ürün > yazı ---------- */
router.get('/:slug', (req, res, next) => {
  const slug = req.params.slug;
  const L = res.locals;

  const page = db.prepare("SELECT * FROM pages WHERE slug = ? AND slug != '' AND status = 'published'").get(slug);
  if (page) {
    page.d = json(page.data, {});
    const meta = L.meta(page.seo_title || page.title, page.seo_desc);
    if (page.key === 'hakkimizda') { L.jsonLd.push(orgLd(L)); return res.render('site/about', { page, d: page.d, meta }); }
    if (page.key === 'iletisim') { L.jsonLd.push(orgLd(L)); return res.render('site/contact', { page, d: page.d, meta, formState: req.query.form }); }
    if (page.key === 'plastik-sandalye') return res.render('site/category', { page, d: page.d, meta, products: listProducts('sandalye') });
    if (page.key === 'blog') return res.redirect(301, '/blog');
    if (page.key.startsWith('legal:')) return res.render('site/legal', { page, d: page.d, meta });
  }

  const product = db.prepare("SELECT * FROM products WHERE slug = ? AND status = 'published'").get(slug);
  if (product) {
    product.d = json(product.data, {});
    const m = product.d.main || {};
    L.jsonLd.push({
      '@context': 'https://schema.org', '@type': 'Product', name: product.title,
      description: util.clip(m.summary || util.stripMd(m.body), 300),
      image: [m.cover, ...((product.d.gallery || {}).images || [])].filter(Boolean).slice(0, 6).map((u) => L.siteUrl + u),
      brand: { '@type': 'Brand', name: 'Plastik Banket Masa' },
    });
    const others = listProducts().filter((p) => p.id !== product.id);
    return res.render('site/product', {
      product, d: product.d, others,
      formState: req.query.form,
      meta: L.meta(product.seo_title || product.title, product.seo_desc || m.summary, m.cover),
    });
  }

  const post = db.prepare(`SELECT p.*, c.name cat_name, c.slug cat_slug FROM posts p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.slug = ? AND p.deleted_at IS NULL AND (p.status = 'published' OR ?)`).get(slug, req.user ? 1 : 0);
  if (post) {
    L.jsonLd.push({
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
      datePublished: post.published_at, dateModified: post.updated_at,
      image: post.cover ? L.siteUrl + post.cover : undefined,
      author: { '@type': 'Organization', name: 'Plastik Banket Masa' },
    });
    const more = latestPosts(4).filter((p) => p.id !== post.id).slice(0, 3);
    return res.render('site/post', {
      post, more,
      meta: L.meta(post.seo_title || post.title, post.seo_desc || post.excerpt, post.cover, { type: 'article', raw: false }),
    });
  }
  next();
});

/* ---------- 404 ---------- */
router.use((req, res) => {
  res.status(404).render('site/404', { meta: res.locals.meta('Sayfa bulunamadı', ''), products: listProducts() });
});

module.exports = router;
