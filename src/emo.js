// ✦ EMOÇ UYGULAMA EMOJİLERİ
// Developer Portal → Emojiler sayfasına yüklenen özel emojiler botun HER yerde
// (her sunucuda!) <:isim:id> olarak kullanılabilir. Yüklü değilse unicode yedeğe düşer,
// yani bot emojisiz de asla bozuk görünmez.
const HARITA = {
  yildiz: '9275yellowstar',
  kupa: '493187giftinglegend',
  kalkan: '369989modshield',
  zil: '944992bell',
  sessiz: 'emoc_sessiz',   // 🔕
  tac: '11140owner',
  elmas: '86637diamond',
  ates: 'emoc_ates',       // 🔥
  parti: '75695heywumpus',
  tik: '495202greentick',
  carpi: '814373redtick',
  uyari: '14224redalert',
  parilti: '4544221starratingids',
  kalp: '86692naheart002',
  para: '5272nacashicon',
  madalya: '2637805starratingids',
  el: '6574partner',
  goz: 'emoc_goz',         // 👀 trend
  kurukafa: 'emoc_kurukafa', // 💀 trend
  roket: 'emoc_roket',     // 🚀
};

function _bul(client, anahtar) {
  try {
    const col = client && client.application && client.application.emojis && client.application.emojis.cache;
    if (!col || !col.size) return null;
    // 1) Kayıtlı kısa ad  2) Birebir emoji adı (103 özel emojinle direkt kullan!)
    return col.find((e) => e.name === HARITA[anahtar]) || col.find((e) => e.name === anahtar) || null;
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
