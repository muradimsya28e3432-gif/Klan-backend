const bcrypt = require('bcryptjs'); // şifrə hash-ləmək üçün
const jwt = require('jsonwebtoken'); // token yaratmaq üçün
const env = require('../config/env'); // konfiqurasiya
const User = require('../models/User'); // istifadəçi modeli
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12); // olmayan istifadəçidə də eyni vaxt sərf etmək üçün saxta hash

const signToken = (user) => jwt.sign({ sub: String(user._id) }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN }); // token yaradır

const publicUser = (u) => ({ id: u._id, username: u.username, role: u.role, balance: u.balance, clan: u.clan || null }); // açıq istifadəçi məlumatı

const register = asyncHandler(async (req, res) => { // qeydiyyat
  const { username, password } = req.body; // yoxlanmış məlumat
  const passwordHash = await bcrypt.hash(password, 12); // şifrəni hash-lə (12 raund)
  let user; // istifadəçi
  try { // yaratmağa çalış
    user = await User.create({ username, passwordHash }); // bazaya yaz
  } catch (e) { // xəta
    if (e.code === 11000) throw new ApiError(409, 'Bu istifadəçi adı artıq mövcuddur'); // təkrar ad
    throw e; // başqa xəta
  }
  res.status(201).json({ success: true, data: { token: signToken(user), user: publicUser(user) } }); // cavab
});

const login = asyncHandler(async (req, res) => { // giriş
  const { username, password } = req.body; // məlumat
  const user = await User.findOne({ usernameLower: username.toLowerCase() }).select('+passwordHash'); // istifadəçini tap
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH); // həmişə müqayisə et (vaxt hücumuna qarşı)
  if (!user || !ok) throw new ApiError(401, 'İstifadəçi adı və ya şifrə yanlışdır'); // eyni mesaj: hansının səhv olduğunu açmır
  if (user.isBanned) throw new ApiError(403, 'Hesabınız bloklanıb'); // blok yoxlaması
  user.lastLoginAt = new Date(); // son giriş vaxtı
  await user.save(); // saxla
  res.json({ success: true, data: { token: signToken(user), user: publicUser(user) } }); // cavab
});

const me = asyncHandler(async (req, res) => { // öz məlumatım
  res.json({ success: true, data: { user: publicUser(req.user) } }); // cavab
});

module.exports = { register, login, me, publicUser }; // xaricə verir