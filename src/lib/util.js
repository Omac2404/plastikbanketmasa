'use strict';
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

const TR_MAP = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };

function slugify(s) {
  return String(s || '')
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR_MAP[c] || c)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

marked.setOptions({ gfm: true, breaks: false });

const SANITIZE = {
  allowedTags: ['h2', 'h3', 'h4', 'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'img', 'figure', 'figcaption', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre'],
  allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height', 'loading'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    a: (tagName, attribs) => {
      const ext = /^https?:\/\//.test(attribs.href || '') && !/plastikbanketmasa\.com/.test(attribs.href || '');
      return { tagName, attribs: ext ? { ...attribs, target: '_blank', rel: 'noopener' } : attribs };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
    h1: 'h2',
  },
};

/** Markdown -> güvenli HTML */
function md(src) {
  if (!src) return '';
  return sanitizeHtml(marked.parse(String(src)), SANITIZE);
}

/** Düz metni paragraflara böler (boş satır = yeni paragraf) */
function paragraphs(text) {
  return String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/** **vurgu** işaretini <em> ile değiştirir, gerisini kaçışlar */
function emphasize(text) {
  return escapeHtml(text || '').replace(/\*\*(.+?)\*\*/g, '<em>$1</em>');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function youtubeId(url) {
  if (!url) return '';
  const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(url) ? url : '');
}

/** "0546 900 09 40" -> "+905469000940" */
function telHref(phone) {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return 'tel:' + d;
  if (d.startsWith('90') && d.length === 12) return 'tel:+' + d;
  if (d.startsWith('0')) d = d.slice(1);
  return 'tel:+90' + d;
}

function waHref(phone, text) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '90' + d.slice(1);
  if (d.length === 10) d = '90' + d;
  return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function dateTR(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).length <= 19 && !/Z$/.test(s) ? 'Z' : ''));
  if (isNaN(d)) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function timeAgo(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return Math.floor(diff / 60) + ' dk önce';
  if (diff < 86400) return Math.floor(diff / 3600) + ' saat önce';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' gün önce';
  return s.slice(0, 16);
}

function clip(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
}

function stripMd(s) {
  return String(s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`~-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { slugify, md, paragraphs, emphasize, escapeHtml, youtubeId, telHref, waHref, dateTR, timeAgo, clip, stripMd };
