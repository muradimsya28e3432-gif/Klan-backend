const crypto = require('crypto'); // Node-un daxili kriptoqrafiya modulu
const env = require('../config/env'); // şifrələmə açarı buradan gəlir

const sanitize = (value) => String(value || '').replace(/[\s-]/g, ''); // boşluq və tireləri silir

function luhn(digits) { // Luhn alqoritmi: kart nömrəsinin riyazi düzgünlüyünü yoxlayır
  let sum = 0; // cəm
  let alt = false; // hər ikinci rəqəmi ikiqat etmək üçün bayraq
  for (let i = digits.length - 1; i >= 0; i--) { // sondan başa gedirik
    let n = digits.charCodeAt(i) - 48; // simvolu rəqəmə çeviririk
    if (alt) { // ikiqat edilməli rəqəmdirsə
      n *= 2; // ikiqat et
      if (n > 9) n -= 9; // 9-dan böyükdürsə 9 çıx
    }
    sum += n; // cəmə əlavə et
    alt = !alt; // bayrağı dəyiş
  }
  return sum % 10 === 0; // cəm 10-a bölünməlidir
}

const isValidCard = (digits) => /^\d{16,19}$/.test(digits) && luhn(digits); // 16-19 rəqəm + Luhn

function detectBrand(digits) { // kartın növünü təxmin edir
  if (digits.startsWith('4')) return 'Visa'; // 4 ilə başlayırsa Visa
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'; // 51-55 və ya 22-27 Mastercard
  return 'Digər'; // başqa hallarda
}

const last4 = (digits) => digits.slice(-4); // son 4 rəqəm
const mask = (digits) => `**** **** **** ${last4(digits)}`; // maskalanmış görünüş

function encrypt(plain) { // kart nömrəsini AES-256-GCM ilə şifrələyir
  const iv = crypto.randomBytes(12); // hər dəfə təsadüfi 12 baytlıq iv (təkrarlanmamalıdır)
  const cipher = crypto.createCipheriv('aes-256-gcm', env.CARD_ENC_KEY, iv); // şifrələyici
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]); // şifrələnmiş data
  const tag = cipher.getAuthTag(); // dəyişdirilmə yoxlaması üçün etiket
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`; // hamısını bir mətndə saxlayırıq
}

function decrypt(payload) { // şifrəni açır
  const [ivHex, tagHex, encHex] = String(payload).split(':'); // hissələrə ayırırıq
  if (!ivHex || !tagHex || !encHex) throw new Error('Şifrələnmiş data zədəlidir'); // format yoxlaması
  const decipher = crypto.createDecipheriv('aes-256-gcm', env.CARD_ENC_KEY, Buffer.from(ivHex, 'hex')); // açıcı
  decipher.setAuthTag(Buffer.from(tagHex, 'hex')); // etiketi veririk (dəyişdirilibsə xəta atacaq)
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8'); // açılmış mətn
}

module.exports = { sanitize, isValidCard, detectBrand, last4, mask, encrypt, decrypt }; // xaricə verir