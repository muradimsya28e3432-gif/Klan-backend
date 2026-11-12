const Clan = require('../models/Clan'); // klan
const User = require('../models/User'); // istifadəçi
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

const join = asyncHandler(async (req, res) => { // klana qoşul
  const clanId = req.params.id; // klan
  const reserved = await Clan.findOneAndUpdate({ _id: clanId, memberCount: { $lt: MAX_MEMBERS } }, { $inc: { memberCount: 1 } }, { new: true }); // yer ayır
  if (!reserved) { // alınmadı
    const exists = await Clan.exists({ _id: clanId }); // klan varmı
    throw new ApiError(exists ? 409 : 404, exists ? 'Klan doludur' : 'Klan tapılmadı'); // səbəbə görə xəta
  }
  const claimed = await User.findOneAndUpdate({ _id: req.user._id, clan: null }, { $set: { clan: clanId } }); // istifadəçini təyin et
  if (!claimed) { // artıq klandadırsa
    await Clan.updateOne({ _id: clanId }, { $inc: { memberCount: -1 } }); // yeri geri ver
    throw new ApiError(409, 'Artıq klandasınız'); // bildir
  }
  res.json({ success: true, data: toDTO(reserved) }); // cavab
});

const leave = asyncHandler(async (req, res) => { // klandan çıx
  const clanId = req.user.clan; // klanım
  if (!clanId) throw new ApiError(400, 'Klanda deyilsiniz'); // klan yoxdur
  const clan = await Clan.findById(clanId); // klan
  if (clan && String(clan.leader) === String(req.user._id)) { // lider isə
    if (clan.memberCount > 1) throw new ApiError(400, 'Lider klandan çıxa bilməz (əvvəl klanda tək qalmalısınız)'); // qadağa
    await Clan.deleteOne({ _id: clan._id }); // tək qalıbsa klanı sil
  } else if (clan) { // adi üzvdürsə
    await Clan.updateOne({ _id: clan._id }, { $inc: { memberCount: -1 } }); // sayı azalt
  }
  await User.updateOne({ _id: req.user._id }, { $set: { clan: null } }); // istifadəçidən klanı götür
  res.json({ success: true, data: { left: true } }); // cavab
});

module.exports = { list, getOne, create, join, leave }; // xaricə verir