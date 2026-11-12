const jwt = require('jsonwebtoken'); // JWT yoxlamaq üçün
const env = require('../config/env'); // gizli açar
const User = require('../models/User'); // istifadəçi modeli
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

async function authenticateToken(token) { // tokeni yoxlayıb istifadəçini qaytarır (həm HTTP, həm socket üçün)
  if (!token || typeof token !== 'string') throw new ApiError(401, 'Giriş tələb olunur'); // token yoxdur
  let payload; // məzmun
  try { // yoxlama
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }); // yalnız HS256 qəbul edirik (alqoritm hücumuna qarşı)
  } catch (e) { // etibarsız/vaxtı bitmiş
    throw new ApiError(401, 'Token etibarsızdır və ya vaxtı bitib'); // 401 qaytarır
  }
  const user = await User.findById(payload.sub); // istifadəçini bazadan tapırıq (həmişə təzə məlumat)
  if (!user) throw new ApiError(401, 'İstifadəçi tapılmadı'); // silinibsə
  if (user.isBanned) throw new ApiError(403, 'Hesabınız bloklanıb'); // bloklanıbsa
  return user; // istifadəçi
}

const protect = asyncHandler(async (req, res, next) => { // qorunan marşrutlar üçün middleware
  const [scheme, token] = (req.headers.authorization || '').split(' '); // "Bearer TOKEN" ayırırıq
  if (scheme !== 'Bearer') throw new ApiError(401, 'Giriş tələb olunur'); // format səhvdir
  req.user = await authenticateToken(token); // istifadəçini sorğuya əlavə edirik
  next(); // növbəti mərhələyə keçir
});

module.exports = { protect, authenticateToken }; // xaricə verir