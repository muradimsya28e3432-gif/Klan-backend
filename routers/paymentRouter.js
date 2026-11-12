const express = require('express'); // express
const rateLimit = require('express-rate-limit'); // limit
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const { createOrder, webhook, devConfirm, myOrders } = require('../controllers/paymentController'); // controller-lər

const router = express.Router(); // router

const orderLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Çox sorğu' } }); // dəqiqədə 5 sifariş
const hookLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }); // webhook üçün limit

router.post('/webhook', hookLimiter, validate({ body: z.object({ // token YOXDUR: provayder çağırır, imza ilə qorunur
  orderId: objectId, status: z.enum(['success', 'failed']), amount: z.number().int().positive(), providerRef: z.string().max(100).optional(), // sahələr
}).strict() }), webhook);

router.post('/orders', protect, orderLimiter, validate({ body: z.object({ amount: z.number().int().positive() }).strict() }), createOrder); // sifariş (qəpiklə)
router.get('/orders', protect, myOrders); // sifarişlərim
router.post('/orders/:id/dev-confirm', protect, validate({ params: z.object({ id: objectId }) }), devConfirm); // test təsdiqi (yalnız dev)

module.exports = router; // xaricə verir