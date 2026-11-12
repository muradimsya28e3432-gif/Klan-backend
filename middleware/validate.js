const { z } = require('zod'); // verilənləri yoxlamaq kitabxanası
const ApiError = require('../utils/ApiError'); // xəta sinfi

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Yanlış ID formatı'); // MongoDB ID formatı

const validate = (parts) => (req, res, next) => { // parts: { body, query, params } zod sxemləri
  const schema = z.object({ // üç hissəni birlikdə yoxlayırıq
    body: parts.body || z.any(), // body sxemi
    query: parts.query || z.any(), // query sxemi
    params: parts.params || z.any(), // params sxemi
  });
  const result = schema.safeParse({ body: req.body, query: req.query, params: req.params }); // yoxlama
  if (!result.success) { // səhv varsa
    const details = result.error.issues.map((i) => ({ field: i.path.slice(1).join('.'), message: i.message })); // səhvlərin siyahısı
    return next(new ApiError(400, 'Göndərilən məlumat yanlışdır', details)); // 400 qaytarır
  }
  req.body = result.data.body === undefined ? {} : result.data.body; // təmizlənmiş body (artıq sahələr atılır)
  req.valid = result.data; // təmizlənmiş query/params buradadır
  next(); // davam
};

module.exports = { validate, objectId }; // xaricə verir