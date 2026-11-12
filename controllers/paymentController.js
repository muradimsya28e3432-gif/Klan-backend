const paymentService = require('../services/paymentService'); // ödəniş məntiqi
const ApiError = require('../utils/ApiError'); // xəta sinfi
const asyncHandler = require('../utils/asyncHandler'); // async sarğı

const createOrder = asyncHandler(async (req, res) => { // balans artırma sifarişi
  const data = await paymentService.createTopUp(req.user._id, req.body.amount); // yarat (qəpiklə)
  res.status(201).json({ success: true, data }); // cavab
});

const webhook = asyncHandler(async (req, res) => { // provayderdən gələn bildiriş
  if (!paymentService.verifySignature(req.rawBody, req.headers['x-signature'])) throw new ApiError(401, 'İmza yanlışdır'); // saxta sorğunu rədd et
  const { orderId, status, amount, providerRef } = req.body; // yoxlanmış məlumat
  if (status === 'success') { // uğurludursa
    await paymentService.processPaid(orderId, amount, providerRef); // balansa yaz
  } else { // uğursuzdursa
    await paymentService.processFailed(orderId); // statusu dəyiş
  }
  res.json({ success: true }); // provayderə 200 qaytarırıq (təkrar göndərməsin)
});

const devConfirm = asyncHandler(async (req, res) => { // test təsdiqi
  const result = await paymentService.devConfirm(req.params.id, req.user._id); // təsdiq
  res.json({ success: true, data: result }); // cavab
});

const myOrders = asyncHandler(async (req, res) => { // sifarişlərim
  res.json({ success: true, data: await paymentService.listOrders(req.user._id) }); // cavab
});

module.exports = { createOrder, webhook, devConfirm, myOrders }; // xaricə verir