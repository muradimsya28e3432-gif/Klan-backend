const mongoose = require('mongoose'); // mongoose

const paymentOrderSchema = new mongoose.Schema( // balans artırma sifarişi
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // sahibi
    amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: 'Məbləğ tam ədəd olmalıdır' } }, // qəpik
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending', index: true }, // vəziyyət
    provider: { type: String, default: 'card', maxlength: 30 }, // ödəniş üsulu
    providerRef: { type: String, maxlength: 100, index: true }, // provayderin əməliyyat nömrəsi
    paidAt: { type: Date }, // ödəniş vaxtı
  },
  { timestamps: true }, // tarixlər
);

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema); // modeli verir