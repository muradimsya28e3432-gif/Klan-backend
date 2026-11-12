const mongoose = require('mongoose'); // mongoose

const duelSchema = new mongoose.Schema( // duel sxemi
  {
    nameA: { type: String, required: true, trim: true, maxlength: 30 }, // A tərəfin adı (məs: Bakı)
    nameB: { type: String, required: true, trim: true, maxlength: 30 }, // B tərəfin adı (məs: Gəncə)
    scoreA: { type: Number, default: 0, min: 0 }, // A tərəfin xalı (qəpik)
    scoreB: { type: Number, default: 0, min: 0 }, // B tərəfin xalı (qəpik)
    status: { type: String, enum: ['active', 'settling', 'finished'], default: 'active', index: true }, // vəziyyət
    winner: { type: String, enum: ['A', 'B', 'draw', null], default: null }, // qalib
    commission: { type: Number, default: 0, min: 0 }, // platforma komissiyası (qəpik)
    revenueBooked: { type: Boolean, default: false }, // gəlir hesaba yazılıb? (ikiqat yazılmanın qarşısı)
    finishedAt: { type: Date }, // bitmə vaxtı
  },
  { timestamps: true }, // tarixlər
);

duelSchema.virtual('pool').get(function () { // ümumi fond virtual sahəsi
  return this.scoreA + this.scoreB; // iki tərəfin cəmi
});

module.exports = mongoose.model('Duel', duelSchema); // modeli verir