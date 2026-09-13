// 🎬🎮 Günlük öneri komutları — prefix-only (slash 100 dolu).
// Kurulum: !oneri-kanal <anime|oyun> #kanal @rol — kur ile otomatik bağlanır.
const { PermissionFlagsBits } = require('discord.js');
const { getGuild, setGuild } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { animeGetir, animeEmbed, oyunGetir, oyunEmbed, gunAnahtar } = require('../src/oneriler');

module.exports = [
  {
    name: 'anime-oneri', aliases: ['animeoneri', 'gunun-anime'], category: 'Özel',
    description: "Bugünün anime önerisini hemen paylaşır. (Kur: !oneri-kanal anime #kanal @rol)",
    usage: '!anime-oneri',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args, client) {
      const m = await message.reply('🎬 Bugünün animesi çekiliyor...').catch(() => null);
      try {
        const veri = await animeGetir(gunAnahtar());
        const g = getGuild(message.guild.id);
        const rol = g.animeRol ? message.guild.roles.cache.get(g.animeRol) : null;
        const hedef = (g.animeOneriKanal && message.guild.channels.cache.get(g.animeOneriKanal)) || message.channel;
        await hedef.send({ content: rol ? `${rol}` : null, embeds: [animeEmbed(client || message.client, veri)] }).catch(() => null);
        await m?.delete().catch(() => {});
      } catch {
        await m?.edit('❌ AniList şu an cevap vermiyor, birazdan tekrar dene!').catch(() => {});
      }
    },
  },
  {
    name: 'oyun-oneri', aliases: ['oyunoneri', 'gunun-oyun'], category: 'Özel',
    description: "Bugünün oyun önerisini hemen paylaşır. (Kur: !oneri-kanal oyun #kanal @rol)",
    usage: '!oyun-oneri',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args, client) {
      const g = getGuild(message.guild.id);
      const rol = g.oyunRol ? message.guild.roles.cache.get(g.oyunRol) : null;
      const hedef = (g.oyunOneriKanal && message.guild.channels.cache.get(g.oyunOneriKanal)) || message.channel;
      await hedef.send({ content: rol ? `${rol}` : null, embeds: [oyunEmbed(client || message.client, oyunGetir(gunAnahtar()))] }).catch(() => null);
      if (hedef.id !== message.channel.id) message.reply({ embeds: [ok(`🎮 Öneri ${hedef} kanalına gönderildi!`)] }).catch(() => {});
    },
  },
  {
    name: 'oneri-kanal', aliases: ['onerikanal', 'oneri-ayarla'], category: 'Özel',
    description: 'Öneri kanalı + bildirim rolü ayarlar. (!oneri-kanal anime #kanal @rol)',
    usage: '!oneri-kanal <anime|oyun> [#kanal] [@rol]',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args) {
      const tur = String(args[0] || '').toLocaleLowerCase('tr');
      if (!['anime', 'oyun'].includes(tur)) {
        const g = getGuild(message.guild.id);
        const satir = (ad, kid, rid) => {
          const k = kid ? `<#${kid}>` : 'ayarlı değil';
          const r = rid ? `<@&${rid}>` : 'yok';
          return `**${ad}:** ${k} • rol: ${r}`;
        };
        return message.reply({
          embeds: [ok(`🎬🎮 Öneri Ayarları\n${satir('Anime', g.animeOneriKanal, g.animeRol)}\n${satir('Oyun', g.oyunOneriKanal, g.oyunRol)}\n\nKur: \`!oneri-kanal anime #anime-öneri @rol\`\nPaylaş: \`!anime-oneri\` / \`!oyun-oneri\` (her gün otomatik de atılır!)`)],
        }).catch(() => {});
      }
      const kanal = message.mentions.channels.first();
      const rol = message.mentions.roles.first();
      if (!kanal && !rol) return message.reply({ embeds: [err('Kanal veya rol etiketle! Örn: !oneri-kanal ' + tur + ' #kanal @rol')] }).catch(() => {});
      const yama = {};
      if (kanal) yama[tur === 'anime' ? 'animeOneriKanal' : 'oyunOneriKanal'] = kanal.id;
      if (rol) yama[tur === 'anime' ? 'animeRol' : 'oyunRol'] = rol.id;
      setGuild(message.guild.id, yama);
      return message.reply({ embeds: [ok(`✅ ${tur === 'anime' ? '🎬 Anime' : '🎮 Oyun'} önerisi bağlandı!\n${kanal ? `📍 Kanal: ${kanal}\n` : ''}${rol ? `🔔 Rol: ${rol}` : ''}\n\nHer gün otomatik paylaşılır!`)] });
    },
  },
];
