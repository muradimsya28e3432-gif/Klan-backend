const mongoose = require('mongoose'); // MongoDB modeli yaratmaq üçün

const userSchema = new mongoose.Schema( // istifadəçi sxemi
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 20, match: /^[\p{L}0-9_]+$/u }, // yalnız hərf, rəqəm, alt xətt
    usernameLower: { type: String, required: true, unique: true, index: true }, // kiçik hərfli ad
    passwordHash: { type: String, required: true, select: false }, // şifrə hash-i
    role: { type: String, enum: ['user', 'admin'], default: 'user' }, // rol
    balance: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'Balans tam ədəd (qəpik) olmalıdır' } }, // balans qəpiklə
    totalGifted: { type: Number, default: 0, min: 0 }, // ümumi atılan hədiyyə (qəpik)
    clan: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', default: null }, // klan
    following: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], select: false, default: [] }, // izlədiklərim
    followersCount: { type: Number, default: 0, min: 0 }, // izləyici sayı
    followingCount: { type: Number, default: 0, min: 0 }, // izlədiyim sayı
    // ---------- YENİ: irəliləyiş ----------
    xp: { type: Number, default: 0, min: 0 }, // təcrübə xalı
    level: { type: Number, default: 1, min: 1 }, // səviyyə
    seasonPoints: { type: Number, default: 0, min: 0 }, // mövsüm reytinq xalı (mövsüm bitəndə sıfırlanır)
    duelWins: { type: Number, default: 0, min: 0 }, // qazanılmış duel sayı
    giftCount: { type: Number, default: 0, min: 0 }, // göndərilən hədiyyə sayı
    friendsCount: { type: Number, default: 0, min: 0 }, // dost sayı
    // --------------------------------------
    isBanned: { type: Boolean, default: false }, // bloklanıb?
    lastLoginAt: { type: Date }, // son giriş vaxtı
  },
  { timestamps: true },
);

userSchema.index({ following: 1 }); // "məni kim izləyir" sorğusu
userSchema.index({ seasonPoints: -1 }); // mövsüm liderbordu
userSchema.index({ xp: -1 }); // səviyyə liderbordu
userSchema.index({ totalGifted: -1 }); // hədiyyə liderbordu
userSchema.index({ clan: 1 }); // klan üzvləri

userSchema.pre('validate', function (next) { // yoxlamadan əvvəl
  if (this.username) this.usernameLower = this.username.toLowerCase(); // kiçik hərfli ad
  next();
});

module.exports = mongoose.model('User', userSchema); // modeli verir