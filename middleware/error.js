const env = require('../config/env'); // mühit
const ApiError = require('../utils/ApiError'); // xəta sinfi

const notFound = (req, res, next) => { // tapılmayan marşrut
  next(new ApiError(404, 'Marşrut tapılmadı')); // 404 xətası yaradır
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => { // mərkəzi xəta emal edən (4 parametr məcburidir)
  if (res.headersSent) return next(err); // cavab artıq göndərilibsə Express-ə buraxır
  let status = 500; // standart: server xətası
  let message = 'Daxili server xətası'; // standart mesaj (daxili detalı gizlədir)
  let details; // əlavə təfərrüat

  if (err instanceof ApiError) { // bizim xətamızdırsa
    status = err.statusCode; message = err.message; details = err.details; // dəyərləri götürür
  } else if (err.name === 'CastError') { // yanlış ID
    status = 400; message = 'Yanlış ID formatı'; // 400
  } else if (err.name === 'ValidationError' && err.errors) { // mongoose validasiyası
    status = 400; message = 'Məlumat yanlışdır'; details = Object.values(err.errors).map((e) => e.message); // siyahı
  } else if (err.code === 11000) { // unikal açar təkrarı
    status = 409; message = 'Bu məlumat artıq mövcuddur'; // 409
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') { // token xətası
    status = 401; message = 'Token etibarsızdır'; // 401
  } else if (err.type === 'entity.parse.failed') { // pozuq JSON
    status = 400; message = 'JSON formatı yanlışdır'; // 400
  } else if (err.type === 'entity.too.large') { // həddindən böyük sorğu
    status = 413; message = 'Sorğu çox böyükdür'; // 413
  }

  if (status >= 500) console.error('❌', err); // yalnız server xətalarını loga yazır
  res.status(status).json({ // cavab göndərir
    success: false, // uğursuz
    message, // mesaj
    ...(details ? { details } : {}), // təfərrüat varsa əlavə et
    ...(env.isProd ? {} : { stack: err.stack }), // stack yalnız development-də görünür
  });
};

module.exports = { notFound, errorHandler }; // xaricə verir