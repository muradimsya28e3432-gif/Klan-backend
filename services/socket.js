const { Server } = require('socket.io'); // real vaxt rabitə kitabxanası
const env = require('../config/env'); // CORS siyahısı
const { authenticateToken } = require('../middleware/auth'); // token yoxlaması
const Message = require('../models/Message'); // mesaj modeli
const User = require('../models/User'); // istifadəçi modeli

let io = null; // socket serveri
const ID_RE = /^[a-f\d]{24}$/i; // ObjectId formatı

function init(httpServer) { // socket serverini işə salır
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e4,
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => { // hər qoşulmada token yoxlayır
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      socket.data.user = await authenticateToken(token);
      next();
    } catch (e) {
      next(new Error('Giriş tələb olunur'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join('global');
    socket.join(`user:${user._id}`);
    if (user.clan) socket.join(`clan:${user.clan}`); // YENİ: klan otağı
    let bucket = { count: 0, resetAt: Date.now() + 10000 };

    const allowed = () => { // 10 saniyədə maksimum 6 mesaj
      if (Date.now() > bucket.resetAt) bucket = { count: 0, resetAt: Date.now() + 10000 };
      bucket.count += 1;
      return bucket.count <= 6;
    };

    const reply = (ack, data) => { if (typeof ack === 'function') ack(data); };

    socket.on('duel:join', (duelId) => {
      if (typeof duelId === 'string' && ID_RE.test(duelId)) socket.join(`duel:${duelId}`);
    });

    socket.on('clan:join', async (ack) => { // YENİ: klana girəndən/çıxandan sonra klient bunu çağırır, otaq yenilənir
      try {
        const fresh = await User.findById(user._id).select('clan isBanned'); // təzə məlumat
        for (const room of socket.rooms) if (room.startsWith('clan:')) socket.leave(room); // köhnə klan otağından çıx
        if (fresh && !fresh.isBanned && fresh.clan) socket.join(`clan:${fresh.clan}`); // yenisinə qoşul
        reply(ack, { ok: true });
      } catch (e) {
        reply(ack, { ok: false, message: 'Xəta baş verdi' });
      }
    });

    socket.on('chat:global', async (payload, ack) => {
      try {
        if (!allowed()) return reply(ack, { ok: false, message: 'Çox sürətlisiniz, bir az gözləyin' });
        const dto = await Message.post({ sender: user._id, senderName: user.username, text: payload && payload.text });
        io.to('global').emit('chat:message', dto);
        reply(ack, { ok: true });
      } catch (e) {
        reply(ack, { ok: false, message: e.isOperational ? e.message : 'Xəta baş verdi' });
      }
    });

    socket.on('chat:private', async (payload, ack) => {
      try {
        if (!allowed()) return reply(ack, { ok: false, message: 'Çox sürətlisiniz, bir az gözləyin' });
        const to = payload && payload.to;
        if (typeof to !== 'string' || !ID_RE.test(to) || to === String(user._id)) return reply(ack, { ok: false, message: 'Alıcı yanlışdır' });
        const exists = await User.exists({ _id: to, isBanned: false });
        if (!exists) return reply(ack, { ok: false, message: 'İstifadəçi tapılmadı' });
        const dto = await Message.post({ sender: user._id, senderName: user.username, recipient: to, text: payload.text });
        io.to(`user:${to}`).to(`user:${user._id}`).emit('chat:message', dto);
        reply(ack, { ok: true });
      } catch (e) {
        reply(ack, { ok: false, message: e.isOperational ? e.message : 'Xəta baş verdi' });
      }
    });

    socket.on('chat:clan', async (payload, ack) => { // YENİ: klan daxili çat
      try {
        if (!allowed()) return reply(ack, { ok: false, message: 'Çox sürətlisiniz, bir az gözləyin' });
        const fresh = await User.findById(user._id).select('clan isBanned'); // klan üzvlüyü həmişə bazadan yoxlanır
        if (!fresh || fresh.isBanned || !fresh.clan) return reply(ack, { ok: false, message: 'Klanda deyilsiniz' });
        const dto = await Message.post({ sender: user._id, senderName: user.username, clan: fresh.clan, text: payload && payload.text });
        io.to(`clan:${fresh.clan}`).emit('chat:message', dto); // yalnız klan üzvlərinə
        reply(ack, { ok: true });
      } catch (e) {
        reply(ack, { ok: false, message: e.isOperational ? e.message : 'Xəta baş verdi' });
      }
    });
  });

  return io;
}

const emitToDuel = (duelId, event, data) => { if (io) io.to(`duel:${duelId}`).emit(event, data); };
const emitGlobal = (event, data) => { if (io) io.to('global').emit(event, data); };
const emitToUser = (userId, event, data) => { if (io) io.to(`user:${userId}`).emit(event, data); };
const emitToClan = (clanId, event, data) => { if (io) io.to(`clan:${clanId}`).emit(event, data); }; // YENİ
const disconnectUser = (userId) => { if (io) io.in(`user:${userId}`).disconnectSockets(true); };
const close = () => new Promise((resolve) => { if (io) io.close(() => resolve()); else resolve(); });

module.exports = { init, emitToDuel, emitGlobal, emitToUser, emitToClan, disconnectUser, close };