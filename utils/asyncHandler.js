// async funksiyalardakı xətaları avtomatik error middleware-ə ötürür (try/catch yazmağa ehtiyac qalmır)
const asyncHandler = (fn) => (req, res, next) => { // controller funksiyasını sarıyır
  Promise.resolve(fn(req, res, next)).catch(next); // xəta olarsa next(err) çağırır, server çökmür
};

module.exports = asyncHandler; // xaricə verir