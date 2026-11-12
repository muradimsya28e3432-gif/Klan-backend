const mongoose = require('mongoose'); // MongoDB ilə işləmək üçün kitabxana
const env = require('./env'); // konfiqurasiya

mongoose.set('strictQuery', true); // sorğularda sxemdə olmayan sahələri nəzərə almır (təhlükəsizlik)

async function connectDB() { // bazaya qoşulma funksiyası
  mongoose.connection.on('error', (err) => console.error('❌ MongoDB xətası:', err.message)); // əlaqə xətasını yazır
  mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB əlaqəsi kəsildi')); // kəsilməni bildirir
  await mongoose.connect(env.MONGO_URI, { // qoşuluruq
    serverSelectionTimeoutMS: 10000, // 10 san ərzində tapılmasa xəta ver (sonsuz gözləmə olmasın)
    maxPoolSize: 20, // eyni vaxtda maksimum 20 bağlantı
  });
  console.log('✅ MongoDB qoşuldu'); // uğur mesajı
}

async function disconnectDB() { // bağlantını düzgün bağlamaq üçün
  await mongoose.connection.close(); // əlaqəni bağlayır
}

module.exports = { connectDB, disconnectDB }; // xaricə verir