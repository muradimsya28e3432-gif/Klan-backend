const mongoose = require('mongoose'); // mongoose

const userAchievementSchema = new mongoose.Schema( // istifadəçinin qazandığı nailiyyət/medal
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // sahibi
    code: { type: String, required: true, maxlength: 60 }, // nailiyyət kodu (medal üçün "medal:<mövsüm>:<yer>")
  },
  { timestamps: true },
);

userAchievementSchema.index({ user: 1, code: 1 }, { unique: true }); // eyni nailiyyət iki dəfə verilməsin

module.exports = mongoose.model('UserAchievement', userAchievementSchema); // modeli verir