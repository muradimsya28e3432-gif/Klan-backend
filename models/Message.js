const mongoose = require('mongoose'); // mongoose
const ApiError = require('../utils/ApiError'); // xəta sinfi

const messageSchema = new mongoose.Schema( // çat mesajı sxemi
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // göndərən
    senderName: { type: String, required: true, maxlength: 20 }, // göndərənin adı (sorğu azaltmaq üçün)
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // alıcı (ümumi çatda null)
    type: { type: String, enum: ['global', 'private'], required: true }, // çat növü
    text: { type: String, required: true, maxlength: 300 }, // mətn
  },
  { timestamps: true }, // tarixlər
);

messageSchema.index({ type: 1, createdAt: -1 }); // ümumi çat sürətli oxunsun
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 }); // şəxsi çat sürətli oxunsun

messageSchema.statics.toDTO = function (m) { // mesajı frontend üçün təmiz formata salır
  return { id: m._id, sender: m.sender, senderName: m.senderName, recipient: m.recipient, type: m.type, text: m.text, createdAt: m.createdAt }; // yalnız lazımi sahələr
};

messageSchema.statics.post = async function ({ sender, senderName, recipient = null, text }) { // mesajı yoxlayıb yazır
  const clean = String(text == null ? '' : text).replace(/[\u0000-\u001F\u007F]/g, ' ').trim(); // idarəedici simvolları təmizləyir
  if (!clean || clean.length > 300) throw new ApiError(400, 'Mesaj 1-300 simvol olmalıdır'); // uzunluq yoxlaması
  const doc = await this.create({ sender, senderName, recipient, type: recipient ? 'private' : 'global', text: clean }); // bazaya yazır
  return this.toDTO(doc); // təmiz nəticə
};

module.exports = mongoose.model('Message', messageSchema); // modeli verir