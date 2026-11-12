const path = require('path'); // fayl yollarını əməliyyat sistemindən asılı olmadan birləşdirir
const dotenv = require('dotenv'); // config.env faylındakı dəyişənləri process.env-ə yükləyir

dotenv.config({ path: path.join(__dirname, 'config.env') }); // config.env faylını bu qovluqdan oxuyuruq

const REQUIRED = ['MONGO_URI', 'JWT_SECRET', 'CARD_ENC_KEY', 'PAYMENT_WEBHOOK_SECRET']; // mütləq olmalı dəyişənlər
const missing = REQUIRED.filter((key) => !process.env[key]); // çatışmayanları tapırıq
if (missing.length > 0) { // əgər çatışan varsa
  console.error(`❌ config.env-də çatışmayan dəyişənlər: ${missing.join(', ')}`); // xətanı yazırıq
  process.exit(1); // serveri işə salmırıq (təhlükəsiz başlanğıc üçün)
}

if (process.env.JWT_SECRET.length < 32) { // zəif JWT açarının qarşısını alırıq
  console.error('❌ JWT_SECRET ən azı 32 simvol olmalıdır!'); // səbəbi yazırıq
  process.exit(1); // dayandırırıq
}

if (!/^[0-9a-fA-F]{64}$/.test(process.env.CARD_ENC_KEY)) { // AES-256 üçün düz 32 bayt (64 hex) lazımdır
  console.error('❌ CARD_ENC_KEY 64 simvolluq hex olmalıdır!'); // səbəbi yazırıq
  process.exit(1); // dayandırırıq
}

const toInt = (value, fallback) => { // mətni tam ədədə çevirir
  const n = parseInt(value, 10); // onluq say sistemində çeviririk
  return Number.isFinite(n) ? n : fallback; // səhvdirsə ehtiyat dəyəri qaytarırıq
};
const toFloat = (value, fallback) => { // mətni onluq ədədə çevirir
  const n = parseFloat(value); // çeviririk
  return Number.isFinite(n) ? n : fallback; // səhvdirsə ehtiyat dəyər
};
const toBool = (value) => String(value).toLowerCase() === 'true'; // "true" mətnini boolean edir

const NODE_ENV = process.env.NODE_ENV || 'development'; // cari mühit

module.exports = Object.freeze({ // dəyişdirilə bilməyən konfiqurasiya obyekti
  NODE_ENV, // mühit adı
  isProd: NODE_ENV === 'production', // production olub-olmadığı
  PORT: toInt(process.env.PORT, 5000), // port
  MONGO_URI: process.env.MONGO_URI, // verilənlər bazası ünvanı
  JWT_SECRET: process.env.JWT_SECRET, // token imza açarı
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d', // token ömrü
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean), // icazəli saytlar siyahısı
  TRUST_PROXY: toBool(process.env.TRUST_PROXY), // proxy etibarı
  CARD_ENC_KEY: Buffer.from(process.env.CARD_ENC_KEY, 'hex'), // şifrələmə açarı (bayt formasında)
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET, // webhook imza açarı
  PAYMENT_PAGE_URL: process.env.PAYMENT_PAGE_URL || '', // ödəniş səhifəsi
  ALLOW_DEV_PAYMENTS: toBool(process.env.ALLOW_DEV_PAYMENTS) && NODE_ENV !== 'production', // saxta ödəniş yalnız production-dan kənarda
  COMMISSION_PERCENT: Math.min(Math.max(toFloat(process.env.COMMISSION_PERCENT, 20), 0), 100), // komissiya 0-100 arası
  PAYOUT_FEE_PERCENT: Math.min(Math.max(toFloat(process.env.PAYOUT_FEE_PERCENT, 2), 0), 100), // çıxarış haqqı 0-100 arası
  MIN_TOPUP: Math.round(toFloat(process.env.MIN_TOPUP_AZN, 1) * 100), // minimum artırma (qəpik)
  MAX_TOPUP: Math.round(toFloat(process.env.MAX_TOPUP_AZN, 500) * 100), // maksimum artırma (qəpik)
  MIN_PAYOUT: Math.round(toFloat(process.env.MIN_PAYOUT_AZN, 10) * 100), // minimum çıxarış (qəpik)
});