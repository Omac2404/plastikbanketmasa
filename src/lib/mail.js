'use strict';
const nodemailer = require('nodemailer');
const { db, getSetting } = require('../db');
const { escapeHtml } = require('./util');

function smtpConfig() {
  return getSetting('smtp', {}) || {};
}

function isConfigured() {
  const c = smtpConfig();
  return !!(c.host && c.user && c.pass);
}

async function send({ to, subject, text, html, replyTo }) {
  const c = smtpConfig();
  if (!c.host) throw new Error('SMTP ayarlanmamış.');
  const port = Number(c.port) || (c.secure ? 465 : 587);
  const transport = nodemailer.createTransport({
    host: c.host,
    port,
    secure: !!c.secure,
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
    connectionTimeout: 15000,
  });
  try {
    await transport.sendMail({
      from: c.from_name ? `"${String(c.from_name).replace(/"/g, '')}" <${c.from || c.user}>` : (c.from || c.user),
      to, subject, text, html, replyTo,
    });
    db.prepare('INSERT INTO mail_log(recipient, subject, status) VALUES(?,?,?)').run(to, subject, 'gitti');
  } catch (e) {
    db.prepare('INSERT INTO mail_log(recipient, subject, status, error) VALUES(?,?,?,?)').run(to, subject, 'hata', String(e.message).slice(0, 300));
    throw e;
  }
}

/** Form başvurusunu bildirim e-postası olarak gönderir (SMTP yoksa sessizce geçer) */
async function notifySubmission(fields, labels) {
  if (!isConfigured()) return;
  const notify = getSetting('forms', {}) || {};
  const to = notify.notify_to || (getSetting('contact', {}) || {}).email;
  if (!to) return;
  const rows = Object.entries(fields).map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666">${escapeHtml(labels[k] || k)}</td><td style="padding:6px 0">${escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`).join('');
  const text = Object.entries(fields).map(([k, v]) => `${labels[k] || k}: ${v}`).join('\n');
  await send({
    to,
    subject: 'Yeni iletişim formu: ' + (fields.ad || 'Ziyaretçi'),
    text,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px"><p>Web sitesinden yeni bir mesaj geldi.</p><table>${rows}</table></div>`,
    replyTo: fields.eposta || undefined,
  });
}

module.exports = { send, notifySubmission, isConfigured };
