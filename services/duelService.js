const mongoose = require('mongoose'); // mongoose
const Duel = require('../models/Duel'); // duel modeli
const User = require('../models/User'); // istifadəçi modeli
const Transaction = require('../models/Transaction'); // əməliyyatlar
const walletService = require('./walletService'); // pul əməliyyatları
const revenueService = require('./revenueService'); // platforma gəliri
const progression = require('./progressionService'); // YENİ: XP / reytinq / nailiyyət
const socket = require('./socket'); // real vaxt bildirişləri
const { getGift } = require('../utils/gifts'); // hədiyyə qiymətləri
const ApiError = require('../utils/ApiError'); // xəta sinfi

const safe = (p) => Promise.resolve(p).catch((e) => console.error('⚠️ Progression xətası:', e.message)); // irəliləyiş xətası əsas axını pozmasın

const toDTO = (d) => ({ // duelin frontend formatı (qəpiklə)
  id: d._id, nameA: d.nameA, nameB: d.nameB, scoreA: d.scoreA, scoreB: d.scoreB,
  pool: d.scoreA + d.scoreB, status: d.status, winner: d.winner,
});

const getActiveDuel = () => Duel.findOne({ status: 'active' }).sort({ createdAt: -1 }); // aktiv duel

async function ensureActiveDuel() { // aktiv duel yoxdursa yaradır
  let duel = await getActiveDuel();
  if (!duel) duel = await Duel.create({ nameA: 'Bakı', nameB: 'Gəncə' });
  return duel;
}

async function createDuel(nameA, nameB) { // yeni duel (admin)
  if (await getActiveDuel()) throw new ApiError(409, 'Artıq aktiv duel var, əvvəl onu bitirin');
  return Duel.create({ nameA, nameB });
}

async function sendGift({ userId, duelId, side, category, sub }) { // hədiyyə göndərmə
  const gift = getGift(category, sub); // qiymət serverdə
  if (!gift) throw new ApiError(400, 'Hədiyyə yanlışdır');
  if (!(await Duel.exists({ _id: duelId, status: 'active' }))) throw new ApiError(409, 'Duel aktiv deyil');
  await walletService.debit(userId, gift.price, 'gift', { duel: duelId, side, giftName: gift.name }); // pulu çıx
  const field = side === 'A' ? 'scoreA' : 'scoreB';
  const duel = await Duel.findOneAndUpdate({ _id: duelId, status: 'active' }, { $inc: { [field]: gift.price } }, { new: true }); // atomik artır
  if (!duel) { // arada duel bitibsə
    await walletService.credit(userId, gift.price, 'refund', { duel: duelId, key: walletService.newKey('giftrefund') });
    throw new ApiError(409, 'Duel bitdi, pulunuz qaytarıldı');
  }
  await User.updateOne({ _id: userId }, { $inc: { totalGifted: gift.price } }); // statistika
  await safe(progression.awardGift(userId, gift.price)); // YENİ: XP, mövsüm xalı, klan xalı, nailiyyət
  const dto = toDTO(duel);
  socket.emitToDuel(String(duel._id), 'duel:update', dto);
  return { duel: dto, gift };
}

async function finishDuel(duelId) { // duelı bitirir və pulları bölüşdürür
  const duel = await Duel.findOneAndUpdate(
    { _id: duelId, status: { $in: ['active', 'settling'] } },
    { $set: { status: 'settling' } },
    { new: true },
  );
  if (!duel) throw new ApiError(409, 'Duel tapılmadı və ya artıq bitib');

  const pool = duel.scoreA + duel.scoreB;
  const winner = duel.scoreA > duel.scoreB ? 'A' : duel.scoreB > duel.scoreA ? 'B' : 'draw';
  const rows = await Transaction.aggregate([
    { $match: { duel: duel._id, type: 'gift' } },
    { $group: { _id: { user: '$user', side: '$side' }, total: { $sum: '$amount' } } },
  ]);

  let commission = 0;
  let paidOut = 0;
  if (winner === 'draw') { // bərabərlik: hamıya qaytar
    for (const r of rows) {
      await walletService.credit(r._id.user, r.total, 'refund', { duel: duel._id, key: `duelrefund:${duel._id}:${r._id.user}:${r._id.side}` });
    }
  } else {
    commission = revenueService.calcCommission(pool);
    const net = pool - commission;
    const winners = rows.filter((r) => r._id.side === winner);
    const winnerTotal = winners.reduce((s, r) => s + r.total, 0);
    for (const r of winners) {
      const share = Number((BigInt(net) * BigInt(r.total)) / BigInt(winnerTotal));
      if (share > 0) {
        const res = await walletService.credit(r._id.user, share, 'duel_win', { duel: duel._id, key: `duelwin:${duel._id}:${r._id.user}` }); // idempotent
        paidOut += share;
        if (!res.duplicate) await safe(progression.awardWin(r._id.user)); // YENİ: yalnız ilk ödənişdə qələbə XP-si (təkrar bitirmədə ikiqat olmasın)
      }
    }
    if (winners.length === 0) commission = pool;
  }

  const revenue = winner === 'draw' ? 0 : pool - paidOut;
  const claim = await Duel.findOneAndUpdate({ _id: duel._id, revenueBooked: { $ne: true } }, { $set: { revenueBooked: true } });
  if (claim) await revenueService.addRevenue(revenue);

  const done = await Duel.findByIdAndUpdate(duel._id, { $set: { status: 'finished', winner, commission, finishedAt: new Date() } }, { new: true });
  const dto = toDTO(done);
  socket.emitToDuel(String(done._id), 'duel:update', dto);
  socket.emitGlobal('duel:finished', dto);
  return dto;
}

async function history(page = 1, limit = 20) { // bitmiş duellər
  const items = await Duel.find({ status: 'finished' }).sort({ finishedAt: -1 }).skip((page - 1) * limit).limit(limit);
  return items.map(toDTO);
}

const findById = async (id) => { // ID ilə duel
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Yanlış ID');
  const duel = await Duel.findById(id);
  if (!duel) throw new ApiError(404, 'Duel tapılmadı');
  return duel;
};

module.exports = { toDTO, getActiveDuel, ensureActiveDuel, createDuel, sendGift, finishDuel, history, findById };