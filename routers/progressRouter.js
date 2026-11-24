const express = require('express'); // express
const { z } = require('zod'); // yoxlama
const { validate } = require('../middleware/validate'); // validasiya
const { protect } = require('../middleware/auth'); // token yoxlaması
const c = require('../controllers/progressController'); // controller

const router = express.Router();
router.use(protect);

const limit = z.coerce.number().int().min(1).max(100).default(20);

router.get('/me', c.myProgress); // XP, səviyyə, yerim
router.get('/achievements', c.achievements); // nailiyyət + medal
router.get('/season', c.season); // mövsüm məlumatı
router.get('/leaderboard/users', validate({ query: z.object({ by: z.enum(['season', 'level', 'gifted']).default('season'), limit }) }), c.leaderboardUsers); // oyunçu reytinqi
router.get('/leaderboard/clans', validate({ query: z.object({ limit }) }), c.leaderboardClans); // klan reytinqi

module.exports = router;