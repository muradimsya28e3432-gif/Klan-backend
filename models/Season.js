const mongoose = require('mongoose'); // mongoose

const seasonSchema = new mongoose.Schema( // mövsüm
  {
    number: { type: Number, required: true, unique: true }, // mövsüm nömrəsi
    status: { type: String, enum: ['active', 'ended'], default: 'active', index: true }, // vəziyyət
    startedAt: { type: Date, default: Date.now }, // başlama
    endedAt: { type: Date }, // bitmə
    winners: [{ _id: false, place: Number, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, username: String, points: Number }], // ilk 3 oyunçu
    topClan: { _id: false, clan: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan' }, name: String, points: Number }, // qalib klan
  },
  { timestamps: true },
);

module.exports = mongoose.model('Season', seasonSchema); // modeli verir