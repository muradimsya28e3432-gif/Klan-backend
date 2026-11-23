const User = require('../models/User'); // istifadəçi
const Clan = require('../models/Clan'); // klan
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // axtarışdakı xüsusi simvolları zərərsiz edir (ReDoS/injection qarşısı)

const publicProfile = (u) => ({ // başqasına göstərilən təhlükəsiz profil
  id: u._id, username: u.username, clan: u.clan && u.clan.name ? { id: u.clan._id, name: u.clan.name } : null, // ad və klan
  followersCount: u.followersCount, followingCount: u.followingCount, totalGifted: u.totalGifted, // statistikalar
});

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
  const term = q.toLowerCase().replace(/\s+/g, ' ').trim(); // kiçik hərf + artıq boşluqlar (nameLower ilə eyni qayda)
  const rx = new RegExp(escapeRegex(term)); // təhlükəsiz regex (içində olanları tapır)
  const fetchSize = limit * 2; // sıralamadan sonra kəsmək üçün bir az artıq çəkirik
  const rank = (lower) => (lower.startsWith(term) ? 0 : 1); // axtarılanla başlayanlar əvvəldə

  const wantUsers = type === 'all' || type === 'users'; // istifadəçilər istənilir?
  const wantClans = type === 'all' || type === 'clans'; // klanlar istənilir?

  const [users, clans, me] = await Promise.all([ // paralel sorğular
    wantUsers
      ? User.find({ usernameLower: rx, isBanned: false, _id: { $ne: req.user._id } }) // users kolleksiyasından (özüm və bloklananlar xaric)
        .select('username usernameLower clan followersCount followingCount totalGifted')
        .limit(fetchSize).populate('clan', 'name').lean()
      : [],
    wantClans
      ? Clan.find({ nameLower: rx }) // clans kolleksiyasından
        .select('name nameLower memberCount leader')
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

module.exports = { getMyProfile, getProfile, search, toggleFollow }; // xaricə verir