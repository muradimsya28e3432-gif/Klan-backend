const express = require('express'); // express
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const requireAdmin = require('../middleware/admin'); // admin yoxlaması
const c = require('../controllers/adminController'); // controller-lər

const router = express.Router(); // router
router.use(protect, requireAdmin); // bütün marşrutlar yalnız admin üçündür

const idParams = z.object({ id: objectId }); // ID
const paging = { page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }; // səhifələmə

router.get('/stats', c.stats); // statistika
router.get('/users', validate({ query: z.object({ ...paging, q: z.string().trim().max(30).optional() }) }), c.listUsers); // istifadəçilər
router.post('/users/:id/ban', validate({ params: idParams }), c.ban); // blokla
router.post('/users/:id/unban', validate({ params: idParams }), c.unban); // blokdan çıxar

router.post('/duels', validate({ body: z.object({ nameA: z.string().trim().min(2).max(30), nameB: z.string().trim().min(2).max(30) }).strict() }), c.createDuel); // yeni duel
router.post('/duels/:id/finish', validate({ params: idParams }), c.finishDuel); // duelı bitir

router.get('/payouts', validate({ query: z.object({ ...paging, status: z.enum(['pending', 'paid', 'rejected']).optional() }) }), c.listPayouts); // sorğular
router.get('/payouts/:id/card', validate({ params: idParams }), c.revealPayoutCard); // tam kart (audit olunur)
router.post('/payouts/:id/approve', validate({ params: idParams, body: z.object({ providerRef: z.string().max(100).optional() }).strict() }), c.approvePayout); // təsdiq
router.post('/payouts/:id/reject', validate({ params: idParams, body: z.object({ note: z.string().max(200).optional() }).strict() }), c.rejectPayout); // rədd

router.post('/platform/withdraw', validate({ body: z.object({ amount: z.number().int().positive(), note: z.string().max(200).optional() }).strict() }), c.platformWithdraw); // gəlir çıxar
router.get('/platform/withdrawals', validate({ query: z.object(paging) }), c.platformWithdrawals); // çıxarış tarixçəsi

module.exports = router; // xaricə verir