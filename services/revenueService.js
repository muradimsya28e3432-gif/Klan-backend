const env = require('../config/env'); // komissiya faizi
const PlatformAccount = require('../models/PlatformAccount'); // platforma hesabı
const PlatformWithdrawal = require('../models/PlatformWithdrawal'); // çıxarış jurnalı
const ApiError = require('../utils/ApiError'); // xəta sinfi

const calcCommission = (pool) => Math.floor((pool * env.COMMISSION_PERCENT) / 100); // fonddan komissiya (aşağı yuvarlaq)

async function addRevenue(amount) { // platforma gəliri əlavə edir
  if (!Number.isSafeInteger(amount) || amount <= 0) return; // sıfır/mənfi məbləğ varsa heç nə etmir
  await PlatformAccount.findOneAndUpdate( // tək hesab sənədi
    { key: 'main' }, // axtarış
    { $inc: { balance: amount, totalEarned: amount } }, // atomik artırma
    { upsert: true, new: true, setDefaultsOnInsert: true }, // yoxdursa yaradır
  );
}

async function getStats() { // platforma statistikası
  const acc = await PlatformAccount.findOne({ key: 'main' }).lean(); // hesab
  return { balance: acc ? acc.balance : 0, totalEarned: acc ? acc.totalEarned : 0, totalWithdrawn: acc ? acc.totalWithdrawn : 0 }; // yoxdursa sıfırlar
}

async function withdraw(adminId, amount, note = '') { // platforma gəlirini çıxarır
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ApiError(400, 'Məbləğ yanlışdır'); // yoxlama
  const acc = await PlatformAccount.findOneAndUpdate( // atomik şərtli azaltma
    { key: 'main', balance: { $gte: amount } }, // qalıq kifayətdirsə
    { $inc: { balance: -amount, totalWithdrawn: amount } }, // balansdan çıx, çıxarılana əlavə et
    { new: true },
  );
  if (!acc) throw new ApiError(402, 'Platforma balansı kifayət deyil'); // kifayət etmədi
  await PlatformWithdrawal.create({ admin: adminId, amount, note: String(note).slice(0, 200) }); // jurnala yaz
  return acc.balance; // qalıq
}

async function listWithdrawals(page = 1, limit = 20) { // çıxarış tarixçəsi
  return PlatformWithdrawal.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(); // siyahı
}

module.exports = { calcCommission, addRevenue, getStats, withdraw, listWithdrawals }; // xaricə verir