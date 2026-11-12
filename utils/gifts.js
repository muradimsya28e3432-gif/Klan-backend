const CATEGORIES = [ // 10 əsas hədiyyə kateqoriyası (qiymətlər SERVERDƏ təyin olunur, istifadəçi dəyişə bilməz)
  { icon: '🌹', name: 'Gül' }, // 0-cı kateqoriya
  { icon: '❤️', name: 'Ürək' }, // 1
  { icon: '⭐', name: 'Ulduz' }, // 2
  { icon: '🔥', name: 'Alov' }, // 3
  { icon: '👑', name: 'Tac' }, // 4
  { icon: '💎', name: 'Almaz' }, // 5
  { icon: '🏎️', name: 'Maşın' }, // 6
  { icon: '🏰', name: 'Qəsr' }, // 7
  { icon: '🚀', name: 'Raket' }, // 8
  { icon: '🌍', name: 'Kainat' }, // 9
];
const SUB_COUNT = 10; // hər kateqoriyada 10 alt növ (cəmi 100 hədiyyə)
const BASE_PRICE = 10; // baza qiymət: 10 qəpik = 0.10 AZN

function getGift(category, sub) { // kateqoriya və alt növə görə hədiyyəni qaytarır
  if (!Number.isInteger(category) || !Number.isInteger(sub)) return null; // tam ədəd deyilsə yararsızdır
  if (category < 0 || category >= CATEGORIES.length) return null; // kateqoriya sərhəddən kənardır
  if (sub < 0 || sub >= SUB_COUNT) return null; // alt növ sərhəddən kənardır
  const c = CATEGORIES[category]; // seçilmiş kateqoriya
  return { name: `${c.icon} ${c.name} Növ ${sub + 1}`, price: (sub + 1) * BASE_PRICE }; // ad və qiymət (qəpik)
}

function listGifts() { // frontend-ə göstərmək üçün bütün hədiyyələr
  return CATEGORIES.map((c, ci) => ({ // hər kateqoriya üçün
    category: ci, // kateqoriya nömrəsi
    icon: c.icon, // emoji
    name: c.name, // ad
    subs: Array.from({ length: SUB_COUNT }, (_, si) => ({ sub: si, price: (si + 1) * BASE_PRICE })), // alt növlər və qiymətləri
  }));
}

module.exports = { getGift, listGifts, CATEGORIES, SUB_COUNT }; // xaricə verir