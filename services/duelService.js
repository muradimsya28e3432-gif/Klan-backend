const mongoose = require('mongoose'); // mongoose
const Duel = require('../models/Duel'); // duel modeli
const User = require('../models/User'); // istifadəçi modeli
const Transaction = require('../models/Transaction'); // əməliyyatlar
const walletService = require('./walletService'); // pul əməliyyatları
const revenueService = require('./revenueService'); // platforma gəliri
const socket = require('./socket'); // real vaxt bildirişləri
const { getGift } = require('../utils/gifts'); // hədiyyə qiymətləri
const ApiError = require('../utils/ApiError'); // xəta sinfi

const toDTO = (d) => ({ // duelin frontend üçün formatı (məbləğlər qəpiklə)
  id: d._id, nameA: d.nameA, nameB: d.nameB, scoreA: d.scoreA, scoreB: d.scoreB, // adlar və xallar
  pool: d.scoreA + d.scoreB, status: d.status, winner: d.winner, // fond, vəziyyət, qalib
});

const getActiveDuel = () => Duel.findOne({ status: 'active' }).sort({ createdAt: -1 }); // aktiv duel

async function ensureActiveDuel() { // heç aktiv duel yoxdursa default yaradır
  let duel = await getActiveDuel(); // axtar
  if (!duel) duel = await Duel.create({ nameA: 'Bakı', nameB: 'Gəncə' }); // yoxdursa yarat
  return duel; // nəticə
}

async function createDuel(nameA, nameB) { // yeni duel (admin)
  if (await getActiveDuel()) throw new ApiError(409, 'Artıq aktiv duel var, əvvəl onu bitirin'); // eyni anda biri
  return Duel.create({ nameA, nameB }); // yarat
}

async function sendGift({ userId, duelId, side, category, sub }) { // hədiyyə göndərmə
  const gift = getGift(category, sub); // hədiyyəni serverdən tap (qiyməti istifadəçi dəyişə bilməz)
  if (!gift) throw new ApiError(400, 'Hədiyyə yanlışdır'); // yoxdursa
  if (!(await Duel.exists({ _id: duelId, status: 'active' }))) throw new ApiError(409, 'Duel aktiv deyil'); // duel aktivdirmi
  await walletService.debit(userId, gift.price, 'gift', { duel: duelId, side, giftName: gift.name }); // pulu çıx
  const field = side === 'A' ? 'scoreA' : 'scoreB'; // hansı xal artacaq
  const duel = await Duel.findOneAndUpdate({ _id: duelId, status: 'active' }, { $inc: { [field]: gift.price } }, { new: true }); // atomik artır
  if (!duel) { // arada duel bitibsə
    await walletService.credit(userId, gift.price, 'refund', { duel: duelId, key: walletService.newKey('giftrefund') }); // pulu qaytar
    throw new ApiError(409, 'Duel bitdi, pulunuz qaytarıldı'); // bildir
  }
  await User.updateOne({ _id: userId }, { $inc: { totalGifted: gift.price } }); // statistika
  const dto = toDTO(duel); // format
  socket.emitToDuel(String(duel._id), 'duel:update', dto); // hamıya canlı göndər
  return { duel: dto, gift }; // cavab
}

async function finishDuel(duelId) { // duelı bitirir və pulları bölüşdürür
  const duel = await Duel.findOneAndUpdate( // "settling" vəziyyətinə keçirir (təkrar bitirmənin qarşısı)
    { _id: duelId, status: { $in: ['active', 'settling'] } }, // aktiv və ya yarımçıq qalmış
    { $set: { status: 'settling' } },
    { new: true },
  );
  if (!duel) throw new ApiError(409, 'Duel tapılmadı və ya artıq bitib'); // bitibsə

  const pool = duel.scoreA + duel.scoreB; // ümumi fond
  const winner = duel.scoreA > duel.scoreB ? 'A' : duel.scoreB > duel.scoreA ? 'B' : 'draw'; // qalib
  const rows = await Transaction.aggregate([ // kim hansı tərəfə nə qədər atıb
    { $match: { duel: duel._id, type: 'gift' } }, // yalnız bu duelın hədiyyələri
    { $group: { _id: { user: '$user', side: '$side' }, total: { $sum: '$amount' } } }, // istifadəçi+tərəf üzrə cəm
  ]);

  let commission = 0; // komissiya
  let paidOut = 0; // qaliblərə ödənən
  if (winner === 'draw') { // bərabərlik: hamıya pulu qaytar
    for (const r of rows) { // hər sətir
      await walletService.credit(r._id.user, r.total, 'refund', { duel: duel._id, key: `duelrefund:${duel._id}:${r._id.user}:${r._id.side}` }); // idempotent qaytarma
    }
  } else { // qalib var
    commission = revenueService.calcCommission(pool); // komissiya
    const net = pool - commission; // qaliblərə bölünən məbləğ
    const winners = rows.filter((r) => r._id.side === winner); // qalib tərəfə atanlar
    const winnerTotal = winners.reduce((s, r) => s + r.total, 0); // onların cəmi
    for (const r of winners) { // hər qalib
      const share = Number((BigInt(net) * BigInt(r.total)) / BigInt(winnerTotal)); // BigInt: böyük ədədlərdə dəqiqlik itməsin
      if (share > 0) { // sıfırdan böyükdürsə
        await walletService.credit(r._id.user, share, 'duel_win', { duel: duel._id, key: `duelwin:${duel._id}:${r._id.user}` }); // idempotent ödəniş
        paidOut += share; // cəmə əlavə et
      }
    }
    if (winners.length === 0) commission = pool; // qalib tərəfə heç kim atmayıbsa hamısı platformaya
  }

  const revenue = winner === 'draw' ? 0 : pool - paidOut; // platformanın payı: komissiya + yuvarlaqlaşdırma qalığı
  const claim = await Duel.findOneAndUpdate({ _id: duel._id, revenueBooked: { $ne: true } }, { $set: { revenueBooked: true } }); // gəliri yalnız bir dəfə yaz
  if (claim) await revenueService.addRevenue(revenue); // platforma gəliri

  const done = await Duel.findByIdAndUpdate(duel._id, { $set: { status: 'finished', winner, commission, finishedAt: new Date() } }, { new: true }); // bitir
  const dto = toDTO(done); // format
  socket.emitToDuel(String(done._id), 'duel:update', dto); // bildir
  socket.emitGlobal('duel:finished', dto); // hamıya bildir
  return dto; // nəticə
}

async function history(page = 1, limit = 20) { // bitmiş duellər
  const items = await Duel.find({ status: 'finished' }).sort({ finishedAt: -1 }).skip((page - 1) * limit).limit(limit); // siyahı
  return items.map(toDTO); // format
}

const findById = async (id) => { // ID ilə duel
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Yanlış ID'); // yoxlama
  const duel = await Duel.findById(id); // tap
  if (!duel) throw new ApiError(404, 'Duel tapılmadı'); // yoxdur
  return duel; // nəticə
};

module.exports = { toDTO, getActiveDuel, ensureActiveDuel, createDuel, sendGift, finishDuel, history, findById }; // xaricə verir