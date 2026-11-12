const mongoose = require('mongoose'); // mongoose

const platformAccountSchema = new mongoose.Schema( // platformanın öz hesabı (tək sənəd)
  {
    key: { type: String, default: 'main', unique: true }, // həmişə "main" - yalnız bir hesab olsun
    balance: { type: Number, default: 0, min: 0 }, // çıxarıla bilən qalıq (qəpik)
    totalEarned: { type: Number, default: 0, min: 0 }, // ümumi qazanc
    totalWithdrawn: { type: Number, default: 0, min: 0 }, // ümumi çıxarılan
  },
  { timestamps: true }, // tarixlər
);

module.exports = mongoose.model('PlatformAccount', platformAccountSchema); // modeli verir