const express = require('express'); // express
const { z } = require('zod'); // yoxlama
const { validate, objectId } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const {
  getMyProfile, getProfile, search, toggleFollow, myFollowers, myFollowing, myGifts,
} = require('../controllers/userController'); // controller-lər

const router = express.Router(); // router
router.use(protect); // bütün marşrutlar giriş tələb edir

const searchQuery = z.object({ // axtarış parametrləri
  q: z.string().trim().max(30).default('').refine((v) => v.length === 0 || v.length >= 2, 'Ən az 2 simvol'), // boş = hamısı, 1 simvol = xəta, 2+ = axtarış
  type: z.enum(['all', 'users', 'clans']).default('all'), // nəyi axtarırıq
  limit: z.coerce.number().int().min(1).max(30).default(20), // nəticə sayı
});

// ⚠️ "/me..." marşrutları MÜTLƏQ "/:id"-dən əvvəl olmalıdır, yoxsa "me" ID kimi qəbul olunar
router.get('/me', getMyProfile); // profilim
router.get('/me/followers', myFollowers); // məni izləyənlər
router.get('/me/following', myFollowing); // mənim izlədiklərim
router.get('/me/gifts', myGifts); // atdığım hədiyyələr

router.get('/search', validate({ query: searchQuery }), search); // istifadəçi + klan axtarışı

router.get('/:id', validate({ params: z.object({ id: objectId }) }), getProfile); // başqasının profili
router.post('/:id/follow', validate({ params: z.object({ id: objectId }) }), toggleFollow); // izlə/çıx

module.exports = router; // xaricə verir