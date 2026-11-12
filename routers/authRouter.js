const express = require('express'); // express
const rateLimit = require('express-rate-limit'); // sorğu limiti
const { z } = require('zod'); // yoxlama
const { validate } = require('../middleware/validate'); // validasiya middleware
const { protect } = require('../middleware/auth'); // token yoxlaması
const { register, login, me } = require('../controllers/authController'); // controller-lər

const router = express.Router(); // router

const authLimiter = rateLimit({ // brute-force-a qarşı: 15 dəqiqədə 20 cəhd
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, // parametrlər
  message: { success: false, message: 'Çox cəhd etdiniz, bir az sonra yenidən yoxlayın' }, // mesaj
});

const username = z.string().trim().min(3, 'Ad ən az 3 simvol').max(20, 'Ad ən çox 20 simvol').regex(/^[\p{L}0-9_]+$/u, 'Yalnız hərf, rəqəm və _'); // ad qaydası
const password = z.string().min(8, 'Şifrə ən az 8 simvol').max(72, 'Şifrə ən çox 72 simvol'); // şifrə qaydası (bcrypt limiti 72)

router.post('/register', authLimiter, validate({ body: z.object({ username, password }).strict() }), register); // qeydiyyat
router.post('/login', authLimiter, validate({ body: z.object({ username, password }).strict() }), login); // giriş
router.get('/me', protect, me); // mənim məlumatım

module.exports = router; // xaricə verir