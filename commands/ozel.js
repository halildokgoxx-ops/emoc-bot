const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { db, getGuild, setGuild, getUser, save } = require('../src/db');
const { ok, err, repRozet, kisiBulAsync } = require('../src/embeds');
const { gunlukSeed, seedRandom, rastgele } = require('../src/utils');
const config = require('../config');

// ---- 🤫 İtiraf seçim akışı (kanala yazınca / !itiraf ile) ----
// Yazarın mesajı silinir, sadece seçim butonları kalır (içerik görünmez).
// 👤 Hesabımla = kimlikli embed • 🕵️ Gizli = "Gizli Kullanıcı" webhook'u.
const bekleyenItiraf = new Map(); // token -> { yazi, userId, guildId, kanalId, bitis }

async function itirafSecimSor(kanal, user, yazi) {
  const token = Math.random().toString(36).slice(2, 10);
  bekleyenItiraf.set(token, {
    yazi: String(yazi).slice(0, 1500),
    userId: user.id, guildId: kanal.guild.id, kanalId: kanal.id,
    bitis: Date.now() + 5 * 60_000,
  });
  if (bekleyenItiraf.size > 200) bekleyenItiraf.delete(bekleyenItiraf.keys().next().value);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`itiraf_acik_${token}`).setLabel('👤 Hesabım gözüksün').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`itiraf_gizli_${token}`).setLabel('🕵️ Gizli kalsın').setStyle(ButtonStyle.Secondary),
  );
  const m = await kanal.send({ content: `${user} 🤫 İtirafın alındı! Nasıl paylaşayım? (5dk)`, components: [row] }).catch(() => null);
  if (m) setTimeout(() => m.delete().catch(() => {}), 120_000);
  return m;
}

async function itirafGizliGonder(kanal, yazi) {
  try {
    const whlar = await kanal.fetchWebhooks().catch(() => null);
    let wh = whlar ? whlar.find((w) => w.name === 'Gizli Kullanıcı') : null;
    if (!wh) wh = await kanal.createWebhook({ name: 'Gizli Kullanıcı', reason: 'İtiraf gizlilik' }).catch(() => null);
    if (wh) {
      await wh.send({ content: String(yazi).slice(0, 2000), username: 'Gizli Kullanıcı' }).catch(() => null);
      return true;
    }
  } catch {}
  return false;
}

module.exports = [
  {
    name: 'kader', aliases: ['fal', 'gunlukfal', 'günlük-fal'], category: 'Özel',
    description: 'Günlük kader falın (her gün değişir, sana özel). BENZERSİZ!', usage: '!kader',
    async run(message) {
      const r = seedRandom(gunlukSeed(message.author.id))();
      const ask = Math.floor(seedRandom(gunlukSeed(message.author.id + 'ask'))() * 101);
      const sans = Math.floor(seedRandom(gunlukSeed(message.author.id + 'sans'))() * 101);
      const para = Math.floor(seedRandom(gunlukSeed(message.author.id + 'para'))() * 101);
      const yorumlar = ['Yıldızlar senden yana ✨', 'Bugün risk alma ⚠️', 'Beklenmedik güzel haber kapıda 📨', 'Eski bir dost yazacak 💬', 'Sabırlı ol, her şey düzelecek 🌱', 'Bugün itibar günün! !1 dağıt ⭐'];
      const yorum = yorumlar[Math.floor(r * yorumlar.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.pink).setTitle(`🔮 ${message.author.username} — Günlük Kader`).setDescription(`💘 Aşk: %${ask}\n🍀 Şans: %${sans}\n💰 Para: %${para}\n\n📜 *${yorum}*`).setFooter({ text: 'Yarın tekrar gel, kader değişir!' }).setTimestamp()] });
    },
  },
  {
    name: 'ruh-hali', aliases: ['ruhhali', 'mood'], category: 'Özel',
    description: 'Bugünkü ruh halini kaydedersin. (!ruh-hali mutlu)', usage: '!ruh-hali <mutlu/üzgün/enerjik/yorgun/sinirli/aşık/sakin>',
    slashOptions: [
      { type: 'string', name: 'hal', description: 'Ruh halin', required: true, choices: [{ name: '😊 Mutlu', value: 'mutlu' }, { name: '😢 Üzgün', value: 'üzgün' }, { name: '⚡ Enerjik', value: 'enerjik' }, { name: '😴 Yorgun', value: 'yorgun' }, { name: '😡 Sinirli', value: 'sinirli' }, { name: '😍 Aşık', value: 'aşık' }, { name: '😌 Sakin', value: 'sakin' }, { name: '🤩 Heyecanlı', value: 'heyecanlı' }] },
    ],
    async run(message, args) {
      const modlar = { 'mutlu': '😊', 'üzgün': '😢', 'uzgun': '😢', 'enerjik': '⚡', 'yorgun': '😴', 'sinirli': '😡', 'aşık': '😍', 'asik': '😍', 'sakin': '😌', 'hasta': '🤒', 'heyecanlı': '🤩' };
      const sec = (args[0] || '').toLocaleLowerCase('tr');
      if (!modlar[sec]) return message.reply({ embeds: [err('Şunlardan seç: `mutlu, üzgün, enerjik, yorgun, sinirli, aşık, sakin, heyecanlı`')] });
      const d = db();
      const gun = new Date().toISOString().slice(0, 10);
      if (!d.ruh[message.guild.id]) d.ruh[message.guild.id] = {};
      d.ruh[message.guild.id][message.author.id] = { mood: sec, date: gun };
      save();
      return message.reply({ embeds: [ok(`${modlar[sec]} Ruh halin kaydedildi: **${sec}**`)] });
    },
  },
  {
    name: 'ruh-haritasi', aliases: ['ruhharitası', 'ruh-haritası'], category: 'Özel',
    description: 'Sunucunun bugünkü ruh haritası. BENZERSİZ!', usage: '!ruh-haritası',
    async run(message) {
      const d = db();
      const gun = new Date().toISOString().slice(0, 10);
      const harita = d.ruh[message.guild.id] || {};
      const bugun = Object.entries(harita).filter(([k, v]) => v.date === gun);
      if (!bugun.length) return message.reply({ embeds: [err('Bugün kimse ruh halini paylaşmamış! `!ruh-hali mutlu` ile ilk sen ol.')] });
      const say = {};
      for (const [, v] of bugun) say[v.mood] = (say[v.mood] || 0) + 1;
      const emoji = { 'mutlu': '😊', 'üzgün': '😢', 'uzgun': '😢', 'enerjik': '⚡', 'yorgun': '😴', 'sinirli': '😡', 'aşık': '😍', 'asik': '😍', 'sakin': '😌', 'heyecanlı': '🤩' };
      const desc = Object.entries(say).sort((a, b) => b[1] - a[1]).map(([m, c]) => `${emoji[m] || '🙂'} **${m}**: ${c} kişi ${'█'.repeat(Math.round((c / bugun.length) * 10))}`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`🗺️ ${message.guild.name} — Bugünkü Ruh Haritası (${bugun.length} kişi)`).setDescription(desc).setTimestamp()] });
    },
  },
  {
    name: 'vibe', aliases: ['enerji'], category: 'Özel',
    description: 'Kullanıcının vibe puanını hesaplar. BENZERSİZ!', usage: '!vibe [@kullanıcı]',
    async run(message, args) {
      const h = (await kisiBulAsync(message, args, 0)) || message.member;
      const d = getUser(message.guild.id, h.id);
      const puan = Math.max(0, Math.min(100, 50 + (d.rep || 0) * 2 + Math.floor((d.xp || 0) / 50) + (gunlukSeed(h.id) % 20)));
      const yorum = puan > 85 ? '🌟 EFSANE VIBE! Ortamın yıldızı!' : puan > 65 ? '✨ Yüksek vibe!' : puan > 40 ? '🙂 Normal vibe.' : '🌧️ Düşük vibe... !1 ile destekle!';
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.pink).setTitle(`⚡ ${h.user.username} — Vibe: %${puan}`).setDescription(yorum).setTimestamp()] });
    },
  },
  {
    name: 'itiraf', aliases: [], category: 'Özel',
    description: 'İtiraf gönderirsin — kanala yaz veya komutla (hesaplı/gizli seçimli).', usage: '!itiraf <yazı>',
    async run(message, args) {
      const g = getGuild(message.guild.id);
      if (!g.itirafKanal) return message.reply({ embeds: [err('İtiraf kanalı ayarlı değil! Yetkili: `!itiraf-ayarla #kanal`')] });
      const yazi = args.join(' ').trim().slice(0, 1500);
      if (!yazi) return message.reply({ embeds: [err('`!itiraf sevdiğim çocuğa açılamıyorum...`\n💡 İtiraf kanalına direkt yazarsan hesaplı/gizli seçimi çıkar!')] });
      await message.delete().catch(() => {});
      const k = message.guild.channels.cache.get(g.itirafKanal);
      if (!k) return;
      await itirafSecimSor(k, message.author, yazi);
    },
  },
  {
    name: 'itiraf-ayarla', aliases: [], category: 'Özel',
    description: 'İtiraf kanalını ayarlar.', usage: '!itiraf-ayarla #kanal',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message) {
      const k = message.mentions.channels.first();
      if (!k) return message.reply({ embeds: [err('`!itiraf-ayarla #itiraf`')] });
      setGuild(message.guild.id, { itirafKanal: k.id });
      return message.reply({ embeds: [ok(`🤫 İtiraf kanalı ${k} oldu.`)] });
    },
  },
  {
    name: 'vitrin-ekle', aliases: ['sunucu-vitrin'], category: 'Özel',
    description: 'Sunucunu global vitrine eklersin, başkaları bulur. (Partner bulmanın kolay yolu!)', usage: '!vitrin-ekle <açıklama>',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args) {
      const aciklama = args.join(' ');
      if (!aciklama || aciklama.length < 10) return message.reply({ embeds: [err('En az 10 karakter açıklama! `!vitrin-ekle Samimi oyun sunucusu, herkesi bekleriz!`')] });
      let davet = null;
      try { davet = (await message.channel.createInvite({ maxAge: 0, maxUses: 0, reason: 'Vitrin' })).url; } catch {}
      if (!davet) return message.reply({ embeds: [err('Davet oluşturamadım! Yetkim yok.')] });
      const d = db();
      d.vitrin = d.vitrin.filter(v => v.guildId !== message.guild.id);
      d.vitrin.unshift({ guildId: message.guild.id, name: message.guild.name, desc: aciklama, invite: davet, members: message.guild.memberCount, date: Date.now(), owner: message.author.id });
      d.vitrin = d.vitrin.slice(0, 50);
      save();
      return message.reply({ embeds: [ok(`🌟 Sunucun vitrine eklendi!\n\`!vitrin\` yazanlar seni bulabilecek.`)] });
    },
  },
  {
    name: 'vitrin', aliases: ['sunucu-bul', 'vitrine'], category: 'Özel',
    description: 'Vitrindeki rastgele sunucuları gösterir (partner adayı bul!).', usage: '!vitrin',
    async run(message) {
      const v = db().vitrin.filter(x => x.guildId !== message.guild.id);
      if (!v.length) return message.reply({ embeds: [err('Vitrin boş! İlk ekleyen sen ol: `!vitrin-ekle <açıklama>` (yönetici)')] });
      const sec = v.sort(() => Math.random() - 0.5).slice(0, 3);
      const desc = sec.map(x => `🌍 **${x.name}** (${x.members} üye)\n> ${x.desc}\n🔗 ${x.invite}\n🤝 Partner için: \`!partner-istek ${x.invite}\``).join('\n\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle('🌟 Sunucu Vitrini').setDescription(desc).setFooter({ text: 'Sen de ekle: !vitrin-ekle <açıklama>' }).setTimestamp()] });
    },
  },
  {
    name: 'gunluk-gorev', aliases: ['görev', 'gorev'], category: 'Özel',
    description: 'Günlük/haftalık görev durumunu gösterir.', usage: '!günlük-görev',
    async run(message) {
      const { gorevDurum, TUR_AD } = require('../src/gorev');
      const st = gorevDurum(message.guild.id, message.author.id);
      if (!st.ayar.aktif) return message.reply({ embeds: [err('🎯 Görev sistemi bu sunucuda **kapalı!**')] });
      const bar = (v, h) => {
        const oran = h ? Math.min(1, v / h) : 0;
        const d = Math.round(oran * 10);
        return '█'.repeat(d) + '░'.repeat(10 - d);
      };
      const alanlar = [{
        name: '🎯 Günlük Görev',
        value: `${TUR_AD[st.ayar.tur]} • **${st.gunluk.ilerleme}/${st.ayar.gunlukHedef}** ${st.gunluk.tamam ? '✅' : ''}\n${bar(st.gunluk.ilerleme, st.ayar.gunlukHedef)}\n🎁 Ödül: **${st.ayar.gunlukOdul} coin**`,
      }];
      if (st.ayar.haftalikAktif) {
        alanlar.push({
          name: '🏆 Haftalık Görev',
          value: `${TUR_AD[st.ayar.tur]} • **${st.haftalik.ilerleme}/${st.ayar.haftalikHedef}** ${st.haftalik.tamam ? '✅' : ''}\n${bar(st.haftalik.ilerleme, st.ayar.haftalikHedef)}\n🎁 Ödül: **${st.ayar.haftalikOdul} coin**`,
        });
      }
      return message.reply({
        embeds: [new EmbedBuilder().setColor(config.colors.gold).setTitle('🎯 Görevlerin')
          .addFields(...alanlar).setFooter({ text: st.ayar.tur === 'ses' ? 'Seste durarak ilerler (1dk = 1 puan)' : st.ayar.tur === 'ikisi' ? 'Mesaj + ses ikisi de ilerletir' : 'Mesaj yazarak ilerler' }).setTimestamp()],
      });
    },
  },
  {
    name: 'gorev-ayarla', aliases: ['gorevayarla', 'gorev-ac-kapa'], category: 'Genel',
    description: 'Görev sistemini açar/kapatır (Yönetici). Detay ayarlar web panelden!', usage: '!gorev-ayarla <gunluk|haftalik> <ac|kapat>',
    perms: [PermissionFlagsBits.ManageGuild],
    slashArgs: (i) => {
      const s = i.options.getString('sistem') || 'gunluk';
      const is = i.options.getString('islem') || 'ac';
      return [s, is];
    },
    slashOptions: [
      { type: 'string', name: 'sistem', description: 'Hangi görev?', required: true, choices: [{ name: 'Günlük', value: 'gunluk' }, { name: 'Haftalık', value: 'haftalik' }] },
      { type: 'string', name: 'islem', description: 'Aç/Kapat', required: true, choices: [{ name: 'Aç 🟢', value: 'ac' }, { name: 'Kapat 🔴', value: 'kapat' }] },
    ],
    async run(message, args) {
      const sistem = String(args[0] || '').toLocaleLowerCase('tr');
      const islem = String(args[1] || '').toLocaleLowerCase('tr');
      const hangisi = sistem.startsWith('hafta') ? 'haftalik' : sistem.startsWith('gun') ? 'gunluk' : null;
      if (!hangisi || !['ac', 'aç', 'kapat'].includes(islem)) {
        return message.reply({ embeds: [err('Kullanım: `!gorev-ayarla <gunluk|haftalik> <ac|kapat>`\nÖrn: `!gorev-ayarla gunluk kapat`\n💡 Hedef/ödül/kanal/tür ayarları **web panelden** (Seviye Sistemi sayfası)!')] });
      }
      const acik = islem.startsWith('ac') || islem.startsWith('aç');
      if (hangisi === 'haftalik') setGuild(message.guild.id, { gorevHaftalikAktif: acik });
      else setGuild(message.guild.id, { gorevAktif: acik });
      return message.reply({ embeds: [ok(`${hangisi === 'haftalik' ? '🏆 Haftalık' : '🎯 Günlük'} görev **${acik ? '🟢 açıldı' : '🔴 kapatıldı'}!`)] });
    },
  },
  // ---- İNTERNAL: itiraf seçim butonları (index.js çağırır) ----
  {
    name: '__itiraf_internal__', aliases: [], category: 'Sistem', description: 'internal', usage: '',
    async run() {},
    async button(interaction, client) {
      const m = interaction.customId.match(/^itiraf_(acik|gizli)_([a-z0-9]+)$/);
      if (!m) return interaction.reply({ content: '❌ Bilinmeyen işlem!', ephemeral: true }).catch(() => {});
      const [, tur, token] = m;
      const kayit = bekleyenItiraf.get(token);
      if (!kayit || kayit.bitis < Date.now()) {
        bekleyenItiraf.delete(token);
        return interaction.reply({ content: '❌ Süre dolmuş! İtirafını tekrar yaz.', ephemeral: true }).catch(() => {});
      }
      if (interaction.user.id !== kayit.userId) {
        return interaction.reply({ content: '❌ Bu seçim sana ait değil!', ephemeral: true }).catch(() => {});
      }
      bekleyenItiraf.delete(token);
      const kanal = interaction.guild.channels.cache.get(kayit.kanalId);
      if (!kanal || !kanal.isTextBased()) {
        return interaction.reply({ content: '❌ Kanal bulunamadı!', ephemeral: true }).catch(() => {});
      }
      if (tur === 'acik') {
        const uye = interaction.member?.user || interaction.user;
        await kanal.send({
          embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🗣️ İtiraf')
            .setAuthor({ name: uye.tag, iconURL: uye.displayAvatarURL({ size: 64 }) })
            .setDescription(kayit.yazi).setTimestamp()],
        }).catch(() => {});
        await interaction.reply({ content: '👤 Hesabınla paylaşıldı!', ephemeral: true }).catch(() => {});
      } else {
        const oldu = await itirafGizliGonder(kanal, kayit.yazi);
        if (!oldu) {
          await kanal.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setTitle('🤫 Anonim İtiraf').setDescription(kayit.yazi).setFooter({ text: 'Kim olduğu bilinmiyor...' }).setTimestamp()] }).catch(() => {});
        }
        await interaction.reply({ content: '🕵️ Gizli paylaşıldı! Kimse bilmeyecek...', ephemeral: true }).catch(() => {});
      }
      await interaction.message.delete().catch(() => {});
    },
  },
];

module.exports.itirafSecimSor = itirafSecimSor;
