const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getUser, save } = require('../src/db');
const { ok, err, kisiBulAsync } = require('../src/embeds');
const { parseSure, sureYaz } = require('../src/utils');
const config = require('../config');

async function logla(message, text) {
  const { getGuild } = require('../src/db');
  const g = getGuild(message.guild.id);
  if (!g.logKanal) return;
  const k = message.guild.channels.cache.get(g.logKanal);
  if (k) k.send({ embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle('📋 Mod Log').setDescription(text).setTimestamp()] }).catch(() => {});
}

module.exports = [
  {
    name: 'ban', aliases: [], category: 'Moderasyon', description: 'Kullanıcıyı sunucudan yasaklar.', usage: '!ban @kullanıcı <sebep>',
    perms: [PermissionFlagsBits.BanMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      if (!h) return message.reply({ embeds: [err('Kullanıcı bulunamadı! `!ban @kullanıcı <sebep>`')] });
      if (!h.bannable) return message.reply({ embeds: [err('Onu banlayamam! (Rolüm yetmiyor veya yetkili)')] });
      const sebep = args.slice(1).join(' ') || 'Sebep belirtilmedi';
      await h.ban({ reason: `${message.author.tag}: ${sebep}` }).catch(() => null);
      logla(message, `🔨 ${h.user.tag} **banlandı** • ${message.author} • ${sebep}`);
      return message.reply({ embeds: [ok(`🔨 ${h.user.tag} banlandı.\n📝 Sebep: *${sebep}*`)] });
    },
  },
  {
    name: 'unban', aliases: ['bankaldir'], category: 'Moderasyon', description: 'Banı kaldırır.', usage: '!unban <ID>',
    perms: [PermissionFlagsBits.BanMembers],
    async run(message, args) {
      if (!args[0]) return message.reply({ embeds: [err('ID yaz! `!unban 123456...`')] });
      await message.guild.bans.remove(args[0]).catch(() => null);
      return message.reply({ embeds: [ok(`✅ ${args[0]} ID'li kişinin banı kaldırıldı.`)] });
    },
  },
  {
    name: 'kick', aliases: ['at'], category: 'Moderasyon', description: 'Kullanıcıyı sunucudan atar.', usage: '!kick @kullanıcı <sebep>',
    perms: [PermissionFlagsBits.KickMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      if (!h || !h.kickable) return message.reply({ embeds: [err('Atamam! Kullanıcı bulunamadı veya yetkim yetmiyor.')] });
      const sebep = args.slice(1).join(' ') || 'Sebep belirtilmedi';
      await h.kick(`${message.author.tag}: ${sebep}`).catch(() => null);
      logla(message, `👢 ${h.user.tag} **atıldı** • ${message.author} • ${sebep}`);
      return message.reply({ embeds: [ok(`👢 ${h.user.tag} sunucudan atıldı.`) ] });
    },
  },
  {
    name: 'mute', aliases: ['sustur'], category: 'Moderasyon', description: 'Kullanıcıyı timeout ile susturur. Örn: !mute @k 10m küfür', usage: '!mute @kullanıcı <süre> <sebep>',
    perms: [PermissionFlagsBits.ModerateMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      const sure = parseSure(args[1]);
      if (!h) return message.reply({ embeds: [err('Kullanıcı bulunamadı!')] });
      if (!sure) return message.reply({ embeds: [err('Süre yaz! `!mute @kullanıcı 10m küfür`')] });
      const sebep = args.slice(2).join(' ') || 'Sebep belirtilmedi';
      await h.timeout(sure, `${message.author.tag}: ${sebep}`).catch(() => null);
      logla(message, `🔇 ${h.user.tag} **${sureYaz(sure)} susturuldu** • ${message.author} • ${sebep}`);
      return message.reply({ embeds: [ok(`🔇 ${h} **${sureYaz(sure)}** susturuldu.\n📝 ${sebep}`)] });
    },
  },
  {
    name: 'unmute', aliases: ['unsustur'], category: 'Moderasyon', description: 'Susturmayı kaldırır.', usage: '!unmute @kullanıcı',
    perms: [PermissionFlagsBits.ModerateMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      if (!h) return message.reply({ embeds: [err('Kullanıcı bulunamadı!')] });
      await h.timeout(null).catch(() => null);
      return message.reply({ embeds: [ok(`🔊 ${h} susturması kaldırıldı.`)] });
    },
  },
  {
    name: 'uyar', aliases: ['warn'], category: 'Moderasyon', description: 'Kullanıcıyı uyarır (kayıtlı). 3 uyarıda oto-timeout!', usage: '!uyar @kullanıcı <sebep>',
    perms: [PermissionFlagsBits.ModerateMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      if (!h) return message.reply({ embeds: [err('Kullanıcı bulunamadı!')] });
      const sebep = args.slice(1).join(' ') || 'Sebep belirtilmedi';
      const d = getUser(message.guild.id, h.id);
      d.warns.push({ mod: message.author.id, reason: sebep, date: Date.now() });
      save();
      logla(message, `⚠️ ${h.user.tag} **uyarıldı** (${d.warns.length}/3) • ${message.author} • ${sebep}`);
      let ekstra = '';
      if (d.warns.length >= 3 && h.moderatable) {
        await h.timeout(60 * 60 * 1000, '3 uyarı oto-ceza').catch(() => null);
        ekstra = '\n🚨 **3 uyarıya ulaştı, 1 saat susturuldu!**';
      }
      return message.reply({ embeds: [ok(`⚠️ ${h} uyarıldı. (**${d.warns.length}** uyarısı var)\n📝 ${sebep}${ekstra}`)] });
    },
  },
  {
    name: 'uyarilar', aliases: ['warnings', 'uyarılar'], category: 'Moderasyon', description: 'Uyarıları listeler.', usage: '!uyarılar [@kullanıcı]',
    perms: [PermissionFlagsBits.ModerateMembers],
    async run(message, args) {
      const h = (await kisiBulAsync(message, args, 0)) || message.member;
      const d = getUser(message.guild.id, h.id);
      if (!d.warns.length) return message.reply({ embeds: [ok(`${h} kullanıcısının uyarısı yok. Temiz! ✨`)] });
      const desc = d.warns.map((w, i) => `\`${i + 1}.\` <@${w.mod}>: *${w.reason}* (<t:${Math.floor(w.date / 1000)}:R>)`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle(`⚠️ ${h.user.username} — ${d.warns.length} Uyarı`).setDescription(desc)] });
    },
  },
  {
    name: 'uyari-sil', aliases: ['unwarn'], category: 'Moderasyon', description: 'Uyarı siler. !uyarı-sil @k <sayı|hepsi>', usage: '!uyarı-sil @kullanıcı <sayı|hepsi>',
    perms: [PermissionFlagsBits.ModerateMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      if (!h) return message.reply({ embeds: [err('Kullanıcı bulunamadı!')] });
      const d = getUser(message.guild.id, h.id);
      if (args[1] === 'hepsi') d.warns = [];
      else { const n = parseInt(args[1], 10); if (!n || n < 1 || n > d.warns.length) return message.reply({ embeds: [err('Geçerli sayı yaz!')] }); d.warns.splice(n - 1, 1); }
      save();
      return message.reply({ embeds: [ok(`✅ ${h} uyarısı silindi. Kalan: **${d.warns.length}**`)] });
    },
  },
  {
    name: 'purge', aliases: ['temizle', 'clear', 'sil'], category: 'Moderasyon',
    description: 'Gelişmiş toplu silme: kullanıcı/link/dosya/embed/kelime filtresi + pin korumalı!',
    usage: '!purge <sayı> [filtre]',
    perms: [PermissionFlagsBits.ManageMessages],
    slashOptions: [
      { type: 'integer', name: 'sayi', description: 'Kaç mesaj taransın (free 100, 👑 200)', required: true },
      { type: 'user', name: 'kullanici', description: 'Sadece bu kullanıcının mesajları', required: false },
      { type: 'string', name: 'filtre', description: 'Filtre', required: false, choices: [{ name: '🤖 Botlar', value: 'botlar' }, { name: '🔗 Linkliler', value: 'link' }, { name: '📎 Dosyalılar', value: 'dosya' }, { name: '📦 Embedliler', value: 'embed' }] },
      { type: 'string', name: 'kelime', description: 'Bu kelimeyi içerenler', required: false },
    ],
    slashArgs: (i) => {
      const a = [`${i.options.getInteger('sayi')}`];
      const k = i.options.getUser('kullanici');
      if (k) a.push(`<@${k.id}>`);
      const f = i.options.getString('filtre');
      if (f) a.push(f);
      const w = i.options.getString('kelime');
      if (w) a.push(`kelime:${w}`);
      return a;
    },
    async run(message, args) {
      const { linkMu } = require('../src/utils');
      const premPurge = require('../src/premium').premiumMu(message.guild.id);
      const maksPurge = premPurge ? 200 : 100;
      const sayi = parseInt(args[0], 10);
      if (!sayi || sayi < 1 || sayi > maksPurge) return message.reply({ embeds: [err(premPurge ? '1-200 arası sayı yaz!' : '1-100 arası sayı yaz! (👑 Premium ile 200!)')] });
      const hedef = message.mentions.users.first();
      const rest = args.slice(1).filter(a => !/^<@!?\d+>$/.test(a)).join(' ').toLowerCase();
      const km = rest.match(/kelime:(.+)/);
      const kelime = km ? km[1].trim() : null;
      const anahtar = kelime ? `kelime:${kelime}` : (['botlar', 'link', 'dosya', 'embed'].find(f => rest.split(/\s+/).includes(f)) || (rest && !hedef ? rest : null));

      const msgs = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
      if (!msgs) return message.reply({ embeds: [err('Mesajları okuyamadım!')] });
      let liste = [...msgs.values()].filter(x => !x.pinned && (Date.now() - x.createdTimestamp) < 14 * 86400_1000);
      const taranan = liste.length;
      if (hedef) liste = liste.filter(x => x.author.id === hedef.id);
      if (anahtar === 'botlar') liste = liste.filter(x => x.author.bot);
      else if (anahtar === 'link') liste = liste.filter(x => linkMu(x.content));
      else if (anahtar === 'dosya') liste = liste.filter(x => x.attachments.size > 0);
      else if (anahtar === 'embed') liste = liste.filter(x => x.embeds.length > 0);
      else if (kelime) liste = liste.filter(x => x.content.toLocaleLowerCase('tr').includes(kelime));
      else if (anahtar) liste = liste.filter(x => x.content.toLocaleLowerCase('tr').includes(anahtar));
      liste = liste.slice(0, sayi);
      if (!liste.length) return message.reply({ embeds: [err(`Eşleşen mesaj yok! (${taranan} mesaj tarandı)\n💡 14 günden eskiler ve 📌 pinliler atlanır.`)] });

      let toplam = 0;
      for (let i = 0; i < liste.length; i += 100) {
        const parca = liste.slice(i, i + 100);
        const s = await message.channel.bulkDelete(parca, true).catch(() => null);
        if (!s) break;
        toplam += s.size;
        if (parca.length === 100 && i + 100 < liste.length) await new Promise((r) => setTimeout(r, 1200));
      }
      if (!toplam) return message.reply({ embeds: [err('Silemedim! Yetkimi kontrol et.')] });
      const silinen = { size: toplam };
      const filtreAd = hedef ? `${hedef.tag}` : (anahtar || 'filtre yok');
      const e = new EmbedBuilder().setColor(config.colors.success).setTitle('🧹 Purge Tamamlandı!')
        .addFields(
          { name: '🗑️ Silinen', value: `**${silinen.size}** mesaj`, inline: true },
          { name: '🔍 Filtre', value: filtreAd.slice(0, 100), inline: true },
          { name: '📍 Kanal', value: `${message.channel}`, inline: true },
          { name: '👮 Mod', value: `${message.author}`, inline: true },
          { name: '📌 Pinliler', value: 'Korundu ✅', inline: true },
          { name: '⏳ Eski (14g+)', value: 'Atlandı', inline: true },
        ).setTimestamp();
      const m = await message.channel.send({ embeds: [e] }).catch(() => null);
      if (m) setTimeout(() => m.delete().catch(() => {}), 6000);
      // Detaylı log
      try {
        const { getGuild } = require('../src/db');
        const g = getGuild(message.guild.id);
        const lc = g.logKanal ? message.guild.channels.cache.get(g.logKanal) : null;
        if (lc) {
          const oniz = liste.slice(0, 3).map(x => `• **${x.author.tag}**: ${(x.content || '[medya/embed]').slice(0, 100)}`).join('\n') || 'yok';
          lc.send({ embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle(`🧹 Purge — #${message.channel.name}`).setDescription(`👮 ${message.author} (**${silinen.size}** mesaj)\n🔍 Filtre: ${filtreAd}\n\n**Önizleme:**\n${oniz}`).setTimestamp()] }).catch(() => {});
        }
      } catch {}
    },
  },
  {
    name: 'yavasmod', aliases: ['slowmode'], category: 'Moderasyon', description: 'Yavaş mod ayarlar. !yavaşmod 10 (kapatmak için 0)', usage: '!yavaşmod <saniye>',
    perms: [PermissionFlagsBits.ManageChannels],
    async run(message, args) {
      const sn = parseInt(args[0], 10);
      if (isNaN(sn) || sn < 0 || sn > 21600) return message.reply({ embeds: [err('0-21600 arası saniye yaz!')] });
      await message.channel.setRateLimitPerUser(sn).catch(() => null);
      return message.reply({ embeds: [ok(sn === 0 ? '🐢 Yavaş mod kapatıldı.' : `🐢 Yavaş mod: **${sn}sn**`)] });
    },
  },
  {
    name: 'kilit', aliases: ['lock'], category: 'Moderasyon', description: 'Kanalı kilitler (süreli olabilir: !kilit 10m).', usage: '!kilit [süre]',
    perms: [PermissionFlagsBits.ManageChannels],
    slashOptions: [{ type: 'string', name: 'sure', description: 'Ne kadar kilitli kalsın? (örn: 10m, boşsa süresiz)', required: false }],
    slashArgs: (i) => { const s = i.options.getString('sure'); return s ? [s] : []; },
    async run(message, args) {
      const { parseSure, sureYaz } = require('../src/utils');
      const sure = parseSure(args[0]);
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(() => null);
      if (sure && sure >= 10_000 && sure <= 86400_000) {
        message.reply({ embeds: [ok(`🔒 Kanal **${sureYaz(sure)}** kilitlendi! Süre bitince otomatik açılacak.`)] });
        setTimeout(() => message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).then(() => message.channel.send('🔓 Kilit süresi doldu, kanal açıldı!').catch(() => {})).catch(() => {}), sure);
        return;
      }
      return message.reply({ embeds: [ok('🔒 Kanal kilitlendi. (`!kilitac` ile açarsın)')] });
    },
  },
  {
    name: 'kilitac', aliases: ['unlock', 'kilitaç'], category: 'Moderasyon', description: 'Kanal kilidini açar.', usage: '!kilitac',
    perms: [PermissionFlagsBits.ManageChannels],
    async run(message) {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).catch(() => null);
      return message.reply({ embeds: [ok('🔓 Kanal kilidi açıldı.')] });
    },
  },
  {
    name: 'nuke', aliases: [], category: 'Moderasyon', description: 'Kanalı silip birebir kopyasını açar (temiz sıfırlama).', usage: '!nuke',
    perms: [PermissionFlagsBits.ManageChannels],
    async run(message) {
      const kanal = message.channel;
      const yeni = await kanal.clone().catch(() => null);
      if (!yeni) return message.reply({ embeds: [err('Klonlayamadım!')] });
      await kanal.delete().catch(() => null);
      yeni.send(`☢️ Kanal **${message.author}** tarafından nuke'lendi! Tertemiz 🧼`).catch(() => {});
    },
  },
  {
    name: 'rolver', aliases: ['rol-ver'], category: 'Moderasyon', description: 'Rol verir.', usage: '!rolver @kullanıcı @rol',
    perms: [PermissionFlagsBits.ManageRoles],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      const rol = message.mentions.roles.first();
      if (!h || !rol) return message.reply({ embeds: [err('Kullanım: `!rolver @kullanıcı @rol`')] });
      await h.roles.add(rol).catch(() => null);
      return message.reply({ embeds: [ok(`🎭 ${h} kullanıcısına ${rol} rolü verildi.`)] });
    },
  },
  {
    name: 'rolal', aliases: ['rol-al'], category: 'Moderasyon', description: 'Rol alır.', usage: '!rolal @kullanıcı @rol',
    perms: [PermissionFlagsBits.ManageRoles],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      const rol = message.mentions.roles.first();
      if (!h || !rol) return message.reply({ embeds: [err('Kullanım: `!rolal @kullanıcı @rol`')] });
      await h.roles.remove(rol).catch(() => null);
      return message.reply({ embeds: [ok(`🎭 ${h} kullanıcısından ${rol} rolü alındı.`)] });
    },
  },
  {
    name: 'nick', aliases: ['isim'], category: 'Moderasyon', description: 'Kullanıcının ismini değiştirir.', usage: '!nick @kullanıcı <yeni-isim>',
    perms: [PermissionFlagsBits.ManageNicknames],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      const yeni = args.slice(1).join(' ');
      if (!h || !yeni) return message.reply({ embeds: [err('Kullanım: `!nick @kullanıcı Yeni İsim`')] });
      await h.setNickname(yeni).catch(() => null);
      return message.reply({ embeds: [ok(`✏️ ${h.user.tag} ismi **${yeni}** oldu.`)] });
    },
  },
  {
    name: 'emoji-cal', aliases: ['emojical', 'emojiçal'], category: 'Moderasyon', description: 'Başka sunucudaki emojiyi bu sunucuya çalar. (Benzersiz!)', usage: '!emoji-çal <emoji> <yeni-isim>',
    perms: [PermissionFlagsBits.ManageEmojisAndStickers],
    async run(message, args) {
      const match = (args[0] || '').match(/<(a)?:(\w+):(\d+)>/);
      if (!match) return message.reply({ embeds: [err('Bir emoji at! `!emoji-çal 😎 havali` (özel emoji olmalı)')] });
      const isim = (args[1] || match[2]).replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      const url = `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] ? 'gif' : 'png'}`;
      const e = await message.guild.emojis.create({ attachment: url, name: isim }).catch(() => null);
      if (!e) return message.reply({ embeds: [err('Çalamadım! (Emoji slotu dolu veya yetkim yok)')] });
      return message.reply({ embeds: [ok(`😎 Emoji çalındı: ${e} \` :${isim}: \``)] });
    },
  },
];
