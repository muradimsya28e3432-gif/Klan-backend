const crypto = require('crypto'); // HMAC imza yoxlaması üçün
const Stripe = require('stripe'); // Stripe SDK
const env = require('../config/env'); // konfiqurasiya
const PaymentOrder = require('../models/PaymentOrder'); // sifariş modeli
const walletService = require('./walletService'); // balans əməliyyatları
const ApiError = require('../utils/ApiError'); // xəta sinfi

const ID_RE = /^[a-f\d]{24}$/i; // ObjectId formatı
let stripeClient = null; // Stripe müştərisi (ilk istifadədə yaradılır)
const getStripe = () => { // Stripe müştərisini qaytarır
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, 'Stripe qurulmayıb'); // açar yoxdur
  if (!stripeClient) stripeClient = new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 }); // yarat
  return stripeClient; // nəticə
};

async function createTopUp(userId, amount) { // balans artırma sifarişi yaradır
  if (!Number.isSafeInteger(amount) || amount < env.MIN_TOPUP || amount > env.MAX_TOPUP) { // limit yoxlaması
    throw new ApiError(400, `Məbləğ ${env.MIN_TOPUP / 100} - ${env.MAX_TOPUP / 100} AZN arasında olmalıdır`); // xəta
  }
  if (env.STRIPE_SECRET_KEY) return createStripeTopUp(userId, amount); // Stripe qurulubsa onunla
  const order = await PaymentOrder.create({ user: userId, amount }); // köhnə axın: sifariş yarat
  const paymentUrl = `${env.PAYMENT_PAGE_URL}?order=${order._id}&amount=${order.amount}`; // provayder səhifəsi
  return { orderId: order._id, amount: order.amount, paymentUrl }; // cavab
}

async function createStripeTopUp(userId, amount) { // Stripe Checkout sessiyası yaradır (kart məlumatı bizə gəlmir)
  if (!env.CLIENT_URL) throw new ApiError(500, 'CLIENT_URL / CORS_ORIGINS təyin olunmayıb'); // qayıdış ünvanı lazımdır
  const order = await PaymentOrder.create({ user: userId, amount, provider: 'stripe' }); // sifariş (pending)
  try { // sessiya yarat
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment', // birdəfəlik ödəniş
      client_reference_id: String(order._id), // bizim sifariş ID
      line_items: [{ quantity: 1, price_data: { currency: env.STRIPE_CURRENCY, unit_amount: amount, product_data: { name: 'Balans artırma' } } }], // məbləğ serverdə təyin olunur (qəpik)
      metadata: { orderId: String(order._id), userId: String(userId) }, // webhook-da sifarişi tanımaq üçün
      success_url: `${env.CLIENT_URL}/wallet?payment=success&order=${order._id}`, // uğurlu qayıdış
      cancel_url: `${env.CLIENT_URL}/wallet?payment=cancel&order=${order._id}`, // ləğv
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 dəqiqə
    }, { idempotencyKey: `topup-${order._id}` }); // təkrar yaranmanın qarşısı
    await PaymentOrder.updateOne({ _id: order._id }, { $set: { providerRef: session.id } }); // sessiya ID-ni saxla
    return { orderId: order._id, amount, paymentUrl: session.url }; // istifadəçini bura yönləndiririk
  } catch (e) { // Stripe xətası
    await PaymentOrder.updateOne({ _id: order._id, status: 'pending' }, { $set: { status: 'failed' } }); // sifarişi bağla
    console.error('❌ Stripe sessiya xətası:', e.message); // loga yaz
    throw new ApiError(502, 'Ödəniş sistemi ilə əlaqə qurulmadı'); // istifadəçiyə
  }
}

function constructStripeEvent(rawBody, signature) { // Stripe webhook imzasını yoxlayıb event qaytarır
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string') throw new Error('Yanlış sorğu'); // tip yoxlaması
  return getStripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET); // imza səhvdirsə xəta atır
}

async function handleStripeEvent(event) { // Stripe hadisələrini emal edir
  const types = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired']; // maraqlandığımız hadisələr
  if (!types.includes(event.type)) return { ignored: true }; // başqa hadisələr
  const s = event.data.object; // sessiya
  const orderId = s.metadata && s.metadata.orderId; // bizim sifariş
  if (!orderId || !ID_RE.test(orderId)) return { ignored: true }; // tanınmayan

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') { // uğurlu
    if (s.payment_status !== 'paid') return { ignored: true }; // hələ ödənməyib (async üsullar)
    if (String(s.currency).toLowerCase() !== env.STRIPE_CURRENCY) { console.error(`⚠️ Valyuta uyğunsuzluğu: ${orderId}`); return { ignored: true }; } // valyuta yoxlaması
    const ref = typeof s.payment_intent === 'string' ? s.payment_intent : s.id; // əməliyyat nömrəsi
    return processPaid(orderId, s.amount_total, ref); // məbləğ sifarişlə uyğun gəlməlidir
  }
  await processFailed(orderId); // uğursuz / vaxtı bitmiş
  return { processed: true }; // nəticə
}

function verifySignature(rawBody, signature) { // köhnə ümumi webhook imzasını yoxlayır
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
  if (!order) { // tapılmadı
    const done = await PaymentOrder.findOne({ _id: orderId, status: 'paid', amount }); // artıq paid olub, amma balansa düşməyibsə (server çöküb)
    if (done) await walletService.credit(done.user, done.amount, 'topup', { refId: String(done._id), key: `topup:${done._id}` }); // idempotent: təkrar olmaz
    return { processed: false }; // artıq işlənib / uyğun deyil
  }
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

const listOrders = (userId, limit = 20) => PaymentOrder.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).select('amount status provider paidAt createdAt').lean(); // sifarişlərim

module.exports = { createTopUp, verifySignature, constructStripeEvent, handleStripeEvent, processPaid, processFailed, devConfirm, listOrders }; // xaricə verir