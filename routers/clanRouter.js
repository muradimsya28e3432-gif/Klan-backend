const express = require('express'); // express
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const { list, getOne, create, join, leave } = require('../controllers/clanController'); // controller-lər

const router = express.Router(); // router
router.use(protect); // giriş tələb olunur

const paging = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }); // səhifələmə
const idParams = z.object({ id: objectId }); // ID parametri

router.get('/', validate({ query: paging }), list); // klanlar siyahısı
router.post('/', validate({ body: z.object({ name: z.string().trim().min(3).max(24).regex(/^[\p{L}0-9_ ]+$/u, 'Yalnız hərf, rəqəm, _ və boşluq') }).strict() }), create); // yarat
router.post('/leave', leave); // çıx (":id"-dən əvvəl olmalıdır)
router.get('/:id', validate({ params: idParams }), getOne); // bir klan
router.post('/:id/join', validate({ params: idParams }), join); // qoşul

module.exports = router; // xaricə verir