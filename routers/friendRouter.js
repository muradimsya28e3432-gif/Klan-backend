const express = require('express'); // express
const rateLimit = require('express-rate-limit'); // limit
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const c = require('../controllers/friendController'); // controller

const router = express.Router();
router.use(protect);

const reqLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Çox sorğu' } }); // spam qarşısı

router.get('/', c.list); // dostlarım
router.get('/requests', c.incoming); // gələn istəklər (":userId"-dən əvvəl)
router.post('/requests/:id/accept', validate({ params: z.object({ id: objectId }) }), c.accept); // qəbul
router.post('/requests/:id/reject', validate({ params: z.object({ id: objectId }) }), c.reject); // rədd
router.post('/:userId/request', reqLimiter, validate({ params: z.object({ userId: objectId }) }), c.sendRequest); // istək göndər
router.delete('/:userId', validate({ params: z.object({ userId: objectId }) }), c.remove); // sil / ləğv et

module.exports = router;