const mongoose = require('mongoose'); // mongoose
const ApiError = require('../utils/ApiError'); // xəta sinfi

const messageSchema = new mongoose.Schema( // çat mesajı sxemi
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // göndərən
    senderName: { type: String, required: true, maxlength: 20 }, // göndərənin adı
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // alıcı (şəxsi çat)
    clan: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', default: null }, // YENİ: klan çatı üçün
    type: { type: String, enum: ['global', 'private', 'clan'], required: true }, // çat növü
    text: { type: String, required: true, maxlength: 300 }, // mətn
  },
  { timestamps: true },
);

messageSchema.index({ type: 1, createdAt: -1 }); // ümumi çat
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 }); // şəxsi çat
messageSchema.index({ clan: 1, createdAt: -1 }); // klan çatı

messageSchema.statics.toDTO = function (m) { // frontend formatı
  return { id: m._id, sender: m.sender, senderName: m.senderName, recipient: m.recipient, clan: m.clan, type: m.type, text: m.text, createdAt: m.createdAt };
};

messageSchema.statics.post = async function ({ sender, senderName, recipient = null, clan = null, text }) { // yoxlayıb yazır
  const clean = String(text == null ? '' : text).replace(/[\u0000-\u001F\u007F]/g, ' ').trim(); // idarəedici simvolları təmizləyir
  if (!clean || clean.length > 300) throw new ApiError(400, 'Mesaj 1-300 simvol olmalıdır'); // uzunluq
  const type = clan ? 'clan' : recipient ? 'private' : 'global'; // növü təyin et
  const doc = await this.create({ sender, senderName, recipient, clan, type, text: clean }); // yaz
  return this.toDTO(doc);
};

module.exports = mongoose.model('Message', messageSchema); // modeli verir