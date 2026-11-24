const seasonService = require('../services/seasonService'); // mövsüm
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const end = asyncHandler(async (req, res) => { // mövsümü bitir (admin)
  console.warn(`🏁 AUDIT: admin ${req.user._id} mövsümü bitirdi`); // audit qeydi
  res.json({ success: true, data: await seasonService.endSeason() });
});

const list = asyncHandler(async (req, res) => { // bütün mövsümlər (admin)
  res.json({ success: true, data: await seasonService.listSeasons(50) });
});

module.exports = { end, list };