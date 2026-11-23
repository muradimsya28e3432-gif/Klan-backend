const mongoose = require('mongoose'); // mongoose

const clanRequestSchema = new mongoose.Schema( // klana qoşulma istəyi
  {
    clan: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', required: true }, // hansı klan
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // istək göndərən
    username: { type: String, required: true, maxlength: 20 }, // göndərənin adı (sorğu azaltmaq üçün)
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending', index: true }, // vəziyyət
  },
  { timestamps: true }, // tarixlər
);

// eyni oyunçu eyni klana eyni anda yalnız 1 gözləyən istək göndərə bilər
clanRequestSchema.index({ clan: 1, user: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

module.exports = mongoose.model('ClanRequest', clanRequestSchema); // modeli verir