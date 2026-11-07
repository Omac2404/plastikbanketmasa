'use strict';
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));

let secret = process.env.SESSION_SECRET;
if (!secret) {
  // Geliştirme için geçici anahtar. Canlıda SESSION_SECRET mutlaka verilmeli.
  secret = crypto.createHash('sha256').update('pbm-dev-' + DATA_DIR).digest('hex');
  if (process.env.NODE_ENV === 'production') {
    console.warn('[uyarı] SESSION_SECRET tanımlı değil. Easypanel ortam değişkenlerine ekleyin.');
  }
}

module.exports = {
  ROOT,
  DATA_DIR,
  UPLOAD_DIR: path.join(DATA_DIR, 'uploads'),
  BACKUP_DIR: path.join(DATA_DIR, 'backups'),
  SEED_MEDIA_DIR: path.join(ROOT, 'seed-media'),
  PORT: Number(process.env.PORT) || 3000,
  SECRET: secret,
  IS_PROD: process.env.NODE_ENV === 'production',
  SITE_URL: (process.env.SITE_URL || 'https://www.plastikbanketmasa.com').replace(/\/+$/, ''),
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'info@webreta.com.tr',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
};
