const express = require('express'); // express
const rateLimit = require('express-rate-limit'); // limit
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const { getGlobal, getPrivate, send } = require('../controllers/chatController'); // controller-lər

const router = express.Router(); // router
router.use(protect); // giriş tələb olunur

const sendLimiter = rateLimit({ windowMs: 10 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Çox sürətlisiniz' } }); // 10 san-də 6 mesaj
const limitQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }); // limit

router.get('/global', validate({ query: limitQuery }), getGlobal); // ümumi çat
router.get('/private/:userId', validate({ params: z.object({ userId: objectId }), query: limitQuery }), getPrivate); // şəxsi çat
router.post('/', sendLimiter, validate({ body: z.object({ text: z.string().min(1).max(300), to: objectId.optional() }).strict() }), send); // mesaj göndər

module.exports = router; // xaricə verir