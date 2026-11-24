const Clan = require('../models/Clan'); // klan
const User = require('../models/User'); // istifadəçi
const Message = require('../models/Message'); // mesaj
const socket = require('../services/socket'); // canlı yayım
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const needClan = (req) => { // klan üzvlüyü yoxlaması (req.user hər sorğuda bazadan təzə gəlir)
  if (!req.user.clan) throw new ApiError(403, 'Klanda deyilsiniz');
  return req.user.clan;
};

const getChat = asyncHandler(async (req, res) => { // klan çatı tarixçəsi
  const clanId = needClan(req);
  const items = await Message.find({ type: 'clan', clan: clanId }).sort({ createdAt: -1 }).limit(req.valid.query.limit);
  res.json({ success: true, data: items.reverse().map(Message.toDTO) });
});

const sendChat = asyncHandler(async (req, res) => { // REST ilə klan mesajı
  const clanId = needClan(req);
  const dto = await Message.post({ sender: req.user._id, senderName: req.user.username, clan: clanId, text: req.body.text });
  socket.emitToClan(String(clanId), 'chat:message', dto);
  res.status(201).json({ success: true, data: dto });
});

const members = asyncHandler(async (req, res) => { // klan üzvləri
  const clanId = needClan(req);
  const [clan, users] = await Promise.all([
    Clan.findById(clanId).select('leader').lean(),
    User.find({ clan: clanId, isBanned: false }).sort({ seasonPoints: -1 }).limit(100).select('username level seasonPoints').lean(),
  ]);
  res.json({ success: true, data: users.map((u) => ({ id: u._id, username: u.username, level: u.level, seasonPoints: u.seasonPoints, isLeader: !!clan && String(clan.leader) === String(u._id) })) });
});

const stats = asyncHandler(async (req, res) => { // klan statistikası
  const clanId = needClan(req);
  const clan = await Clan.findById(clanId).populate('leader', 'username').lean();
  if (!clan) throw new ApiError(404, 'Klan tapılmadı');
  const [rank, top] = await Promise.all([
    Clan.countDocuments({ points: { $gt: clan.points } }), // məndən yüksək xallı klanlar
    User.find({ clan: clanId, isBanned: false }).sort({ seasonPoints: -1 }).limit(5).select('username seasonPoints').lean(),
  ]);
  res.json({ success: true, data: {
    id: clan._id, name: clan.name, leader: clan.leader ? clan.leader.username : null, memberCount: clan.memberCount,
    points: clan.points, totalPoints: clan.totalPoints, rank: rank + 1,
    topMembers: top.map((u) => ({ id: u._id, username: u.username, points: u.seasonPoints })),
  } });
});

module.exports = { getChat, sendChat, members, stats };