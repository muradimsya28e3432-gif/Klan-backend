const User = require('../models/User'); // istifadəçi
const Clan = require('../models/Clan'); // klan
const UserAchievement = require('../models/UserAchievement'); // nailiyyətlər
const { ACHIEVEMENTS } = require('../utils/achievements'); // kataloq
const socket = require('./socket'); // canlı bildiriş

const WIN_XP = 50; // duel qələbəsi üçün XP
const levelFromXp = (xp) => Math.floor(Math.sqrt(xp / 100)) + 1; // səviyyə düsturu (100, 400, 900 ... XP)
const xpForLevel = (lvl) => (lvl - 1) ** 2 * 100; // səviyyənin başlanğıc XP-si

async function unlock(userId, code, xpReward = 0) { // nailiyyət ver (təkrar verilmir)
  try {
    await UserAchievement.create({ user: userId, code }); // unikal indeks təkrarın qarşısını alır
  } catch (e) {
    if (e.code === 11000) return false; // artıq var
    throw e;
  }
  if (xpReward > 0) await User.updateOne({ _id: userId }, { $inc: { xp: xpReward } }); // mükafat XP
  socket.emitToUser(String(userId), 'achievement:unlocked', { code, xp: xpReward }); // canlı bildir
  return true;
}

async function checkAchievements(user) { // bütün nailiyyətləri yoxla
  const owned = new Set((await UserAchievement.find({ user: user._id }).select('code').lean()).map((a) => a.code)); // sahib olunanlar
  for (const a of ACHIEVEMENTS) {
    if (!owned.has(a.code) && a.test(user)) await unlock(user._id, a.code, a.xp); // açılmalıdırsa aç
  }
}

async function checkUser(userId) { // ID ilə yoxla (başqa servislər üçün)
  const user = await User.findById(userId);
  if (user) await checkAchievements(user);
}

async function addXp(userId, xp, inc = {}) { // XP + əlavə sayğaclar, səviyyə və nailiyyət yoxlaması
  const user = await User.findByIdAndUpdate(userId, { $inc: { xp, ...inc } }, { new: true }); // atomik artırma
  if (!user) return null;
  const lvl = levelFromXp(user.xp);
  if (lvl > user.level) { // səviyyə qalxıb
    await User.updateOne({ _id: userId, level: { $lt: lvl } }, { $set: { level: lvl } }); // yalnız yuxarı
    user.level = lvl;
    socket.emitToUser(String(userId), 'level:up', { level: lvl }); // bildir
  }
  await checkAchievements(user);
  return user;
}

async function awardGift(userId, price) { // hədiyyə göndərəndə
  const user = await addXp(userId, Math.max(1, Math.floor(price / 10)), { giftCount: 1, seasonPoints: price }); // 10 qəpik = 1 XP
  if (user && user.clan) await Clan.updateOne({ _id: user.clan }, { $inc: { points: price, totalPoints: price } }); // klana xal
}

async function awardWin(userId) { // duel qalibi
  await addXp(userId, WIN_XP, { duelWins: 1 });
}

module.exports = { awardGift, awardWin, checkUser, unlock, levelFromXp, xpForLevel }; // xaricə verir