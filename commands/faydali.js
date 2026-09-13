const { EmbedBuilder, PermissionFlagsBits, GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType } = require('discord.js');
const { getUser, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { parseSure, sureYaz, rastgele } = require('../src/utils');
const { animeGif } = require('../src/gif');
const config = require('../config');

const SEHIRLER = {
  istanbul: 'Europe/Istanbul', ankara: 'Europe/Istanbul', izmir: 'Europe/Istanbul',
  londra: 'Europe/London', paris: 'Europe/Paris', berlin: 'Europe/Berlin',
  moskova: 'Europe/Moscow', dubai: 'Asia/Dubai', tokyo: 'Asia/Tokyo',
  seul: 'Asia/Seoul', newyork: 'America/New_York', losangeles: 'America/Los_Angeles',
};
function saatYaz(tz) {
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: tz }).format(new Date());
}

module.exports = [
  {
    name: 'kura', aliases: ['kuracek', 'pick', 'sec'], category: 'Eğlence',
    description: 'Seçenekler arasından rastgele seçer. (!kura pizza hamburger)',
    usage: '!kura <seçenek1> <seçenek2> [...]',
    async run(message, args) {
      if (args.length < 2) return message.reply({ embeds: [err('En az 2 seçenek yaz! `!kura pizza hamburger pide`')] });
      let limit = 10;
      try { if (require('../src/premium').premiumMu(message.guild.id)) limit = 20; } catch {}
      if (args.length > limit) {
        return message.reply({ embeds: [err(`❌ Free kura en fazla **${limit}** seçenek!${limit < 20 ? ' 👑 **Premium ile 20!** (`/premium bilgi`)' : ''}`)] });
      }
      const sec = args.slice(0, limit);
      const m = await message.reply('🎲 Çekiliyor...');
      await new Promise((r) => setTimeout(r, 1500));
      const kazanan = sec[rastgele(0, sec.length - 1)];
      const gif = await animeGif('happy').catch(() => null);
      return m.edit({
        content: '',
        embeds: [new EmbedBuilder().setColor(config.colors.gold).setTitle('🎲 KURA SONUCU')
          .setDescription(`Seçenekler: ${sec.map((s) => `\`${s.slice(0, 50)}\``).join(' ')}\n\n## 🏆 Kazanan: **${kazanan.slice(0, 100)}**`)
          .setImage(gif || null).setFooter({ text: `Çeken: ${message.author.username}` }).setTimestamp()],
      }).catch(() => {});
    },
  },
  {
    name: 'saat', aliases: ['saatkac', 'time'], category: 'Genel',
    description: 'Dünya saatlerini gösterir. (!saat tokyo)',
    usage: '!saat [şehir]',
    slashOptions: [
      {
        type: 'string', name: 'sehir', description: 'Şehir', required: false,
        choices: [
          { name: '🇹🇷 İstanbul', value: 'Europe/Istanbul' }, { name: '🇬🇧 Londra', value: 'Europe/London' },
          { name: '🇫🇷 Paris', value: 'Europe/Paris' }, { name: '🇩🇪 Berlin', value: 'Europe/Berlin' },
          { name: '🇷🇺 Moskova', value: 'Europe/Moscow' }, { name: '🇦🇪 Dubai', value: 'Asia/Dubai' },
          { name: '🇯🇵 Tokyo', value: 'Asia/Tokyo' }, { name: '🇰🇷 Seul', value: 'Asia/Seoul' },
          { name: '🇺🇸 New York', value: 'America/New_York' }, { name: '🇺🇸 Los Angeles', value: 'America/Los_Angeles' },
        ],
      },
    ],
    async run(message, args) {
      const ham = (args[0] || '').toLocaleLowerCase('tr').replace(/[^a-z]/g, '');
      if (!ham) {
        const liste = [['🇹🇷 İstanbul', 'Europe/Istanbul'], ['🇬🇧 Londra', 'Europe/London'], ['🇺🇸 New York', 'America/New_York'], ['🇯🇵 Tokyo', 'Asia/Tokyo']];
        return message.reply({
          embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle('🕐 Dünya Saatleri')
            .setDescription(liste.map(([ad, tz]) => `${ad}: **${saatYaz(tz)}**`).join('\n'))
            .setFooter({ text: 'Detay: !saat tokyo' }).setTimestamp()],
        });
      }
      const tz = SEHIRLER[ham] || (/^[a-z]+\/[a-z_]+$/i.test(args[0]) ? args[0] : null);
      if (!tz) return message.reply({ embeds: [err('Şehri anlamadım! Örn: `!saat tokyo` `!saat londra` `!saat dubai`')] });
      try {
        return message.reply(`🕐 **${args[0]}**: **${saatYaz(tz)}**`);
      } catch { return message.reply({ embeds: [err('Saat alınamadı!')] }); }
    },
  },
  {
    name: 'gerisayim', aliases: ['gerisayım', 'countdown', 'timer'], category: 'Genel',
    description: 'Süre bitince kanalda haber veren geri sayım kurar.',
    usage: '!gerisayim <süre> [not]',
    async run(message, args) {
      const sure = parseSure(args[0]);
      const not = args.slice(1).join(' ').slice(0, 200) || 'Süre doldu!';
      if (!sure || sure < 10_000 || sure > 86400_000) return message.reply({ embeds: [err('Süre 10sn-24saat arası! `!gerisayim 10m mola bitti`')] });
      message.reply({ embeds: [ok(`⏱️ Geri sayım kuruldu: **${sureYaz(sure)}** sonra haber vereceğim!\n📝 *${not}*\n*(Bot yeniden başlarsa iptal olur)*`)] });
      setTimeout(() => {
        message.channel.send(`${message.author} ⏰ **GERİ SAYIM BİTTİ:** ${not}`).catch(() => {});
      }, sure);
    },
  },
  {
    name: 'notum', aliases: ['notekle', 'note'], category: 'Genel',
    description: 'Kendine özel not kaydedersin (DM ile gösterilir, gizli!).',
    usage: '!notum <yazı>',
    async run(message, args) {
      const yazi = args.join(' ').slice(0, 300);
      if (!yazi) return message.reply({ embeds: [err('Ne kaydedeyim? `!notum süt al`')] });
      const d = getUser(message.guild.id, message.author.id);
      if (!d.notlar) d.notlar = [];
      if (d.notlar.length >= 10) return message.reply({ embeds: [err('En fazla 10 not! Önce `!not-sil <sıra>` ile sil.')] });
      d.notlar.push({ t: yazi, t2: Date.now() });
      save();
      try {
        await message.author.send(`📝 Notun kaydedildi (**#${d.notlar.length}**):\n> ${yazi}`);
        return message.reply('📨 Notun DM\'ne kaydedildi!').then((m) => setTimeout(() => m.delete().catch(() => {}), 4000)).catch(() => {});
      } catch {
        d.notlar.pop(); save();
        return message.reply({ embeds: [err('DM\'n kapalı! Gizlilik için notlar DM\'den verilir. DM\'ni açıp tekrar dene.')] });
      }
    },
  },
  {
    name: 'notlarim', aliases: ['notlar', 'mynotes'], category: 'Genel',
    description: 'Notlarını DM ile gösterir.',
    usage: '!notlarım',
    async run(message) {
      const d = getUser(message.guild.id, message.author.id);
      if (!d.notlar || !d.notlar.length) return message.reply({ embeds: [err('Notun yok! `!notum <yazı>` ile ekle.')] });
      const liste = d.notlar.map((n, i) => `\`${i + 1}.\` ${n.t}`).join('\n').slice(0, 1800);
      try {
        await message.author.send({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`📝 ${message.author.username} — Notların`).setDescription(liste).setTimestamp()] });
        return message.reply('📨 Notların DM\'ne gönderildi!').then((m) => setTimeout(() => m.delete().catch(() => {}), 4000)).catch(() => {});
      } catch {
        return message.reply({ embeds: [err('DM\'n kapalı! Aç da göndereyim.')] });
      }
    },
  },
  {
    name: 'not-sil', aliases: ['notsil', 'notdel'], category: 'Genel',
    description: 'Notunu silersin.',
    usage: '!not-sil <sıra>',
    async run(message, args) {
      const d = getUser(message.guild.id, message.author.id);
      const n = parseInt(args[0], 10);
      if (!d.notlar || !n || n < 1 || n > d.notlar.length) return message.reply({ embeds: [err('Geçerli sıra yaz! Sıranı `!notlarım` ile gör.')] });
      const silinen = d.notlar.splice(n - 1, 1)[0];
      save();
      return message.reply({ embeds: [ok(`🗑️ Not silindi: *${silinen.t.slice(0, 100)}*`)] });
    },
  },
  {
    name: 'sunucu-banner', aliases: ['banner', 'sunucubanner'], category: 'Genel',
    description: 'Sunucu banner + davet splash görselini gösterir.',
    usage: '!sunucu-banner',
    async run(message) {
      const g = message.guild;
      const banner = g.bannerURL({ size: 1024 });
      const e = new EmbedBuilder().setColor(config.colors.main).setTitle(`🏞️ ${g.name}`)
        .addFields(
          { name: '🚀 Boost', value: `Seviye ${g.premiumTier} (${g.premiumSubscriptionCount || 0} boost)`, inline: true },
          { name: '✨ Partnerli mi?', value: g.partnered ? 'Evet' : 'Hayır', inline: true },
          { name: '✅ Onaylı mı?', value: g.verified ? 'Evet' : 'Hayır', inline: true },
        ).setTimestamp();
      if (banner) e.setImage(banner);
      else e.setDescription('*Bu sunucunun banner görseli yok.* (Boost Seviye 2+ gerekir)');
      return message.reply({ embeds: [e] });
    },
  },
  {
    name: 'rol-liste', aliases: ['roller', 'roles'], category: 'Genel',
    description: 'Rolleri üye sayısıyla listeler.',
    usage: '!rol-liste',
    async run(message) {
      const roller = [...message.guild.roles.cache.values()]
        .filter((r) => r.id !== message.guild.id)
        .sort((a, b) => b.position - a.position)
        .slice(0, 25);
      const desc = roller.map((r) => `${r} — **${r.members.size}** kişi`).join('\n').slice(0, 3900);
      return message.reply({
        embeds: [new EmbedBuilder().setColor(config.colors.main)
          .setTitle(`🎭 Roller (${message.guild.roles.cache.size - 1})`)
          .setDescription(desc).setFooter({ text: 'En yüksekten sıralı • ilk 25' }).setTimestamp()],
      });
    },
  },
  {
    name: 'etkinlik', aliases: ['event', 'etkinlik-olustur'], category: 'Genel',
    description: 'Sunucu etkinliği oluşturur! (!etkinlik 2h Film Gecesi | Sohbet)',
    usage: '!etkinlik <süre> <isim> [| yer]',
    perms: [PermissionFlagsBits.ManageEvents],
    slashOptions: [
      { type: 'string', name: 'sure', description: 'Ne kadar sonra? (örn: 2h, 1d)', required: true },
      { type: 'string', name: 'isim', description: 'Etkinlik adı', required: true },
      { type: 'string', name: 'yer', description: 'Yer (örn: Sohbet odası)', required: false },
    ],
    slashArgs: (i) => {
      const a = [i.options.getString('sure') || '', i.options.getString('isim') || ''];
      const y = i.options.getString('yer');
      if (y) a.push('|', y);
      return a;
    },
    async run(message, args) {
      const ham = args.join(' ').split('|').map((s) => s.trim());
      const ilk = (ham[0] || '').split(/\s+/);
      const sure = parseSure(ilk[0]);
      const isim = ilk.slice(1).join(' ').slice(0, 100);
      const yer = (ham[1] || 'Discord').slice(0, 100);
      if (!sure || sure < 10 * 60_000) return message.reply({ embeds: [err('En az 10dk sonrası olmalı! `!etkinlik 2h Film Gecesi | Sohbet`')] });
      if (!isim) return message.reply({ embeds: [err('İsim yaz! `!etkinlik 1d Turnuva`')] });
      try {
        const etkinlik = await message.guild.scheduledEvents.create({
          name: isim,
          scheduledStartTime: new Date(Date.now() + sure),
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: GuildScheduledEventEntityType.External,
          description: `Oluşturan: ${message.author.tag}`.slice(0, 1000),
          entityMetadata: { location: yer },
          reason: message.author.tag,
        });
        return message.reply({
          embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle('📅 Etkinlik Oluşturuldu!')
            .setDescription(`**${isim}**\n📍 ${yer}\n🕐 <t:${Math.floor((Date.now() + sure) / 1000)}:F>\n🔗 https://discord.com/events/${message.guild.id}/${etkinlik.id}`)
            .setTimestamp()],
        });
      } catch {
        return message.reply({ embeds: [err('Oluşturamadım! (Topluluk özelliği veya yetki gerekli olabilir)')] });
      }
    },
  },
];
