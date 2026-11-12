class ApiError extends Error { // öz xəta sinfimiz: HTTP status kodu daşıyır
  constructor(statusCode, message, details) { // status, mesaj, əlavə təfərrüat
    super(message); // Error sinfinin mesajını təyin edir
    this.name = 'ApiError'; // xətanın adı
    this.statusCode = statusCode; // HTTP status kodu (400, 401, 404 və s.)
    this.details = details; // məsələn: validasiya xətalarının siyahısı
    this.isOperational = true; // "gözlənilən" xəta olduğunu göstərir (bug deyil)
    Error.captureStackTrace(this, this.constructor); // stack izini təmiz saxlayır
  }
}

module.exports = ApiError; // xaricə verir