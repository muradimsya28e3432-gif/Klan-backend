const { Server } = require('socket.io'); // real vaxt rabitə kitabxanası
const env = require('../config/env'); // CORS siyahısı
const { authenticateToken } = require('../middleware/auth'); // token yoxlaması
const Message = require('../models/Message'); // mesaj modeli
const User = require('../models/User'); // istifadəçi modeli

let io = null; // socket serveri (init-dən sonra dolur)
const ID_RE = /^[a-f\d]{24}$/i; // ObjectId formatı

function init(httpServer) { // socket serverini işə salır
  io = new Server(httpServer, { // yaradırıq
    cors: { origin: env.CORS_ORIGINS, methods: ['GET', 'POST'] }, // yalnız icazəli saytlar
    maxHttpBufferSize: 1e4, // maksimum 10KB mesaj
    pingTimeout: 20000, // 20 san cavab verməyənləri atır
  });

  io.use(async (socket, next) => { // hər qoşulmada token yoxlayır
    try { // yoxlama
      const token = socket.handshake.auth && socket.handshake.auth.token; // tokeni götür
      socket.data.user = await authenticateToken(token); // istifadəçini yadda saxla
      next(); // icazə ver
    } catch (e) { // uğursuzsa
      next(new Error('Giriş tələb olunur')); // qoşulmanı rədd et
    }
  });

  io.on('connection', (socket) => { // uğurlu qoşulma
    const user = socket.data.user; // istifadəçi
    socket.join('global'); // ümumi çat otağına
    socket.join(`user:${user._id}`); // şəxsi otağa (şəxsi mesajlar üçün)
    let bucket = { count: 0, resetAt: Date.now() + 10000 }; // spam limiti sayğacı

    const allowed = () => { // 10 saniyədə maksimum 6 mesaj
      if (Date.now() > bucket.resetAt) bucket = { count: 0, resetAt: Date.now() + 10000 }; // pəncərəni yeniləyir
      bucket.count += 1; // sayğacı artırır
      return bucket.count <= 6; // limit daxilindədirsə true
    };

    const reply = (ack, data) => { if (typeof ack === 'function') ack(data); }; // ack varsa cavab verir

    socket.on('duel:join', (duelId) => { // duel otağına qoşulma
      if (typeof duelId === 'string' && ID_RE.test(duelId)) socket.join(`duel:${duelId}`); // yalnız düzgün ID
    });

    socket.on('chat:global', async (payload, ack) => { // ümumi çat mesajı
      try { // xəta tutmaq üçün
        if (!allowed()) return reply(ack, { ok: false, message: 'Çox sürətlisiniz, bir az gözləyin' }); // spam
        const dto = await Message.post({ sender: user._id, senderName: user.username, text: payload && payload.text }); // yoxla və yaz
        io.to('global').emit('chat:message', dto); // hamıya göndər
        reply(ack, { ok: true }); // uğur
      } catch (e) { // xəta
        reply(ack, { ok: false, message: e.isOperational ? e.message : 'Xəta baş verdi' }); // gizli detal vermir
      }
    });

    socket.on('chat:private', async (payload, ack) => { // şəxsi mesaj
      try { // xəta tutmaq üçün
        if (!allowed()) return reply(ack, { ok: false, message: 'Çox sürətlisiniz, bir az gözləyin' }); // spam
        const to = payload && payload.to; // alıcı ID
        if (typeof to !== 'string' || !ID_RE.test(to) || to === String(user._id)) return reply(ack, { ok: false, message: 'Alıcı yanlışdır' }); // yoxlama
        const exists = await User.exists({ _id: to, isBanned: false }); // alıcı varmı
        if (!exists) return reply(ack, { ok: false, message: 'İstifadəçi tapılmadı' }); // yoxdur
        const dto = await Message.post({ sender: user._id, senderName: user.username, recipient: to, text: payload.text }); // yaz
        io.to(`user:${to}`).to(`user:${user._id}`).emit('chat:message', dto); // yalnız iki tərəfə göndər
        reply(ack, { ok: true }); // uğur
      } catch (e) { // xəta
        reply(ack, { ok: false, message: e.isOperational ? e.message : 'Xəta baş verdi' }); // cavab
      }
    });
  });

  return io; // serveri qaytarır
}

const emitToDuel = (duelId, event, data) => { if (io) io.to(`duel:${duelId}`).emit(event, data); }; // duel otağına göndərir
const emitGlobal = (event, data) => { if (io) io.to('global').emit(event, data); }; // hamıya göndərir
const emitToUser = (userId, event, data) => { if (io) io.to(`user:${userId}`).emit(event, data); }; // bir istifadəçiyə göndərir
const disconnectUser = (userId) => { if (io) io.in(`user:${userId}`).disconnectSockets(true); }; // bloklananın bağlantısını kəsir
const close = () => new Promise((resolve) => { if (io) io.close(() => resolve()); else resolve(); }); // serveri bağlayır

module.exports = { init, emitToDuel, emitGlobal, emitToUser, disconnectUser, close }; // xaricə verir