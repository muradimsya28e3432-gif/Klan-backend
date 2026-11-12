const payoutService = require('../services/payoutService'); // çıxarış məntiqi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const request = asyncHandler(async (req, res) => { // pul çıxarma sorğusu
  const data = await payoutService.requestPayout(req.user._id, req.body.amount, req.body.cardNumber); // yarat
  res.status(201).json({ success: true, data }); // cavab (kart yalnız maskalı)
});

const mine = asyncHandler(async (req, res) => { // sorğularım
  res.json({ success: true, data: await payoutService.listForUser(req.user._id) }); // cavab
});

module.exports = { request, mine }; // xaricə verir