const { PermissionFlagsBits } = require('discord.js');
const { getGuild, setGuild, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { kart, RENK } = require('../src/tasarim');
const P = require('../src/premium');

const AVANTAJLAR =
  '🧲 **Yapışkan rol** — çıkanın rolleri saklanır, dönünce iade! (`/premium yapiskan`)\n' +
  '🤖 **Oto-cevap** — kendi komutlarını yarat! (`/premium oto-cevap`)\n' +
  '💾 **Sunucu yedeği** — al, sakla, tek tıkla geri yükle! (`/premium yedek`)\n' +
  '💌 **Giriş DM** — yeni gelene özel karşılama! (`/premium giris-dm`)\n' +
  '🚀 **Seviye hızı** — 5 kata kadar XP! (`/premium seviye-hiz`)\n' +
  '🏰 **/sunucu kur** — tek tıkla dehşet sunucu\n' +
  '🎉 **Çekiliş PRO** — 30 gün süre, 1000 katılımcı (free: 7 gün/200)\n' +
  '🎁 Günlük x2 • 🚀 XP x2 • ⭐ Profil mührü';

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
];

// ---------- Yedek yardımcıları ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const premiumSlash = {
  data: {
    name: 'premium',
    description: '👑 Premium: aktifleştir + bilgi',
    contexts: [0],
    options: [
      {
        type: 1, name: 'aktiflestir', description: 'Premium kodunu BU sunucuda aktifleştir',
        options: [{ type: 3, name: 'kod', description: 'EMOC-XXXX-XXXX', required: true }],
      },
      { type: 1, name: 'bilgi', description: 'Bu sunucunun premium durumu + avantajlar' },
      {
        type: 1, name: 'yapiskan', description: '👑 Yapışkan rol (çıkanın rolü saklanır)',
        options: [{ type: 3, name: 'islem', description: 'Aç/Kapat/Durum', required: true, choices: [{ name: 'Aç ✅', value: 'ac' }, { name: 'Kapat', value: 'kapat' }, { name: 'Durum', value: 'durum' }] }],
      },
      {
        type: 1, name: 'oto-cevap', description: '👑 Özel oto-cevaplayıcı',
        options: [
          { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ekle', value: 'ekle' }, { name: 'Sil', value: 'sil' }, { name: 'Liste', value: 'liste' }] },
          { type: 3, name: 'tetik', description: 'Hangi yazıda? (örn: selam)', required: false },
          { type: 3, name: 'cevap', description: 'Bot ne yazsın?', required: false },
        ],
      },
      {
        type: 1, name: 'yedek', description: '👑 Sunucu yedeği al / geri yükle',
        options: [
          { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Al 💾', value: 'al' }, { name: 'Yükle ♻️', value: 'yukle' }, { name: 'Liste', value: 'liste' }] },
          { type: 3, name: 'id', description: 'Yedek ID (yükle için)', required: false },
          { type: 3, name: 'onay', description: 'Yükleme için EVET yaz!', required: false },
        ],
      },
      {
        type: 1, name: 'giris-dm', description: '👑 Yeni gelene özel DM',
        options: [
          { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ayarla', value: 'ayarla' }, { name: 'Kapat', value: 'kapat' }, { name: 'Test', value: 'test' }] },
          { type: 3, name: 'mesaj', description: 'DM metni ({kullanıcı} {sunucu})', required: false },
        ],
      },
      {
        type: 1, name: 'seviye-hiz', description: '👑 XP hızı 1-5x',
        options: [{ type: 4, name: 'carpan', description: 'Çarpan (boş = göster)', required: false, min_value: 1, max_value: 5 }],
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
    // --- OP Premium komutlar: premium + yetki şart ---
    if (['yapiskan', 'oto-cevap', 'yedek', 'giris-dm', 'seviye-hiz'].includes(alt)) {
      if (!P.premiumMu(interaction.guild.id)) {
        return interaction.reply({ content: '👑 Bu özellik **PREMIUM**! Kodun varsa `/premium aktiflestir` yaz.\nAvantajlar: `/premium bilgi`', ephemeral: true });
      }
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true });
      }
    }
    if (alt === 'yapiskan') {
      const islem = interaction.options.getString('islem');
      if (islem === 'durum') {
        const g = getGuild(interaction.guild.id);
        const d = require('../src/db').db();
        const sayi = Object.keys(d.yapiskan || {}).filter((k) => k.startsWith(interaction.guild.id + '_')).length;
        return interaction.reply({ content: g.yapiskan ? `🧲 Yapışkan rol **AÇIK** (${sayi} kişinin rolü saklı).` : '🧲 Yapışkan rol kapalı.', ephemeral: true });
      }
      setGuild(interaction.guild.id, { yapiskan: islem === 'ac' });
      return interaction.reply({ embeds: [ok(islem === 'ac' ? '🧲 Yapışkan rol **açıldı**! Çıkanların rolleri saklanıp dönünce iade edilecek.' : '🧲 Yapışkan rol kapatıldı.')] });
    }
    if (alt === 'oto-cevap') {
      const islem = interaction.options.getString('islem');
      const g = getGuild(interaction.guild.id);
      if (!Array.isArray(g.otoCevap)) g.otoCevap = [];
      if (islem === 'liste') {
        if (!g.otoCevap.length) return interaction.reply({ content: 'Liste boş! Örn: `/premium oto-cevap islem:Ekle tetik:selam cevap:Hoş geldin!`', ephemeral: true });
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
    }
    if (alt === 'yedek') {
      const islem = interaction.options.getString('islem');
      const d = require('../src/db').db();
      if (!d.yedekler) d.yedekler = {};
      const key = interaction.guild.id;
      if (!d.yedekler[key]) d.yedekler[key] = [];
      if (islem === 'liste') {
        if (!d.yedekler[key].length) return interaction.reply({ content: 'Yedek yok! `/premium yedek islem:Al`', ephemeral: true });
        return interaction.reply({ embeds: [kart(client, { baslik: '💾 Yedekler', aciklama: d.yedekler[key].map((y) => `\`${y.id}\` — <t:${Math.floor(y.tarih / 1000)}:R> (${y.rol} rol, ${y.kanal} kanal)`).join('\n') })], ephemeral: true });
      }
      if (islem === 'al') {
        const snap = await yedekAl(interaction.guild);
        d.yedekler[key].unshift(snap);
        d.yedekler[key] = d.yedekler[key].slice(0, 3);
        save();
        return interaction.reply({ embeds: [ok(`💾 Yedek alındı! ID: \`${snap.id}\`\n🎭 ${snap.rol} rol • 📁 ${snap.kanal} kanal\nGeri yüklemek için: \`/premium yedek islem:Yükle id:${snap.id} onay:EVET\``)] });
      }
      if (interaction.options.getString('onay') !== 'EVET') {
        return interaction.reply({ content: '⚠️ **DİKKAT:** Mevcut kanallar/roller silinip yedek kurulacak!\nEminsen `onay` kutusuna **EVET** yazıp tekrar dene.', ephemeral: true });
      }
      if (interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Yükleme sadece **sunucu sahibi** yapabilir!', ephemeral: true });
      }
      const y = d.yedekler[key].find((x) => x.id === (interaction.options.getString('id') || '').toUpperCase());
      if (!y) return interaction.reply({ content: 'Yedek bulunamadı! `/premium yedek islem:Liste`', ephemeral: true });
      await interaction.reply({ content: '♻️ Yedek yükleniyor... (1-2 dk sürebilir)', ephemeral: true });
      const sonuc = await yedekYukle(interaction.guild, y);
      return interaction.followUp({ content: `✅ Yükleme bitti! ${sonuc}`, ephemeral: true }).catch(() => {});
    }
    if (alt === 'giris-dm') {
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
    }
    if (alt === 'seviye-hiz') {
      const c = interaction.options.getInteger('carpan');
      if (c === null || c === undefined) {
        return interaction.reply({ content: `🚀 Mevcut hız: **${getGuild(interaction.guild.id).seviyeHiz || 1}x**`, ephemeral: true });
      }
      setGuild(interaction.guild.id, { seviyeHiz: c });
      return interaction.reply({ embeds: [ok(`🚀 XP hızı **${c}x** oldu!`)] });
    }
  },
};
module.exports.premiumSlash = premiumSlash;
module.exports.AVANTAJLAR = AVANTAJLAR;
