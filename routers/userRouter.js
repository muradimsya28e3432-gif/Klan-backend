const express = require('express'); // express
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const { getMyProfile, getProfile, search, toggleFollow } = require('../controllers/userController'); // controller-lər

const router = express.Router(); // router
router.use(protect); // bütün marşrutlar giriş tələb edir

const searchQuery = z.object({ // axtarış parametrləri
  q: z.string().trim().min(2, 'Ən az 2 simvol').max(30), // axtarış sözü
  type: z.enum(['all', 'users', 'clans']).default('all'), // nəyi axtarırıq
  limit: z.coerce.number().int().min(1).max(30).default(20), // nəticə sayı
});

router.get('/me', getMyProfile); // profilim
router.get('/search', validate({ query: searchQuery }), search); // istifadəçi + klan axtarışı (MongoDB-dən canlı)
router.get('/:id', validate({ params: z.object({ id: objectId }) }), getProfile); // başqasının profili
router.post('/:id/follow', validate({ params: z.object({ id: objectId }) }), toggleFollow); // izlə/çıx

module.exports = router; // xaricə verir