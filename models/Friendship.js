const mongoose = require('mongoose'); // mongoose

const friendshipSchema = new mongoose.Schema( // dostluq münasibəti
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // istək göndərən
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // istək alan
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' }, // vəziyyət (rədd = sənəd silinir)
    pairKey: { type: String, required: true, unique: true }, // iki ID sıralanıb birləşir: A-B və B-A eyni sayılır
  },
  { timestamps: true },
);

friendshipSchema.index({ recipient: 1, status: 1 }); // gələn istəklər
friendshipSchema.index({ requester: 1, status: 1 }); // dost siyahısı

friendshipSchema.statics.makeKey = (a, b) => [String(a), String(b)].sort().join(':'); // pair açarı

module.exports = mongoose.model('Friendship', friendshipSchema); // modeli verir