const mongoose = require('mongoose'); // mongoose

const clanSchema = new mongoose.Schema( // klan sxemi
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 24, match: /^[\p{L}0-9_ ]+$/u }, // klan adı
    nameLower: { type: String, required: true, unique: true, index: true }, // təkrarlanma yoxlaması
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // lider
    memberCount: { type: Number, default: 1, min: 0 }, // üzv sayı
    points: { type: Number, default: 0, min: 0 }, // mövsüm xalı (üzvlərin hədiyyələrindən)
    totalPoints: { type: Number, default: 0, min: 0 }, // bütün zamanların xalı
  },
  { timestamps: true },
);

clanSchema.index({ points: -1 }); // klan liderbordu

clanSchema.pre('validate', function (next) { // yoxlamadan əvvəl
  if (this.name) this.nameLower = this.name.toLowerCase().replace(/\s+/g, ' '); // təmizləmə
  next();
});

module.exports = mongoose.model('Clan', clanSchema); // modeli verir