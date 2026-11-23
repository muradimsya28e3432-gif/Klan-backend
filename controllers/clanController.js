const Clan = require('../models/Clan'); // klan
const User = require('../models/User'); // istifadəçi
const ClanRequest = require('../models/ClanRequest'); // klana qoşulma istəkləri
const socket = require('../services/socket'); // real vaxt bildirişi
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const MAX_MEMBERS = 500; // klanda maksimum üzv
const toDTO = (c) => ({ id: c._id, name: c.name, memberCount: c.memberCount, leader: c.leader && c.leader.username ? c.leader.username : null }); // format

const list = asyncHandler(async (req, res) => { // klanlar siyahısı
  const { page, limit } = req.valid.query; // səhifələmə
  const clans = await Clan.find().sort({ memberCount: -1 }).skip((page - 1) * limit).limit(limit).populate('leader', 'username'); // siyahı
  res.json({ success: true, data: clans.map(toDTO) }); // cavab
});

const getOne = asyncHandler(async (req, res) => { // bir klan
  const clan = await Clan.findById(req.params.id).populate('leader', 'username'); // tap
  if (!clan) throw new ApiError(404, 'Klan tapılmadı'); // yoxdur
  res.json({ success: true, data: toDTO(clan) }); // cavab
});

const create = asyncHandler(async (req, res) => { // klan yarat
  if (req.user.clan) throw new ApiError(409, 'Artıq klandasınız'); // bir klan qaydası
  let clan; // klan
  try { // yarat
    clan = await Clan.create({ name: req.body.name, leader: req.user._id }); // bazaya yaz
  } catch (e) { // xəta
    if (e.code === 11000) throw new ApiError(409, 'Bu klan adı artıq mövcuddur'); // təkrar ad
    throw e; // başqa xəta
  }
  const claimed = await User.findOneAndUpdate({ _id: req.user._id, clan: null }, { $set: { clan: clan._id } }); // atomik klana təyin et
  if (!claimed) { // yarış vəziyyəti: arada başqa klana girib
    await Clan.deleteOne({ _id: clan._id }); // yaradılanı sil
    throw new ApiError(409, 'Artıq klandasınız'); // bildir
  }
  res.status(201).json({ success: true, data: toDTO(clan) }); // cavab
});

const join = asyncHandler(async (req, res) => { // klana qoşulmaq üçün İSTƏK göndər
  if (req.user.clan) throw new ApiError(409, 'Artıq klandasınız'); // artıq klandadır
  const clan = await Clan.findById(req.params.id); // klan
  if (!clan) throw new ApiError(404, 'Klan tapılmadı'); // yoxdur
  if (clan.memberCount >= MAX_MEMBERS) throw new ApiError(409, 'Klan doludur'); // dolu
  let request; // istək
  try { // yarat
    request = await ClanRequest.create({ clan: clan._id, user: req.user._id, username: req.user.username }); // yaz
  } catch (e) { // xəta
    if (e.code === 11000) throw new ApiError(409, 'Bu klana artıq istək göndərmisiniz'); // təkrar istək
    throw e; // başqa xəta
  }
  socket.emitToUser(String(clan.leader), 'clan:request', { // klan sahibinə canlı bildiriş
    id: request._id, clanId: clan._id, clanName: clan.name, userId: req.user._id, username: req.user.username, createdAt: request.createdAt, // istək göndərənin adı daxildir
  });
  res.status(201).json({ success: true, data: { requestId: request._id, status: 'pending' } }); // cavab
});

const incomingRequests = asyncHandler(async (req, res) => { // klan sahibinin gözləyən istəkləri (oflayn olanda da görsün)
  const clan = await Clan.findOne({ leader: req.user._id }); // mənim klanım
  if (!clan) return res.json({ success: true, data: [] }); // lider deyil
  const items = await ClanRequest.find({ clan: clan._id, status: 'pending' }).sort({ createdAt: -1 }).limit(50).lean(); // siyahı
  res.json({ success: true, data: items.map((r) => ({ id: r._id, userId: r.user, username: r.username, clanName: clan.name, createdAt: r.createdAt })) }); // cavab
});

const myRequests = asyncHandler(async (req, res) => { // mənim göndərdiyim istəklər (rədd olunanı oflayn görmək üçün)
  const items = await ClanRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20).populate('clan', 'name').lean(); // siyahı
  res.json({ success: true, data: items.map((r) => ({ id: r._id, clanName: r.clan ? r.clan.name : null, status: r.status, message: r.status === 'rejected' ? 'Klan sahibi tərəfindən qəbul edilmədiniz' : null })) }); // cavab
});

const loadMyPendingRequest = async (requestId, leaderId) => { // istək + sahiblik yoxlaması
  const request = await ClanRequest.findOne({ _id: requestId, status: 'pending' }); // gözləyən istək
  if (!request) throw new ApiError(404, 'İstək tapılmadı və ya artıq cavablandırılıb'); // yoxdur
  const clan = await Clan.findOne({ _id: request.clan, leader: leaderId }); // yalnız klan sahibi
  if (!clan) throw new ApiError(403, 'Bu əməliyyat üçün icazəniz yoxdur'); // sahibi deyil
  return { request, clan }; // nəticə
};

const acceptRequest = asyncHandler(async (req, res) => { // qəbul et
  const { request, clan } = await loadMyPendingRequest(req.params.id, req.user._id); // yoxla
  const reserved = await Clan.findOneAndUpdate({ _id: clan._id, memberCount: { $lt: MAX_MEMBERS } }, { $inc: { memberCount: 1 } }, { new: true }); // yer ayır
  if (!reserved) throw new ApiError(409, 'Klan doludur'); // dolu
  const claimed = await User.findOneAndUpdate({ _id: request.user, clan: null }, { $set: { clan: clan._id } }); // oyunçunu klana yaz (atomik)
  if (!claimed) { // arada başqa klana girib
    await Clan.updateOne({ _id: clan._id }, { $inc: { memberCount: -1 } }); // yeri geri ver
    await ClanRequest.updateOne({ _id: request._id }, { $set: { status: 'rejected' } }); // istəyi bağla
    throw new ApiError(409, 'Oyunçu artıq başqa klandadır'); // bildir
  }
  await ClanRequest.updateOne({ _id: request._id }, { $set: { status: 'accepted' } }); // qəbul olundu
  await ClanRequest.updateMany({ user: request.user, status: 'pending' }, { $set: { status: 'rejected' } }); // digər gözləyən istəkləri bağla
  socket.emitToUser(String(request.user), 'clan:accepted', { clanId: clan._id, clanName: clan.name, message: `${clan.name} klanına qəbul olundunuz` }); // oyunçuya bildir
  res.json({ success: true, data: { accepted: true, clan: toDTO(reserved) } }); // cavab
});

const rejectRequest = asyncHandler(async (req, res) => { // rədd et
  const { request, clan } = await loadMyPendingRequest(req.params.id, req.user._id); // yoxla
  await ClanRequest.updateOne({ _id: request._id, status: 'pending' }, { $set: { status: 'rejected' } }); // rədd
  socket.emitToUser(String(request.user), 'clan:rejected', { clanId: clan._id, clanName: clan.name, message: 'Klan sahibi tərəfindən qəbul edilmədiniz' }); // oyunçuya bildir
  res.json({ success: true, data: { rejected: true } }); // cavab
});

const leave = asyncHandler(async (req, res) => { // klandan çıx
  const clanId = req.user.clan; // klanım
  if (!clanId) throw new ApiError(400, 'Klanda deyilsiniz'); // klan yoxdur
  const clan = await Clan.findById(clanId); // klan
  if (clan && String(clan.leader) === String(req.user._id)) { // lider isə
    if (clan.memberCount > 1) throw new ApiError(400, 'Lider klandan çıxa bilməz (əvvəl klanda tək qalmalısınız)'); // qadağa
    await Clan.deleteOne({ _id: clan._id }); // tək qalıbsa klanı sil
    await ClanRequest.deleteMany({ clan: clan._id }); // klanın istəklərini sil
  } else if (clan) { // adi üzvdürsə
    await Clan.updateOne({ _id: clan._id }, { $inc: { memberCount: -1 } }); // sayı azalt
  }
  await User.updateOne({ _id: req.user._id }, { $set: { clan: null } }); // istifadəçidən klanı götür
  res.json({ success: true, data: { left: true } }); // cavab
});

module.exports = { list, getOne, create, join, leave, incomingRequests, myRequests, acceptRequest, rejectRequest }; // xaricə verir