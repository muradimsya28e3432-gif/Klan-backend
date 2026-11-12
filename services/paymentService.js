const crypto = require('crypto'); // HMAC imza yoxlaması üçün
const env = require('../config/env'); // konfiqurasiya
const PaymentOrder = require('../models/PaymentOrder'); // sifariş modeli
const walletService = require('./walletService'); // balans əməliyyatları
const ApiError = require('../utils/ApiError'); // xəta sinfi

async function createTopUp(userId, amount) { // balans artırma sifarişi yaradır
  if (!Number.isSafeInteger(amount) || amount < env.MIN_TOPUP || amount > env.MAX_TOPUP) { // limit yoxlaması
    throw new ApiError(400, `Məbləğ ${env.MIN_TOPUP / 100} - ${env.MAX_TOPUP / 100} AZN arasında olmalıdır`); // xəta
  }
  const order = await PaymentOrder.create({ user: userId, amount }); // sifariş yarat
  const paymentUrl = `${env.PAYMENT_PAGE_URL}?order=${order._id}&amount=${order.amount}`; // provayder səhifəsi
  return { orderId: order._id, amount: order.amount, paymentUrl }; // cavab
}

function verifySignature(rawBody, signature) { // webhook imzasını yoxlayır
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string') return false; // tip yoxlaması
  const expected = crypto.createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest(); // gözlənən imza
  const given = Buffer.from(signature, 'hex'); // gələn imza
  return given.length === expected.length && crypto.timingSafeEqual(given, expected); // zamanla hücumdan qorunan müqayisə
}

async function processPaid(orderId, amount, providerRef) { // ödənişi təsdiqləyir
  const order = await PaymentOrder.findOneAndUpdate( // yalnız gözləyən və məbləği uyğun sifariş
    { _id: orderId, status: 'pending', amount }, // şərtlər
    { $set: { status: 'paid', paidAt: new Date(), providerRef: String(providerRef || '').slice(0, 100) } }, // paid et
    { new: true },
  );
  if (!order) return { processed: false }; // tapılmadı / artıq işlənib / məbləğ uyğun deyil
  await walletService.credit(order.user, order.amount, 'topup', { refId: String(order._id), key: `topup:${order._id}` }); // balansa yaz
  return { processed: true }; // uğur
}

async function processFailed(orderId) { // uğursuz ödəniş
  await PaymentOrder.updateOne({ _id: orderId, status: 'pending' }, { $set: { status: 'failed' } }); // statusu dəyiş
}

async function devConfirm(orderId, userId) { // yalnız test üçün saxta təsdiq
  if (!env.ALLOW_DEV_PAYMENTS) throw new ApiError(403, 'Test ödənişi söndürülüb'); // production-da bağlıdır
  const order = await PaymentOrder.findOne({ _id: orderId, user: userId, status: 'pending' }); // öz sifarişi
  if (!order) throw new ApiError(404, 'Sifariş tapılmadı'); // yoxdur
  return processPaid(order._id, order.amount, 'dev-test'); // təsdiq
}

const listOrders = (userId, limit = 20) => PaymentOrder.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean(); // sifarişlərim

module.exports = { createTopUp, verifySignature, processPaid, processFailed, devConfirm, listOrders }; // xaricə verir