// 🎮 Oyun kanalı motoru — sayı-sayma + kelime-türetme (restart-dayanıklı, db durumlu).
// Kanal adı `sayı-sayma` / `kelime-türetme` içeriyorsa her sunucuda otomatik çalışır.
const { db, save } = require('./db');

function oyunDurum(gid, kanalId) {
  const d = db();
  if (!d.oyunlar) d.oyunlar = {};
  const key = `${gid}_${kanalId}`;
  if (!d.oyunlar[key]) d.oyunlar[key] = { son: 0, sonKullanici: null, kelimeler: [] };
  return d.oyunlar[key];
}

function uyariGonder(message, metin) {
  return message.channel.send(`${message.author} ⚠️ ${metin}`)
    .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
}

// Sayı-sayma: sıradaki sayı + farklı kullanıcı. Döndürür: 'gecti' (devam et) | 'isledi' (dur).
async function oyunSayi(message) {
  const st = oyunDurum(message.guild.id, message.channel.id);
  const ham = String(message.content || '').trim();
  const beklenen = (st.son || 0) + 1;
  if (!/^\d+$/.test(ham)) {
    await message.delete().catch(() => {});
    await uyariGonder(message, `Sadece sayı yaz! Sıradaki: **${beklenen}**`);
    return 'isledi';
  }
  const n = parseInt(ham, 10);
  if (n === beklenen && message.author.id !== st.sonKullanici) {
    st.son = n;
    st.sonKullanici = message.author.id;
    save();
    await message.react('✅').catch(() => {});
    if (n % 100 === 0) {
      await message.channel.send(`🎉 **${n}** sayısına ulaşıldı! Devam! 🚀`).catch(() => {});
    }
    return 'isledi';
  }
  await message.delete().catch(() => {});
  st.son = 0;
  st.sonKullanici = null;
  save();
  await uyariGonder(message, `Bozdun! **1** ile baştan başlıyoruz! 😅`);
  return 'isledi';
}

function kelimeTemizle(s) {
  return String(s || '').toLocaleLowerCase('tr').replace(/[^a-zçğıöşü]/g, '');
}
function sonHarf(kelime) {
  const t = kelimeTemizle(kelime);
  return t ? t[t.length - 1] : '';
}

// Kelime-türetme: son harfle başla + tekrar yok. Döndürür: 'gecti' | 'isledi'.
async function oyunKelime(message) {
  const st = oyunDurum(message.guild.id, message.channel.id);
  if (!Array.isArray(st.kelimeler)) st.kelimeler = [];
  const ham = String(message.content || '').trim();
  if (!ham || /\s/.test(ham)) {
    await message.delete().catch(() => {});
    await uyariGonder(message, 'Tek kelime yaz!');
    return 'isledi';
  }
  const kelime = kelimeTemizle(ham);
  if (kelime.length < 2) {
    await message.delete().catch(() => {});
    await uyariGonder(message, 'En az 2 harfli kelime yaz!');
    return 'isledi';
  }
  const sonKelime = st.kelimeler[st.kelimeler.length - 1];
  if (sonKelime) {
    const beklenen = sonHarf(sonKelime);
    if (kelime[0] !== beklenen) {
      await message.delete().catch(() => {});
      await uyariGonder(message, `**${beklenen.toUpperCase()}** ile başlayan bir kelime yaz! (son: ${sonKelime})`);
      return 'isledi';
    }
  }
  if (st.kelimeler.includes(kelime)) {
    await message.delete().catch(() => {});
    await uyariGonder(message, 'Bu kelime daha önce yazıldı, yenisini bul! 🧠');
    return 'isledi';
  }
  st.kelimeler.push(kelime);
  if (st.kelimeler.length > 50) st.kelimeler = st.kelimeler.slice(-50);
  save();
  await message.react('✅').catch(() => {});
  return 'isledi';
}

module.exports = { oyunDurum, oyunSayi, oyunKelime, kelimeTemizle, sonHarf };
