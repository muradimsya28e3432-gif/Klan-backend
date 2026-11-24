const Season = require('../models/Season'); // mövsüm
const User = require('../models/User'); // istifadəçi
const Clan = require('../models/Clan'); // klan
const progression = require('./progressionService'); // medal vermək üçün

const MEDAL_XP = { 1: 200, 2: 100, 3: 50 }; // yerə görə XP

async function getActive() { // aktiv mövsüm, yoxdursa yaradır
  let s = await Season.findOne({ status: 'active' });
  if (s) return s;
  const last = await Season.findOne().sort({ number: -1 }).lean();
  try {
    s = await Season.create({ number: (last ? last.number : 0) + 1 }); // nömrə unikaldır, yarış olsa 11000
  } catch (e) {
    if (e.code !== 11000) throw e;
    s = await Season.findOne({ status: 'active' });
  }
  return s;
}

async function endSeason() { // mövsümü bitirir: medallar, sıfırlama, yeni mövsüm
  await getActive(); // aktiv olduğundan əmin ol
  const season = await Season.findOneAndUpdate({ status: 'active' }, { $set: { status: 'ended', endedAt: new Date() } }, { new: true }); // atomik: ikiqat bitirmə olmaz
  if (!season) return null;

  const top = await User.find({ isBanned: false, seasonPoints: { $gt: 0 } }).sort({ seasonPoints: -1 }).limit(3).select('username seasonPoints').lean(); // ilk 3
  const winners = top.map((u, i) => ({ place: i + 1, user: u._id, username: u.username, points: u.seasonPoints }));
  const clan = await Clan.findOne({ points: { $gt: 0 } }).sort({ points: -1 }).select('name points').lean(); // qalib klan

  await Season.updateOne({ _id: season._id }, { $set: { winners, topClan: clan ? { clan: clan._id, name: clan.name, points: clan.points } : undefined } }); // nəticəni yaz
  for (const w of winners) await progression.unlock(w.user, `medal:${season.number}:${w.place}`, MEDAL_XP[w.place]); // medallar

  await User.updateMany({}, { $set: { seasonPoints: 0 } }); // sıfırla
  await Clan.updateMany({}, { $set: { points: 0 } }); // sıfırla
  await getActive(); // yeni mövsüm
  return Season.findById(season._id).lean();
}

const listSeasons = (limit = 20) => Season.find().sort({ number: -1 }).limit(limit).lean(); // tarixçə

module.exports = { getActive, endSeason, listSeasons }; // xaricə verir