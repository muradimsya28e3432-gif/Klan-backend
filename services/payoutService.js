const env = require('../config/env'); // limitlər
const Payout = require('../models/Payout'); // çıxarış modeli
const walletService = require('./walletService'); // balans
const revenueService = require('./revenueService'); // platforma gəliri
const card = require('../utils/card'); // kart funksiyaları
const ApiError = require('../utils/ApiError'); // xəta sinfi

async function requestPayout(userId, amount, cardNumber) { // istifadəçi pul çıxarmaq istəyir
  if (!Number.isSafeInteger(amount) || amount < env.MIN_PAYOUT) throw new ApiError(400, `Minimum çıxarış ${env.MIN_PAYOUT / 100} AZN-dir`); // minimum
  const digits = card.sanitize(cardNumber); // rəqəmləri təmizlə
  if (!card.isValidCard(digits)) throw new ApiError(400, 'Kart nömrəsi yanlışdır'); // Luhn yoxlaması
  if ((await Payout.countDocuments({ user: userId, status: 'pending' })) >= 3) throw new ApiError(429, 'Gözləyən çox sorğunuz var'); // spam limiti
  const fee = Math.floor((amount * env.PAYOUT_FEE_PERCENT) / 100); // komissiya
  await walletService.debit(userId, amount, 'payout'); // pulu dərhal balansdan çıx (ikiqat xərcləməyə qarşı)
  try { // sorğunu yarat
    const payout = await Payout.create({ // yazırıq
      user: userId, amount, fee, netAmount: amount - fee, // məbləğlər
      cardEnc: card.encrypt(digits), cardLast4: card.last4(digits), cardBrand: card.detectBrand(digits), // kart yalnız şifrəli saxlanır
    });
    return { id: payout._id, amount, fee, netAmount: amount - fee, card: card.mask(digits), status: payout.status }; // cavab
  } catch (e) { // alınmadısa pulu qaytar
    await walletService.credit(userId, amount, 'payout_refund', { key: walletService.newKey('payoutfail') }); // geri
    throw e; // xəta
  }
}

async function approve(payoutId, adminId, providerRef = '') { // admin köçürməni təsdiqləyir (pul artıq göndərilib)
  const payout = await Payout.findOneAndUpdate( // yalnız gözləyən
    { _id: payoutId, status: 'pending' }, // şərt
    { $set: { status: 'paid', reviewedBy: adminId, reviewedAt: new Date(), providerRef: String(providerRef).slice(0, 100) } }, // paid
    { new: true },
  );
  if (!payout) throw new ApiError(409, 'Sorğu tapılmadı və ya artıq işlənib'); // yoxdur
  await revenueService.addRevenue(payout.fee); // komissiyanı platforma gəlirinə yaz
  return payout; // nəticə
}

async function reject(payoutId, adminId, note = '') { // admin rədd edir
  const payout = await Payout.findOneAndUpdate( // yalnız gözləyən
    { _id: payoutId, status: 'pending' }, // şərt
    { $set: { status: 'rejected', reviewedBy: adminId, reviewedAt: new Date(), note: String(note).slice(0, 200) } }, // rədd
    { new: true },
  );
  if (!payout) throw new ApiError(409, 'Sorğu tapılmadı və ya artıq işlənib'); // yoxdur
  await walletService.credit(payout.user, payout.amount, 'payout_refund', { refId: String(payout._id), key: `payoutrefund:${payout._id}` }); // pulu qaytar
  return payout; // nəticə
}

async function revealCard(payoutId, adminId) { // yalnız admin üçün tam kart nömrəsi
  const payout = await Payout.findOne({ _id: payoutId, status: 'pending' }).select('+cardEnc'); // gözləyən sorğu
  if (!payout) throw new ApiError(404, 'Sorğu tapılmadı'); // yoxdur
  console.warn(`🔐 AUDIT: admin ${adminId} payout ${payoutId} kartına baxdı`); // audit qeydi
  return card.decrypt(payout.cardEnc); // şifrəni aç
}

const listForUser = (userId) => Payout.find({ user: userId }).sort({ createdAt: -1 }).limit(50).select('-reviewedBy').lean(); // istifadəçinin sorğuları
const listForAdmin = (status, page = 1, limit = 20) => Payout.find(status ? { status } : {}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'username').lean(); // admin siyahısı

module.exports = { requestPayout, approve, reject, revealCard, listForUser, listForAdmin }; // xaricə verir