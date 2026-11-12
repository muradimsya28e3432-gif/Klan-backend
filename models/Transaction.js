const mongoose = require('mongoose'); // mongoose

const transactionSchema = new mongoose.Schema( // maliyyə əməliyyatları jurnalı
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // kimin əməliyyatı
    type: { type: String, enum: ['topup', 'gift', 'refund', 'duel_win', 'payout', 'payout_refund'], required: true }, // növ
    direction: { type: String, enum: ['in', 'out'], required: true }, // pul gəldi (in) / getdi (out)
    amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: 'Məbləğ tam ədəd olmalıdır' } }, // qəpik
    duel: { type: mongoose.Schema.Types.ObjectId, ref: 'Duel' }, // əlaqəli duel
    side: { type: String, enum: ['A', 'B'] }, // hansı tərəfə
    giftName: { type: String, maxlength: 60 }, // hədiyyə adı
    refId: { type: String, maxlength: 64 }, // əlaqəli sifariş/çıxarış ID
    key: { type: String, maxlength: 120, unique: true, sparse: true }, // təkrar əməliyyatın qarşısı (idempotency açarı)
  },
  { timestamps: true }, // tarixlər
);

transactionSchema.index({ user: 1, createdAt: -1 }); // istifadəçi tarixçəsi sürətli olsun
transactionSchema.index({ duel: 1, type: 1 }); // duel hesablaması sürətli olsun

module.exports = mongoose.model('Transaction', transactionSchema); // modeli verir