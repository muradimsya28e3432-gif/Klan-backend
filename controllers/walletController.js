const User = require('../models/User'); // istifadəçi
const walletService = require('../services/walletService'); // pul əməliyyatları
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const balance = asyncHandler(async (req, res) => { // balansım
  const user = await User.findById(req.user._id).select('balance totalGifted'); // təzə məlumat
  res.json({ success: true, data: { balance: user.balance, totalGifted: user.totalGifted } }); // qəpiklə
});

const history = asyncHandler(async (req, res) => { // əməliyyat tarixçəm
  const { page, limit } = req.valid.query; // səhifələmə
  res.json({ success: true, data: await walletService.getHistory(req.user._id, page, limit) }); // cavab
});

module.exports = { balance, history }; // xaricə verir