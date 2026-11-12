const express = require('express'); // express
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const { getMyProfile, getProfile, search, toggleFollow } = require('../controllers/userController'); // controller-lər

const router = express.Router(); // router
router.use(protect); // bütün marşrutlar giriş tələb edir

router.get('/me', getMyProfile); // profilim
router.get('/search', validate({ query: z.object({ q: z.string().trim().min(2, 'Ən az 2 simvol').max(30) }) }), search); // axtarış
router.get('/:id', validate({ params: z.object({ id: objectId }) }), getProfile); // başqasının profili
router.post('/:id/follow', validate({ params: z.object({ id: objectId }) }), toggleFollow); // izlə/çıx

module.exports = router; // xaricə verir