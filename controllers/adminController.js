const User = require('../models/User'); // istifadəçi
const duelService = require('../services/duelService'); // duel
const payoutService = require('../services/payoutService'); // çıxarışlar
const revenueService = require('../services/revenueService'); // platforma gəliri
const socket = require('../services/socket'); // socket
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // regex təmizləyici

const stats = asyncHandler(async (req, res) => { // ümumi statistika
  const [users, platform] = await Promise.all([User.countDocuments(), revenueService.getStats()]); // paralel
  res.json({ success: true, data: { users, platform } }); // cavab
});

const listUsers = asyncHandler(async (req, res) => { // istifadəçilər siyahısı
  const { page, limit, q } = req.valid.query; // parametrlər
  const filter = q ? { usernameLower: new RegExp(escapeRegex(q.toLowerCase())) } : {}; // axtarış
  const users = await User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('username role balance isBanned createdAt'); // siyahı
  res.json({ success: true, data: users }); // cavab
});

const setBan = (banned) => asyncHandler(async (req, res) => { // bloklama/blokdan çıxarma fabriki
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: { $ne: 'admin' } }, { $set: { isBanned: banned } }, { new: true }); // adminləri bloklamaq olmaz
  if (!user) throw new ApiError(404, 'İstifadəçi tapılmadı və ya admindir'); // yoxdur
  if (banned) socket.disconnectUser(String(user._id)); // bloklananı canlı bağlantıdan at
  res.json({ success: true, data: { id: user._id, isBanned: user.isBanned } }); // cavab
});

const createDuel = asyncHandler(async (req, res) => { // yeni duel
  const duel = await duelService.createDuel(req.body.nameA, req.body.nameB); // yarat
  res.status(201).json({ success: true, data: duelService.toDTO(duel) }); // cavab
});

const finishDuel = asyncHandler(async (req, res) => { // duelı bitir
  res.json({ success: true, data: await duelService.finishDuel(req.params.id) }); // cavab
});

const listPayouts = asyncHandler(async (req, res) => { // çıxarış sorğuları
  const { page, limit, status } = req.valid.query; // parametrlər
  res.json({ success: true, data: await payoutService.listForAdmin(status, page, limit) }); // cavab
});

const revealPayoutCard = asyncHandler(async (req, res) => { // tam kart nömrəsi (audit olunur)
  res.json({ success: true, data: { cardNumber: await payoutService.revealCard(req.params.id, req.user._id) } }); // cavab
});

const approvePayout = asyncHandler(async (req, res) => { // təsdiq
  const p = await payoutService.approve(req.params.id, req.user._id, req.body.providerRef); // təsdiqlə
  res.json({ success: true, data: { id: p._id, status: p.status } }); // cavab
});

const rejectPayout = asyncHandler(async (req, res) => { // rədd
  const p = await payoutService.reject(req.params.id, req.user._id, req.body.note); // rədd et
  res.json({ success: true, data: { id: p._id, status: p.status } }); // cavab
});

const platformWithdraw = asyncHandler(async (req, res) => { // platforma gəlirini çıxar
  const left = await revenueService.withdraw(req.user._id, req.body.amount, req.body.note); // çıxar
  res.json({ success: true, data: { balance: left } }); // qalıq
});

const platformWithdrawals = asyncHandler(async (req, res) => { // çıxarış tarixçəsi
  const { page, limit } = req.valid.query; // səhifələmə
  res.json({ success: true, data: await revenueService.listWithdrawals(page, limit) }); // cavab
});

module.exports = { // xaricə verir
  stats, listUsers, ban: setBan(true), unban: setBan(false), createDuel, finishDuel, // idarəetmə
  listPayouts, revealPayoutCard, approvePayout, rejectPayout, platformWithdraw, platformWithdrawals, // pul
};