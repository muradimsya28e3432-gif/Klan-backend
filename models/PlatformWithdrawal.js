const mongoose = require('mongoose'); // mongoose

const platformWithdrawalSchema = new mongoose.Schema( // platforma gəlirinin çıxarılması jurnalı
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // çıxaran admin
    amount: { type: Number, required: true, min: 1 }, // məbləğ (qəpik)
    note: { type: String, maxlength: 200 }, // qeyd
  },
  { timestamps: true }, // tarixlər
);

module.exports = mongoose.model('PlatformWithdrawal', platformWithdrawalSchema); // modeli verir