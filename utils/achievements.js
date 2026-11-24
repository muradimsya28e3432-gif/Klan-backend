// Nailiyyət kataloqu: test(user) true qaytaranda nailiyyət açılır. xp = mükafat (pul YOX, balans təhlükəsiz qalır)
const ACHIEVEMENTS = [
  { code: 'first_gift', name: 'İlk hədiyyə', description: 'İlk hədiyyəni göndər', xp: 20, test: (u) => u.giftCount >= 1 },
  { code: 'gifts_100', name: 'Səxavətli', description: '100 hədiyyə göndər', xp: 150, test: (u) => u.giftCount >= 100 },
  { code: 'spender_100', name: 'Böyük dəstəkçi', description: 'Cəmi 100 AZN dəyərində hədiyyə göndər', xp: 300, test: (u) => u.totalGifted >= 10000 },
  { code: 'first_win', name: 'İlk qələbə', description: 'Qalib tərəfdə ilk dueli qazan', xp: 50, test: (u) => u.duelWins >= 1 },
  { code: 'wins_10', name: 'Döyüşçü', description: '10 duel qazan', xp: 200, test: (u) => u.duelWins >= 10 },
  { code: 'level_5', name: 'Təcrübəli', description: '5-ci səviyyəyə çat', xp: 100, test: (u) => u.level >= 5 },
  { code: 'level_10', name: 'Veteran', description: '10-cu səviyyəyə çat', xp: 250, test: (u) => u.level >= 10 },
  { code: 'friends_5', name: 'Sosial', description: '5 dostun olsun', xp: 60, test: (u) => u.friendsCount >= 5 },
  { code: 'popular_10', name: 'Populyar', description: '10 izləyici topla', xp: 80, test: (u) => u.followersCount >= 10 },
];

module.exports = { ACHIEVEMENTS }; // xaricə verir