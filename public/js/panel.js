/* Plastik Banket Masa — panel davranışları (bağımlılıksız) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CSRF = ($('meta[name=csrf]') || {}).content || '';
  var uid = function () { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var thumbOf = function (u) {
    if (/^\/uploads\/.+\.webp$/.test(u) && !/-(480|1024)\.webp$/.test(u)) return u.replace(/\.webp$/, '-480.webp');
    return u;
  };
  var markDirty = function (el) { var f = el && el.closest('form[data-dirty-guard]'); if (f) { f.classList.add('is-dirty'); f.dataset.dirty = '1'; } };

  /* ---------- mobil kenar menü ---------- */
  var mb = $('.bar__menu');
  if (mb) mb.addEventListener('click', function () {
    var open = document.body.classList.toggle('side-open');
    mb.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', function (e) {
    if (document.body.classList.contains('side-open') && !e.target.closest('.side') && !e.target.closest('.bar__menu')) document.body.classList.remove('side-open');
  });

  /* ---------- onay isteyen butonlar ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-confirm]');
    if (b && !confirm(b.getAttribute('data-confirm'))) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ---------- kaydedilmemiş değişiklik uyarısı ---------- */
  $$('form[data-dirty-guard]').forEach(function (f) {
    f.addEventListener('input', function () { markDirty(f); });
    f.addEventListener('change', function () { markDirty(f); });
    f.addEventListener('submit', function () { f.dataset.dirty = ''; });
  });
  window.addEventListener('beforeunload', function (e) {
    if ($$('form[data-dirty-guard]').some(function (f) { return f.dataset.dirty === '1'; })) { e.preventDefault(); e.returnValue = ''; }
  });
  // Ctrl+S ile kaydet
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      var f = $('form[data-dirty-guard]');
      if (f) { e.preventDefault(); f.dataset.dirty = ''; f.requestSubmit ? f.requestSubmit() : f.submit(); }
    }
  });

  /* ---------- tekrarlanan liste alanları ---------- */
  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-list-add]');
    if (add) {
      var list = add.closest('[data-list]');
      var tpl = $(':scope > template', list);
      var html = tpl.innerHTML.replace(/__i__/g, uid());
      var holder = document.createElement('div'); holder.innerHTML = html;
      var li = holder.firstElementChild;
      $('.list__items', list).appendChild(li);
      var first = $('input, textarea, select', li); if (first) first.focus();
      markDirty(list);
      return;
    }
    var madd = e.target.closest('[data-mlist-add]');
    if (madd) {
      var scope = madd.closest('form');
      var t = $('template', scope);
      var h = document.createElement('div'); h.innerHTML = t.innerHTML.trim();
      var row = h.firstElementChild;
      $('[data-mlist]', scope).appendChild(row);
      var fi = $('input, select', row); if (fi) fi.focus();
      markDirty(scope);
      return;
    }
    var up = e.target.closest('[data-list-up]'), down = e.target.closest('[data-list-down]'), del = e.target.closest('[data-list-del]');
    var item = (up || down || del) && (e.target.closest('.list__item') || e.target.closest('.mlist__item'));
    if (!item) return;
    if (up && item.previousElementSibling) item.parentNode.insertBefore(item, item.previousElementSibling);
    if (down && item.nextElementSibling) item.parentNode.insertBefore(item.nextElementSibling, item);
    if (del) { var form = item.closest('form'); item.remove(); markDirty(form); return; }
    (up || down).focus();
    markDirty(item);
  });

  // menü: "alt madde" anahtarı gizli alanı günceller
  document.addEventListener('change', function (e) {
    var cb = e.target.closest('[data-level]');
    if (!cb) return;
    var li = cb.closest('.mlist__item');
    $('input[name=level]', li).value = cb.checked ? '1' : '0';
    li.classList.toggle('is-child', cb.checked);
  });

  /* ---------- görsel seçici ---------- */
  var picker = $('#picker');
  var pickCb = null, mediaCache = null;
  var renderPicker = function (q) {
    var grid = $('.picker__grid', picker);
    grid.innerHTML = '';
    (mediaCache || []).filter(function (m) {
      return m.mime !== 'application/pdf' && (!q || (m.original_name + ' ' + m.alt + ' ' + m.file).toLowerCase().indexOf(q.toLowerCase()) > -1);
    }).forEach(function (m) {
      var li = document.createElement('li');
      var b = document.createElement('button'); b.type = 'button';
      var im = document.createElement('img'); im.src = m.thumb; im.alt = ''; im.loading = 'lazy';
      var sp = document.createElement('span'); sp.textContent = m.original_name || m.file;
      b.appendChild(im); b.appendChild(sp);
      b.addEventListener('click', function () { picker.close(); if (pickCb) pickCb(m.url, m); });
      li.appendChild(b); grid.appendChild(li);
    });
    if (!grid.children.length) grid.innerHTML = '<li class="muted">Görsel bulunamadı.</li>';
  };
  var loadMedia = function () {
    return fetch('/panel/medya/api', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (j) { mediaCache = j.items; });
  };
  var openPicker = function (cb) {
    pickCb = cb;
    $('.picker__status', picker).textContent = 'Yükleniyor…';
    picker.showModal();
    loadMedia().then(function () { $('.picker__status', picker).textContent = ''; renderPicker($('.picker__search', picker).value); $('.picker__search', picker).focus(); });
  };
  var uploadFiles = function (files, statusEl) {
    var fd = new FormData();
    Array.prototype.forEach.call(files, function (f) { fd.append('files', f); });
    statusEl.textContent = files.length + ' dosya yükleniyor…';
    return fetch('/panel/medya/yukle', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': CSRF, Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var res = j.results || [];
        var bad = res.filter(function (x) { return !x.ok; });
        statusEl.textContent = (res.length - bad.length) + ' dosya yüklendi.' + (bad.length ? ' Yüklenemeyen: ' + bad.map(function (b) { return b.name + ' (' + b.message + ')'; }).join(', ') : '') + (j.message ? ' ' + j.message : '');
        return res.filter(function (x) { return x.ok; });
      })
      .catch(function () { statusEl.textContent = 'Yükleme başarısız. Bağlantınızı kontrol edin.'; return []; });
  };
  if (picker) {
    $('.picker__search', picker).addEventListener('input', function (e) { renderPicker(e.target.value); });
    $('.picker__up input', picker).addEventListener('change', function (e) {
      var files = e.target.files; if (!files.length) return;
      uploadFiles(files, $('.picker__status', picker)).then(function (ok) {
        e.target.value = '';
        if (ok.length === 1 && pickCb) { picker.close(); pickCb(ok[0].url, ok[0]); return; }
        loadMedia().then(function () { renderPicker(''); });
      });
    });
  }

  var setImg = function (box, url) {
    var input = $('[data-imgurl]', box);
    input.value = url;
    var prev = $('.imgfield__prev', box);
    prev.innerHTML = url ? '<img alt="">' : '<span>Görsel seçilmedi</span>';
    if (url) $('img', prev).src = thumbOf(url);
    $('[data-img-clear]', box).hidden = !url;
    markDirty(box);
  };
  document.addEventListener('click', function (e) {
    var pick = e.target.closest('[data-pick]');
    if (pick) { var box = pick.closest('[data-imgfield]'); openPicker(function (url) { setImg(box, url); }); return; }
    var clr = e.target.closest('[data-img-clear]');
    if (clr) { setImg(clr.closest('[data-imgfield]'), ''); return; }
    var gadd = e.target.closest('[data-gallery-add]');
    if (gadd) {
      var gl = $('[data-gallery]', gadd.closest('.field'));
      openPicker(function (url) {
        var li = document.createElement('li'); li.className = 'gallery__item';
        li.innerHTML = '<img alt=""><input type="hidden"><span class="gallery__tools"><button type="button" data-g-left aria-label="Sola taşıyın">‹</button><button type="button" data-g-right aria-label="Sağa taşıyın">›</button><button type="button" data-g-del aria-label="Kaldırın">✕</button></span>';
        $('img', li).src = thumbOf(url);
        var hi = $('input', li); hi.name = gl.getAttribute('data-gallery'); hi.value = url;
        gl.appendChild(li); markDirty(gl);
      });
      return;
    }
    var gi = e.target.closest('.gallery__item');
    if (gi) {
      if (e.target.closest('[data-g-del]')) { var g = gi.parentNode; gi.remove(); markDirty(g); }
      else if (e.target.closest('[data-g-left]') && gi.previousElementSibling) { gi.parentNode.insertBefore(gi, gi.previousElementSibling); markDirty(gi); }
      else if (e.target.closest('[data-g-right]') && gi.nextElementSibling) { gi.parentNode.insertBefore(gi.nextElementSibling, gi); markDirty(gi); }
    }
  });
  document.addEventListener('change', function (e) {
    var u = e.target.closest('[data-imgurl]');
    if (u) setImg(u.closest('[data-imgfield]'), u.value.trim());
  });

  /* ---------- markdown editör ---------- */
  $$('[data-md]').forEach(function (box) {
    var ta = $('textarea', box), pv = $('.md__preview', box);
    var wrap = function (a, b, ph) {
      var s = ta.selectionStart, en = ta.selectionEnd, sel = ta.value.slice(s, en) || ph;
      ta.setRangeText(a + sel + b, s, en, 'end');
      ta.selectionStart = s + a.length; ta.selectionEnd = s + a.length + sel.length;
      ta.focus(); markDirty(ta);
    };
    var linePrefix = function (p) {
      var s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
      var ls = v.lastIndexOf('\n', s - 1) + 1;
      var block = v.slice(ls, en) || 'metin';
      var i = 0;
      var out = block.split('\n').map(function (l) { i++; return (typeof p === 'function' ? p(i) : p) + l.replace(/^(#+\s|[-*]\s|\d+\.\s)/, ''); }).join('\n');
      ta.setRangeText(out, ls, en, 'end'); ta.focus(); markDirty(ta);
    };
    $$('[data-md-cmd]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-md-cmd');
        if (c === 'b') wrap('**', '**', 'kalın metin');
        if (c === 'i') wrap('*', '*', 'italik metin');
        if (c === 'h2') linePrefix('## ');
        if (c === 'ul') linePrefix('- ');
        if (c === 'ol') linePrefix(function (i) { return i + '. '; });
        if (c === 'link') { var url = prompt('Bağlantı adresi (https://... veya /sayfa):', 'https://'); if (url) wrap('[', '](' + url + ')', 'bağlantı metni'); }
        if (c === 'img') openPicker(function (url, m) { wrap('\n\n![' + ((m && m.alt) || 'görsel açıklaması') + '](' + url + ')\n\n', '', ''); });
      });
    });
    $$('[data-md-tab]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var prev = b.getAttribute('data-md-tab') === 'preview';
        $$('[data-md-tab]', box).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        ta.hidden = prev; pv.hidden = !prev;
        if (prev) {
          pv.textContent = 'Önizleme hazırlanıyor…';
          fetch('/panel/onizleme', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': CSRF }, body: new URLSearchParams({ md: ta.value }) })
            .then(function (r) { return r.text(); }).then(function (h) { pv.innerHTML = h; });
        }
      });
    });
  });

  /* ---------- adres (slug) otomatik doldurma ---------- */
  var TR = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'Ö': 'o', 'Ş': 's', 'Ü': 'u' };
  var slugify = function (s) { return s.replace(/[çğıİöşüÇĞÖŞÜ]/g, function (c) { return TR[c]; }).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var src = $('[data-slug-src]'), dst = $('[data-slug-dst][data-auto]');
  if (src && dst) {
    src.addEventListener('input', function () { if (dst.dataset.auto !== undefined) dst.value = slugify(src.value); });
    dst.addEventListener('input', function () { delete dst.dataset.auto; });
  }

  /* ---------- karakter sayaçları + Google önizlemesi ---------- */
  $$('[data-count]').forEach(function (el) {
    var max = +el.getAttribute('data-count');
    var c = $('[data-counter]', el.closest('.field'));
    var upd = function () {
      if (c) { c.textContent = el.value.length; c.classList.toggle('is-over', el.value.length > max); }
      var sb = el.closest('[data-seobox]');
      if (sb) {
        if (/seo_title$/.test(el.name)) $('[data-serp-t]', sb).textContent = el.value || el.placeholder;
        if (/seo_desc$/.test(el.name)) $('[data-serp-d]', sb).textContent = el.value;
      }
    };
    el.addEventListener('input', upd); upd();
  });

  /* ---------- ürün sırası ---------- */
  var st = $('[data-sortable]');
  if (st) {
    var save = function () {
      var ids = $$('tbody tr', st).map(function (r) { return r.getAttribute('data-id'); });
      var body = new URLSearchParams(); ids.forEach(function (i) { body.append('ids', i); });
      fetch(st.getAttribute('data-sortable'), { method: 'POST', headers: { 'X-CSRF-Token': CSRF, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: body })
        .then(function () { var s = $('[data-sort-status]'); if (s) s.textContent = 'Sıra kaydedildi.'; });
    };
    st.addEventListener('click', function (e) {
      var tr = e.target.closest('tr'); if (!tr) return;
      if (e.target.closest('[data-row-up]') && tr.previousElementSibling) { tr.parentNode.insertBefore(tr, tr.previousElementSibling); save(); e.target.focus(); }
      if (e.target.closest('[data-row-down]') && tr.nextElementSibling) { tr.parentNode.insertBefore(tr.nextElementSibling, tr); save(); e.target.focus(); }
    });
  }

  /* ---------- medya sayfası ---------- */
  var drop = $('[data-drop]');
  if (drop) {
    var inp = $('[data-drop-input]', drop), stEl = $('.drop__status', drop);
    var go = function (files) { if (files.length) uploadFiles(files, stEl).then(function (ok) { if (ok.length) setTimeout(function () { location.reload(); }, 700); }); };
    inp.addEventListener('change', function () { go(inp.files); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
    drop.addEventListener('drop', function (e) { go(e.dataTransfer.files); });
  }
  $$('[data-alt-form]').forEach(function (f) {
    var i = $('input[name=alt]', f), last = i.value;
    var save = function () {
      if (i.value === last) return; last = i.value;
      fetch(f.action, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(f)) })
        .then(function () { i.style.borderColor = '#1E7A44'; setTimeout(function () { i.style.borderColor = ''; }, 900); });
    };
    i.addEventListener('blur', save);
    f.addEventListener('submit', function (e) { e.preventDefault(); save(); });
  });
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = 'Kopyalandı'; setTimeout(function () { b.textContent = 'Adresi kopyalayın'; }, 1200); }, function () { prompt('Adres:', t); });
    });
  });
  $$('[data-media-del]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (f.dataset.ok) return;
      e.preventDefault();
      fetch('/panel/medya/' + f.getAttribute('data-media-del') + '/kullanim', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (j) {
        var msg = j.items.length
          ? 'Bu görsel şu yerlerde kullanılıyor:\n- ' + j.items.map(function (x) { return x.label; }).join('\n- ') + '\n\nSilerseniz bu yerlerde görsel görünmez. Yine de silinsin mi?'
          : 'Bu dosya kalıcı olarak silinsin mi?';
        if (confirm(msg)) { f.dataset.ok = '1'; f.submit(); }
      });
    });
  });
})();
