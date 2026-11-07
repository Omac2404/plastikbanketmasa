/* Plastik Banket Masa — site davranışları (bağımlılıksız) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- mobil menü ---------- */
  var burger = $('.hdr__burger');
  if (burger) {
    burger.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { burger.click(); burger.focus(); }
    });
  }

  /* ---------- alt menüler (tıklama + klavye + masaüstünde üzerine gelme) ---------- */
  $$('.nav__item.has-sub').forEach(function (item) {
    var btn = $('.nav__toggle', item);
    var set = function (open) { item.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    btn.addEventListener('click', function () { set(!item.classList.contains('is-open')); });
    var desktop = window.matchMedia('(min-width: 1081px) and (hover: hover)');
    var t;
    item.addEventListener('mouseenter', function () { if (desktop.matches) { clearTimeout(t); set(true); } });
    item.addEventListener('mouseleave', function () { if (desktop.matches) t = setTimeout(function () { set(false); }, 120); });
    item.addEventListener('keydown', function (e) { if (e.key === 'Escape') { set(false); btn.focus(); } });
    item.addEventListener('focusout', function (e) { if (desktop.matches && !item.contains(e.relatedTarget)) set(false); });
  });
  document.addEventListener('click', function (e) {
    $$('.nav__item.is-open').forEach(function (i) { if (!i.contains(e.target) && window.innerWidth > 1080) { i.classList.remove('is-open'); $('.nav__toggle', i).setAttribute('aria-expanded', 'false'); } });
  });

  /* ---------- YouTube: tıklayınca yüklenir (youtube-nocookie) ---------- */
  $$('.yt').forEach(function (box) {
    var btn = $('.yt__play', box);
    btn.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + box.getAttribute('data-yt') + '?autoplay=1&rel=0&modestbranding=1';
      f.title = box.getAttribute('data-title') || 'Video';
      f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      box.innerHTML = '';
      box.appendChild(f);
      f.focus();
    });
  });

  /* ---------- Google Haritalar: tıklayınca yüklenir ---------- */
  $$('[data-map-load]').forEach(function (b) {
    b.addEventListener('click', function () {
      var box = b.closest('.map');
      var f = document.createElement('iframe');
      f.src = box.getAttribute('data-map');
      f.title = 'Konumumuz, Google Haritalar';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      box.innerHTML = '';
      box.appendChild(f);
    });
  });

  /* ---------- lightbox ---------- */
  var lb = $('#lightbox');
  if (lb && typeof lb.showModal === 'function') {
    var lbImg = $('img', lb), lbCap = $('.lb__cap', lb), opener = null;
    $$('[data-lightbox]').forEach(function (b) {
      b.addEventListener('click', function () {
        opener = b;
        lbImg.src = b.getAttribute('data-lightbox');
        lbImg.alt = b.getAttribute('data-caption') || '';
        lbCap.textContent = b.getAttribute('data-caption') || '';
        lb.showModal();
      });
    });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('close', function () { if (opener) opener.focus(); });
  }

  /* ---------- iletişim formu: istemci doğrulama + sayfa yenilemeden gönderim ---------- */
  $$('form[data-ajax]').forEach(function (form) {
    var status = $('.cform__status', form);
    var setErr = function (input, msg) {
      var field = input.closest('.field');
      var err = field && $('.field__err', field);
      if (!field || !err) return;
      field.classList.toggle('has-err', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      err.textContent = msg || '';
      err.hidden = !msg;
    };
    var check = function () {
      var first = null, ok = true;
      var ad = form.elements.ad, tel = form.elements.telefon, mail = form.elements.eposta, kvkk = form.elements.kvkk;
      var rules = [
        [ad, ad.value.trim().length < 2 ? 'Lütfen adınızı yazın.' : ''],
        [tel, tel.value.replace(/\D/g, '').length < 10 ? 'Lütfen size ulaşabileceğimiz bir telefon numarası yazın.' : ''],
        [mail, mail.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value) ? 'E-posta adresi geçerli görünmüyor. Örn: ad@firma.com' : ''],
        [kvkk, !kvkk.checked ? 'Devam etmek için KVKK aydınlatma metnini onaylayın.' : ''],
      ];
      rules.forEach(function (r) { setErr(r[0], r[1]); if (r[1]) { ok = false; first = first || r[0]; } });
      if (first) first.focus();
      return ok;
    };
    $$('input, textarea', form).forEach(function (el) {
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') setErr(el, ''); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!check()) return;
      if (!window.fetch) return form.submit();
      form.classList.add('is-sending');
      status.innerHTML = 'Gönderiliyor…';
      fetch(form.action, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          form.classList.remove('is-sending');
          if (j.ok) {
            form.reset();
            status.innerHTML = '<span class="ok"></span>';
            status.firstChild.textContent = j.message || 'Mesajınız bize ulaştı.';
            if (window.dataLayer) window.dataLayer.push({ event: 'form_gonderildi' });
          } else {
            status.innerHTML = '<span class="bad"></span>';
            status.firstChild.textContent = j.message || 'Mesaj gönderilemedi.';
            if (j.field && form.elements[j.field]) { setErr(form.elements[j.field], j.message); form.elements[j.field].focus(); }
          }
        })
        .catch(function () {
          form.classList.remove('is-sending');
          status.innerHTML = '<span class="bad">Bağlantı hatası. Lütfen tekrar deneyin ya da bizi arayın.</span>';
        });
    });
  });

  /* ---------- çerez onayı + Google Tag Manager ---------- */
  var KEY = 'pbm_cerez';
  var banner = $('#cookie');
  var read = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var write = function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* özel mod */ } };
  var loadGtm = function () {
    var id = window.PBM_GTM;
    if (!id || window.__gtmLoaded) return;
    window.__gtmLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  };
  var choice = read();
  if (choice === 'accept') loadGtm();
  if (banner && window.PBM_GTM && !choice) banner.hidden = false;
  $$('[data-cookie]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-cookie');
      write(v);
      banner.hidden = true;
      if (v === 'accept') loadGtm();
    });
  });
  $$('[data-cookie-open]').forEach(function (b) { b.addEventListener('click', function () { if (banner) { banner.hidden = false; $('button', banner).focus(); } }); });
})();
