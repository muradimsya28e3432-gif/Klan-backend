const mongoose = require('mongoose'); // mongoose

const clanSchema = new mongoose.Schema( // klan sxemi
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 24, match: /^[\p{L}0-9_ ]+$/u }, // klan adı
    nameLower: { type: String, required: true, unique: true, index: true }, // təkrarlanma yoxlaması üçün
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // lider
    memberCount: { type: Number, default: 1, min: 0 }, // üzv sayı
  },
  { timestamps: true }, // tarixlər
);

clanSchema.pre('validate', function (next) { // yoxlamadan əvvəl
  if (this.name) this.nameLower = this.name.toLowerCase().replace(/\s+/g, ' '); // kiçik hərf + artıq boşluqları təmizləmə
  next(); // davam
});

module.exports = mongoose.model('Clan', clanSchema); // modeli verir