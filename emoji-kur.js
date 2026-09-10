// MICROSOFT FLUENT özel emojileri indirip Developer Portal → Emojiler'e yükler.
// Çalıştır: npm run emoji
// 3 katman dener: 3D (en havalı) → Fluent renkli → klasik. Portal asla boş kalmaz.
// YENILE listesindeki emojiler silinip tazelenir (aynı isimle).
require('dotenv').config();
const config = require('./config');
const { EMOJI_HARITA } = require('./src/emo');

const FL = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets';
const TW = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';
// [anahtar, fluent3D yolu, fluentRenkli yolu, twemoji kodu]
const SET = [
  ['yildiz', 'Star/3D/star_3d.png', 'Star/Color/star_color.png', '2b50'],
  ['kupa', 'Trophy/3D/trophy_3d.png', 'Trophy/Color/trophy_color.png', '1f3c6'],
  ['kalkan', 'Shield/3D/shield_3d.png', 'Shield/Color/shield_color.png', '1f6e1'],
  ['zil', 'Bell/3D/bell_3d.png', 'Bell/Color/bell_color.png', '1f514'],
  ['sessiz', 'Bell with slash/3D/bell_with_slash_3d.png', 'Bell with slash/Color/bell_with_slash_color.png', '1f515'],
  ['tac', 'Crown/3D/crown_3d.png', 'Crown/Color/crown_color.png', '1f451'],
  ['elmas', 'Gem stone/3D/gem_stone_3d.png', 'Gem stone/Color/gem_stone_color.png', '1f48e'],
  ['ates', 'Fire/3D/fire_3d.png', 'Fire/Color/fire_color.png', '1f525'],
  ['parti', 'Party popper/3D/party_popper_3d.png', 'Party popper/Color/party_popper_color.png', '1f389'],
  ['tik', 'Check mark button/3D/check_mark_button_3d.png', 'Check mark button/Color/check_mark_button_color.png', '2705'],
  ['carpi', 'Cross mark/3D/cross_mark_3d.png', 'Cross mark/Color/cross_mark_color.png', '274c'],
  ['uyari', 'Warning/3D/warning_3d.png', 'Warning/Color/warning_color.png', '26a0'],
  ['parilti', 'Sparkles/3D/sparkles_3d.png', 'Sparkles/Color/sparkles_color.png', '2728'],
  ['kalp', 'Red heart/3D/red_heart_3d.png', 'Red heart/Color/red_heart_color.png', '2764'],
  ['para', 'Coin/3D/coin_3d.png', 'Coin/Color/coin_color.png', '1fa99'],
  ['madalya', 'Sports medal/3D/sports_medal_3d.png', 'Sports medal/Color/sports_medal_color.png', '1f3c5'],
  ['el', 'Handshake/3D/handshake_3d.png', 'Handshake/Color/handshake_color.png', '1f91d'],
  ['goz', 'Eyes/3D/eyes_3d.png', 'Eyes/Color/eyes_color.png', '1f440'],
  ['kurukafa', 'Skull/3D/skull_3d.png', 'Skull/Color/skull_color.png', '1f480'],
  ['roket', 'Rocket/3D/rocket_3d.png', 'Rocket/Color/rocket_color.png', '1f680'],
];

// Klasik kalanları 3D ile tazele:
const YENILE = ['emoc_sessiz', 'emoc_elmas', 'emoc_parti', 'emoc_tik', 'emoc_carpi', 'emoc_kalp', 'emoc_madalya'];

async function indir(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'EmocBot/2.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length) throw new Error('boş dosya');
  if (buf.length > 256 * 1024) throw new Error(`${(buf.length / 1024).toFixed(0)}KB > 256KB limit!`);
  return buf;
}

async function main() {
  const { Client, GatewayIntentBits } = require('discord.js');
  if (!config.token) throw new Error('TOKEN yok!');
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(config.token);
  await client.application.fetch();
  const mevcut = await client.application.emojis.fetch();
  console.log(`📦 Portalda şu an ${mevcut.size} uygulama emojisi var.`);

  for (const isim of YENILE) {
    const e = mevcut.find((x) => x.name === isim);
    if (e) {
      await e.delete().catch(() => {});
      console.log(`🗑️ tazeleniyor: ${isim}`);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  // Silinenler önbellekte kalmasın diye yeniden çek:
  const taze = await client.application.emojis.fetch();
  console.log(`🔄 Güncel sayı: ${taze.size}`);

  let d3 = 0, renkli = 0, klasik = 0, hata = 0;
  for (const [anahtar, f3d, fr, tw] of SET) {
    const isim = EMOJI_HARITA[anahtar];
    if (taze.find((e) => e.name === isim)) {
      console.log(`⏭️ ${isim} zaten var.`);
      continue;
    }
    let buf = null, kaynak = '';
    const denemeler = [
      [encodeURI(`${FL}/${f3d}`), '🌀3D'],
      [encodeURI(`${FL}/${fr}`), '🎨renkli'],
      [`${TW}/${tw}.png`, '⌨️klasik'],
    ];
    for (const [url, etiket] of denemeler) {
      try { buf = await indir(url); kaynak = etiket; break; }
      catch {}
    }
    if (!buf) { console.log(`❌ ${isim} üç kaynak da patladı!`); hata++; continue; }
    try {
      const emoji = await client.application.emojis.create({ attachment: buf, name: isim });
      console.log(`${kaynak} ✅ ${isim} → ${emoji}`);
      if (kaynak.startsWith('🌀')) d3++;
      else if (kaynak.startsWith('🎨')) renkli++;
      else klasik++;
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      console.log(`❌ ${isim} yüklenemedi: ${e.message}`);
      hata++;
    }
  }
  console.log(`\n🎉 Bitti! 3D: ${d3} • renkli: ${renkli} • klasik: ${klasik} • hata: ${hata}`);
  await client.destroy();
  process.exit(0);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
