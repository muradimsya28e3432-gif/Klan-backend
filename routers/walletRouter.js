const express = require('express'); // express
const { z } = require('zod'); // yoxlama
const { validate } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const rateLimit = require('express-rate-limit'); // limit
const { balance, history } = require('../controllers/walletController'); // controller-lər
const payout = require('../controllers/payoutController'); // pul çıxarma controller-i

const router = express.Router(); // router
router.use(protect); // giriş tələb olunur

router.get('/balance', balance); // balansım
router.get('/history', validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }) }), history); // tarixçə

const payoutLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Saatda ən çox 5 çıxarış sorğusu' } }); // saatda 5 sorğu

router.get('/payouts', payout.mine); // çıxarış sorğularım
router.post('/payouts', payoutLimiter, validate({ body: z.object({ amount: z.number().int().positive(), cardNumber: z.string().min(16).max(23) }).strict() }), payout.request); // çıxarış sorğusu

module.exports = router; // xaricə verir