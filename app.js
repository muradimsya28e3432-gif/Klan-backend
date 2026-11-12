const http = require('http'); // HTTP server (socket.io üçün lazımdır)
const express = require('express'); // express
const helmet = require('helmet'); // təhlükəsizlik başlıqları
const cors = require('cors'); // CORS
const rateLimit = require('express-rate-limit'); // ümumi limit
const env = require('./config/env'); // konfiqurasiya (səhv olarsa serveri dayandırır)
const { connectDB, disconnectDB } = require('./config/db'); // baza
const { notFound, errorHandler } = require('./middleware/error'); // xəta middleware-ləri
const ApiError = require('./utils/ApiError'); // xəta sinfi
const socket = require('./services/socket'); // socket
const duelService = require('./services/duelService'); // duel

const app = express(); // tətbiq

app.disable('x-powered-by'); // "Express" başlığını gizlət
if (env.TRUST_PROXY) app.set('trust proxy', 1); // proxy arxasında düzgün IP almaq üçün

app.use(helmet()); // təhlükəsizlik başlıqları (XSS, clickjacking və s.)
app.use(cors({ // yalnız icazəli saytlar
  origin: (origin, cb) => { // mənbə yoxlaması
    if (!origin || env.CORS_ORIGINS.includes(origin)) return cb(null, true); // origin yoxdursa (webhook/curl) və ya siyahıdadırsa
    return cb(new ApiError(403, 'CORS: bu ünvana icazə yoxdur')); // rədd
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // icazəli metodlar
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Signature'], // icazəli başlıqlar
}));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Çox sorğu göndərdiniz' } })); // ümumi limit
app.use(express.json({ limit: '10kb', verify: (req, res, buf) => { req.rawBody = buf; } })); // JSON oxu (10KB limit) + webhook imzası üçün xam body

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' })); // sağlamlıq yoxlaması

app.use('/api/auth', require('./routers/authRouter')); // giriş/qeydiyyat
app.use('/api/users', require('./routers/userRouter')); // istifadəçilər
app.use('/api/clans', require('./routers/clanRouter')); // klanlar
app.use('/api/duels', require('./routers/duelRouter')); // duellər
app.use('/api/chat', require('./routers/chatRouter')); // çat
app.use('/api/wallet', require('./routers/walletRouter')); // balans və çıxarış
app.use('/api/payments', require('./routers/paymentRouter')); // ödənişlər
app.use('/api/admin', require('./routers/adminRouter')); // admin

app.use(notFound); // tapılmayan marşrut
app.use(errorHandler); // mərkəzi xəta emalı (həmişə ən sonda)

async function start() { // serveri işə salır
  await connectDB(); // bazaya qoşul
  await duelService.ensureActiveDuel(); // aktiv duel olduğundan əmin ol
  const server = http.createServer(app); // HTTP server
  socket.init(server); // socket-i qoş
  server.listen(env.PORT, () => console.log(`🚀 Server http://localhost:${env.PORT} ünvanında işləyir (${env.NODE_ENV})`)); // dinləməyə başla

  let closing = false; // təkrar bağlanmanın qarşısı
  const shutdown = async (signal) => { // səliqəli dayandırma
    if (closing) return; // artıq bağlanır
    closing = true; // bayraq
    console.log(`\n${signal} alındı, server bağlanır...`); // məlumat
    setTimeout(() => process.exit(1), 10000).unref(); // 10 san-də bağlanmasa məcburi çıx
    await socket.close(); // socket-i bağla
    server.close(async () => { // HTTP-ni bağla
      await disconnectDB(); // bazanı bağla
      process.exit(0); // uğurla çıx
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C
  process.on('SIGTERM', () => shutdown('SIGTERM')); // hosting dayandırması
}

process.on('unhandledRejection', (reason) => console.error('⚠️ Tutulmayan promise xətası:', reason)); // server çökməsin, loga yazılsın
process.on('uncaughtException', (err) => { console.error('💥 Gözlənilməz xəta:', err); process.exit(1); }); // təhlükəsiz vəziyyət itibsə yenidən başlat

if (require.main === module) { // fayl birbaşa işə salınıbsa
  start().catch((err) => { console.error('❌ Server başlamadı:', err.message); process.exit(1); }); // başlat
}

module.exports = { app, start }; // test üçün xaricə verir