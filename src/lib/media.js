'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { db } = require('../db');
const { UPLOAD_DIR } = require('../config');
const { slugify, escapeHtml } = require('./util');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const SIZES = [480, 1024]; // ek boyutlar; ana dosya en fazla 1920 px
const MAX = 1920;
const RASTER = /^image\/(jpeg|png|webp|gif|avif|tiff)$/;

function uniqueBase(name) {
  const base = slugify(path.parse(name).name) || 'gorsel';
  let candidate = base;
  while (fs.existsSync(path.join(UPLOAD_DIR, candidate + '.webp')) || fs.existsSync(path.join(UPLOAD_DIR, candidate + path.extname(name).toLowerCase()))) {
    candidate = base + '-' + crypto.randomBytes(3).toString('hex');
  }
  return candidate;
}

/**
 * Yüklenen dosyayı işler: raster görseller WebP'ye çevrilir ve 3 boyutta saklanır.
 * SVG ve PDF olduğu gibi saklanır.
 */
async function processUpload(buffer, originalName, mime) {
  const ext = path.extname(originalName).toLowerCase();
  if (RASTER.test(mime) || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)) {
    const base = uniqueBase(originalName);
    const img = sharp(buffer, { failOn: 'error' }).rotate();
    const meta = await img.metadata();
    const mainW = Math.min(meta.width || MAX, MAX);
    const mainFile = base + '.webp';
    const info = await img.clone().resize({ width: mainW, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(UPLOAD_DIR, mainFile));
    for (const w of SIZES) {
      if (w < mainW) await img.clone().resize({ width: w }).webp({ quality: 78 }).toFile(path.join(UPLOAD_DIR, `${base}-${w}.webp`));
    }
    const r = db.prepare('INSERT INTO media(file, original_name, mime, width, height, size) VALUES(?,?,?,?,?,?)')
      .run(mainFile, originalName, 'image/webp', info.width, info.height, info.size);
    invalidate();
    return { id: r.lastInsertRowid, url: '/uploads/' + mainFile, width: info.width, height: info.height };
  }
  if (ext === '.svg' || ext === '.pdf') {
    const base = uniqueBase(originalName);
    const file = base + ext;
    let data = buffer;
    if (ext === '.svg') {
      const s = buffer.toString('utf8');
      if (/<script|on\w+\s*=|javascript:/i.test(s)) throw new Error('SVG dosyası güvenli değil (script içeriyor).');
      data = Buffer.from(s);
    }
    fs.writeFileSync(path.join(UPLOAD_DIR, file), data);
    const r = db.prepare('INSERT INTO media(file, original_name, mime, size) VALUES(?,?,?,?)').run(file, originalName, ext === '.svg' ? 'image/svg+xml' : 'application/pdf', data.length);
    invalidate();
    return { id: r.lastInsertRowid, url: '/uploads/' + file };
  }
  throw new Error('Desteklenmeyen dosya türü. JPG, PNG, WebP, GIF, SVG veya PDF yükleyin.');
}

function deleteMedia(id) {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
  if (!m) return;
  const base = m.file.replace(/\.webp$/, '');
  const files = [m.file, ...SIZES.map((w) => `${base}-${w}.webp`)];
  for (const f of files) { try { fs.unlinkSync(path.join(UPLOAD_DIR, f)); } catch { /* yok */ } }
  db.prepare('DELETE FROM media WHERE id = ?').run(id);
  invalidate();
}

/* ---------- şablon yardımcıları ---------- */
let cache = null;
function invalidate() { cache = null; }
function lookup(url) {
  if (!cache) {
    cache = new Map();
    for (const m of db.prepare('SELECT file, width, height, alt FROM media').all()) cache.set('/uploads/' + m.file, m);
  }
  return cache.get(url);
}

/**
 * <img> etiketi üretir; medya kütüphanesindeki WebP'ler için srcset ekler.
 * opts: { alt, sizes, cls, eager, w, h }
 */
function img(url, opts = {}) {
  if (!url) return '';
  const m = lookup(url);
  const attrs = [];
  attrs.push(`src="${escapeHtml(url)}"`);
  if (m && m.width && /\.webp$/.test(url)) {
    const base = url.replace(/\.webp$/, '');
    const set = SIZES.filter((w) => w < m.width).map((w) => `${base}-${w}.webp ${w}w`);
    set.push(`${url} ${m.width}w`);
    if (set.length > 1) {
      attrs.push(`srcset="${escapeHtml(set.join(', '))}"`);
      attrs.push(`sizes="${escapeHtml(opts.sizes || '100vw')}"`);
    }
    attrs.push(`width="${m.width}" height="${m.height}"`);
  } else if (opts.w && opts.h) {
    attrs.push(`width="${opts.w}" height="${opts.h}"`);
  }
  const alt = opts.alt != null ? opts.alt : (m && m.alt) || '';
  attrs.push(`alt="${escapeHtml(alt)}"`);
  if (opts.cls) attrs.push(`class="${escapeHtml(opts.cls)}"`);
  if (opts.eager) attrs.push('fetchpriority="high"'); else attrs.push('loading="lazy" decoding="async"');
  return `<img ${attrs.join(' ')}>`;
}

/** Görselin küçük sürümünün adresi (panel önizlemeleri, OG vb.) */
function thumb(url, w = 480) {
  if (!url || !/^\/uploads\/.+\.webp$/.test(url)) return url || '';
  const m = lookup(url);
  if (m && m.width > w) return url.replace(/\.webp$/, `-${w}.webp`);
  return url;
}

module.exports = { processUpload, deleteMedia, img, thumb, invalidate, lookup };
