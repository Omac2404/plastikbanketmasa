'use strict';
/**
 * Panel formlarından gelen düz alanları (ör. "hero.title", "values.items.3.title")
 * şemaya göre iç içe nesneye çevirir.
 */

function str(v) {
  if (Array.isArray(v)) v = v[v.length - 1];
  return v == null ? '' : String(v).replace(/\r\n/g, '\n').trim();
}

function readField(body, name, field) {
  switch (field.type) {
    case 'number': { const n = Number(str(body[name])); return Number.isFinite(n) ? n : 0; }
    case 'toggle': return !!body[name] && body[name] !== '0';
    case 'gallery': return [].concat(body[name] || []).map((x) => String(x).trim()).filter(Boolean);
    case 'list': return readList(body, name, field.fields);
    default: return str(body[name]);
  }
}

function readList(body, prefix, subFields) {
  // Dizin sırası formdaki sıradır (sürükle/taşı sonrası DOM sırası korunur)
  const order = [];
  const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.(\\w+)\\.');
  for (const k of Object.keys(body)) {
    const m = k.match(re);
    if (m && !order.includes(m[1])) order.push(m[1]);
  }
  const out = [];
  for (const idx of order) {
    const item = {};
    let filled = false;
    for (const sf of subFields) {
      item[sf.key] = readField(body, `${prefix}.${idx}.${sf.key}`, sf);
      if (sf.type !== 'select' && item[sf.key] !== '' && item[sf.key] != null) filled = true;
    }
    if (filled) out.push(item);
  }
  return out;
}

/** Şemadaki tüm bölümleri okur: { section: { field: value } } */
function readSections(body, schema) {
  const data = {};
  for (const s of schema.sections) {
    data[s.key] = {};
    for (const f of s.fields) data[s.key][f.key] = readField(body, `${s.key}.${f.key}`, f);
  }
  return data;
}

module.exports = { readSections, readField, str };
