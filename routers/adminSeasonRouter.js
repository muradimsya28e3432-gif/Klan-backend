const express = require('express'); // express
const { protect } = require('../middleware/auth'); // token yoxlaması
const requireAdmin = require('../middleware/admin'); // admin yoxlaması
const c = require('../controllers/seasonController'); // controller

const router = express.Router();
router.use(protect, requireAdmin); // yalnız admin

router.get('/', c.list); // mövsümlər
router.post('/end', c.end); // cari mövsümü bitir

module.exports = router;