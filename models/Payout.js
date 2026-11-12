const mongoose = require('mongoose'); // mongoose

const payoutSchema = new mongoose.Schema( // pul çıxarma sorğusu
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // sorğu verən
    amount: { type: Number, required: true, min: 1 }, // balansdan çıxan məbləğ (qəpik)
    fee: { type: Number, required: true, min: 0 }, // komissiya (qəpik)
    netAmount: { type: Number, required: true, min: 0 }, // kartına keçəcək məbləğ (qəpik)
    cardEnc: { type: String, required: true, select: false }, // şifrələnmiş kart nömrəsi (adətən gizli)
    cardLast4: { type: String, required: true, match: /^\d{4}$/ }, // son 4 rəqəm
    cardBrand: { type: String, maxlength: 20 }, // kart növü
    status: { type: String, enum: ['pending', 'paid', 'rejected'], default: 'pending', index: true }, // vəziyyət
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // baxan admin
    reviewedAt: { type: Date }, // baxılma vaxtı
    note: { type: String, maxlength: 200 }, // admin qeydi / ret səbəbi
    providerRef: { type: String, maxlength: 100 }, // köçürmə referansı
  },
  { timestamps: true }, // tarixlər
);

module.exports = mongoose.model('Payout', payoutSchema); // modeli verir