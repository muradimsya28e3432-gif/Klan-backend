const Message = require('../models/Message'); // mesaj modeli
const User = require('../models/User'); // istifadəçi modeli
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı
const socket = require('../services/socket'); // real vaxt yayımı

const getGlobal = asyncHandler(async (req, res) => { // ümumi çat tarixçəsi
  const { limit } = req.valid.query; // limit
  const items = await Message.find({ type: 'global' }).sort({ createdAt: -1 }).limit(limit); // son mesajlar
  res.json({ success: true, data: items.reverse().map(Message.toDTO) }); // köhnədən yeniyə sıralayıb qaytarır
});

const getPrivate = asyncHandler(async (req, res) => { // iki nəfər arasındakı şəxsi yazışma
  const { limit } = req.valid.query; // limit
  const me = req.user._id; // mən
  const other = req.params.userId; // qarşı tərəf
  const items = await Message.find({ type: 'private', $or: [{ sender: me, recipient: other }, { sender: other, recipient: me }] }).sort({ createdAt: -1 }).limit(limit); // yalnız bu ikisinin mesajları
  res.json({ success: true, data: items.reverse().map(Message.toDTO) }); // cavab
});

const send = asyncHandler(async (req, res) => { // REST ilə mesaj göndər (socket işləməzsə ehtiyat)
  const { text, to } = req.body; // məlumat
  if (to) { // şəxsi mesajdırsa
    if (String(to) === String(req.user._id)) throw new ApiError(400, 'Özünüzə yaza bilməzsiniz'); // özünə yox
    if (!(await User.exists({ _id: to, isBanned: false }))) throw new ApiError(404, 'İstifadəçi tapılmadı'); // alıcı varmı
  }
  const dto = await Message.post({ sender: req.user._id, senderName: req.user.username, recipient: to || null, text }); // yaz
  if (to) { socket.emitToUser(String(to), 'chat:message', dto); socket.emitToUser(String(req.user._id), 'chat:message', dto); } // iki tərəfə göndər
  else socket.emitGlobal('chat:message', dto); // ümumi mesaj
  res.status(201).json({ success: true, data: dto }); // cavab
});

module.exports = { getGlobal, getPrivate, send }; // xaricə verir