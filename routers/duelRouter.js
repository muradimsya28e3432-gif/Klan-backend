const express = require('express'); // express
const rateLimit = require('express-rate-limit'); // limit
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const { current, getOne, history, gifts, gift } = require('../controllers/duelController'); // controller-lər

const router = express.Router(); // router
router.use(protect); // giriş tələb olunur

const giftLimiter = rateLimit({ windowMs: 10 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Çox sürətlisiniz' } }); // 10 san-də 10 hədiyyə

router.get('/current', current); // aktiv duel
router.get('/gifts', gifts); // hədiyyə kataloqu
router.get('/history', validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }) }), history); // tarixçə
router.get('/:id', validate({ params: z.object({ id: objectId }) }), getOne); // bir duel
router.post('/:id/gift', giftLimiter, validate({ // hədiyyə göndər
  params: z.object({ id: objectId }), // duel ID
  body: z.object({ side: z.enum(['A', 'B']), category: z.number().int().min(0).max(9), sub: z.number().int().min(0).max(9) }).strict(), // yalnız bu sahələr
}), gift);

module.exports = router; // xaricə verir