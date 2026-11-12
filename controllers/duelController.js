const duelService = require('../services/duelService'); // duel məntiqi
const { listGifts } = require('../utils/gifts'); // hədiyyə siyahısı
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const current = asyncHandler(async (req, res) => { // aktiv duel
  const duel = await duelService.getActiveDuel(); // tap
  if (!duel) throw new ApiError(404, 'Hazırda aktiv duel yoxdur'); // yoxdur
  res.json({ success: true, data: duelService.toDTO(duel) }); // cavab
});

const getOne = asyncHandler(async (req, res) => { // ID ilə duel
  const duel = await duelService.findById(req.params.id); // tap
  res.json({ success: true, data: duelService.toDTO(duel) }); // cavab
});

const history = asyncHandler(async (req, res) => { // bitmiş duellər
  const { page, limit } = req.valid.query; // səhifələmə
  res.json({ success: true, data: await duelService.history(page, limit) }); // cavab
});

const gifts = asyncHandler(async (req, res) => { // hədiyyə kataloqu
  res.json({ success: true, data: listGifts() }); // cavab
});

const gift = asyncHandler(async (req, res) => { // hədiyyə göndər
  const { side, category, sub } = req.body; // yoxlanmış məlumat
  const result = await duelService.sendGift({ userId: req.user._id, duelId: req.params.id, side, category, sub }); // göndər
  res.json({ success: true, data: result }); // cavab
});

module.exports = { current, getOne, history, gifts, gift }; // xaricə verir