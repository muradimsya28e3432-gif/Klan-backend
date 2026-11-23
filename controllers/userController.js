const User = require('../models/User'); // istifadəçi
const Clan = require('../models/Clan'); // klan
const Transaction = require('../models/Transaction'); // əməliyyatlar (hədiyyələr üçün)
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // axtarışdakı xüsusi simvolları zərərsiz edir (ReDoS/injection qarşısı)

const publicProfile = (u) => ({ // başqasına göstərilən təhlükəsiz profil
  id: u._id, username: u.username, clan: u.clan && u.clan.name ? { id: u.clan._id, name: u.clan.name } : null, // ad və klan
  followersCount: u.followersCount, followingCount: u.followingCount, totalGifted: u.totalGifted, // statistikalar
});

const LIST_LIMIT = 100; // siyahılarda maksimum nəticə

const getMyProfile = asyncHandler(async (req, res) => { // profilim
  const user = await User.findById(req.user._id).populate('clan', 'name'); // klanla birlikdə
  res.json({ success: true, data: { ...publicProfile(user), balance: user.balance, role: user.role } }); // balans yalnız özümə
});

const getProfile = asyncHandler(async (req, res) => { // başqasının profili
  const user = await User.findOne({ _id: req.params.id, isBanned: false }).populate('clan', 'name'); // tap
  if (!user) throw new ApiError(404, 'İstifadəçi tapılmadı'); // yoxdur
  res.json({ success: true, data: publicProfile(user) }); // cavab
});

const search = asyncHandler(async (req, res) => { // istifadəçi və klan axtarışı (hər sorğuda birbaşa MongoDB-dən)
  const { q, type, limit } = req.valid.query; // parametrlər
  const term = (q || '').toLowerCase().replace(/\s+/g, ' ').trim(); // kiçik hərf + artıq boşluqlar (nameLower ilə eyni qayda)
  const hasTerm = term.length > 0; // axtarış sözü varmı? (yoxdursa hamısı qaytarılır)
  const rx = hasTerm ? new RegExp(escapeRegex(term)) : null; // təhlükəsiz regex (içində olanları tapır)
  const fetchSize = limit * 2; // sıralamadan sonra kəsmək üçün bir az artıq çəkirik
  const rank = (lower) => (hasTerm && lower.startsWith(term) ? 0 : 1); // axtarılanla başlayanlar əvvəldə (boş axtarışda hamısı bərabər)

  const wantUsers = type === 'all' || type === 'users'; // istifadəçilər istənilir?
  const wantClans = type === 'all' || type === 'clans'; // klanlar istənilir?

  const userFilter = { isBanned: false, _id: { $ne: req.user._id }, ...(hasTerm ? { usernameLower: rx } : {}) }; // özüm və bloklananlar xaric; söz varsa uyğunluq
  const clanFilter = hasTerm ? { nameLower: rx } : {}; // söz yoxdursa bütün klanlar

  const [users, clans, me] = await Promise.all([ // paralel sorğular
    wantUsers
      ? User.find(userFilter) // users kolleksiyasından
        .select('username usernameLower clan followersCount followingCount totalGifted')
        .sort(hasTerm ? {} : { followersCount: -1, createdAt: -1 }) // boş axtarışda ən populyarlar əvvəl gəlsin
        .limit(fetchSize).populate('clan', 'name').lean()
      : [],
    wantClans
      ? Clan.find(clanFilter) // clans kolleksiyasından
        .select('name nameLower memberCount leader')
        .sort(hasTerm ? {} : { memberCount: -1, createdAt: -1 }) // boş axtarışda ən böyük klanlar əvvəl
        .limit(fetchSize).populate('leader', 'username').lean()
      : [],
    wantUsers ? User.findById(req.user._id).select('following').lean() : null, // izlədiklərim
  ]);

  const followingSet = new Set(((me && me.following) || []).map(String)); // sürətli yoxlama üçün
  const myClan = req.user.clan ? String(req.user.clan) : null; // mənim klanım

  const userList = users
    .sort((a, b) => rank(a.usernameLower) - rank(b.usernameLower) || b.followersCount - a.followersCount) // əvvəl uyğunluq, sonra populyarlıq
    .slice(0, limit)
    .map((u) => ({ ...publicProfile(u), followed: followingSet.has(String(u._id)) })); // izləmə vəziyyəti ilə

  const clanList = clans
    .sort((a, b) => rank(a.nameLower) - rank(b.nameLower) || b.memberCount - a.memberCount) // əvvəl uyğunluq, sonra üzv sayı
    .slice(0, limit)
    .map((c) => ({
      id: c._id, name: c.name, memberCount: c.memberCount, // əsas məlumat
      leader: c.leader && c.leader.username ? c.leader.username : null, // lider adı
      joined: myClan === String(c._id), // mən bu klandayam?
    }));

  res.json({ success: true, data: { users: userList, clans: clanList } }); // cavab
});

const toggleFollow = asyncHandler(async (req, res) => { // izlə / izləmədən çıx
  const me = req.user._id; // mən
  const targetId = req.params.id; // hədəf
  if (String(me) === targetId) throw new ApiError(400, 'Özünüzü izləyə bilməzsiniz'); // özünü izləmə
  if (!(await User.exists({ _id: targetId, isBanned: false }))) throw new ApiError(404, 'İstifadəçi tapılmadı'); // hədəf varmı
  const added = await User.updateOne({ _id: me, following: { $ne: targetId } }, { $addToSet: { following: targetId }, $inc: { followingCount: 1 } }); // atomik əlavə
  if (added.modifiedCount === 1) { // yeni izləmədirsə
    await User.updateOne({ _id: targetId }, { $inc: { followersCount: 1 } }); // hədəfin izləyicisini artır
    return res.json({ success: true, data: { followed: true } }); // cavab
  }
  const removed = await User.updateOne({ _id: me, following: targetId }, { $pull: { following: targetId }, $inc: { followingCount: -1 } }); // atomik silmə
  if (removed.modifiedCount === 1) await User.updateOne({ _id: targetId }, { $inc: { followersCount: -1 } }); // izləyicini azalt
  res.json({ success: true, data: { followed: false } }); // cavab
});

// ---------- Profil siyahıları ----------

const listShape = (u) => ({ id: u._id, username: u.username, clan: u.clan && u.clan.name ? { id: u.clan._id, name: u.clan.name } : null }); // siyahı üçün qısa format

const myFollowers = asyncHandler(async (req, res) => { // məni izləyənlər
  const users = await User.find({ following: req.user._id, isBanned: false }) // following massivində mənim ID-m olanlar
    .select('username clan').sort({ createdAt: -1 }).limit(LIST_LIMIT).populate('clan', 'name').lean(); // siyahı
  res.json({ success: true, data: users.map(listShape) }); // cavab
});

const myFollowing = asyncHandler(async (req, res) => { // mənim izlədiklərim
  const me = await User.findById(req.user._id).select('following').lean(); // izlədiyim ID-lər
  const ids = ((me && me.following) || []).slice(-LIST_LIMIT); // sonuncu 100 (massivdə sonra əlavə olunan axırdadır)
  const users = await User.find({ _id: { $in: ids }, isBanned: false }).select('username clan').populate('clan', 'name').lean(); // istifadəçilər
  const order = new Map(ids.map((id, i) => [String(id), i])); // əlavə olunma sırası
  users.sort((a, b) => order.get(String(b._id)) - order.get(String(a._id))); // yenilər əvvəl
  res.json({ success: true, data: users.map(listShape) }); // cavab
});

const myGifts = asyncHandler(async (req, res) => { // atdığım hədiyyələr
  const items = await Transaction.find({ user: req.user._id, type: 'gift' }) // yalnız hədiyyə əməliyyatları
    .sort({ createdAt: -1 }).limit(LIST_LIMIT).populate('duel', 'nameA nameB').lean(); // duel adları ilə
  res.json({
    success: true,
    data: items.map((t) => ({
      id: t._id, giftName: t.giftName, amount: t.amount, createdAt: t.createdAt, // əsas məlumat
      side: t.side || null, // A / B
      sideName: t.duel ? (t.side === 'A' ? t.duel.nameA : t.duel.nameB) : null, // hansı tərəfə (Bakı / Gəncə)
    })),
  }); // cavab
});

module.exports = { getMyProfile, getProfile, search, toggleFollow, myFollowers, myFollowing, myGifts }; // xaricə verir