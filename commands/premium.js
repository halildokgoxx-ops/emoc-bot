const { PermissionFlagsBits } = require('discord.js');
const { getGuild, setGuild, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { kart, RENK } = require('../src/tasarim');
const P = require('../src/premium');

const AVANTAJLAR =
  '🧲 **/yapiskan** — yapışkan rol: çıkanın rolleri saklanır, dönünce iade!\n' +
  '🤖 **/oto-cevap** — kendi komutlarını yarat (20 kayıt)!\n' +
  '💾 **/yedek** — sunucu yedeği al, tek tıkla geri yükle!\n' +
  '💌 **/giris-dm** — yeni gelene özel karşılama DM\'i!\n' +
  '🚀 **/seviye-hiz** — 5 kata kadar XP hızı!\n' +
  '🎯 **/sayac-pro** — hedef + kalan + KİMİN DAVET ETTİĞİ detaylı sayaç!\n' +
  '👋 **/hosgeldin** + **/gorusuruz** — resimli embed karşılama & veda!\n' +
  '🎭 **/oto-roller** — katılana 3 role kadar otomatik rol!\n' +
  '🏷️ **/tag** — isminde tag olana otomatik rol!\n' +
  '🎉 **/oto-cekilis** — sürekli otomatik çekiliş!\n' +
  '📨 **/davet-odul** — X davet edene otomatik rol!\n' +
  '🏰 **/sunucu kur** — tek tıkla dehşet sunucu\n' +
  '🎉 **Çekiliş PRO** — 30 gün süre, 1000 katılımcı (free: 7 gün/200)\n' +
  '✦ **EmocAI PRO** — 100/gün hak + komutsuz sohbet kanalı (`/premium ai-kanal`)!\n' +
  '🎁 Günlük x2 • 🚀 XP x2 • ⭐ Profil mührü\n' +
  '⭐ **/starboard** — yıldız panosu: beğenilen mesajlar özel kanala!\n' +
  '🎭 **/toplu-rol** — herkese/botlara tek tıkla toplu rol ver-al!\n' +
  '🔥 **/aktif-rol** — aktif üyelere (mesaj sayısına göre) otomatik rol!';

// Free yazarsa premium hatası veren kapı
function premKontrol(interaction) {
  if (!P.premiumMu(interaction.guild.id)) {
    interaction.reply({ content: '👑 Bu özellik **PREMIUM**! Kodun varsa `/premium aktiflestir` yaz.\nAvantajlar için: `/premium bilgi` 💎', ephemeral: true });
    return false;
  }
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true });
    return false;
  }
  return true;
}

// ---------- Yardımcılar ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function renkCoz(s) {
  const map = { kirmizi: '#FF0000', kırmızı: '#FF0000', mavi: '#0000FF', yesil: '#00FF00', yeşil: '#00FF00', sari: '#FFFF00', sarı: '#FFFF00', mor: '#800080', pembe: '#FF69B4', turuncu: '#FFA500', siyah: '#000000', beyaz: '#FFFFFF', gri: '#808080' };
  s = String(s || '').toLocaleLowerCase('tr').trim();
  if (map[s]) return map[s];
  const h = s.replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(h)) return '#' + h.toUpperCase();
  if (/^[0-9a-f]{3}$/i.test(h)) return '#' + h.split('').map((c) => c + c).join('').toUpperCase();
  return null;
}

function hgVedaEmbed(client, guild, kisi, ayar, hosgeldinMi) {
  const ad = kisi.username || kisi.user?.username || 'Dostumuz';
  const avatar = kisi.displayAvatarURL ? kisi.displayAvatarURL({ size: 256 }) : kisi.user?.displayAvatarURL({ size: 256 });
  const metin = String(ayar.mesaj || '')
    .replace(/{kullanıcı}/g, kisi.toString())
    .replace(/{sunucu}/g, guild.name)
    .replace(/{üye}/g, `${guild.memberCount}`).slice(0, 1500);
  return kart(client, {
    renk: hosgeldinMi ? (ayar.renk || RENK.ana) : RENK.hata,
    baslik: ayar.baslik || `👋 ${ad}`,
    aciklama: metin || '*...*',
    kucukResim: avatar || undefined,
  });
}

async function premiumSayacGuncelle(client, guild, sonUye, davetEdenId) {
  try {
    const g = getGuild(guild.id);
    const sc = g.premiumSayac;
    if (!sc || !sc.kanal) return;
    const kanal = guild.channels.cache.get(sc.kanal);
    if (!kanal || !kanal.isTextBased()) return;
    const kalan = Math.max(0, (sc.hedef || 0) - guild.memberCount);
    let davetAd = 'bilinmiyor';
    if (davetEdenId) {
      const du = await client.users.fetch(davetEdenId).catch(() => null);
      if (du) davetAd = du.username;
    }
    const metin = String(sc.mesaj || '🎯 Hedef: {hedef} • Kalan: {kalan} • Üye: {uye}')
      .replace(/{hedef}/g, sc.hedef).replace(/{kalan}/g, kalan).replace(/{uye}/g, guild.memberCount)
      .replace(/{son}/g, sonUye ? sonUye.user.username : '-').replace(/{davet}/g, davetAd)
      .replace(/{sunucu}/g, guild.name).slice(0, 1800);
    const e = kart(client, { baslik: '🎯 Sayaç', aciklama: metin, altbilgi: 'Premium sayaç • otomatik güncellenir' });
    if (sc.mesajId) {
      const eski = await kanal.messages.fetch(sc.mesajId).catch(() => null);
      if (eski) { await eski.edit({ embeds: [e] }).catch(() => {}); return; }
    }
    const msg = await kanal.send({ embeds: [e] }).catch(() => null);
    if (msg) { sc.mesajId = msg.id; save(); }
  } catch {}
}

async function yedekAl(guild) {
  const roller = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id && !r.managed)
    .map((r) => ({ ad: r.name, renk: r.hexColor, hosit: r.hoist, bahsedilebilir: r.mentionable, izin: r.permissions.bitfield.toString(), sira: r.position }));
  const kanallar = [...guild.channels.cache.values()]
    .filter((k) => !k.isThread())
    .map((k) => ({ ad: k.name, tip: k.type, konu: k.topic || null, yavas: k.rateLimitPerUser || 0, nsfw: !!k.nsfw, ebeveyn: k.parent ? k.parent.name : null }));
  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(), tarih: Date.now(),
    rol: roller.length, kanal: kanallar.length, roller, kanallar,
  };
}

async function yedekYukle(guild, y) {
  const ben = guild.members.me;
  const enUst = ben.roles.highest.position;
  let rolSay = 0, kanalSay = 0;
  for (const r of [...guild.roles.cache.values()].filter((r) => r.id !== guild.id && !r.managed && r.position < enUst)) {
    await r.delete('Yedek yükleme').catch(() => {});
    await sleep(500);
  }
  for (const r of [...(y.roller || [])].sort((a, b) => a.sira - b.sira)) {
    await guild.roles.create({
      name: String(r.ad).slice(0, 50), color: r.renk, hoist: !!r.hosit,
      mentionable: !!r.bahsedilebilir, permissions: BigInt(r.izin || 0), reason: 'Yedek yükleme',
    }).then(() => rolSay++).catch(() => {});
    await sleep(600);
  }
  for (const k of [...guild.channels.cache.values()]) {
    await k.delete('Yedek yükleme').catch(() => {});
    await sleep(400);
  }
  const katMap = {};
  for (const k of (y.kanallar || []).filter((k) => k.tip === 4)) {
    const kat = await guild.channels.create({ name: k.ad, type: 4, reason: 'Yedek yükleme' }).catch(() => null);
    if (kat) katMap[k.ad] = kat;
    await sleep(400);
  }
  for (const k of (y.kanallar || []).filter((k) => [0, 2, 5, 13, 15].includes(k.tip))) {
    await guild.channels.create({
      name: k.ad, type: k.tip, topic: k.konu, rateLimitPerUser: k.yavas || 0, nsfw: !!k.nsfw,
      parent: k.ebeveyn && katMap[k.ebeveyn] ? katMap[k.ebeveyn].id : null, reason: 'Yedek yükleme',
    }).then(() => kanalSay++).catch(() => {});
    await sleep(500);
  }
  return `${rolSay} rol, ${kanalSay} kanal kuruldu!\n⚠️ Kanal ID'leri değiştiği için bot ayarlarını (log, oto-rol, sayaç, partner) **yeniden bağla!**`;
}

module.exports = [
  {
    name: 'premium-kod', aliases: ['premiumkod', 'prekod'], category: 'Premium',
    description: 'Premium kodu üretir (SADECE bot kurucuları). Kod DM ile gider!',
    usage: '!premium-kod <süre> (örn: 30d, 1y, sinirsiz)',
    async run(message, args) {
      if (!P.sahipMi(message.author.id)) return message.reply({ embeds: [err('❌ Bu komut sadece bot kurucularına özel!')] });
      const gun = P.sureParse(args[0]);
      if (!gun || gun < 1) return message.reply({ embeds: [err('Süre yaz! `!premium-kod 30d` • `!premium-kod 1y` • `!premium-kod sinirsiz`')] });
      const kod = P.kodUret(gun, message.author.id);
      try {
        await message.author.send(
          `👑 **Premium kodun hazır!**\n\`\`\`${kod}\`\`\`\n` +
          `📅 Süre: **${gun >= 36500 ? 'SINIRSIZ ♾️' : gun + ' gün'}**\n` +
          `💡 Kullanım: kodu bir sunucuda \`!premium-aktifleştir ${kod}\` yaz — **sadece o sunucuda** geçerli olur!`
        );
      } catch {}
      await message.delete().catch(() => {});
      return message.channel.send(`${message.author} ✅ Kod DM'ne gönderildi! (güvenlik için komut silindi)`)
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
    },
  },
  {
    name: 'premium-aktifleştir', aliases: ['premiumaktiflestir', 'premium-aktiflestir', 'pre-aktive'], category: 'Premium',
    description: 'Premium kodu BU sunucuda aktifleştirir.',
    usage: '!premium-aktifleştir <kod>',
    async run(message, args, client) {
      if (!message.guild) return;
      const kod = (args[0] || '').trim();
      if (!kod) return message.reply({ embeds: [err('Kod yaz! `!premium-aktifleştir EMOC-XXXX-XXXX`')] });
      const s = P.kodKullan(kod, message.guild.id, message.author.id);
      if (s.hata) return message.reply({ embeds: [err(s.hata)] });
      await message.delete().catch(() => {});
      return message.channel.send({
        embeds: [kart(client || message.client, {
          renk: RENK.altin,
          baslik: '👑 PREMIUM AKTİF!',
          aciklama: `**${message.guild.name}** artık PREMIUM! ${s.gun >= 36500 ? '♾️ **SINIRSIZ**' : `(<t:${Math.floor(s.bitis / 1000)}:F> tarihine kadar)`}`,
          alanlar: [{ name: '✨ Açılan Avantajlar', value: AVANTAJLAR }],
        })],
      });
    },
  },
  {
    name: 'premium', aliases: ['prem'], category: 'Premium',
    description: 'Premium komutlar slash ile: /yapiskan /tag /yedek... (liste için yaz!)',
    usage: '!premium',
    async run(message) {
      return message.reply({
        embeds: [kart(message.client, {
          renk: RENK.altin, baslik: '👑 Premium Komutlar',
          aciklama: 'Hepsi **slash** ile çalışır, free yazarsa premium hatası verir:\n\n' + AVANTAJLAR,
          altbilgi: 'Kodun varsa: /premium aktiflestir',
        })],
      });
    },
  },
];

const premiumSlash = {
  data: {
    name: 'premium',
    description: '👑 Premium: aktifleştir + bilgi',
    contexts: [0],
    options: [
      {
        type: 1, name: 'aktiflestir', description: 'Premium kodunu BU sunucuda aktifleştir (FREE!)',
        options: [{ type: 3, name: 'kod', description: 'EMOC-XXXX-XXXX', required: true }],
      },
      { type: 1, name: 'bilgi', description: 'Bu sunucunun premium durumu + avantajlar' },
      {
        type: 1, name: 'ai-kanal', description: '👑 Komutsuz EmocAI sohbet kanalı!',
        options: [
          { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ayarla', value: 'ayarla' }, { name: 'Kapat', value: 'kapat' }, { name: 'Durum', value: 'durum' }] },
          { type: 7, name: 'kanal', description: 'AI sohbet kanalı', required: false },
        ],
      },
    ],
  },
  async execute(interaction, client) {
    const alt = interaction.options.getSubcommand();
    if (alt === 'aktiflestir') {
      const s = P.kodKullan(interaction.options.getString('kod'), interaction.guild.id, interaction.user.id);
      if (s.hata) return interaction.reply({ content: `❌ ${s.hata}`, ephemeral: true });
      return interaction.reply({
        embeds: [kart(client, {
          renk: RENK.altin,
          baslik: '👑 PREMIUM AKTİF!',
          aciklama: `**${interaction.guild.name}** artık PREMIUM!\n\n${AVANTAJLAR}`,
        })],
      });
    }
    const b = P.premiumBilgi(interaction.guild.id);
    if (alt === 'ai-kanal') {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      if (islem === 'kapat') {
        setGuild(interaction.guild.id, { aiKanal: null });
        return interaction.reply({ embeds: [ok('✦ EmocAI kanalı kapatıldı.')] });
      }
      if (islem === 'durum') {
        const k = getGuild(interaction.guild.id).aiKanal;
        return interaction.reply({ content: k ? `✦ EmocAI kanalı: <#${k}> — komutsuz sohbet aktif! (Premium: 100/gün)` : 'Kapalı.', ephemeral: true });
      }
      const kanal = interaction.options.getChannel('kanal');
      if (!kanal || !kanal.isTextBased()) return interaction.reply({ content: 'Yazı kanalı seç!', ephemeral: true });
      setGuild(interaction.guild.id, { aiKanal: kanal.id });
      return interaction.reply({ embeds: [ok(`✦ ${kanal} artık **EmocAI sohbet kanalı**!\nKomutsuz yaz, EmocAI cevaplasın! (Premium: 100/gün) 💬`)] });
    }
    return interaction.reply({
      embeds: [kart(client, {
        renk: b ? RENK.altin : RENK.ana,
        baslik: b ? '👑 PREMIUM AKTİF' : '👑 Premium Bilgi',
        aciklama: b
          ? `Bitiş: <t:${Math.floor(b.bitis / 1000)}:F> (<t:${Math.floor(b.bitis / 1000)}:R>)`
          : 'Bu sunucuda premium yok. Kodun varsa `/premium aktiflestir` yaz!',
        alanlar: [{ name: '✨ Premium Avantajları', value: AVANTAJLAR }],
      })],
      ephemeral: true,
    });
  },
};

// ---------- 12 OP PREMIUM KOMUT (normal isimler, free'ye hata!) ----------
const premiumKomutlar = [
  {
    data: {
      name: 'yapiskan', description: '🧲 Yapışkan rol: çıkanın rolü saklanır, dönünce iade!',
      contexts: [0],
      options: [{ type: 3, name: 'islem', description: 'Aç/Kapat/Durum', required: true, choices: [{ name: 'Aç ✅', value: 'ac' }, { name: 'Kapat', value: 'kapat' }, { name: 'Durum', value: 'durum' }] }],
    },
    async execute(interaction) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      if (islem === 'durum') {
        const g = getGuild(interaction.guild.id);
        const d = require('../src/db').db();
        const sayi = Object.keys(d.yapiskan || {}).filter((k) => k.startsWith(interaction.guild.id + '_')).length;
        return interaction.reply({ content: g.yapiskan ? `🧲 Yapışkan rol **AÇIK** (${sayi} kişinin rolü saklı).` : '🧲 Yapışkan rol kapalı.', ephemeral: true });
      }
      setGuild(interaction.guild.id, { yapiskan: islem === 'ac' });
      return interaction.reply({ embeds: [ok(islem === 'ac' ? '🧲 Yapışkan rol **açıldı**! Çıkanların rolleri saklanıp dönünce iade edilecek.' : '🧲 Yapışkan rol kapatıldı.')] });
    },
  },
  {
    data: {
      name: 'oto-cevap', description: '🤖 Özel oto-cevaplayıcı kur (20 kayıt)!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ekle', value: 'ekle' }, { name: 'Sil', value: 'sil' }, { name: 'Liste', value: 'liste' }] },
        { type: 3, name: 'tetik', description: 'Hangi yazıda? (örn: selam)', required: false },
        { type: 3, name: 'cevap', description: 'Bot ne yazsın?', required: false },
      ],
    },
    async execute(interaction, client) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      const g = getGuild(interaction.guild.id);
      if (!Array.isArray(g.otoCevap)) g.otoCevap = [];
      if (islem === 'liste') {
        if (!g.otoCevap.length) return interaction.reply({ content: 'Liste boş! Örn: `/oto-cevap islem:Ekle tetik:selam cevap:Hoş geldin!`', ephemeral: true });
        return interaction.reply({ embeds: [kart(client, { baslik: '🤖 Oto-Cevaplar', aciklama: g.otoCevap.map((o, i) => `\`${i + 1}.\` **${o.tetik}** → ${o.cevap}`.slice(0, 200)).join('\n').slice(0, 3500) })], ephemeral: true });
      }
      if (islem === 'sil') {
        const tetik = (interaction.options.getString('tetik') || '').toLocaleLowerCase('tr');
        const i = g.otoCevap.findIndex((o) => o.tetik === tetik);
        if (i < 0) return interaction.reply({ content: 'Bulunamadı!', ephemeral: true });
        g.otoCevap.splice(i, 1);
        save();
        return interaction.reply({ embeds: [ok('🗑️ Silindi.')] });
      }
      const tetik = (interaction.options.getString('tetik') || '').toLocaleLowerCase('tr').slice(0, 50);
      const cevap = (interaction.options.getString('cevap') || '').slice(0, 500);
      if (!tetik || !cevap) return interaction.reply({ content: 'Tetik + cevap şart! Örn: tetik:`selam` cevap:`Hoş geldin!`', ephemeral: true });
      if (g.otoCevap.length >= 20) return interaction.reply({ content: 'En fazla 20 kayıt!', ephemeral: true });
      const var1 = g.otoCevap.find((o) => o.tetik === tetik);
      if (var1) var1.cevap = cevap;
      else g.otoCevap.push({ tetik, cevap });
      save();
      return interaction.reply({ embeds: [ok(`🤖 Eklendi! **${tetik}** yazılınca:\n> ${cevap}`)] });
    },
  },
  {
    data: {
      name: 'yedek', description: '💾 Sunucu yedeği al / geri yükle!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Al 💾', value: 'al' }, { name: 'Yükle ♻️', value: 'yukle' }, { name: 'Liste', value: 'liste' }] },
        { type: 3, name: 'id', description: 'Yedek ID (yükle için)', required: false },
        { type: 3, name: 'onay', description: 'Yükleme için EVET yaz!', required: false },
      ],
    },
    async execute(interaction) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      const d = require('../src/db').db();
      if (!d.yedekler) d.yedekler = {};
      const key = interaction.guild.id;
      if (!d.yedekler[key]) d.yedekler[key] = [];
      if (islem === 'liste') {
        if (!d.yedekler[key].length) return interaction.reply({ content: 'Yedek yok! `/yedek islem:Al`', ephemeral: true });
        const { kart: _k } = require('../src/tasarim');
        return interaction.reply({ embeds: [_k(null, { baslik: '💾 Yedekler', aciklama: d.yedekler[key].map((y) => `\`${y.id}\` — <t:${Math.floor(y.tarih / 1000)}:R> (${y.rol} rol, ${y.kanal} kanal)`).join('\n') })], ephemeral: true });
      }
      if (islem === 'al') {
        const snap = await yedekAl(interaction.guild);
        d.yedekler[key].unshift(snap);
        d.yedekler[key] = d.yedekler[key].slice(0, 3);
        save();
        return interaction.reply({ embeds: [ok(`💾 Yedek alındı! ID: \`${snap.id}\`\n🎭 ${snap.rol} rol • 📁 ${snap.kanal} kanal\nGeri yüklemek için: \`/yedek islem:Yükle id:${snap.id} onay:EVET\``)] });
      }
      if (interaction.options.getString('onay') !== 'EVET') {
        return interaction.reply({ content: '⚠️ **DİKKAT:** Mevcut kanallar/roller silinip yedek kurulacak!\nEminsen `onay` kutusuna **EVET** yazıp tekrar dene.', ephemeral: true });
      }
      if (interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Yükleme sadece **sunucu sahibi** yapabilir!', ephemeral: true });
      }
      const y = d.yedekler[key].find((x) => x.id === (interaction.options.getString('id') || '').toUpperCase());
      if (!y) return interaction.reply({ content: 'Yedek bulunamadı! `/yedek islem:Liste`', ephemeral: true });
      await interaction.reply({ content: '♻️ Yedek yükleniyor... (1-2 dk sürebilir)', ephemeral: true });
      const sonuc = await yedekYukle(interaction.guild, y);
      return interaction.followUp({ content: `✅ Yükleme bitti! ${sonuc}`, ephemeral: true }).catch(() => {});
    },
  },
  {
    data: {
      name: 'giris-dm', description: '💌 Yeni gelene özel karşılama DM\'i!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ayarla', value: 'ayarla' }, { name: 'Kapat', value: 'kapat' }, { name: 'Test', value: 'test' }] },
        { type: 3, name: 'mesaj', description: 'DM metni ({kullanıcı} {sunucu})', required: false },
      ],
    },
    async execute(interaction) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      if (islem === 'kapat') {
        setGuild(interaction.guild.id, { girisDM: null });
        return interaction.reply({ embeds: [ok('💌 Giriş DM kapatıldı.')] });
      }
      if (islem === 'test') {
        const g = getGuild(interaction.guild.id);
        if (!g.girisDM) return interaction.reply({ content: 'Önce ayarla!', ephemeral: true });
        await interaction.user.send(String(g.girisDM).replace(/{kullanıcı}/g, `${interaction.user}`).replace(/{sunucu}/g, interaction.guild.name)).catch(() => null);
        return interaction.reply({ content: '📨 Test DM\'ne gönderildi! (gelmediyse DM\'in kapalıdır)', ephemeral: true });
      }
      const mesaj = (interaction.options.getString('mesaj') || '').slice(0, 1000);
      if (!mesaj) return interaction.reply({ content: 'Mesaj yaz! Değişkenler: {kullanıcı} {sunucu}', ephemeral: true });
      setGuild(interaction.guild.id, { girisDM: mesaj });
      return interaction.reply({ embeds: [ok(`💌 Giriş DM ayarlandı!\n> ${mesaj.slice(0, 300)}`)] });
    },
  },
  {
    data: {
      name: 'seviye-hiz', description: '🚀 XP kazanma hızı 1-5x!',
      contexts: [0],
      options: [{ type: 4, name: 'carpan', description: 'Çarpan (boş = göster)', required: false, min_value: 1, max_value: 5 }],
    },
    async execute(interaction) {
      if (!premKontrol(interaction)) return;
      const c = interaction.options.getInteger('carpan');
      if (c === null || c === undefined) {
        return interaction.reply({ content: `🚀 Mevcut hız: **${getGuild(interaction.guild.id).seviyeHiz || 1}x**`, ephemeral: true });
      }
      setGuild(interaction.guild.id, { seviyeHiz: c });
      return interaction.reply({ embeds: [ok(`🚀 XP hızı **${c}x** oldu!`)] });
    },
  },
  {
    data: {
      name: 'sayac-pro', description: '🎯 Detaylı sayaç: hedef + kalan + davet eden!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ayarla', value: 'ayarla' }, { name: 'Kapat', value: 'kapat' }, { name: 'Durum', value: 'durum' }] },
        { type: 4, name: 'hedef', description: 'Üye hedefi (örn: 1000)', required: false, min_value: 1, max_value: 1000000 },
        { type: 7, name: 'kanal', description: 'Sayaç kanalı', required: false },
        { type: 3, name: 'mesaj', description: 'Şablon: {hedef} {kalan} {uye} {son} {davet}', required: false },
      ],
    },
    async execute(interaction, client) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      if (islem === 'kapat') {
        setGuild(interaction.guild.id, { premiumSayac: null });
        return interaction.reply({ embeds: [ok('🎯 Premium sayaç kapatıldı.')] });
      }
      if (islem === 'durum') {
        const sc = getGuild(interaction.guild.id).premiumSayac;
        if (!sc) return interaction.reply({ content: 'Sayaç kurulu değil!', ephemeral: true });
        const kalan = Math.max(0, (sc.hedef || 0) - interaction.guild.memberCount);
        return interaction.reply({ content: `🎯 Hedef: **${sc.hedef}** • Kalan: **${kalan}** • Kanal: <#${sc.kanal}>`, ephemeral: true });
      }
      const hedef = interaction.options.getInteger('hedef');
      const kanal = interaction.options.getChannel('kanal');
      const mesaj = interaction.options.getString('mesaj');
      if (!hedef || !kanal) return interaction.reply({ content: 'Hedef + kanal şart!', ephemeral: true });
      if (!kanal.isTextBased()) return interaction.reply({ content: 'Yazı kanalı seç!', ephemeral: true });
      setGuild(interaction.guild.id, { premiumSayac: { hedef, kanal: kanal.id, mesaj: mesaj || null, mesajId: null } });
      await premiumSayacGuncelle(client, interaction.guild, null, null);
      return interaction.reply({ embeds: [ok(`🎯 Premium sayaç kuruldu: **${hedef}** hedef ${kanal} kanalında!\nKim davet etti, kaç kaldı — hepsi otomatik!`)] });
    },
  },
  {
    data: {
      name: 'hosgeldin', description: '👋 Resimli/embedli hoşgeldin mesajı!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ayarla', value: 'ayarla' }, { name: 'Kapat', value: 'kapat' }, { name: 'Test', value: 'test' }] },
        { type: 3, name: 'baslik', description: 'Embed başlığı', required: false },
        { type: 3, name: 'mesaj', description: 'Mesaj ({kullanıcı} {sunucu})', required: false },
        { type: 3, name: 'renk', description: 'Renk (örn: #8B5CF6, mavi)', required: false },
      ],
    },
    async execute(interaction, client) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      if (islem === 'kapat') {
        setGuild(interaction.guild.id, { hgEmbed: null });
        return interaction.reply({ embeds: [ok('👋 Embed hoşgeldin kapatıldı.')] });
      }
      if (islem === 'test') {
        const g = getGuild(interaction.guild.id);
        if (!g.hgEmbed) return interaction.reply({ content: 'Önce ayarla!', ephemeral: true });
        return interaction.reply({ embeds: [hgVedaEmbed(client, interaction.guild, interaction.user, g.hgEmbed, true)], ephemeral: true });
      }
      const baslik = (interaction.options.getString('baslik') || 'Hoş geldin!').slice(0, 100);
      const mesaj = (interaction.options.getString('mesaj') || '').slice(0, 1000);
      const renk = renkCoz(interaction.options.getString('renk') || '#8B5CF6') || '#8B5CF6';
      if (!mesaj) return interaction.reply({ content: 'Mesaj yaz!', ephemeral: true });
      setGuild(interaction.guild.id, { hgEmbed: { baslik, mesaj, renk } });
      return interaction.reply({ embeds: [ok('👋 Embed hoşgeldin ayarlandı!')] });
    },
  },
  {
    data: {
      name: 'gorusuruz', description: '👋 Resimli/embedli veda mesajı!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ayarla', value: 'ayarla' }, { name: 'Kapat', value: 'kapat' }, { name: 'Test', value: 'test' }] },
        { type: 3, name: 'baslik', description: 'Embed başlığı', required: false },
        { type: 3, name: 'mesaj', description: 'Mesaj ({kullanıcı} {sunucu})', required: false },
      ],
    },
    async execute(interaction, client) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      if (islem === 'kapat') {
        setGuild(interaction.guild.id, { vedaEmbed: null });
        return interaction.reply({ embeds: [ok('👋 Embed veda kapatıldı.')] });
      }
      if (islem === 'test') {
        const g = getGuild(interaction.guild.id);
        if (!g.vedaEmbed) return interaction.reply({ content: 'Önce ayarla!', ephemeral: true });
        return interaction.reply({ embeds: [hgVedaEmbed(client, interaction.guild, interaction.user, g.vedaEmbed, false)], ephemeral: true });
      }
      const baslik = (interaction.options.getString('baslik') || 'Görüşürüz...').slice(0, 100);
      const mesaj = (interaction.options.getString('mesaj') || '').slice(0, 1000);
      if (!mesaj) return interaction.reply({ content: 'Mesaj yaz!', ephemeral: true });
      setGuild(interaction.guild.id, { vedaEmbed: { baslik, mesaj } });
      return interaction.reply({ embeds: [ok('👋 Embed veda ayarlandı!')] });
    },
  },
  {
    data: {
      name: 'oto-roller', description: '🎭 Katılana 3 role kadar otomatik rol!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ekle', value: 'ekle' }, { name: 'Temizle', value: 'temizle' }, { name: 'Liste', value: 'liste' }] },
        { type: 8, name: 'rol', description: 'Eklenecek rol', required: false },
      ],
    },
    async execute(interaction) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      const g = getGuild(interaction.guild.id);
      if (!Array.isArray(g.otoRolCoklu)) g.otoRolCoklu = [];
      if (islem === 'liste') {
        if (!g.otoRolCoklu.length) return interaction.reply({ content: 'Ekstra rol yok!', ephemeral: true });
        return interaction.reply({ content: `🎭 Ekstra oto-roller:\n${g.otoRolCoklu.map((id) => `• <@&${id}>`).join('\n')}`, ephemeral: true });
      }
      if (islem === 'temizle') {
        g.otoRolCoklu = [];
        save();
        return interaction.reply({ embeds: [ok('🗑️ Ekstra oto-roller temizlendi.')] });
      }
      const rol = interaction.options.getRole('rol');
      if (!rol) return interaction.reply({ content: 'Rol seç!', ephemeral: true });
      if (rol.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: '❌ Bu rol benden üstte!', ephemeral: true });
      if (rol.managed) return interaction.reply({ content: '❌ Bot rolü olmaz!', ephemeral: true });
      if (g.otoRolCoklu.includes(rol.id)) return interaction.reply({ content: 'Zaten ekli!', ephemeral: true });
      if (g.otoRolCoklu.length >= 3) return interaction.reply({ content: 'En fazla 3 ekstra rol!', ephemeral: true });
      g.otoRolCoklu.push(rol.id);
      save();
      return interaction.reply({ embeds: [ok(`🎭 ${rol} eklendi! (${g.otoRolCoklu.length}/3)`)] });
    },
  },
  {
    data: {
      name: 'tag', description: '🏷️ İsminde tag olana otomatik rol!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ayarla', value: 'ayarla' }, { name: 'Kapat', value: 'kapat' }, { name: 'Durum', value: 'durum' }] },
        { type: 3, name: 'tag', description: 'Aranacak yazı (örn: ★)', required: false },
        { type: 8, name: 'rol', description: 'Verilecek rol', required: false },
      ],
    },
    async execute(interaction) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      if (islem === 'kapat') {
        setGuild(interaction.guild.id, { tagSistemi: null });
        return interaction.reply({ embeds: [ok('🏷️ Tag sistemi kapatıldı.')] });
      }
      if (islem === 'durum') {
        const t = getGuild(interaction.guild.id).tagSistemi;
        return interaction.reply({ content: t ? `🏷️ Tag: **${t.tag}** → <@&${t.rolId}>` : 'Kapalı.', ephemeral: true });
      }
      const tag = (interaction.options.getString('tag') || '').slice(0, 20);
      const rol = interaction.options.getRole('rol');
      if (!tag || !rol) return interaction.reply({ content: 'Tag + rol şart!', ephemeral: true });
      if (rol.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: '❌ Bu rol benden üstte!', ephemeral: true });
      setGuild(interaction.guild.id, { tagSistemi: { tag: tag.toLocaleLowerCase('tr'), rolId: rol.id } });
      let n = 0;
      try {
        const uyeler = await interaction.guild.members.fetch();
        for (const [, m] of uyeler) {
          if (m.user.bot) continue;
          const varMi = m.user.username.toLocaleLowerCase('tr').includes(tag.toLocaleLowerCase('tr'));
          try {
            if (varMi && !m.roles.cache.has(rol.id)) { await m.roles.add(rol); n++; }
            else if (!varMi && m.roles.cache.has(rol.id)) { await m.roles.remove(rol); }
          } catch {}
          if (n >= 50) break;
        }
      } catch {}
      return interaction.reply({ embeds: [ok(`🏷️ Tag sistemi açıldı: **${tag}** → ${rol}\n⚡ ${n} kişiye anında uygulandı!`)] });
    },
  },
  {
    data: {
      name: 'oto-cekilis', description: '🎉 Sürekli otomatik çekiliş!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ayarla', value: 'ayarla' }, { name: 'Durdur', value: 'durdur' }, { name: 'Liste', value: 'liste' }] },
        { type: 7, name: 'kanal', description: 'Çekiliş kanalı', required: false },
        { type: 3, name: 'sure', description: 'Ne sıklıkla? (örn: 1d, 12h)', required: false },
        { type: 3, name: 'odul', description: 'Ödül ne?', required: false },
      ],
    },
    async execute(interaction) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      const g = getGuild(interaction.guild.id);
      if (!Array.isArray(g.otoCekilis)) g.otoCekilis = [];
      if (islem === 'liste') {
        if (!g.otoCekilis.length) return interaction.reply({ content: 'Kayıtlı oto-çekiliş yok!', ephemeral: true });
        return interaction.reply({ content: g.otoCekilis.map((o, i) => `\`${i + 1}.\` <#${o.kanal}> — her **${o.etiket}** → **${o.odul}**`).join('\n'), ephemeral: true });
      }
      if (islem === 'durdur') {
        g.otoCekilis = [];
        save();
        return interaction.reply({ embeds: [ok('🛑 Tüm oto-çekilişler durduruldu.')] });
      }
      const kanal = interaction.options.getChannel('kanal');
      const sureStr = interaction.options.getString('sure');
      const odul = (interaction.options.getString('odul') || '').slice(0, 200);
      const { parseSure, sureYaz } = require('../src/utils');
      const aralik = parseSure(sureStr || '');
      if (!kanal || !kanal.isTextBased() || !aralik || aralik < 3600_000 || !odul) {
        return interaction.reply({ content: 'Kanal + süre (en az 1h) + ödül şart!', ephemeral: true });
      }
      if (g.otoCekilis.length >= 3) return interaction.reply({ content: 'En fazla 3 oto-çekiliş!', ephemeral: true });
      g.otoCekilis.push({ kanal: kanal.id, aralik, odul, etiket: sureYaz(aralik), son: Date.now() });
      save();
      return interaction.reply({ embeds: [ok(`🎉 Oto-çekiliş kuruldu!\n📍 ${kanal} • ⏱️ Her **${sureYaz(aralik)}** → **${odul}**`)] });
    },
  },
  {
    data: {
      name: 'davet-odul', description: '📨 X davet edene otomatik rol!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ekle', value: 'ekle' }, { name: 'Sil', value: 'sil' }, { name: 'Liste', value: 'liste' }] },
        { type: 4, name: 'sayi', description: 'Kaç davet? (örn: 10)', required: false, min_value: 1, max_value: 10000 },
        { type: 8, name: 'rol', description: 'Verilecek rol', required: false },
      ],
    },
    async execute(interaction) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      const g = getGuild(interaction.guild.id);
      if (!Array.isArray(g.davetRolleri)) g.davetRolleri = [];
      if (islem === 'liste') {
        if (!g.davetRolleri.length) return interaction.reply({ content: 'Kayıt yok! Örn: `/davet-odul islem:Ekle sayi:10 rol:@Davetçi`', ephemeral: true });
        return interaction.reply({ content: g.davetRolleri.sort((a, b) => a.sayi - b.sayi).map((x) => `📨 **${x.sayi}** davet → <@&${x.rolId}>`).join('\n'), ephemeral: true });
      }
      if (islem === 'sil') {
        const s = interaction.options.getInteger('sayi');
        const i = g.davetRolleri.findIndex((x) => x.sayi === s);
        if (i < 0) return interaction.reply({ content: 'Bu sayıda kayıt yok!', ephemeral: true });
        g.davetRolleri.splice(i, 1);
        save();
        return interaction.reply({ embeds: [ok('🗑️ Silindi.')] });
      }
      const s = interaction.options.getInteger('sayi');
      const rol = interaction.options.getRole('rol');
      if (!s || !rol) return interaction.reply({ content: 'Sayı + rol şart!', ephemeral: true });
      if (rol.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: '❌ Bu rol benden üstte!', ephemeral: true });
      const var1 = g.davetRolleri.find((x) => x.sayi === s);
      if (var1) var1.rolId = rol.id;
      else g.davetRolleri.push({ sayi: s, rolId: rol.id });
      save();
      return interaction.reply({ embeds: [ok(`📨 **${s}** davet eden artık otomatik **${rol}** alacak!`)] });
    },
  },
  {
    data: {
      name: 'starboard', description: '⭐ Yıldız panosu: beğenilen mesajları kanala taşı!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Aç', value: 'ac' }, { name: 'Kapat', value: 'kapat' }, { name: 'Durum', value: 'durum' }] },
        { type: 7, name: 'kanal', description: 'Pano kanalı', required: false },
        { type: 4, name: 'esik', description: 'Kaç yıldız gerekli? (varsayılan 3)', required: false, min_value: 1, max_value: 25 },
      ],
    },
    async execute(interaction) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      const g = getGuild(interaction.guild.id);
      if (islem === 'durum') {
        const sb = g.starboard;
        return interaction.reply({ content: sb && sb.kanal ? `⭐ Starboard **AÇIK** → <#${sb.kanal}> • eşik: **${sb.esik || 3}** ⭐` : '⭐ Starboard kapalı.', ephemeral: true });
      }
      if (islem === 'kapat') {
        setGuild(interaction.guild.id, { starboard: null });
        save();
        return interaction.reply({ embeds: [ok('⭐ Starboard kapatıldı.')] });
      }
      const kanal = interaction.options.getChannel('kanal');
      const esik = interaction.options.getInteger('esik') || 3;
      if (!kanal || !kanal.isTextBased()) return interaction.reply({ content: '❌ Bir yazı kanalı seç!', ephemeral: true });
      setGuild(interaction.guild.id, { starboard: { kanal: kanal.id, esik, gonderilen: (g.starboard && g.starboard.gonderilen) || {} } });
      save();
      return interaction.reply({ embeds: [ok(`⭐ Starboard açıldı! ${esik} ⭐ alan mesajlar ${kanal} kanalına taşınacak.`)] });
    },
  },
  {
    data: {
      name: 'toplu-rol', description: '🎭 Herkese/botlara tek tıkla toplu rol ver-al!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Rol Ver', value: 'ver' }, { name: 'Rol Al', value: 'al' }] },
        { type: 8, name: 'rol', description: 'Rol', required: true },
        { type: 3, name: 'hedef', description: 'Kimlere?', required: true, choices: [{ name: 'Herkes', value: 'herkes' }, { name: 'Sadece Kullanıcılar', value: 'kullanici' }, { name: 'Sadece Botlar', value: 'bot' }] },
      ],
    },
    async execute(interaction, client) {
      if (!premKontrol(interaction)) return;
      const rol = interaction.options.getRole('rol');
      const islem = interaction.options.getString('islem');
      const hedef = interaction.options.getString('hedef');
      if (!rol || rol.managed) return interaction.reply({ content: '❌ Geçerli bir rol seç!', ephemeral: true });
      if (rol.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: '❌ Bu rol benden üstte!', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      try {
        const uyeler = await interaction.guild.members.fetch();
        let okSayi = 0, atla = 0;
        for (const [, u] of uyeler) {
          if (u.user.bot && hedef === 'kullanici') continue;
          if (!u.user.bot && hedef === 'bot') continue;
          if (u.id === client.user.id) continue;
          try {
            if (islem === 'ver') { if (!u.roles.cache.has(rol.id)) { await u.roles.add(rol, 'Toplu rol (premium)'); okSayi++; } }
            else { if (u.roles.cache.has(rol.id)) { await u.roles.remove(rol, 'Toplu rol (premium)'); okSayi++; } }
          } catch { atla++; }
        }
        return interaction.editReply({ content: `🎭 Toplu rol **tamam!** ${islem === 'ver' ? 'Verilen' : 'Alınan'}: **${okSayi}** üye${atla ? ` • atlanan: ${atla}` : ''}` });
      } catch {
        return interaction.editReply({ content: '❌ Üyeler alınamadı!' });
      }
    },
  },
  {
    data: {
      name: 'aktif-rol', description: '🔥 Aktif üyelere mesaj sayısına göre otomatik rol!',
      contexts: [0],
      options: [
        { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Rol Ver', value: 'ver' }, { name: 'Liste', value: 'liste' }] },
        { type: 8, name: 'rol', description: 'Rol', required: false },
        { type: 4, name: 'minmesaj', description: 'En az kaç mesaj? (varsayılan 100)', required: false, min_value: 1, max_value: 100000 },
      ],
    },
    async execute(interaction, client) {
      if (!premKontrol(interaction)) return;
      const islem = interaction.options.getString('islem');
      const minMesaj = interaction.options.getInteger('minmesaj') || 100;
      const d = require('../src/db').db();
      const gid = interaction.guild.id;
      const uygun = [];
      for (const [key, v] of Object.entries(d.users)) {
        if (!key.startsWith(gid + '_')) continue;
        if ((v.mesaj || 0) >= minMesaj) uygun.push({ uid: key.split('_')[1], mesaj: v.mesaj });
      }
      uygun.sort((a, b) => b.mesaj - a.mesaj);
      if (islem === 'liste') {
        const satir = uygun.slice(0, 15).map((x, i) => `\`${i + 1}.\` <@${x.uid}> — **${x.mesaj}** mesaj`).join('\n') || 'Kimse barajı geçememiş!';
        return interaction.reply({ content: `🔥 **${minMesaj}+ mesajı olanlar (${uygun.length} kişi):**\n${satir}`.slice(0, 1800), ephemeral: true });
      }
      const rol = interaction.options.getRole('rol');
      if (!rol || rol.managed) return interaction.reply({ content: '❌ Geçerli bir rol seç!', ephemeral: true });
      if (rol.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: '❌ Bu rol benden üstte!', ephemeral: true });
      if (!uygun.length) return interaction.reply({ content: '❌ Barajı geçen üye yok!', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      let okSayi = 0, atla = 0;
      for (const x of uygun.slice(0, 500)) {
        try {
          const u = await interaction.guild.members.fetch(x.uid).catch(() => null);
          if (!u || u.user.bot || u.roles.cache.has(rol.id)) continue;
          await u.roles.add(rol, 'Aktif rol (premium)');
          okSayi++;
        } catch { atla++; }
      }
      return interaction.editReply({ content: `🔥 Aktif rol dağıtıldı! **${okSayi}** üyeye ${rol} verildi${atla ? ` • atlanan: ${atla}` : ''}` });
    },
  },
];

module.exports.premiumSlash = premiumSlash;
module.exports.premiumKomutlar = premiumKomutlar;
module.exports.AVANTAJLAR = AVANTAJLAR;
module.exports.premiumSayacGuncelle = premiumSayacGuncelle;
module.exports.hgVedaEmbed = hgVedaEmbed;