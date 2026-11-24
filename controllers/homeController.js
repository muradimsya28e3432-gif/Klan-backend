const User = require('../models/User'); // istifadəçi
const Clan = require('../models/Clan'); // klan
const Friendship = require('../models/Friendship'); // dostluq istəkləri
const ClanRequest = require('../models/ClanRequest'); // klan istəkləri
const duelService = require('../services/duelService'); // duel
const seasonService = require('../services/seasonService'); // mövsüm
const { xpForLevel } = require('../services/progressionService'); // səviyyə düsturu
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const getHome = asyncHandler(async (req, res) => { // Ana səhifə: hər şey bir sorğuda
  const uid = req.user._id; // mən

  const [duel, me, season, topPlayers, topClans, recentDuels, totalUsers, friendRequests, myLedClan] = await Promise.all([ // paralel sorğular
    duelService.getActiveDuel(), // aktiv duel
    User.findById(uid).select('balance xp level seasonPoints duelWins giftCount friendsCount'), // mənim göstəricilərim
    seasonService.getActive(), // aktiv mövsüm
    User.find({ isBanned: false, seasonPoints: { $gt: 0 } }).sort({ seasonPoints: -1, _id: 1 }).limit(3).select('username level seasonPoints').lean(), // top 3 oyunçu
    Clan.find({ points: { $gt: 0 } }).sort({ points: -1, _id: 1 }).limit(3).select('name points memberCount').lean(), // top 3 klan
    duelService.history(1, 3), // son bitmiş duellər
    User.countDocuments({ isBanned: false }), // ümumi oyunçu sayı
    Friendship.countDocuments({ recipient: uid, status: 'pending' }), // gələn dostluq istəkləri
    Clan.findOne({ leader: uid }).select('_id').lean(), // lideri olduğum klan
  ]);

  const [seasonRank, clanRequests] = await Promise.all([ // mənim yerim və klan istəkləri
    User.countDocuments({ isBanned: false, seasonPoints: { $gt: me.seasonPoints } }), // məndən yüksək xallılar
    myLedClan ? ClanRequest.countDocuments({ clan: myLedClan._id, status: 'pending' }) : 0, // yalnız lider üçün
  ]);

  res.json({ success: true, data: {
    activeDuel: duel ? duelService.toDTO(duel) : null, // aktiv duel (yoxdursa null)
    me: { // mənim qısa göstəricilərim
      balance: me.balance, xp: me.xp, level: me.level, currentLevelXp: xpForLevel(me.level), nextLevelXp: xpForLevel(me.level + 1),
      seasonPoints: me.seasonPoints, seasonRank: seasonRank + 1, duelWins: me.duelWins, giftCount: me.giftCount, friendsCount: me.friendsCount,
    },
    season: { number: season.number, startedAt: season.startedAt }, // cari mövsüm
    topPlayers: topPlayers.map((u, i) => ({ rank: i + 1, id: u._id, username: u.username, level: u.level, points: u.seasonPoints })), // top oyunçular
    topClans: topClans.map((c, i) => ({ rank: i + 1, id: c._id, name: c.name, points: c.points, memberCount: c.memberCount })), // top klanlar
    recentDuels, // son duellər
    stats: { totalUsers }, // ümumi göstərici
    notifications: { friendRequests, clanRequests, total: friendRequests + clanRequests }, // bildiriş sayğacları
  } });
});

module.exports = { getHome }; // xaricə verir