const mongoose = require('mongoose'); // ObjectId yaratmaq üçün
const User = require('../models/User'); // istifadəçi modeli
const Transaction = require('../models/Transaction'); // əməliyyat jurnalı
const ApiError = require('../utils/ApiError'); // xəta sinfi

const toQepik = (azn) => { // AZN-i qəpiyə çevirir (float xətalarından qaçmaq üçün pul qəpiklə saxlanır)
  const n = Number(azn); // ədədə çeviririk
  if (!Number.isFinite(n)) throw new ApiError(400, 'Məbləğ yanlışdır'); // ədəd deyilsə
  return Math.round(n * 100); // yuvarlaqlaşdırırıq
};
const fromQepik = (q) => Number((q / 100).toFixed(2)); // qəpiyi AZN-ə çevirir

function assertAmount(amount) { // məbləğin düzgünlüyünü yoxlayır
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ApiError(400, 'Məbləğ müsbət tam ədəd olmalıdır'); // yoxlama
}

async function credit(userId, amount, type, extra = {}) { // balansa pul əlavə edir
  assertAmount(amount); // məbləği yoxla
  try { // əvvəlcə jurnala yazırıq
    await Transaction.create({ user: userId, type, direction: 'in', amount, ...extra }); // key təkrar olarsa xəta verəcək
  } catch (e) { // xəta tutulur
    if (e.code === 11000) return { duplicate: true }; // eyni əməliyyat artıq edilib: ikiqat ödənişin qarşısı
    throw e; // başqa xəta
  }
  const user = await User.findByIdAndUpdate(userId, { $inc: { balance: amount } }, { new: true }).select('balance'); // atomik artırma
  return { duplicate: false, balance: user ? user.balance : null }; // nəticə
}

async function debit(userId, amount, type, extra = {}) { // balansdan pul çıxarır
  assertAmount(amount); // məbləği yoxla
  const user = await User.findOneAndUpdate( // şərtli atomik azaltma
    { _id: userId, isBanned: false, balance: { $gte: amount } }, // balans kifayətdirsə və bloklu deyilsə
    { $inc: { balance: -amount } }, // azalt
    { new: true },
  ).select('balance');
  if (!user) throw new ApiError(402, 'Balans kifayət deyil'); // şərt ödənmədi
  try { // jurnala yazırıq
    await Transaction.create({ user: userId, type, direction: 'out', amount, ...extra }); // qeyd
  } catch (e) { // yazılmadısa pulu geri qaytarırıq ki, itki olmasın
    await User.updateOne({ _id: userId }, { $inc: { balance: amount } }); // geri qaytarma
    throw e; // xətanı yuxarı ötür
  }
  return user.balance; // yeni balans
}

const newKey = (prefix) => `${prefix}:${new mongoose.Types.ObjectId().toString()}`; // unikal açar yaradır

async function getHistory(userId, page = 1, limit = 20) { // əməliyyat tarixçəsi
  const items = await Transaction.find({ user: userId }) // istifadəçinin əməliyyatları
    .sort({ createdAt: -1 }) // yenilər əvvəl
    .skip((page - 1) * limit) // səhifələmə
    .limit(limit) // limit
    .select('-key -__v') // daxili sahələri gizlət
    .lean(); // sürətli oxu
  return items; // siyahı
}

module.exports = { toQepik, fromQepik, credit, debit, newKey, getHistory }; // xaricə verir