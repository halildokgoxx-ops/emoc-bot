// ✦ EMOÇ UYGULAMA EMOJİLERİ
// Developer Portal → Emojiler sayfasına yüklenen özel emojiler botun HER yerde
// (her sunucuda!) <:isim:id> olarak kullanılabilir. Yüklü değilse unicode yedeğe düşer,
// yani bot emojisiz de asla bozuk görünmez.
const HARITA = {
  yildiz: 'emoc_yildiz',   // ⭐
  kupa: 'emoc_kupa',       // 🏆
  kalkan: 'emoc_kalkan',   // 🛡️
  zil: 'emoc_zil',         // 🔔
  sessiz: 'emoc_sessiz',   // 🔕
  tac: 'emoc_tac',         // 👑
  elmas: 'emoc_elmas',     // 💎
  ates: 'emoc_ates',       // 🔥
  parti: 'emoc_parti',     // 🎉
  tik: 'emoc_tik',         // ✅
  carpi: 'emoc_carpi',     // ❌
  uyari: 'emoc_uyari',     // ⚠️
  parilti: 'emoc_parilti', // ✨
  kalp: 'emoc_kalp',       // ❤️
  para: 'emoc_para',       // 🪙
  madalya: 'emoc_madalya', // 🏅
  el: 'emoc_el',           // 🤝
  goz: 'emoc_goz',         // 👀 trend
  kurukafa: 'emoc_kurukafa', // 💀 trend
  roket: 'emoc_roket',     // 🚀
};

function _bul(client, anahtar) {
  try {
    const col = client && client.application && client.application.emojis && client.application.emojis.cache;
    if (!col) return null;
    return col.find((e) => e.name === HARITA[anahtar]) || null;
  } catch { return null; }
}

// Metin/embed içinde: E(client, 'yildiz', '⭐')
function E(client, anahtar, yedek = '') {
  const e = _bul(client, anahtar);
  return e ? `${e}` : yedek;
}

// Buton emojisi için ID: EID(client, 'zil') || '🔔'
function EID(client, anahtar) {
  const e = _bul(client, anahtar);
  return e ? e.id : null;
}

module.exports = { E, EID, EMOJI_HARITA: HARITA };
