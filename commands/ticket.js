const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder, UserSelectMenuBuilder } = require('discord.js');
const { getGuild, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const config = require('../config');

// Ticket verisi db().guilds[gid].ticket = { kategori, logKanal, destekRol, sayac, acik: {userId: {kanal, konu, aciliyet, devralan, durum, acilma}} }
// Eski string kayıtlar otomatik objeye çevrilir.

const KONULAR = {
  genel: { ad: '🛠️-genel', baslik: 'Genel Destek', emoji: '🛠️', aciklama: 'Soru ve yardım' },
  sikayet: { ad: '🚨-şikayet', baslik: 'Şikayet', emoji: '🚨', aciklama: 'Kullanıcı/olay bildir' },
  partner: { ad: '🤝-partner', baslik: 'Partner', emoji: '🤝', aciklama: 'Partner başvurusu' },
  oneri: { ad: '💡-öneri', baslik: 'Öneri', emoji: '💡', aciklama: 'Fikrini paylaş' },
  ozel: { ad: '🔒-özel', baslik: 'Özel', emoji: '🔒', aciklama: 'Gizli konu' },
  yetkili: { ad: '🎖️-yetkili-alım', baslik: 'Yetkili Alım', emoji: '🎖️', aciklama: 'Yetkili başvurusu' },
};
const ACILIYET = {
  normal: { emoji: '', etiket: 'Normal', renk: 0x57F287 },
  acele: { emoji: '🟡', etiket: 'Acele', renk: 0xFEE75C },
  acil: { emoji: '🔴', etiket: 'ACİL', renk: 0xED4245 },
};

function ticketAyar(gid) {
  const { getGuild, save: _save } = require('../src/db');
  const g = getGuild(gid);
  if (!g.ticket) g.ticket = { kategori: null, logKanal: null, destekRol: null, sayac: 0, acik: {} };
  if (!g.ticket.acik) g.ticket.acik = {};
  // Eski string kayıtları objeye çevir
  for (const [uid, v] of Object.entries(g.ticket.acik)) {
    if (typeof v === 'string') g.ticket.acik[uid] = { kanal: v, konu: 'genel', aciliyet: 'normal', devralan: null, durum: 'acik', acilma: Date.now() };
  }
  // Web panel (flat) -> nested senkron: web kazanır
  let degisti = false;
  if (g.ticketDestekRol && g.ticketDestekRol !== g.ticket.destekRol) { g.ticket.destekRol = g.ticketDestekRol; degisti = true; }
  if (g.ticketKategori && g.ticketKategori !== g.ticket.kategori) { g.ticket.kategori = g.ticketKategori; degisti = true; }
  if (degisti) { try { _save(); } catch {} }
  return g.ticket;
}

function ekipMi(member, t) {
  if (!member) return false;
  try {
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
    if (t.destekRol && member.roles.cache.has(t.destekRol)) return true;
  } catch {}
  return false;
}

function acikBul(t, kanalId) {
  for (const [uid, v] of Object.entries(t.acik)) {
    const cid = typeof v === 'string' ? v : v.kanal;
    if (cid === kanalId) return { uid, kayit: typeof v === 'string' ? { kanal: v } : v };
  }
  return null;
}

function kontrolButonlari(durum) {
  const beklet = durum === 'beklemede'
    ? new ButtonBuilder().setCustomId('ticket_ac').setLabel('▶️ Geri Aç').setStyle(ButtonStyle.Success)
    : new ButtonBuilder().setCustomId('ticket_beklet').setLabel('⏸️ Beklet').setStyle(ButtonStyle.Secondary);
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_devral').setLabel('🙋 Devral').setStyle(ButtonStyle.Primary),
    beklet,
    new ButtonBuilder().setCustomId('ticket_kapat').setLabel('🔒 Kapat').setStyle(ButtonStyle.Danger),
  ),
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_devret').setLabel('🔄 Devret').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_oncelik').setLabel('⚡ Öncelik').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_ekle').setLabel('➕ Ekle').setStyle(ButtonStyle.Secondary),
  )];
}

function premiumGerekli(message, ozellik) {
  try {
    if (require('../src/premium').premiumMu(message.guild.id)) return false;
  } catch {}
  message.reply({ embeds: [err(`👑 **${ozellik}** PREMIUM özelliğidir!\nKodun varsa \`!premium-aktifleştir KOD\` yaz, detay için \`/premium bilgi\` bak! 💎`)] }).catch(() => {});
  return true;
}

// Öncelik (aciliyet) değiştir: kayıt + kanal adı + bilgi mesajı
async function oncelikUygula(guild, kanal, kayit, seviye, degistiren) {
  const ac = ACILIYET[seviye] || ACILIYET.normal;
  kayit.aciliyet = seviye;
  save();
  try {
    const suanki = kanal.name || '';
    const temiz = suanki.replace(/^(🟡-|🔴-)/, '');
    const yeni = `${ac.emoji ? ac.emoji + '-' : ''}${temiz}`.slice(0, 90);
    if (yeni !== suanki) await kanal.setName(yeni).catch(() => {});
  } catch {}
  await kanal.send(`⚡ Öncelik **${ac.emoji || '🟢'} ${ac.etiket}** olarak değiştirildi! (${degistiren})`).catch(() => {});
}

async function transcriptTopla(kanal, limit = 500) {
  const satirlar = [];
  try {
    let sonId = null;
    while (satirlar.length < limit) {
      const sayfa = await kanal.messages.fetch({ limit: 100, ...(sonId ? { before: sonId } : {}) });
      if (!sayfa.size) break;
      const dizili = [...sayfa.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      for (const m of dizili) {
        const ek = [...m.attachments.values()].map((a) => `[dosya: ${a.name}]`).join(' ');
        satirlar.push(`[${new Date(m.createdTimestamp).toLocaleString('tr-TR')}] ${m.author.tag}: ${(m.content || '[embed/medya]').slice(0, 1000)}${ek ? ' ' + ek : ''}`);
      }
      sonId = dizili[0].id;
      if (sayfa.size < 100) break;
    }
  } catch {}
  return { metin: satirlar.join('\n'), sayi: satirlar.length };
}

async function transcriptGonder(guild, { sahipId, kapatan, sebep, kanalAdi, konu, aciliyet, devralanId, mesajSayisi, metin }) {
  try {
    const g = getGuild(guild.id);
    if (!g.logKanal) return;
    const lc = guild.channels.cache.get(g.logKanal);
    if (!lc || !lc.isTextBased()) return;
    const ozet = new EmbedBuilder().setColor(config.colors.warn).setTitle(`🎫 Ticket Kapatıldı — #${kanalAdi}`)
      .setDescription(
        `👤 Sahip: ${sahipId ? `<@${sahipId}>` : '?'}\n` +
        `👮 Kapatan: ${kapatan}\n` +
        `📝 Sebep: ${String(sebep || 'Belirtilmedi').slice(0, 300)}\n` +
        `📂 Konu: **${konu || '?'}** • ⚡ Aciliyet: **${aciliyet || 'normal'}**\n` +
        (devralanId ? `🙋 Devralan: <@${devralanId}>\n` : '') +
        `💬 Mesaj: **${mesajSayisi}**`
      ).setTimestamp();
    const dosyalar = metin ? [{ attachment: Buffer.from(metin.slice(0, 900000), 'utf8'), name: `transcript-${kanalAdi}.txt` }] : [];
    await lc.send({ embeds: [ozet], files: dosyalar }).catch(() => {});
  } catch {}
}

async function ticketKapatAkis(guild, kanal, { sahipId, kapatan, sebep }) {
  const t = ticketAyar(guild.id);
  const bulunan = acikBul(t, kanal.id);
  const kayit = bulunan ? bulunan.kayit : {};
  const gercekSahip = sahipId || (bulunan ? bulunan.uid : null);
  const { metin, sayi } = await transcriptTopla(kanal);
  await transcriptGonder(guild, {
    sahipId: gercekSahip, kapatan, sebep, kanalAdi: kanal.name,
    konu: kayit.konu || '?', aciliyet: kayit.aciliyet || 'normal',
    devralanId: kayit.devralan || null, mesajSayisi: sayi, metin,
  });
  if (gercekSahip && t.acik[gercekSahip]) { delete t.acik[gercekSahip]; save(); }
  await kanal.send('🔒 Kapanıyor... konuşma kaydı loga aktarıldı. **5 saniye**...').catch(() => {});
  setTimeout(() => kanal.delete('Ticket kapatıldı').catch(() => {}), 5000);
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

      const { setGuild } = require('../src/db');
      const g = getGuild(message.guild.id);
      const t = ticketAyar(message.guild.id);
      t.destekRol = rol ? rol.id : null;
      t.logKanal = g.logKanal || null;
      try { setGuild(message.guild.id, { ticketDestekRol: rol ? rol.id : null }); } catch {}

      let kat = message.guild.channels.cache.find(c => c.name === '🎫-DESTEK' && c.type === ChannelType.GuildCategory);
      if (!kat) {
        try { kat = await message.guild.channels.create({ name: '🎫-DESTEK', type: ChannelType.GuildCategory }); } catch {}
      }
      if (kat) t.kategori = kat.id;
      try { if (kat) setGuild(message.guild.id, { ticketKategori: kat.id }); } catch {}
      save();

      const embed = new EmbedBuilder().setColor(config.colors.main).setTitle('🎫 DESTEK TALEBİ OLUŞTUR')
        .setThumbnail(message.guild.iconURL({ size: 256 }))
        .setDescription(
          `Yardıma mı ihtiyacın var? Aşağıdan konusunu seç, aciliyetini işaretle, özel odan **anında** açılsın!\n\n` +
          `🛠️ **Genel Destek** — soru, yardım\n` +
          `🚨 **Şikayet** — kullanıcı/olay bildir\n` +
          `🤝 **Partner** — partner başvurusu\n` +
          `💡 **Öneri** — fikirlerin\n` +
          `🎖️ **Yetkili Alım** — yetkili başvurusu\n` +
          `🔒 **Özel** — gizli konu\n\n` +
          `*Kötüye kullananlara ceza verilir.*`
        ).setFooter({ text: `${message.guild.name} • 7/24 destek` }).setTimestamp();

      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('🎫 Konu seç, ticket aç...')
          .addOptions(Object.entries(KONULAR).map(([v, k]) => ({ label: k.baslik, value: v, emoji: k.emoji, description: k.aciklama })))
      );

      await kanal.send({ embeds: [embed], components: [menu] }).catch(() => null);
      return message.reply({ embeds: [ok('🎫 Ticket paneli ' + kanal + ' kanalına kuruldu!\n👥 Destek rolü: ' + (rol || 'ayarlanmadı') + '\n📁 Kategori: ' + (kat || 'oluşturulamadı') + '\n\nKomutlar: !ticket-kapat !ticket-devral !ticket-devret !ticket-beklet !ticket-ac !ticket-oncelik !ticket-ekle👑 !ticket-cikar')] });
    },
  },
  {
    name: 'ticket-kapat', aliases: ['t-kapat', 'kapat'], category: 'Genel',
    description: 'Bulunduğun ticket kanalını kapatır (konuşma kaydı loga gider).', usage: '!ticket-kapat [sebep]',
    async run(message, args) {
      const t = ticketAyar(message.guild.id);
      const bulunan = acikBul(t, message.channel.id);
      if (!bulunan && !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply({ embeds: [err('Burası bir ticket kanalı değil!')] });
      }
      await ticketKapatAkis(message.guild, message.channel, {
        sahipId: bulunan ? bulunan.uid : null,
        kapatan: `${message.author}`, sebep: args.join(' ') || 'Belirtilmedi',
      });
    },
  },
  {
    name: 'ticket-devral', aliases: ['t-devral', 'devral'], category: 'Genel',
    description: 'Ticketı üstüne alır (devralır).', usage: '!ticket-devral',
    async run(message) {
      const t = ticketAyar(message.guild.id);
      const bulunan = acikBul(t, message.channel.id);
      if (!bulunan) return message.reply({ embeds: [err('Burası bir ticket kanalı değil!')] });
      if (!ekipMi(message.member, t)) return message.reply({ embeds: [err('Sadece destek ekibi devralabilir!')] });
      const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
      if (kayit) { kayit.devralan = message.author.id; save(); }
      await message.channel.permissionOverwrites.edit(message.author, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => null);
      return message.reply({ embeds: [ok(`🙋 ${message.author} ticketı **devraldı!** Artık bu ticket ona ait.`)] });
    },
  },
  {
    name: 'ticket-devret', aliases: ['t-devret', 'devret'], category: 'Genel',
    description: 'Ticketı başka yetkiliye devret.', usage: '!ticket-devret @yetkili [sebep]',
    async run(message, args) {
      const t = ticketAyar(message.guild.id);
      const bulunan = acikBul(t, message.channel.id);
      if (!bulunan) return message.reply({ embeds: [err('Burası bir ticket kanalı değil!')] });
      const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
      const devralanId = kayit && kayit.devralan;
      const yetkili = message.member.permissions.has(PermissionFlagsBits.ManageGuild) || (devralanId === message.author.id);
      if (!yetkili) return message.reply({ embeds: [err('Sadece devralan kişi veya yönetici devredebilir!')] });
      const hedef = message.mentions.members.first();
      if (!hedef || hedef.user.bot) return message.reply({ embeds: [err('`!ticket-devret @yetkili [sebep]`')] });
      if (!ekipMi(hedef, t)) return message.reply({ embeds: [err('Hedef destek ekibinde değil!')] });
      if (kayit) { kayit.devralan = hedef.id; save(); }
      await message.channel.permissionOverwrites.edit(hedef, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => null);
      const sebep = args.slice(1).join(' ') || 'Belirtilmedi';
      return message.reply({ embeds: [ok(`🔄 Ticket ${message.author} tarafından ${hedef} adlı yetkiliye **devredildi!**\n📝 ${sebep}`)] });
    },
  },
  {
    name: 'ticket-beklet', aliases: ['t-beklet', 'beklet'], category: 'Genel',
    description: 'Ticketı beklemeye al (sahibi yazamaz).', usage: '!ticket-beklet [sebep]',
    async run(message, args) {
      const t = ticketAyar(message.guild.id);
      const bulunan = acikBul(t, message.channel.id);
      if (!bulunan) return message.reply({ embeds: [err('Burası bir ticket kanalı değil!')] });
      if (!ekipMi(message.member, t)) return message.reply({ embeds: [err('Sadece destek ekibi bekletebilir!')] });
      const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
      if (kayit) { kayit.durum = 'beklemede'; save(); }
      const sahip = await message.guild.members.fetch(bulunan.uid).catch(() => null);
      if (sahip) await message.channel.permissionOverwrites.edit(sahip, { ViewChannel: true, SendMessages: false, ReadMessageHistory: true }).catch(() => null);
      try {
        const suanki = message.channel.name;
        if (!suanki.startsWith('⏸️-')) await message.channel.setName('⏸️-' + suanki).catch(() => {});
      } catch {}
      const sebep = args.join(' ') || 'Belirtilmedi';
      return message.reply({ content: `⏸️ Ticket **beklemeye alındı.** (${sebep})`, components: kontrolButonlari('beklemede') });
    },
  },
  {
    name: 'ticket-ac', aliases: ['t-ac', 't-aç', 'ticket-aç'], category: 'Genel',
    description: 'Beklemedeki ticketı geri aç.', usage: '!ticket-ac',
    async run(message) {
      const t = ticketAyar(message.guild.id);
      const bulunan = acikBul(t, message.channel.id);
      if (!bulunan) return message.reply({ embeds: [err('Burası bir ticket kanalı değil!')] });
      if (!ekipMi(message.member, t)) return message.reply({ embeds: [err('Sadece destek ekibi açabilir!')] });
      const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
      if (kayit) { kayit.durum = 'acik'; save(); }
      const sahip = await message.guild.members.fetch(bulunan.uid).catch(() => null);
      if (sahip) await message.channel.permissionOverwrites.edit(sahip, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
      try {
        const suanki = message.channel.name;
        if (suanki.startsWith('⏸️-')) await message.channel.setName(suanki.replace(/^⏸️-/, '')).catch(() => {});
      } catch {}
      return message.reply({ content: `▶️ Ticket **geri açıldı!** ${sahip || ''}`, components: kontrolButonlari('acik') });
    },
  },
  {
    name: 'ticket-oncelik', aliases: ['t-oncelik', 't-öncelik', 'ticket-öncelik'], category: 'Genel',
    description: 'Ticketın önceliğini değiştirir (normal/acele/acil).', usage: '!ticket-oncelik <normal|acele|acil>',
    async run(message, args) {
      const t = ticketAyar(message.guild.id);
      const bulunan = acikBul(t, message.channel.id);
      if (!bulunan) return message.reply({ embeds: [err('Burası bir ticket kanalı değil!')] });
      if (!ekipMi(message.member, t)) return message.reply({ embeds: [err('Sadece destek ekibi öncelik değiştirebilir!')] });
      const giris = String(args[0] || '').toLocaleLowerCase('tr');
      const seviye = giris.startsWith('acil') ? 'acil' : giris.startsWith('acele') ? 'acele' : giris.startsWith('normal') ? 'normal' : null;
      if (!seviye) return message.reply({ embeds: [err('`!ticket-oncelik normal|acele|acil`')] });
      const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
      if (!kayit) return message.reply({ embeds: [err('Eski kayıt, önce ticketı kapatıp yeniden aç!')] });
      await oncelikUygula(message.guild, message.channel, kayit, seviye, `${message.author}`);
      return message.reply({ embeds: [ok(`⚡ Öncelik **${ACILIYET[seviye].etiket}** yapıldı!`)] });
    },
  },
  {
    name: 'ticket-ekle', aliases: ['t-ekle'], category: 'Genel',
    description: 'Ticketa kullanıcı ekler. (👑 PREMIUM)', usage: '!ticket-ekle @kullanıcı',
    async run(message) {
      const t = ticketAyar(message.guild.id);
      if (!acikBul(t, message.channel.id)) return message.reply({ embeds: [err('Burası ticket kanalı değil!')] });
      if (!ekipMi(message.member, t)) return message.reply({ embeds: [err('Sadece destek ekibi kullanıcı ekleyebilir!')] });
      if (premiumGerekli(message, 'Ticketa kullanıcı ekleme')) return;
      const h = message.mentions.members.first();
      if (!h) return message.reply({ embeds: [err('`!ticket-ekle @kullanıcı`')] });
      if (h.user.bot) return message.reply({ embeds: [err('Bot ekleyemezsin!')] });
      await message.channel.permissionOverwrites.edit(h, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => null);
      return message.reply({ embeds: [ok(`${h} ticketa eklendi. 👑`)] });
    },
  },
  {
    name: 'ticket-cikar', aliases: ['t-çıkar', 't-cikar'], category: 'Genel',
    description: 'Ticketdan kullanıcı çıkarır.', usage: '!ticket-cıkar @kullanıcı',
    async run(message) {
      const t = ticketAyar(message.guild.id);
      const bulunan = acikBul(t, message.channel.id);
      if (!bulunan) return message.reply({ embeds: [err('Burası ticket kanalı değil!')] });
      const h = message.mentions.members.first();
      if (!h) return message.reply({ embeds: [err('`!ticket-cıkar @kullanıcı`')] });
      if (h.id === bulunan.uid) return message.reply({ embeds: [err('Ticket sahibini çıkaramazsın!')] });
      await message.channel.permissionOverwrites.delete(h).catch(() => null);
      return message.reply({ embeds: [ok(`${h} ticketdan çıkarıldı.`)] });
    },
  },
  // ---- İNTERNAL: menü + buton + aciliyet (index.js çağırır) ----
  {
    name: '__ticket_internal__', aliases: [], category: 'Sistem', description: 'internal', usage: '',
    async run() {},
    async select(interaction, client) {
      // ticket_menu → konu seçildi, şimdi aciliyet sor
      const t = ticketAyar(interaction.guild.id);
      const kayit = t.acik[interaction.user.id];
      const cid = typeof kayit === 'string' ? kayit : kayit?.kanal;
      if (cid) {
        const eski = interaction.guild.channels.cache.get(cid);
        if (eski) return interaction.reply({ content: `❌ Zaten açık ticketın var: ${eski}`, ephemeral: true });
      }
      const konu = interaction.values[0];
      const bilgi = KONULAR[konu] || KONULAR.genel;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_acil_${konu}_normal`).setLabel('🟢 Normal').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_acil_${konu}_acele`).setLabel('🟡 Acele').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ticket_acil_${konu}_acil`).setLabel('🔴 Acil').setStyle(ButtonStyle.Danger),
      );
      return interaction.reply({ content: `${bilgi.emoji} **${bilgi.baslik}** konusu — aciliyet durumunu seç:`, components: [row], ephemeral: true });
    },
    async aciliyet(interaction, client) {
      // ticket_acil_<konu>_<seviye>
      const parca = interaction.customId.split('_');
      const konu = parca[2];
      const seviye = parca[3] === 'acil' ? 'acil' : parca[3] === 'acele' ? 'acele' : 'normal';
      const t = ticketAyar(interaction.guild.id);
      const kayit = t.acik[interaction.user.id];
      const cid = typeof kayit === 'string' ? kayit : kayit?.kanal;
      if (cid) {
        const eski = interaction.guild.channels.cache.get(cid);
        if (eski) return interaction.reply({ content: `❌ Zaten açık ticketın var: ${eski}`, ephemeral: true });
      }
      const bilgi = KONULAR[konu] || KONULAR.genel;
      const ac = ACILIYET[seviye];
      t.sayac = (t.sayac || 0) + 1;
      const isim = `${ac.emoji ? ac.emoji + '-' : ''}${bilgi.ad}-${t.sayac}`.toLocaleLowerCase('tr');
      save();
      try {
        const kanal = await interaction.guild.channels.create({
          name: isim.slice(0, 90), type: ChannelType.GuildText,
          parent: t.kategori || null,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            ...(t.destekRol ? [{ id: t.destekRol, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
          ],
        });
        t.acik[interaction.user.id] = { kanal: kanal.id, konu, aciliyet: seviye, devralan: null, durum: 'acik', acilma: Date.now() };
        save();

        const embed = new EmbedBuilder().setColor(ac.renk).setTitle(`🎫 ${isim}`)
          .setDescription(`Selam ${interaction.user}! Destek ekibi yakında burada olacak.\n**Konu:** ${bilgi.emoji} ${bilgi.baslik}\n**Aciliyet:** ${ac.emoji || '🟢'} ${ac.etiket}\n\nLütfen sorunu detaylı yaz 👇`).setTimestamp();
        const ping = t.destekRol && seviye !== 'normal' ? `<@&${t.destekRol}> ` : '';
        await kanal.send({ content: `${interaction.user} ${ping}`, embeds: [embed], components: kontrolButonlari('acik') });
        await interaction.update({ content: `✅ Ticket açıldı (${ac.etiket}): ${kanal}`, components: [] }).catch(() => {});
      } catch (e) {
        return interaction.reply({ content: '❌ Kanal açamadım! Yetkilerimi kontrol et.', ephemeral: true }).catch(() => {});
      }
    },
    async button(interaction, client) {
      const t = ticketAyar(interaction.guild.id);
      const bulunan = acikBul(t, interaction.channel.id);
      if (!bulunan) return interaction.reply({ content: '❌ Bu kanal bir ticket değil!', ephemeral: true }).catch(() => {});
      const id = interaction.customId === 'ticket_kilit' ? 'ticket_beklet' : interaction.customId;
      if (id === 'ticket_kapat') {
        await interaction.reply('🔒 Kapanıyor... konuşma kaydı loga aktarılıyor. 5sn...').catch(() => {});
        await ticketKapatAkis(interaction.guild, interaction.channel, {
          sahipId: bulunan.uid, kapatan: `${interaction.user}`, sebep: id === 'ticket_kilit' ? 'Buton (beklet kanalı kapatma)' : 'Buton ile',
        });
        return;
      }
      if (id === 'ticket_devral') {
        if (!ekipMi(interaction.member, t)) return interaction.reply({ content: '❌ Sadece destek ekibi devralabilir!', ephemeral: true }).catch(() => {});
        const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
        if (kayit) { kayit.devralan = interaction.user.id; save(); }
        await interaction.channel.permissionOverwrites.edit(interaction.user, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
        return interaction.reply({ content: `🙋 ${interaction.user} ticketı **devraldı!**` }).catch(() => {});
      }
      if (id === 'ticket_beklet') {
        if (!ekipMi(interaction.member, t)) return interaction.reply({ content: '❌ Sadece destek ekibi!', ephemeral: true }).catch(() => {});
        const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
        if (kayit) { kayit.durum = 'beklemede'; save(); }
        const sahip = await interaction.guild.members.fetch(bulunan.uid).catch(() => null);
        if (sahip) await interaction.channel.permissionOverwrites.edit(sahip, { ViewChannel: true, SendMessages: false, ReadMessageHistory: true }).catch(() => {});
        try {
          const suanki = interaction.channel.name;
          if (!suanki.startsWith('⏸️-')) await interaction.channel.setName('⏸️-' + suanki).catch(() => {});
        } catch {}
        return interaction.reply({ content: '⏸️ Beklemeye alındı.', components: kontrolButonlari('beklemede') }).catch(() => {});
      }
      if (id === 'ticket_ac') {
        if (!ekipMi(interaction.member, t)) return interaction.reply({ content: '❌ Sadece destek ekibi!', ephemeral: true }).catch(() => {});
        const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
        if (kayit) { kayit.durum = 'acik'; save(); }
        const sahip = await interaction.guild.members.fetch(bulunan.uid).catch(() => null);
        if (sahip) await interaction.channel.permissionOverwrites.edit(sahip, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
        try {
          const suanki = interaction.channel.name;
          if (suanki.startsWith('⏸️-')) await interaction.channel.setName(suanki.replace(/^⏸️-/, '')).catch(() => {});
        } catch {}
        return interaction.reply({ content: `▶️ Geri açıldı! ${sahip || ''}`, components: kontrolButonlari('acik') }).catch(() => {});
      }
      if (id === 'ticket_devret') {
        if (!ekipMi(interaction.member, t)) return interaction.reply({ content: '❌ Sadece destek ekibi devredebilir!', ephemeral: true }).catch(() => {});
        const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
        const devralanId = kayit && kayit.devralan;
        const yetkili = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) || devralanId === interaction.user.id || !devralanId;
        if (!yetkili) return interaction.reply({ content: '❌ Sadece devralan kişi veya yönetici devredebilir!', ephemeral: true }).catch(() => {});
        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId('ticket_devret_select').setPlaceholder('🔄 Devredilecek yetkiliyi seç...').setMinValues(1).setMaxValues(1)
        );
        return interaction.reply({ content: '🔄 Ticketı kime devredeyim? Aşağıdan yetkiliyi seç:', components: [row], ephemeral: true }).catch(() => {});
      }
      if (id === 'ticket_oncelik') {
        if (!ekipMi(interaction.member, t)) return interaction.reply({ content: '❌ Sadece destek ekibi!', ephemeral: true }).catch(() => {});
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_oncelik_normal').setLabel('🟢 Normal').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ticket_oncelik_acele').setLabel('🟡 Acele').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('ticket_oncelik_acil').setLabel('🔴 Acil').setStyle(ButtonStyle.Danger),
        );
        return interaction.reply({ content: '⚡ Yeni önceliği seç:', components: [row], ephemeral: true }).catch(() => {});
      }
      if (id === 'ticket_oncelik_normal' || id === 'ticket_oncelik_acele' || id === 'ticket_oncelik_acil') {
        if (!ekipMi(interaction.member, t)) return interaction.reply({ content: '❌ Sadece destek ekibi!', ephemeral: true }).catch(() => {});
        const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
        if (!kayit) return interaction.reply({ content: '❌ Eski kayıt, önce ticketı kapatıp yeniden aç!', ephemeral: true }).catch(() => {});
        const seviye = id.endsWith('_acil') ? 'acil' : id.endsWith('_acele') ? 'acele' : 'normal';
        await oncelikUygula(interaction.guild, interaction.channel, kayit, seviye, `${interaction.user}`);
        return interaction.reply({ content: `⚡ Öncelik **${ACILIYET[seviye].etiket}** yapıldı!`, ephemeral: true }).catch(() => {});
      }
      if (id === 'ticket_ekle') {
        if (!ekipMi(interaction.member, t)) return interaction.reply({ content: '❌ Sadece destek ekibi!', ephemeral: true }).catch(() => {});
        try {
          if (!require('../src/premium').premiumMu(interaction.guild.id)) {
            return interaction.reply({ content: '👑 **Ticketa kullanıcı ekleme PREMIUM** özelliğidir!\nKodun varsa `!premium-aktifleştir KOD` yaz! 💎', ephemeral: true }).catch(() => {});
          }
        } catch {}
        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId('ticket_ekle_select').setPlaceholder('➕ Ticketa eklenecek kişiyi seç...').setMinValues(1).setMaxValues(5)
        );
        return interaction.reply({ content: '➕ Kimi ekleyeyim? (en fazla 5 kişi)', components: [row], ephemeral: true }).catch(() => {});
      }
      return interaction.reply({ content: '❌ Bilinmeyen işlem!', ephemeral: true }).catch(() => {});
    },
    async userSelect(interaction, client) {
      const t = ticketAyar(interaction.guild.id);
      const bulunan = acikBul(t, interaction.channel.id);
      if (!bulunan) return interaction.reply({ content: '❌ Bu kanal bir ticket değil!', ephemeral: true }).catch(() => {});
      if (interaction.customId === 'ticket_devret_select') {
        if (!ekipMi(interaction.member, t)) return interaction.reply({ content: '❌ Sadece destek ekibi!', ephemeral: true }).catch(() => {});
        const hedefId = interaction.values[0];
        const hedef = await interaction.guild.members.fetch(hedefId).catch(() => null);
        if (!hedef || hedef.user.bot) return interaction.reply({ content: '❌ Geçerli bir yetkili seç!', ephemeral: true }).catch(() => {});
        if (!ekipMi(hedef, t)) return interaction.reply({ content: '❌ Seçtiğin kişi destek ekibinde değil!', ephemeral: true }).catch(() => {});
        const kayit = typeof t.acik[bulunan.uid] === 'string' ? null : t.acik[bulunan.uid];
        if (kayit) { kayit.devralan = hedef.id; save(); }
        await interaction.channel.permissionOverwrites.edit(hedef, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => null);
        await interaction.update({ content: `🔄 Ticket ${interaction.user} tarafından ${hedef} adlı yetkiliye **devredildi!**`, components: [] }).catch(() => {});
        return;
      }
      if (interaction.customId === 'ticket_ekle_select') {
        if (!ekipMi(interaction.member, t)) return interaction.reply({ content: '❌ Sadece destek ekibi!', ephemeral: true }).catch(() => {});
        try {
          if (!require('../src/premium').premiumMu(interaction.guild.id)) {
            return interaction.reply({ content: '👑 **Ticketa kullanıcı ekleme PREMIUM** özelliğidir!', ephemeral: true }).catch(() => {});
          }
        } catch {}
        const eklenen = [];
        for (const uid of interaction.values.slice(0, 5)) {
          if (uid === bulunan.uid) continue;
          const uye = await interaction.guild.members.fetch(uid).catch(() => null);
          if (!uye || uye.user.bot) continue;
          await interaction.channel.permissionOverwrites.edit(uye, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => null);
          eklenen.push(`${uye}`);
        }
        if (!eklenen.length) return interaction.reply({ content: '❌ Kimse eklenemedi!', ephemeral: true }).catch(() => {});
        await interaction.update({ content: `➕ Ticketa eklendi: ${eklenen.join(' ')} 👑`, components: [] }).catch(() => {});
        return;
      }
      return interaction.reply({ content: '❌ Bilinmeyen seçim!', ephemeral: true }).catch(() => {});
    },
  },
];

const _CMDS = module.exports;

// /ticket grubu — tek slash, 8 alt komut (100 limitini aşmamak için)
const ticketSlash = {
  data: {
    name: 'ticket',
    description: '🎫 Ticket sistemi (kur/kapat/devral/devret/beklet/aç/öncelik/ekle/çıkar)',
    contexts: [0],
    options: [
      { type: 1, name: 'kur', description: '🎫 Ticket paneli kur (Yönetici)', options: [{ type: 7, name: 'kanal', description: 'Panelin gönderileceği kanal', required: true }, { type: 8, name: 'rol', description: 'Destek ekibi rolü', required: false }] },
      { type: 1, name: 'kapat', description: '🔒 Bulunduğun ticketı kapat', options: [{ type: 3, name: 'sebep', description: 'Kapatma sebebi', required: false }] },
      { type: 1, name: 'devral', description: '🙋 Ticketı üstüne al' },
      { type: 1, name: 'devret', description: '🔄 Ticketı başka yetkiliye devret', options: [{ type: 6, name: 'yetkili', description: 'Devredilecek yetkili', required: true }, { type: 3, name: 'sebep', description: 'Sebep', required: false }] },
      { type: 1, name: 'beklet', description: '⏸️ Ticketı beklemeye al', options: [{ type: 3, name: 'sebep', description: 'Sebep', required: false }] },
      { type: 1, name: 'ac', description: '▶️ Beklemedeki ticketı geri aç' },
      { type: 1, name: 'oncelik', description: '⚡ Ticket önceliğini değiştir', options: [{ type: 3, name: 'seviye', description: 'Yeni öncelik', required: true, choices: [{ name: '🟢 Normal', value: 'normal' }, { name: '🟡 Acele', value: 'acele' }, { name: '🔴 Acil', value: 'acil' }] }] },
      { type: 1, name: 'ekle', description: '➕ Ticketa kullanıcı ekle (👑 PREMIUM)', options: [{ type: 6, name: 'kullanici', description: 'Eklenecek kullanıcı', required: true }] },
      { type: 1, name: 'cikar', description: '➖ Tickettan kullanıcı çıkar', options: [{ type: 6, name: 'kullanici', description: 'Çıkarılacak kullanıcı', required: true }] },
    ],
  },
  async execute(interaction, client) {
    const alt = interaction.options.getSubcommand();
    const bul = (ad) => _CMDS.find((c) => c.name === ad);
    // sahte message: prefix run() aynen çalışsın (defer sonrası ilk reply -> editReply)
    const sahte = (extra = {}) => {
      const cozulen = interaction.options.resolved || {};
      const { Collection: Col } = require('discord.js');
      const bos = new Col();
      const state = { replied: false };
      const fake = {
        author: interaction.user, member: interaction.member, guild: interaction.guild,
        channel: interaction.channel, client, createdTimestamp: Date.now(), content: '',
        mentions: {
          users: cozulen.users || bos, members: cozulen.members || bos,
          channels: cozulen.channels || bos, roles: cozulen.roles || bos,
        },
        delete: async () => {},
        react: async () => {},
        reply: async (payload) => {
          if (typeof payload === 'string') payload = { content: payload };
          try {
            if (!state.replied) { state.replied = true; await interaction.editReply(payload); }
            else await interaction.followUp(payload);
          } catch {}
          try { return await interaction.fetchReply(); } catch { return null; }
        },
        ...extra,
      };
      return fake;
    };
    await interaction.deferReply().catch(() => {});
    try {
      if (alt === 'kur') {
        const kanal = interaction.options.getChannel('kanal');
        const rol = interaction.options.getRole('rol');
        const cmd = bul('ticket-kur');
        const fake = sahte();
        // prefix run mention bekler: mentions doldur
        fake.mentions.channels.set?.(kanal.id, kanal);
        if (rol) fake.mentions.roles.set?.(rol.id, rol);
        // mentions.channels.first() Collection ister — set ile doldurduk
        const { Collection: Col2 } = require('discord.js');
        fake.mentions.channels = new Col2([[kanal.id, kanal]]);
        fake.mentions.roles = rol ? new Col2([[rol.id, rol]]) : new Col2();
        await cmd.run(fake, [], client);
        return;
      }
      if (alt === 'kapat') {
        const sebep = interaction.options.getString('sebep') || '';
        const cmd = bul('ticket-kapat');
        await cmd.run(sahte(), sebep ? [sebep] : [], client);
        return;
      }
      if (alt === 'devral') { await bul('ticket-devral').run(sahte(), [], client); return; }
      if (alt === 'devret') {
        const yet = interaction.options.getUser('yetkili');
        const sebep = interaction.options.getString('sebep') || '';
        const cmd = bul('ticket-devret');
        const fake = sahte();
        const { Collection: Col3 } = require('discord.js');
        try {
          const uye = await interaction.guild.members.fetch(yet.id).catch(() => null);
          fake.mentions.members = new Col3(uye ? [[uye.id, uye]] : []);
        } catch { fake.mentions.members = new Col3(); }
        const args = [`<@${yet.id}>`, ...(sebep ? [sebep] : [])];
        await cmd.run(fake, args, client);
        return;
      }
      if (alt === 'beklet') {
        const sebep = interaction.options.getString('sebep') || '';
        await bul('ticket-beklet').run(sahte(), sebep ? [sebep] : [], client);
        return;
      }
      if (alt === 'ac') { await bul('ticket-ac').run(sahte(), [], client); return; }
      if (alt === 'oncelik') {
        const seviye = interaction.options.getString('seviye') || 'normal';
        await bul('ticket-oncelik').run(sahte(), [seviye], client);
        return;
      }
      if (alt === 'ekle' || alt === 'cikar') {
        const k = interaction.options.getUser('kullanici');
        const cmd = bul(alt === 'ekle' ? 'ticket-ekle' : 'ticket-cikar');
        const fake = sahte();
        const { Collection: Col4 } = require('discord.js');
        try {
          const uye = await interaction.guild.members.fetch(k.id).catch(() => null);
          fake.mentions.members = new Col4(uye ? [[uye.id, uye]] : []);
        } catch { fake.mentions.members = new Col4(); }
        await cmd.run(fake, [`<@${k.id}>`], client);
        return;
      }
      await interaction.editReply({ content: '❌ Bilinmeyen alt komut!' }).catch(() => {});
    } catch (e) {
      await interaction.editReply({ content: '❌ Bir hata oldu!' }).catch(() => {});
    }
  },
};

module.exports = _CMDS;
module.exports.ticketSlash = ticketSlash;
