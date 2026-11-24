const express = require('express'); // express
const rateLimit = require('express-rate-limit'); // limit
const { z } = require('zod'); // yoxlama
const { validate } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const c = require('../controllers/clanHubController'); // controller

const router = express.Router();
router.use(protect);

const sendLimiter = rateLimit({ windowMs: 10 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Çox sürətlisiniz' } });

router.get('/chat', validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }) }), c.getChat); // klan çatı
router.post('/chat', sendLimiter, validate({ body: z.object({ text: z.string().min(1).max(300) }).strict() }), c.sendChat); // mesaj göndər
router.get('/members', c.members); // üzvlər
router.get('/stats', c.stats); // statistika

module.exports = router;