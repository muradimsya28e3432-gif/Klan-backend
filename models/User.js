const mongoose = require('mongoose'); // MongoDB modeli yaratmaq üçün

const userSchema = new mongoose.Schema( // istifadəçi sxemi
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 20, match: /^[\p{L}0-9_]+$/u }, // yalnız hərf, rəqəm, alt xətt
    usernameLower: { type: String, required: true, unique: true, index: true }, // kiçik hərfli ad: təkrarlanmanın qarşısı
    passwordHash: { type: String, required: true, select: false }, // şifrə hash-i, sorğularda gizlidir
    role: { type: String, enum: ['user', 'admin'], default: 'user' }, // rol
    balance: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'Balans tam ədəd (qəpik) olmalıdır' } }, // balans qəpiklə
    totalGifted: { type: Number, default: 0, min: 0 }, // ümumi atılan hədiyyə (qəpik)
    clan: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', default: null }, // klan (yoxdursa null)
    following: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], select: false, default: [] }, // izlədiklərim, adətən gizli
    followersCount: { type: Number, default: 0, min: 0 }, // izləyici sayı
    followingCount: { type: Number, default: 0, min: 0 }, // izlədiyim sayı
    isBanned: { type: Boolean, default: false }, // bloklanıb?
    lastLoginAt: { type: Date }, // son giriş vaxtı
  },
  { timestamps: true }, // createdAt, updatedAt avtomatik
);

userSchema.pre('validate', function (next) { // yoxlamadan əvvəl işləyir
  if (this.username) this.usernameLower = this.username.toLowerCase(); // kiçik hərfli adı avtomatik yazır
  next(); // davam edir
});

module.exports = mongoose.model('User', userSchema); // modeli verir