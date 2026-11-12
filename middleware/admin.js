const ApiError = require('../utils/ApiError'); // xəta sinfi

const requireAdmin = (req, res, next) => { // yalnız adminlərə icazə
  if (!req.user || req.user.role !== 'admin') return next(new ApiError(403, 'Bu əməliyyat üçün icazəniz yoxdur')); // admin deyilsə rədd
  next(); // adminsə davam
};

module.exports = requireAdmin; // xaricə verir