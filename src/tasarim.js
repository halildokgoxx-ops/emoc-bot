// ✦ EMOÇ TASARIM SİSTEMİ — modern, premium, "seksi" görünüm
// Tüm amiral gemisi embedler buradaki dille konuşur: mor/pembe neon palet,
// EMOÇ author bandı, ilerleme çubukları, tutarlı footer.
const { EmbedBuilder } = require('discord.js');

const RENK = {
  ana: 0x8B5CF6,     // elektrik moru
  vurgu: 0xEC4899,   // neon pembe
  bilgi: 0x00D4FF,   // buz mavisi
  altin: 0xFFC93C,   // altın
  basari: 0x00E676,  // neon yeşil
  hata: 0xFF3D71,    // neon kırmızı
  uyari: 0xFFB800,   // amber
};

function ikon(client) {
  try { return (client && client.user && client.user.displayAvatarURL({ size: 128 })) || null; }
  catch { return null; }
}

// Standart premium kart
function kart(client, o = {}) {
  const img = ikon(client);
  const e = new EmbedBuilder().setColor(o.renk ?? RENK.ana).setTimestamp();
  e.setAuthor({ name: '✦ EMOÇ', iconURL: img || undefined });
  if (o.baslik) e.setTitle(o.baslik);
  if (o.aciklama) e.setDescription(o.aciklama);
  if (o.kucukResim) e.setThumbnail(o.kucukResim);
  if (o.resim) e.setImage(o.resim);
  if (o.alanlar && o.alanlar.length) e.addFields(...o.alanlar);
  e.setFooter({ text: o.altbilgi || 'EMOÇ • Premium Deneyim • /yardım', iconURL: img || undefined });
  return e;
}

// İlerleme çubuğu: cubuk(65) → ████████░░░░
function cubuk(deger, max = 100, uzunluk = 12, dolu = '█', bos = '░') {
  const oran = Math.max(0, Math.min(1, (max || 100) === 0 ? 0 : deger / max));
  const d = Math.round(oran * uzunluk);
  return dolu.repeat(d) + bos.repeat(uzunluk - d);
}

function pingRenk(ms) {
  if (ms < 150) return RENK.basari;
  if (ms < 300) return RENK.altin;
  return RENK.hata;
}

const ROZETLER = [
  [250, '👑', 'EFSANE'], [100, '💎', 'ELMAS'], [50, '🥇', 'ALTIN'],
  [25, '🥈', 'GÜMÜŞ'], [10, '🥉', 'BRONZ'], [1, '✨', 'TANINAN'],
];
function sonrakiRozet(rep) {
  const sirali = [...ROZETLER].reverse();
  for (const [esik, emoji, ad] of sirali) {
    if (rep < esik) return { esik, emoji, ad, kalan: esik - rep };
  }
  return null; // zirvede!
}

module.exports = { RENK, ikon, kart, cubuk, pingRenk, ROZETLER, sonrakiRozet };
