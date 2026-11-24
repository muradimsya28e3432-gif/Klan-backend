const Friendship = require('../models/Friendship'); // dostluq
const User = require('../models/User'); // istifadəçi
const progression = require('../services/progressionService'); // nailiyyət yoxlaması
const socket = require('../services/socket'); // canlı bildiriş
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const sendRequest = asyncHandler(async (req, res) => { // dostluq istəyi göndər
  const me = req.user._id;
  const target = req.params.userId;
  if (String(me) === target) throw new ApiError(400, 'Özünüzə istək göndərə bilməzsiniz');
  if (!(await User.exists({ _id: target, isBanned: false }))) throw new ApiError(404, 'İstifadəçi tapılmadı');
  const pairKey = Friendship.makeKey(me, target);
  const existing = await Friendship.findOne({ pairKey }).lean();
  if (existing) throw new ApiError(409, existing.status === 'accepted' ? 'Artıq dostsunuz' : 'İstək artıq göndərilib');
  let fr;
  try {
    fr = await Friendship.create({ requester: me, recipient: target, pairKey });
  } catch (e) {
    if (e.code === 11000) throw new ApiError(409, 'İstək artıq göndərilib'); // yarış vəziyyəti
    throw e;
  }
  socket.emitToUser(target, 'friend:request', { id: fr._id, userId: me, username: req.user.username }); // canlı bildiriş
  res.status(201).json({ success: true, data: { id: fr._id, status: 'pending' } });
});

const accept = asyncHandler(async (req, res) => { // istəyi qəbul et
  const fr = await Friendship.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id, status: 'pending' }, { $set: { status: 'accepted' } }, { new: true }); // atomik
  if (!fr) throw new ApiError(404, 'İstək tapılmadı və ya artıq cavablandırılıb');
  await User.updateMany({ _id: { $in: [fr.requester, fr.recipient] } }, { $inc: { friendsCount: 1 } }); // hər iki tərəfdə say
  await Promise.all([progression.checkUser(fr.requester), progression.checkUser(fr.recipient)]).catch(() => {}); // nailiyyət
  socket.emitToUser(String(fr.requester), 'friend:accepted', { userId: req.user._id, username: req.user.username });
  res.json({ success: true, data: { accepted: true } });
});

const reject = asyncHandler(async (req, res) => { // istəyi rədd et (sənəd silinir)
  const fr = await Friendship.findOneAndDelete({ _id: req.params.id, recipient: req.user._id, status: 'pending' });
  if (!fr) throw new ApiError(404, 'İstək tapılmadı və ya artıq cavablandırılıb');
  res.json({ success: true, data: { rejected: true } });
});

const remove = asyncHandler(async (req, res) => { // dostluğu sil / göndərdiyim istəyi ləğv et
  const me = req.user._id;
  const pairKey = Friendship.makeKey(me, req.params.userId);
  const fr = await Friendship.findOneAndDelete({ pairKey, $or: [{ status: 'accepted' }, { requester: me }] }); // yalnız dostluq və ya öz istəyim
  if (!fr) throw new ApiError(404, 'Tapılmadı');
  if (fr.status === 'accepted') await User.updateMany({ _id: { $in: [fr.requester, fr.recipient] }, friendsCount: { $gt: 0 } }, { $inc: { friendsCount: -1 } });
  res.json({ success: true, data: { removed: true } });
});

const list = asyncHandler(async (req, res) => { // dostlarım
  const me = String(req.user._id);
  const items = await Friendship.find({ status: 'accepted', $or: [{ requester: me }, { recipient: me }] })
    .sort({ updatedAt: -1 }).limit(200).populate('requester recipient', 'username level isBanned').lean();
  const friends = items
    .map((f) => (String(f.requester._id) === me ? f.recipient : f.requester)) // qarşı tərəf
    .filter((u) => !u.isBanned)
    .map((u) => ({ id: u._id, username: u.username, level: u.level }));
  res.json({ success: true, data: friends });
});

const incoming = asyncHandler(async (req, res) => { // gələn istəklər
  const items = await Friendship.find({ recipient: req.user._id, status: 'pending' }).sort({ createdAt: -1 }).limit(50).populate('requester', 'username level').lean();
  res.json({ success: true, data: items.filter((f) => f.requester).map((f) => ({ id: f._id, userId: f.requester._id, username: f.requester.username, level: f.requester.level, createdAt: f.createdAt })) });
});

module.exports = { sendRequest, accept, reject, remove, list, incoming };