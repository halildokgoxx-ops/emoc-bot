const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const { getGuild, setGuild, db, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const config = require('../config');

// Ticket verisi db().guilds[gid].ticket = { kategori, logKanal, destekRol, sayac, acik: {userId: channelId} }
// Basit tutuyoruz ama ULTRA gelişmiş hissi: panel + butonlar + sebep seçimi + log + transcript

function ticketAyar(gid) {
  const { getGuild } = require('../src/db');
  const g = getGuild(gid);
  if (!g.ticket) g.ticket = { kategori: null, logKanal: null, destekRol: null, sayac: 0, acik: {} };
  if (!g.ticket.acik) g.ticket.acik = {};
  return g.ticket;
}

module.exports = [
  {
    name: 'ticket-kur', aliases: ['ticketkur', 'destek-kur'], category: 'Genel',
    description: 'ULTRA ticket sistemi kurar: panel + buton + log. (!ticket-kur #panel-kanal @destek-rolü)',
    usage: '!ticket-kur #kanal @destek-rolü',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message) {
      const kanal = message.mentions.channels.first();
      const rol = message.mentions.roles.first();
      if (!kanal) return message.reply({ embeds: [err('Panel kanalı etiketle! `!ticket-kur #destek @Destek-Ekibi`')] });

      const g = getGuild(message.guild.id);
      const t = ticketAyar(message.guild.id);
      t.destekRol = rol ? rol.id : null;
      t.logKanal = g.logKanal || null;

      // Kategori oluştur
      let kat = message.guild.channels.cache.find(c => c.name === '🎫-DESTEK' && c.type === ChannelType.GuildCategory);
      if (!kat) {
        try { kat = await message.guild.channels.create({ name: '🎫-DESTEK', type: ChannelType.GuildCategory }); } catch {}
      }
      if (kat) t.kategori = kat.id;
      save();

      const embed = new EmbedBuilder().setColor(config.colors.main).setTitle('🎫 DESTEK TALEBİ OLUŞTUR')
        .setThumbnail(message.guild.iconURL({ size: 256 }))
        .setDescription(
          `Yardıma mı ihtiyacın var? Aşağıdan konusunu seç, özel odan **anında** açılsın!\n\n` +
          `🛠️ **Genel Destek** — soru, yardım\n` +
          `🚨 **Şikayet** — kullanıcı/olay bildir\n` +
          `🤝 **Partner** — partner başvurusu\n` +
          `💡 **Öneri** — fikirlerin\n` +
          `🔒 **Özel** — gizli konu\n\n` +
          `*Kötüye kullananlara ceza verilir.*`
        ).setFooter({ text: `${message.guild.name} • 7/24 destek` }).setTimestamp();

      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('🎫 Konu seç, ticket aç...')
          .addOptions([
            { label: 'Genel Destek', value: 'genel', emoji: '🛠️', description: 'Soru ve yardım' },
            { label: 'Şikayet', value: 'sikayet', emoji: '🚨', description: 'Kullanıcı/olay bildir' },
            { label: 'Partner', value: 'partner', emoji: '🤝', description: 'Partner başvurusu' },
            { label: 'Öneri', value: 'oneri', emoji: '💡', description: 'Fikrini paylaş' },
            { label: 'Özel', value: 'ozel', emoji: '🔒', description: 'Gizli konu' },
          ])
      );

      await kanal.send({ embeds: [embed], components: [menu] }).catch(() => null);
      return message.reply({ embeds: [ok(`🎫 Ticket paneli ${kanal} kanalına kuruldu!\n👥 Destek rolü: ${rol || 'ayarlanmadı'}\n📁 Kategori: ${kat || 'oluşturulamadı'}\n\nKomutlar: \`!ticket-kapat\` \`!ticket-ekle @k\` \`!ticket-cikar @k\``)] });
    },
  },
  {
    name: 'ticket-kapat', aliases: ['t-kapat', 'kapat'], category: 'Genel',
    description: 'Bulunduğun ticket kanalını kapatır (transcript loga gider).', usage: '!ticket-kapat [sebep]',
    async run(message, args) {
      const t = ticketAyar(message.guild.id);
      const acikMi = Object.entries(t.acik).find(([uid, cid]) => cid === message.channel.id);
      if (!acikMi && !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply({ embeds: [err('Burası bir ticket kanalı değil!')] });
      const sebep = args.join(' ') || 'Belirtilmedi';

      // Transcript topla (son 100 mesaj)
      let transcript = '';
      try {
        const msgs = await message.channel.messages.fetch({ limit: 100 });
        transcript = [...msgs.values()].reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString('tr-TR')}] ${m.author.tag}: ${m.content || '[embed/medya]'}`).join('\n').slice(0, 4000);
      } catch {}

      const g = getGuild(message.guild.id);
      if (g.logKanal) {
        const lc = message.guild.channels.cache.get(g.logKanal);
        if (lc) lc.send({ embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle(`🎫 Ticket Kapatıldı — #${message.channel.name}`).setDescription(`👤 Sahip: <@${acikMi ? acikMi[0] : '?'}>\n👮 Kapatan: ${message.author}\n📝 Sebep: ${sebep}\n\n**Konuşma:**\n\`\`\`\n${transcript || 'alınamadı'}\n\`\`\``.slice(0, 4000)).setTimestamp()] }).catch(() => {});
      }
      if (acikMi) { delete t.acik[acikMi[0]]; save(); }
      await message.reply('🔒 Ticket **5 saniye** içinde siliniyor...');
      setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    },
  },
  {
    name: 'ticket-ekle', aliases: ['t-ekle'], category: 'Genel',
    description: 'Ticketa kullanıcı ekler.', usage: '!ticket-ekle @kullanıcı',
    async run(message) {
      const t = ticketAyar(message.guild.id);
      if (!Object.values(t.acik).includes(message.channel.id)) return message.reply({ embeds: [err('Burası ticket kanalı değil!')] });
      const h = message.mentions.members.first();
      if (!h) return message.reply({ embeds: [err('`!ticket-ekle @kullanıcı`')] });
      await message.channel.permissionOverwrites.edit(h, { ViewChannel: true, SendMessages: true }).catch(() => null);
      return message.reply({ embeds: [ok(`${h} ticketa eklendi.`)] });
    },
  },
  {
    name: 'ticket-cikar', aliases: ['t-çıkar', 't-cikar'], category: 'Genel',
    description: 'Ticketdan kullanıcı çıkarır.', usage: '!ticket-cıkar @kullanıcı',
    async run(message) {
      const t = ticketAyar(message.guild.id);
      if (!Object.values(t.acik).includes(message.channel.id)) return message.reply({ embeds: [err('Burası ticket kanalı değil!')] });
      const h = message.mentions.members.first();
      if (!h) return message.reply({ embeds: [err('`!ticket-cıkar @kullanıcı`')] });
      await message.channel.permissionOverwrites.delete(h).catch(() => null);
      return message.reply({ embeds: [ok(`${h} ticketdan çıkarıldı.`)] });
    },
  },
  // ---- İNTERNAL: menü + butonlar (index.js çağırır) ----
  {
    name: '__ticket_internal__', aliases: [], category: 'Sistem', description: 'internal', usage: '',
    async run() {},
    async select(interaction, client) {
      // ticket_menu
      const t = ticketAyar(interaction.guild.id);
      if (t.acik[interaction.user.id]) {
        const eski = interaction.guild.channels.cache.get(t.acik[interaction.user.id]);
        if (eski) return interaction.reply({ content: `❌ Zaten açık ticketın var: ${eski}`, ephemeral: true });
      }
      const konu = interaction.values[0];
      const konuAd = { genel: '🛠️-genel', sikayet: '🚨-şikayet', partner: '🤝-partner', oneri: '💡-öneri', ozel: '🔒-özel' }[konu] || '🎫-destek';
      t.sayac = (t.sayac || 0) + 1;
      const isim = `${konuAd}-${t.sayac}`;
      save();

      try {
        const kanal = await interaction.guild.channels.create({
          name: isim, type: ChannelType.GuildText,
          parent: t.kategori || null,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            ...(t.destekRol ? [{ id: t.destekRol, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
          ],
        });
        t.acik[interaction.user.id] = kanal.id;
        save();

        const embed = new EmbedBuilder().setColor(config.colors.success).setTitle(`🎫 ${isim}`)
          .setDescription(`Selam ${interaction.user}! Destek ekibi yakında burada olacak.\n**Konu:** ${konu}\n\nLütfen sorunu detaylı yaz 👇`).setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_kapat').setLabel('🔒 Kapat').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('ticket_kilit').setLabel('⏸️ Beklet').setStyle(ButtonStyle.Secondary),
        );
        await kanal.send({ content: `${interaction.user} ${t.destekRol ? `<@&${t.destekRol}>` : ''}`, embeds: [embed], components: [row] });
        return interaction.reply({ content: `✅ Ticket açıldı: ${kanal}`, ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: '❌ Kanal açamadım! Yetkilerimi kontrol et.', ephemeral: true });
      }
    },
    async button(interaction, client) {
      if (interaction.customId === 'ticket_kapat') {
        await interaction.reply('🔒 Kapanıyor... `!ticket-kapat <sebep>` ile detaylı kapatabilirsin. 5sn...');
        setTimeout(() => {
          const t = ticketAyar(interaction.guild.id);
          const giris = Object.entries(t.acik).find(([u, c]) => c === interaction.channel.id);
          if (giris) { delete t.acik[giris[0]]; save(); }
          interaction.channel.delete().catch(() => {});
        }, 5000);
      } else if (interaction.customId === 'ticket_kilit') {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }).catch(() => {});
        await interaction.reply('⏸️ Ticket beklemeye alındı (yazma kapatıldı).');
      }
    },
  },
];
