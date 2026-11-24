const express = require('express'); // express
const rateLimit = require('express-rate-limit'); // limit
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const { createOrder, stripeWebhook, webhook, devConfirm, myOrders } = require('../controllers/paymentController'); // controller-lər

const router = express.Router(); // router

const orderLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Çox sorğu' } }); // dəqiqədə 5 sifariş
const hookLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }); // webhook üçün limit

// Stripe webhook: token YOXDUR, Stripe imzası ilə qorunur. Body xam Buffer olmalıdır (app.js-də express.raw ilə oxunur), ona görə validate YOXDUR
router.post('/stripe-webhook', hookLimiter, stripeWebhook); // Stripe bildirişi

router.post('/webhook', hookLimiter, validate({ body: z.object({ // köhnə ümumi webhook (HMAC imza ilə qorunur)
  orderId: objectId, status: z.enum(['success', 'failed']), amount: z.number().int().positive(), providerRef: z.string().max(100).optional(), // sahələr
}).strict() }), webhook);

router.post('/orders', protect, orderLimiter, validate({ body: z.object({ amount: z.number().int().positive() }).strict() }), createOrder); // sifariş (qəpiklə)
router.get('/orders', protect, myOrders); // sifarişlərim
router.post('/orders/:id/dev-confirm', protect, validate({ params: z.object({ id: objectId }) }), devConfirm); // test təsdiqi (yalnız dev)

module.exports = router; // xaricə verir