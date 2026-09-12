const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const { getUser } = require('../src/db');
const { ok, err, repRozet } = require('../src/embeds');
const { animeGif } = require('../src/gif');

const KATEGORI_EMOJI = {
  'Genel': '📦', 'Moderasyon': '🛡️', 'Güvenlik': '🔒', 'İtibar': '⭐',
  'Ekonomi': '💰', 'Seviye': '📈', 'Eğlence': '🎉', 'Partner': '🤝', 'Özel': '✨',
  'İşlevsel': '🧰', 'Premium': '👑',
};

const KATEGORI_ORNEK = {
  'Genel': '`/qr discord.gg/abc` • `/hava ankara` • `/anket`',
  'Moderasyon': '`/purge 20 botlar` • `/sicil @kullanıcı` • `/sunucu-kilit`',
  'Güvenlik': '`/güvenlik-ultra` • `/güvenlik-skor` • `/oto-rol @Üye`',
  'İtibar': '`/itibar bak @kullanıcı` • `/itibar top` • `/itibar ver @kullanıcı`',
  'Premium': '`/premium bilgi` • `/premium yapiskan` • `/premium yedek`',
  'Ekonomi': '`/günlük` • `/kumar 100` • `/zenginler`',
  'Seviye': '`/seviye` • `/liderlik`',
  'Eğlence': '`/duello @rakip 100` • `/anime hug @kullanıcı` • `/ruh-esi`',
  'Partner': '`/partner ayarla` • `/partner-radar` • `/vitrin`',
  'Özel': '`/kader` • `/sunucu-dna` • `/vibe @kullanıcı`',
  'İşlevsel': '`/hava istanbul` • `/doviz` • `/deprem` • `/cevir en tr hello`',
};

const HELP_GIFLER = ['happy', 'dance', 'wink', 'smile', 'yeet', 'blush'];

function loncaPrefix(gid) {
  try {
    const { getGuild } = require('../src/db');
    const ozel = String(getGuild(gid).prefix || '').trim();
    if (ozel && require('../src/premium').premiumMu(gid)) return ozel.slice(0, 5);
  } catch {}
  return config.prefix;
}
async function yardimEmbed(client, kategori = null, oneEk = null) {
  const cmdler = [...client.commands.values()];
  const gif = await animeGif(HELP_GIFLER[Math.floor(Math.random() * HELP_GIFLER.length)]).catch(() => null);
  const pref = oneEk || config.prefix;
  if (!kategori) {
    const e = new EmbedBuilder()
      .setColor(config.colors.main)
      .setTitle(`🤖 ${client.user.username} — Yardım Menüsü`)
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .setDescription(
        `Selam! Ben **her şeyi yapan public bot** 🤖\n` +
        `Slash: \`/\` • Prefix: \`${pref}\` • Toplam **${cmdler.length} komut**\n\n` +
        Object.keys(KATEGORI_EMOJI).map(k => {
          const sayi = cmdler.filter(c => c.category === k).length;
          return `${KATEGORI_EMOJI[k]} **${k}** — \`${sayi} komut\``;
        }).join('\n') +
        `\n\n👇 Menüden kategori seç, komutları + **örnekleri** gör.\n⭐ Hızlı başla: \`${pref}1 @kullanıcı\` ile itibar ver!`
      )
      .addFields(
        { name: '⭐ Popüler', value: '`/profil` `/itibar-top` `/duello` `/sicil` `/hava` `/qr`', inline: false },
        { name: '💡 Örnek Kullanımlar', value: '`/purge 20 botlar` • `/sicil @kullanıcı` • `/hava ankara` • `/cevir en tr hello` • `/duello @rakip 100`', inline: false },
        { name: '🔗 Linkler', value: '`/davet` yazarak botu sunucuna ekle!', inline: false },
      )
      .setImage(gif || null)
      .setFooter({ text: `${client.user.username} • Diğer botlarda olmayan özelliklerle dolu!` })
      .setTimestamp();
    return e;
  }
  const liste = cmdler.filter(c => c.category === kategori);
  let slashMod = null;
  try { slashMod = require('../src/slash'); } catch {}
  const ad = (c) => {
    if (c.name.startsWith('partner')) return '`/partner` (alt komut)';
    if (c.name === 'itibar' || c.name === 'itibar-top') return '`/itibar` (alt komut)';
    if (c.category === 'Premium') return '`/premium` (alt komut)';
    if (c.name === 'level') return '`/level` (alt komut)';
    if (c.name === '1') return '`!1`';
    if (c.name === '-1') return '`!-1` (kaldırıldı)';
    if (slashMod && slashMod.isSlash(c.name)) return `\`/${c.name}\``;
    return `\`!${c.name}\``;
  };
  const e = new EmbedBuilder()
    .setColor(config.colors.main)
    .setTitle(`${KATEGORI_EMOJI[kategori] || '📌'} ${kategori} Komutları (${liste.length})`)
    .setDescription(liste.map(c => `${ad(c)} — ${c.description}`).join('\n').slice(0, 3500))
    .addFields({ name: '💡 Örnekler', value: KATEGORI_ORNEK[kategori] || '`/yardım`', inline: false })
    .setImage(gif || null)
    .setFooter({ text: `Detay: /komut-bilgi komut:yardım • Prefix de çalışır: !${liste[0] ? liste[0].name : 'yardım'}` })
    .setTimestamp();
  return e;
}

function yardimRow(client, aktif = null) {
  const cats = Object.keys(KATEGORI_EMOJI);
  const menu = new StringSelectMenuBuilder()
    .setCustomId('yardim_menu')
    .setPlaceholder('📂 Kategori seç...')
    .addOptions(cats.map(k => ({ label: k, value: k, emoji: KATEGORI_EMOJI[k], description: `${client.commands.filter ? '' : ''}${[...client.commands.values()].filter(c => c.category === k).length} komut` })));
  return [new ActionRowBuilder().addComponents(menu)];
}

module.exports = [
  {
    name: 'yardim', aliases: ['help', 'yardım', 'komutlar', 'h'], category: 'Genel',
    description: 'Süper yardım menüsü (kategorili, menülü).',
    usage: '!yardım [kategori]',
    async run(message, args, client) {
      const kat = args[0] ? Object.keys(KATEGORI_EMOJI).find(k => k.toLocaleLowerCase('tr') === args.join(' ').toLocaleLowerCase('tr')) : null;
      const pref = message.guild ? loncaPrefix(message.guild.id) : config.prefix;
      if (kat) {
        return message.reply({ embeds: [await yardimEmbed(client, kat, pref)], components: yardimRow(client, kat) });
      }
      const msg = await message.reply({ embeds: [await yardimEmbed(client, null, pref)], components: yardimRow(client) });
      const coll = msg.createMessageComponentCollector({ time: 120_000 });
      coll.on('collect', async (i) => {
        try {
          if (i.user.id !== message.author.id) return await i.reply({ content: 'Bu menü sana ait değil!', ephemeral: true }).catch(() => {});
          await i.update({ embeds: [await yardimEmbed(client, i.values[0], pref)], components: yardimRow(client, i.values[0]) });
        } catch {}
      });
      coll.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    },
  },
  {
    name: 'komut-bilgi', aliases: ['kb', 'cmdinfo'], category: 'Genel',
    description: 'Bir komutun detayını gösterir.',
    usage: '!komut-bilgi <komut>',
    async run(message, args, client) {
      const isim = (args[0] || '').toLowerCase();
      const c = client.commands.get(isim) || [...client.commands.values()].find(x => (x.aliases || []).includes(isim));
      if (!c) return message.reply({ embeds: [err('Komut bulunamadı! `!yardım` yaz.')] });
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`📖 !${c.name}`).setDescription(c.description || 'Açıklama yok.').addFields({ name: 'Kullanım', value: `\`${c.usage || '!' + c.name}\``, inline: false }, { name: 'Kategori', value: c.category || 'Genel', inline: true }, { name: 'Diğer adlar', value: (c.aliases || []).map(a => `\`${a}\``).join(', ') || 'Yok', inline: true })] });
    },
  },
  {
    name: 'ping', aliases: ['gecikme'], category: 'Genel',
    description: 'Botun gecikmesini gösterir.', usage: '!ping',
    async run(message, client) {
      const { kart, pingRenk, cubuk } = require('../src/tasarim');
      const t0 = Date.now();
      const gonder = await message.reply('🏓 Ölçülüyor...');
      const cevap = Date.now() - t0;
      const api = Math.round((client || message.client).ws.ping);
      const k = client || message.client;
      const durum = api < 150 ? '🟢 IŞIK HIZINDA' : api < 300 ? '🟡 STABİL' : '🔴 YOĞUN';
      const e = kart(k, {
        renk: pingRenk(api),
        baslik: '🏓 Pong!',
        aciklama: `**${durum}**`,
        alanlar: [
          { name: '📡 API Gecikmesi', value: `**${api}ms**\n${cubuk(Math.min(api, 500), 500, 10)}`, inline: true },
          { name: '💬 Yanıt Hızı', value: `**${cevap}ms**\n${cubuk(Math.min(cevap, 2000), 2000, 10)}`, inline: true },
          { name: '⏱️ Çalışma Süresi', value: `<t:${Math.floor((Date.now() - k.uptime) / 1000)}:R>`, inline: true },
        ],
      });
      return gonder.edit({ content: '', embeds: [e] });
    },
  },
  {
    name: 'botbilgi', aliases: ['botinfo', 'istatistik'], category: 'Genel',
    description: 'Bot istatistiklerini gösterir.', usage: '!botbilgi',
    async run(message, client) {
      const e = new EmbedBuilder().setColor(config.colors.main).setTitle(`🤖 ${client.user.username} Bilgi`)
        .setThumbnail(client.user.displayAvatarURL()).addFields(
          { name: '📡 Gecikme', value: `${Math.round(client.ws.ping)}ms`, inline: true },
          { name: '🌍 Sunucu', value: `${client.guilds.cache.size}`, inline: true },
          { name: '👥 Kullanıcı', value: `${client.users.cache.size}`, inline: true },
          { name: '📦 Komut', value: `${client.commands.size}`, inline: true },
          { name: '⏱️ Çalışma', value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R> açıldı`, inline: true },
          { name: '💻 discord.js', value: require('discord.js').version, inline: true },
        ).setTimestamp();
      return message.reply({ embeds: [e] });
    },
  },
  {
    name: 'sunucubilgi', aliases: ['serverinfo', 'sunucu'], category: 'Genel',
    description: 'Sunucu bilgilerini gösterir.', usage: '!sunucubilgi',
    async run(message) {
      const g = message.guild;
      const e = new EmbedBuilder().setColor(config.colors.main).setTitle(`🌍 ${g.name}`)
        .setThumbnail(g.iconURL({ size: 256 })).addFields(
          { name: '👑 Sahip', value: `<@${g.ownerId}>`, inline: true },
          { name: '👥 Üye', value: `${g.memberCount}`, inline: true },
          { name: '📅 Kuruluş', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '💬 Kanal', value: `${g.channels.cache.size}`, inline: true },
          { name: '🎭 Rol', value: `${g.roles.cache.size}`, inline: true },
          { name: '😀 Emoji', value: `${g.emojis.cache.size}`, inline: true },
          { name: '🔒 Doğrulama', value: `${g.verificationLevel}`, inline: true },
          { name: '🚀 Boost', value: `Lv.${g.premiumTier} (${g.premiumSubscriptionCount || 0} boost)`, inline: true },
          { name: '🆔 ID', value: g.id, inline: false },
        ).setTimestamp();
      return message.reply({ embeds: [e] });
    },
  },
  {
    name: 'kullanicibilgi', aliases: ['kb2', 'userinfo', 'kullanıcıbilgi', 'kim'], category: 'Genel',
    description: 'Kullanıcı bilgisini gösterir.', usage: '!kullanıcibilgi [@kullanıcı]',
    async run(message, args) {
      const m = message.mentions.members.first() || message.member;
      const d = getUser(message.guild.id, m.id);
      const e = new EmbedBuilder().setColor(config.colors.main).setTitle(`👤 ${m.user.tag}`)
        .setThumbnail(m.user.displayAvatarURL({ size: 256 })).addFields(
          { name: '🆔 ID', value: m.id, inline: true },
          { name: '🤖 Bot mu?', value: m.user.bot ? 'Evet' : 'Hayır', inline: true },
          { name: '⭐ İtibar', value: `${d.rep} ${repRozet(d.rep)}`, inline: true },
          { name: '📅 Hesap', value: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '📥 Katılım', value: `<t:${Math.floor((m.joinedAt?.getTime() || Date.now()) / 1000)}:R>`, inline: true },
          { name: '🎭 Roller', value: m.roles.cache.filter(r => r.id !== message.guild.id).map(r => `${r}`).slice(0, 10).join(', ') || 'Yok', inline: false },
        ).setTimestamp();
      return message.reply({ embeds: [e] });
    },
  },
  {
    name: 'avatar', aliases: ['av', 'pp'], category: 'Genel',
    description: 'Avatarı büyük gösterir.', usage: '!avatar [@kullanıcı]',
    async run(message) {
      const u = message.mentions.users.first() || message.author;
      const e = new EmbedBuilder().setColor(config.colors.main).setTitle(`🖼️ ${u.username}`).setImage(u.displayAvatarURL({ size: 1024 })).setTimestamp();
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('PNG Aç').setStyle(ButtonStyle.Link).setURL(u.displayAvatarURL({ size: 1024 })));
      return message.reply({ embeds: [e], components: [row] });
    },
  },
  {
    name: 'afk', aliases: [], category: 'Genel',
    description: 'AFK moduna geçersin, seni etiketleyenlere sebep söylenir.',
    usage: '!afk <sebep>',
    async run(message, args) {
      const sebep = args.join(' ') || 'Sebep belirtilmedi';
      const d = getUser(message.guild.id, message.author.id);
      d.afk = { reason: sebep, date: Date.now() };
      const { save } = require('../src/db'); save();
      return message.reply({ embeds: [ok(`**${message.author.username}** artık AFK: *${sebep}*`)] });
    },
  },
  {
    name: 'anket', aliases: ['oylama', 'poll'], category: 'Genel',
    description: 'Butonlu anket başlatır. (Modern, diğer botlardan güzel!)',
    usage: '!anket <soru> | <şık1> | <şık2> ...',
    slashOptions: [
      { type: 'string', name: 'soru', description: 'Anket sorusu', required: true },
      { type: 'string', name: 'sik1', description: '1. şık', required: true },
      { type: 'string', name: 'sik2', description: '2. şık', required: true },
      { type: 'string', name: 'sik3', description: '3. şık', required: false },
      { type: 'string', name: 'sik4', description: '4. şık', required: false },
      { type: 'string', name: 'sik5', description: '5. şık (👑)', required: false },
      { type: 'string', name: 'sik6', description: '6. şık (👑)', required: false },
      { type: 'string', name: 'sik7', description: '7. şık (👑)', required: false },
      { type: 'string', name: 'sik8', description: '8. şık (👑)', required: false },
      { type: 'string', name: 'sik9', description: '9. şık (👑)', required: false },
    ],
    slashArgs: (i) => {
      let s = `${i.options.getString('soru')} | ${i.options.getString('sik1')} | ${i.options.getString('sik2')}`;
      for (const k of ['sik3', 'sik4', 'sik5', 'sik6', 'sik7', 'sik8', 'sik9']) {
        const v = i.options.getString(k);
        if (v) s += ` | ${v}`;
      }
      return [s];
    },
    async run(message, args) {
      const premAnket = require('../src/premium').premiumMu(message.guild.id);
      const maksSik = premAnket ? 9 : 4;
      const parts = args.join(' ').split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length < 3) return message.reply({ embeds: [err('Kullanım: `!anket Soru | Evet | Hayır` (en az 2 şık)')] });
      const [soru, ...siklar] = parts;
      if (siklar.length > maksSik) return message.reply({ embeds: [err(premAnket ? 'En fazla 9 şık olabilir!' : 'En fazla 4 şık olabilir! (👑 Premium ile 9 şık!)')] });
      const emojiler = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
      const e = new EmbedBuilder().setColor(config.colors.main).setTitle(`📊 ${soru}`).setDescription(siklar.map((s, i) => `${emojiler[i]} **${s}**`).join('\n')).setFooter({ text: `Başlatan: ${message.author.username}${premAnket ? ' • 👑 Premium anket' : ''}` }).setTimestamp();
      const msg = await message.reply({ embeds: [e] });
      for (let i = 0; i < siklar.length; i++) await msg.react(emojiler[i]).catch(() => {});
    },
  },
  {
    name: 'cekilis', aliases: ['çekiliş', 'giveaway'], category: 'Genel',
    description: 'Süreli çekiliş başlatır. Örn: !çekiliş 10m 1 Nitro',
    usage: '!çekiliş <süre> <kazanan-sayısı> <ödül>',
    perms: [PermissionFlagsBits.ManageMessages],
    async run(message, args) {
      const { parseSure, sureYaz } = require('../src/utils');
      const sure = parseSure(args[0]);
      const kazanan = parseInt(args[1], 10);
      const odul = args.slice(2).join(' ');
      if (!sure || sure < 10_000 || sure > 7 * 86400_000) return message.reply({ embeds: [err('Süre geçersiz! Örn: `10m`, `1h`, `1d` (10sn - 7gün arası)')] });
      if (!kazanan || kazanan < 1 || kazanan > 10) return message.reply({ embeds: [err('Kazanan sayısı 1-10 arası olmalı!')] });
      if (!odul) return message.reply({ embeds: [err('Ödül yaz! `!çekiliş 10m 1 Nitro`')] });
      const e = new EmbedBuilder().setColor(config.colors.pink).setTitle(`🎉 ÇEKİLİŞ: ${odul}`).setDescription(`🎁 Ödül: **${odul}**\n👥 Kazanan: **${kazanan}**\n⏱️ Bitiş: <t:${Math.floor((Date.now() + sure) / 1000)}:R> (${sureYaz(sure)})\n\nKatılmak için 🎉'ya bas!`).setFooter({ text: `Başlatan: ${message.author.username}` }).setTimestamp();
      const msg = await message.reply({ embeds: [e] });
      await msg.react('🎉').catch(() => {});
      setTimeout(async () => {
        try {
          const taze = await msg.fetch();
          const users = (await taze.reactions.cache.get('🎉')?.users.fetch())?.filter(u => !u.bot);
          if (!users || !users.size) return message.channel.send(`😢 Çekiliş bitti ama kimse katılmadı! (**${odul}**)`);
          const arr = [...users.values()];
          const secs = [];
          for (let i = 0; i < Math.min(kazanan, arr.length); i++) secs.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
          message.channel.send(`🎉 **ÇEKİLİŞ BİTTİ!**\n🏆 Kazanan(lar): ${secs.map(u => `${u}`).join(', ')}\n🎁 Ödül: **${odul}**\nTebrikler!`);
        } catch {}
      }, sure);
    },
  },
  {
    name: 'davet', aliases: ['invite', 'ekle'], category: 'Genel',
    description: 'Botun davet linkini verir.', usage: '!davet',
    async run(message, client) {
      const link = config.clientId ? `https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=8&scope=bot%20applications.commands` : '`(Bot sahibi CLIENT_ID eklememiş, ama bot zaten burada 😎)`';
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle('🔗 Beni Sunucuna Ekle!').setDescription(link).setTimestamp()] });
    },
  },
  {
    name: 'hatirlat', aliases: ['hatırlat', 'remind'], category: 'Genel',
    description: 'Sana DM/kanaldan hatırlatma kurar. Örn: !hatırlat 10m su iç',
    usage: '!hatırlat <süre> <yazı>',
    async run(message, args) {
      const { parseSure, sureYaz } = require('../src/utils');
      const premHat = require('../src/premium').premiumMu(message.guild.id);
      const sure = parseSure(args[0]);
      const yazi = args.slice(1).join(' ');
      const maksHat = premHat ? 7 * 86400_000 : 6 * 3600_000;
      if (!sure || sure < 10_000 || sure > maksHat) return message.reply({ embeds: [err(premHat ? 'Süre 10sn-7gün arası olmalı!' : 'Süre 10sn-6saat arası! (👑 Premium ile 7 güne kadar!)')] });
      if (!yazi) return message.reply({ embeds: [err('Ne hatırlatayım? `!hatırlat 1h mola ver`')] });
      message.reply({ embeds: [ok(`⏰ Tamam! **${sureYaz(sure)}** sonra hatırlatacağım: *${yazi}*`)] });
      setTimeout(() => message.reply(`${message.author} ⏰ **Hatırlatma:** ${yazi}`).catch(() => {}), sure);
    },
  },
];

module.exports.yardimEmbed = yardimEmbed;
module.exports.yardimRow = yardimRow;
