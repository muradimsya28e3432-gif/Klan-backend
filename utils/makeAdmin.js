// İstifadə: node utils/makeAdmin.js istifadeci_adi
require('../config/env'); // konfiqurasiyanı yoxlayır və yükləyir
const { connectDB, disconnectDB } = require('../config/db'); // baza funksiyaları
const User = require('../models/User'); // istifadəçi modeli

(async () => { // dərhal işləyən async funksiya
  const username = (process.argv[2] || '').trim().toLowerCase(); // komanda sətrindən ad alırıq
  if (!username) { // ad verilməyibsə
    console.error('İstifadə: node utils/makeAdmin.js istifadeci_adi'); // təlimat
    process.exit(1); // çıxırıq
  }
  try { // xətaları tutmaq üçün
    await connectDB(); // bazaya qoşuluruq
    const user = await User.findOneAndUpdate({ usernameLower: username }, { $set: { role: 'admin' } }, { new: true }); // rolu admin edirik
    if (!user) { // istifadəçi yoxdursa
      console.error(`❌ "${username}" tapılmadı. Əvvəl qeydiyyatdan keçin.`); // xəbər veririk
      process.exitCode = 1; // xəta kodu ilə bitir
    } else { // tapıldısa
      console.log(`✅ ${user.username} indi admindir.`); // uğur mesajı
    }
  } catch (err) { // gözlənilməz xəta
    console.error('❌ Xəta:', err.message); // yazırıq
    process.exitCode = 1; // xəta kodu
  } finally { // hər halda
    await disconnectDB(); // bazanı bağlayırıq ki, proses ilişib qalmasın
  }
})();