const User = require('../models/User'); // istifadəçi
const Clan = require('../models/Clan'); // klan
const UserAchievement = require('../models/UserAchievement'); // nailiyyətlər
const { ACHIEVEMENTS } = require('../utils/achievements'); // kataloq
const { xpForLevel } = require('../services/progressionService'); // səviyyə düsturu
const seasonService = require('../services/seasonService'); // mövsüm
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const myProgress = asyncHandler(async (req, res) => { // mənim irəliləyişim
  const u = await User.findById(req.user._id);
  const rank = (await User.countDocuments({ isBanned: false, seasonPoints: { $gt: u.seasonPoints } })) + 1; // mövsümdəki yerim
  res.json({ success: true, data: {
    xp: u.xp, level: u.level, currentLevelXp: xpForLevel(u.level), nextLevelXp: xpForLevel(u.level + 1), // proqres zolağı üçün
    seasonPoints: u.seasonPoints, seasonRank: rank, duelWins: u.duelWins, giftCount: u.giftCount, friendsCount: u.friendsCount,
  } });
});

const achievements = asyncHandler(async (req, res) => { // nailiyyətlər və medallar
  const mine = await UserAchievement.find({ user: req.user._id }).lean();
  const got = new Map(mine.map((a) => [a.code, a.createdAt]));
  const catalog = ACHIEVEMENTS.map((a) => ({ code: a.code, name: a.name, description: a.description, xp: a.xp, unlockedAt: got.get(a.code) || null }));
  const medals = mine.filter((a) => a.code.startsWith('medal:')).map((a) => { // "medal:<mövsüm>:<yer>"
    const [, season, place] = a.code.split(':');
    return { code: a.code, season: Number(season), place: Number(place), unlockedAt: a.createdAt };
  });
  res.json({ success: true, data: { achievements: catalog, medals } });
});

const BY = { season: 'seasonPoints', level: 'xp', gifted: 'totalGifted' }; // icazəli sıralamalar

const leaderboardUsers = asyncHandler(async (req, res) => { // oyunçu reytinqi
  const { by, limit } = req.valid.query;
  const field = BY[by];
  const users = await User.find({ isBanned: false, [field]: { $gt: 0 } }).sort({ [field]: -1, _id: 1 }).limit(limit)
    .select('username level xp seasonPoints totalGifted duelWins clan').populate('clan', 'name').lean();
  res.json({ success: true, data: users.map((u, i) => ({
    rank: i + 1, id: u._id, username: u.username, level: u.level, value: u[field], duelWins: u.duelWins, clan: u.clan ? u.clan.name : null,
  })) });
});

const leaderboardClans = asyncHandler(async (req, res) => { // klan reytinqi
  const { limit } = req.valid.query;
  const clans = await Clan.find({ points: { $gt: 0 } }).sort({ points: -1, _id: 1 }).limit(limit).populate('leader', 'username').lean();
  res.json({ success: true, data: clans.map((c, i) => ({ rank: i + 1, id: c._id, name: c.name, points: c.points, totalPoints: c.totalPoints, memberCount: c.memberCount, leader: c.leader ? c.leader.username : null })) });
});

const season = asyncHandler(async (req, res) => { // aktiv mövsüm + son bitmişlər
  const [active, past] = await Promise.all([seasonService.getActive(), seasonService.listSeasons(5)]);
  res.json({ success: true, data: { active: { number: active.number, startedAt: active.startedAt }, past: past.filter((s) => s.status === 'ended') } });
});

module.exports = { myProgress, achievements, leaderboardUsers, leaderboardClans, season };