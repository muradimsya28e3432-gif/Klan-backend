const express = require('express'); // express
const { protect } = require('../middleware/auth'); // token yoxlaması
const { getHome } = require('../controllers/homeController'); // controller

const router = express.Router(); // router
router.use(protect); // giriş tələb olunur

router.get('/', getHome); // Ana səhifə məlumatları

module.exports = router; // xaricə verir