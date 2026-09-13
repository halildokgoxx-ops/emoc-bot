const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getGuild, setGuild, db, save } = require('../src/db');
const { ok, err, kisiBulAsync } = require('../src/embeds');
const { davetKoduBul } = require('../src/utils');
const { animeGif, tenorLink } = require('../src/gif');
const config = require('../config');

// ---------- Yardımcılar ----------
function pv2Ayar(gid) {
  const g = getGuild(gid);
  if (g.partnerChat === undefined) g.partnerChat = null;
  if (g.partnerYetkiliKanal === undefined) g.partnerYetkiliKanal = null;
  if (g.partnerYetkiliRol === undefined) g.partnerYetkiliRol = null;
  if (g.partnerSayi === undefined) g.partnerSayi = 0;
  return g;
}
function basvuruStore() {
  const d = db();
  if (!d.partnerBasvuru) d.partnerBasvuru = {};
  return d.partnerBasvuru;
}

// ---------- Partner sayaç (yetkili skoru: günlük/haftalık/aylık/yıllık) ----------
const DONEMLER = {
  gunluk: { ad: 'Günlük', emoji: '📅', ms: 86400_000 },
  haftalik: { ad: 'Haftalık', emoji: '📆', ms: 7 * 86400_000 },
  aylik: { ad: 'Aylık', emoji: '🗓️', ms: 30 * 86400_000 },
  yillik: { ad: 'Yıllık', emoji: '📊', ms: 365 * 86400_000 },
};
function donemNorm(d) {
  d = String(d || '').toLocaleLowerCase('tr');
  return DONEMLER[d] ? d : 'aylik';
}
function skorKaydet(gid, staffId) {
  try {
    const d = db();
    if (!d.partnerSkor) d.partnerSkor = [];
    d.partnerSkor.push({ gid: String(gid), staff: String(staffId), tarih: Date.now() });
    const sinir = Date.now() - 400 * 86400_000;
    d.partnerSkor = d.partnerSkor.filter((x) => x.tarih > sinir).slice(-5000);
    save();
  } catch {}
}
function skorLiderlik(gid, donem) {
  const D = DONEMLER[donemNorm(donem)];
  const esik = Date.now() - D.ms;
  const say = {};
  for (const x of (db().partnerSkor || [])) {
    if (x.gid !== String(gid) || x.tarih < esik) continue;
    say[x.staff] = (say[x.staff] || 0) + 1;
  }
  const toplam = Object.values(say).reduce((a, b) => a + b, 0);
  const sira = Object.entries(say)
    .map(([staff, n]) => ({ staff, sayi: n }))
    .sort((a, b) => b.sayi - a.sayi)
    .slice(0, 10);
  return { donem: donemNorm(donem), toplam, sira };
}
function skorKisi(gid, uid) {
  const out = {};
  for (const [k, D] of Object.entries(DONEMLER)) {
    const esik = Date.now() - D.ms;
    out[k] = (db().partnerSkor || []).filter((x) => x.gid === String(gid) && x.staff === String(uid) && x.tarih >= esik).length;
  }
  out.toplam = out.yillik;
  return out;
}

const MADALYA = ['🥇', '🥈', '🥉'];
function sayacEmbed(guild, donem) {
  const { donem: d, toplam, sira } = skorLiderlik(guild.id, donem);
  const D = DONEMLER[d];
  const satir = sira.length
    ? sira.map((s, i) => `${MADALYA[i] || `\`${i + 1}.\``} <@${s.staff}> — **${s.sayi}** partner`).join('\n')
    : '*Bu dönemde onay yok.*';
  return new EmbedBuilder().setColor(config.colors.main)
    .setTitle(`🤝 Partner Sayaç — ${D.emoji} ${D.ad}`)
    .setThumbnail(guild.iconURL({ size: 128 }) || null)
    .setDescription(satir.slice(0, 3500))
    .addFields({ name: '🔢 Dönem Toplamı', value: `**${toplam}** onay`, inline: true })
    .setFooter({ text: `${guild.name} • Aşağıdan dönem değiştir` })
    .setTimestamp();
}
function sayacRow(aktif) {
  return [new ActionRowBuilder().addComponents(
    Object.entries(DONEMLER).map(([k, D]) =>
      new ButtonBuilder().setCustomId(`partner_sayac_${k}`)
        .setLabel(`${D.emoji} ${D.ad}`).setStyle(k === aktif ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(k === aktif))
  )];
}
function kisiSayacEmbed(guild, user) {
  const s = skorKisi(guild.id, user.id);
  const satir = Object.entries(DONEMLER).map(([k, D]) => `${D.emoji} **${D.ad}:** ${s[k]} partner`).join('\n');
  return new EmbedBuilder().setColor(0x57F287)
    .setTitle(`🤝 ${user.tag} — Partner Karnesi`)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setDescription(satir)
    .addFields({ name: '🔢 Toplam (yıllık)', value: `**${s.toplam}** onay`, inline: true })
    .setFooter({ text: guild.name })
    .setTimestamp();
}
async function sayacButton(interaction, client) {
  const donem = donemNorm((interaction.customId || '').replace('partner_sayac_', ''));
  await interaction.update({ embeds: [sayacEmbed(interaction.guild, donem)], components: sayacRow(donem) }).catch(() => {});
}
function linkVarMi(text) {
  return /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/|https?:\/\/)/i.test(text || '');
}
function partnerTextUret(text, kaynakGuild, hedefDavet) {
  return (text || '🤝 **{sunucu}** ile partner olduk! ({üye} üye)\n🔗 {davet}')
    .replace(/{sunucu}/g, `**${kaynakGuild.name}**`)
    .replace(/{üye}/g, `${kaynakGuild.memberCount}`)
    .replace(/{davet}/g, hedefDavet || '')
    .replace(/{isim}/g, kaynakGuild.name);
}
async function otoDavetUret(kanal) {
  try {
    const davet = await kanal.createInvite({ maxAge: 0, maxUses: 0, reason: 'Oto-partner tanıtımı' });
    return davet.url;
  } catch { return null; }
}

// Chat tetikleyici cooldown (kullanıcı bazında 45sn)
const chatCooldown = new Map();
const CHAT_ANAHTAR = ['partner', 'partnerlik', 'partnership', 'reklam', 'tanıtım', 'tanitim', 'işbirliği', 'isbirligi', 'iş birliği', 'birlikte büyüyelim', 'sunucum', 'partner dm', 'partnerlik dm'];

async function maybePartnerPrompt(message) {
  try {
    if (!message.guild || message.author.bot) return;
    const g = pv2Ayar(message.guild.id);
    if (!g.partnerChat || message.channel.id !== g.partnerChat) return;
    // Komutları ve buton etkileşimlerini sayma (sunucu özel ön eki dahil)
    let _pref = config.prefix;
    try {
      const _o = String(getGuild(message.guild.id).prefix || '').trim();
      if (_o && require('../src/premium').premiumMu(message.guild.id)) _pref = _o.slice(0, 5);
    } catch {}
    if (message.content.startsWith(_pref)) return;
    const icerik = message.content.toLocaleLowerCase('tr');
    if (!CHAT_ANAHTAR.some(k => icerik.includes(k))) return;
    const son = chatCooldown.get(message.author.id) || 0;
    if (Date.now() - son < 45_000) return;
    chatCooldown.set(message.author.id, Date.now());

    const gif = await animeGif('hug').catch(() => null);
    const e = new EmbedBuilder().setColor(config.colors.pink)
      .setTitle('🤝 Partnerlik mi yapmak istiyorsun?')
      .setDescription(
        `Selam ${message.author}! ✨\n\n` +
        `Partnerlik başvurusu için aşağıdaki **🤝 Partner Ol** butonuna bas.\n` +
        `Açılan pencereden **kendi partner textini** (sunucu linkinle birlikte!) gönder.\n\n` +
        `📩 Başvurun yetkililere iletilecek, onaylanınca partner kanalında paylaşılacak!`
      )
      .setImage(gif || null)
      .setFooter({ text: `${message.guild.name} • Oto Partner Sistemi` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pv2_basvuru').setLabel('🤝 Partner Ol').setStyle(ButtonStyle.Primary),
    );
    const gonder = await message.reply({ embeds: [e], components: [row] }).catch(() => null);
    if (gonder) setTimeout(() => gonder.delete().catch(() => {}), 120_000);
  } catch {}
}

// ---------- Buton + Modal işleyiciler (index.js çağırır) ----------
async function handlePv2Button(interaction, client) {
  const id = interaction.customId;
  // 1) Başvuru butonu → MODAL aç
  if (id === 'pv2_basvuru') {
    const g = pv2Ayar(interaction.guild.id);
    if (!g.partnerYetkiliKanal) return interaction.reply({ content: '❌ Partner sistemi tam kurulmamış! Yetkiliye söyle.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId('pv2_modal').setTitle('🤝 Partner Başvurusu');
    const text = new TextInputBuilder().setCustomId('pv2_text').setLabel('Partner textin (link içermeli!)').setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Örn: 🌙 Cennet Bahçesi — 500 üyeli samimi ortam! Katıl: https://discord.gg/xxxx')
      .setRequired(true).setMinLength(20).setMaxLength(1500);
    const davet = new TextInputBuilder().setCustomId('pv2_davet').setLabel('Sunucu davet linkin').setStyle(TextInputStyle.Short)
      .setPlaceholder('https://discord.gg/xxxx').setRequired(true).setMinLength(8).setMaxLength(150);
    modal.addComponents(new ActionRowBuilder().addComponents(text), new ActionRowBuilder().addComponents(davet));
    return interaction.showModal(modal);
  }
  // 2) Onay
  if (id.startsWith('pv2_onay_')) {
    const basId = id.replace('pv2_onay_', '');
    const store = basvuruStore();
    const b = store[basId];
    if (!b || b.status !== 'bekliyor') return interaction.reply({ content: '❌ Bu başvuru zaten sonuçlanmış!', ephemeral: true });
    const g = pv2Ayar(interaction.guild.id);
    const uye = interaction.member;
    const yetkiliMi = uye.permissions.has(PermissionFlagsBits.ManageGuild) || (g.partnerYetkiliRol && uye.roles.cache.has(g.partnerYetkiliRol));
    if (!yetkiliMi) return interaction.reply({ content: '❌ Sadece partner yetkilileri onaylayabilir!', ephemeral: true });

    b.status = 'onay'; b.kararVeren = interaction.user.id; b.kararTarih = Date.now();
    g.partnerSayi = (g.partnerSayi || 0) + 1;
    save();
    skorKaydet(interaction.guild.id, interaction.user.id);

    // Partner kanalına ŞIK embed
    const gif = await animeGif('happy').catch(() => null);
    const paylasim = new EmbedBuilder().setColor(config.colors.success)
      .setTitle(`🤝 YENİ PARTNER!`)
      .setThumbnail(interaction.guild.iconURL({ size: 256 }))
      .setDescription(b.text.slice(0, 3500))
      .addFields(
        { name: '🔗 Sunucu Daveti', value: b.invite, inline: false },
        { name: '📨 Ekleyen', value: `<@${b.userId}>`, inline: true },
        { name: '✅ Onaylayan', value: `${interaction.user}`, inline: true },
      )
      .setImage(gif || null)
      .setFooter({ text: `${interaction.guild.name} • Kod: ${basId}` })
      .setTimestamp();
    const katilRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('🔗 Sunucuya Katıl').setStyle(ButtonStyle.Link).setURL(b.invite.startsWith('http') ? b.invite : `https://${b.invite}`),
    );
    const pKanal = interaction.guild.channels.cache.get(g.partnerKanal);
    if (pKanal) await pKanal.send({ embeds: [paylasim], components: [katilRow] }).catch(() => {});
    await interaction.update({ content: `✅ Başvuru **${interaction.user.tag}** tarafından **onaylandı** ve partner kanalına gönderildi! (\`${basId}\`)`, embeds: [], components: [] }).catch(() => {});
    // DM: kabul
    try {
      const kisi = await client.users.fetch(b.userId);
      await kisi.send({ embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle(`✅ Partnerliğin onaylandı! — ${interaction.guild.name}`).setDescription(`Textin partner kanalında paylaşıldı! 🎉\n\n> ${b.text.slice(0, 500)}`).setTimestamp()] }).catch(() => {});
    } catch {}
    return;
  }
  // 3) Ret → sebep MODALı
  if (id.startsWith('pv2_red_')) {
    const basId = id.replace('pv2_red_', '');
    const store = basvuruStore();
    const b = store[basId];
    if (!b || b.status !== 'bekliyor') return interaction.reply({ content: '❌ Bu başvuru zaten sonuçlanmış!', ephemeral: true });
    const g = pv2Ayar(interaction.guild.id);
    const uye = interaction.member;
    const yetkiliMi = uye.permissions.has(PermissionFlagsBits.ManageGuild) || (g.partnerYetkiliRol && uye.roles.cache.has(g.partnerYetkiliRol));
    if (!yetkiliMi) return interaction.reply({ content: '❌ Sadece partner yetkilileri reddedebilir!', ephemeral: true });
    const modal = new ModalBuilder().setCustomId(`pv2_redmodal_${basId}`).setTitle('❌ Partner Reddi');
    const sebep = new TextInputBuilder().setCustomId('pv2_redsebep').setLabel('Red sebebi (kişiye DM gider)').setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Örn: Link geçersiz, text çok kısa...').setRequired(true).setMinLength(3).setMaxLength(500);
    modal.addComponents(new ActionRowBuilder().addComponents(sebep));
    return interaction.showModal(modal);
  }
}

async function handlePv2Modal(interaction, client) {
  // Başvuru formu
  if (interaction.customId === 'pv2_modal') {
    const text = (interaction.fields.getTextInputValue('pv2_text') || '').trim();
    const davet = (interaction.fields.getTextInputValue('pv2_davet') || '').trim();
    if (!linkVarMi(text) && !linkVarMi(davet)) {
      return interaction.reply({ content: '❌ Textinde veya davet kutusunda **geçerli bir sunucu linki** olmalı! (discord.gg/...)', ephemeral: true });
    }
    const g = pv2Ayar(interaction.guild.id);
    const yKanal = interaction.guild.channels.cache.get(g.partnerYetkiliKanal);
    if (!yKanal) return interaction.reply({ content: '❌ Yetkili kanalı bulunamadı! Yetkiliye söyle.', ephemeral: true });

    const basId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const store = basvuruStore();
    store[basId] = { id: basId, guildId: interaction.guild.id, userId: interaction.user.id, userTag: interaction.user.tag, text, invite: davet, status: 'bekliyor', date: Date.now() };
    save();

    // Yetkili kanalına: link AYRI mesaj içeriği + detay embed + butonlar
    const e = new EmbedBuilder().setColor(config.colors.warn)
      .setTitle(`📩 YENİ PARTNER BAŞVURUSU (\`${basId}\`)`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👤 Başvuran', value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: false },
        { name: '📝 Gönderdiği Text', value: text.slice(0, 1500), inline: false },
        { name: '🔗 Sunucu Linki', value: davet, inline: false },
        { name: '📅 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        { name: '🆔 Kullanıcı ID', value: interaction.user.id, inline: true },
      )
      .setFooter({ text: 'Onayla → partner kanalına düşer • Reddet → kişiye DM gider' })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`pv2_onay_${basId}`).setLabel('✅ Onayla').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`pv2_red_${basId}`).setLabel('❌ Reddet').setStyle(ButtonStyle.Danger),
    );
    await yKanal.send({
      content: `🔔 ${g.partnerYetkiliRol ? `<@&${g.partnerYetkiliRol}>` : ''} **Yeni başvuru!**\n🔗 **Sunucu linki:** ${davet}`,
      embeds: [e], components: [row],
    }).catch(() => null);
    return interaction.reply({ content: `✅ Başvurun yetkililere iletildi! Onaylanınca ${g.partnerKanal ? `<#${g.partnerKanal}>` : 'partner kanalında'} paylaşılacak. Kodun: \`${basId}\``, ephemeral: true });
  }
  // Ret sebebi formu
  if (interaction.customId.startsWith('pv2_redmodal_')) {
    const basId = interaction.customId.replace('pv2_redmodal_', '');
    const store = basvuruStore();
    const b = store[basId];
    if (!b) return interaction.reply({ content: '❌ Başvuru bulunamadı!', ephemeral: true });
    const sebep = interaction.fields.getTextInputValue('pv2_redsebep');
    b.status = 'red'; b.redSebep = sebep; b.kararVeren = interaction.user.id; b.kararTarih = Date.now();
    save();
    await interaction.update({ content: `❌ Başvuru **${interaction.user.tag}** tarafından reddedildi. Sebep: *${sebep}* (\`${basId}\`)`, embeds: [], components: [] }).catch(() => {});
    try {
      const kisi = await client.users.fetch(b.userId);
      const gif = await animeGif('cry').catch(() => null);
      await kisi.send({ embeds: [new EmbedBuilder().setColor(config.colors.error).setTitle(`❌ Partnerliğin reddedildi — ${interaction.guild.name}`).setDescription(`**Sebep:** ${sebep}\n\nDüzenleyip tekrar başvurabilirsin! 💪`).setImage(gif || null).setTimestamp()] }).catch(() => {});
    } catch {}
    return;
  }
}

// ---------- /partner slash tanımı (ham JSON) ----------
const partnerSlash = {
  data: {
    name: 'partner',
    description: '🤝 Partner sistemi (kurulum, bilgi, başvurular)',
    contexts: [0],
    options: [
      {
        type: 1, name: 'ayarla', description: 'Partner sistemini kur (5 ayar birden)',
        options: [
          { type: 7, name: 'kanal', description: 'Onaylanan textlerin paylaşılacağı kanal', required: true },
          { type: 8, name: 'yetkili_rol', description: 'Onay verecek partner yetkilisi rolü', required: true },
          { type: 7, name: 'chat', description: 'Üyelerin partner yazacağı başvuru chat kanalı', required: true },
          { type: 7, name: 'yetkili_kanal', description: 'Başvuruların düşeceği yetkili kanalı', required: true },
          { type: 3, name: 'yazi', description: 'Sunucunun kendi partner tanıtım yazısı', required: true },
        ],
      },
      { type: 1, name: 'bilgi', description: 'Partner ayarlarını ve istatistiği gösterir' },
      { type: 1, name: 'liste', description: 'Onaylanan partner başvurularını listeler' },
      {
        type: 1, name: 'durum', description: 'Başvuru durumunu kodla sorgula',
        options: [{ type: 3, name: 'kod', description: 'Başvuru kodu (örn: A1B2C3)', required: true }],
      },
      { type: 1, name: 'sifirla', description: 'Partner ayarlarını sıfırlar' },
      {
        type: 1, name: 'sayac', description: '🏆 Yetkili partner sayacı (dönemlik liderlik)',
        options: [{ type: 6, name: 'kullanici', description: 'Kişisel karne için etiketle (boş = liderlik)', required: false }],
      },
      {
        type: 1, name: 'capraz-istek', description: 'Başka sunucuya botlar-arası oto partner isteği gönder',
        options: [{ type: 3, name: 'davet', description: 'Karşı sunucunun davet linki', required: true }],
      },
    ],
  },
  async execute(interaction, client) {
    const alt = interaction.options.getSubcommand();
    const g = pv2Ayar(interaction.guild.id);
    const uye = interaction.member;
    const yonetici = uye.permissions.has(PermissionFlagsBits.ManageGuild);

    if (alt === 'ayarla') {
      if (!yonetici) return interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true });
      const kanal = interaction.options.getChannel('kanal');
      const rol = interaction.options.getRole('yetkili_rol');
      const chat = interaction.options.getChannel('chat');
      const ykanal = interaction.options.getChannel('yetkili_kanal');
      const yazi = interaction.options.getString('yazi');
      if (yazi.length < 10) return interaction.reply({ content: '❌ Tanıtım yazısı en az 10 karakter olmalı!', ephemeral: true });
      setGuild(interaction.guild.id, { partnerKanal: kanal.id, partnerYetkiliRol: rol.id, partnerChat: chat.id, partnerYetkiliKanal: ykanal.id, partnerText: yazi });
      const gif = await animeGif('happy').catch(() => null);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle('🤝 Partner Sistemi Kuruldu!')
          .setDescription(
            `📢 Paylaşım: ${kanal}\n👮 Yetkili rol: ${rol}\n💬 Başvuru chat: ${chat}\n📩 Yetkili kanal: ${ykanal}\n\n` +
            `📝 Yazın:\n> ${yazi.slice(0, 500)}\n\n` +
            `💡 Biri ${chat} kanalına "partner" yazınca bot otomatik **başvuru butonu** gönderecek!`
          ).setImage(gif || null).setTimestamp()],
      });
    }
    if (alt === 'bilgi') {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`🤝 ${interaction.guild.name} — Partner Bilgi`)
          .addFields(
            { name: '📢 Paylaşım Kanalı', value: g.partnerKanal ? `<#${g.partnerKanal}>` : '❌', inline: true },
            { name: '💬 Başvuru Chat', value: g.partnerChat ? `<#${g.partnerChat}>` : '❌', inline: true },
            { name: '📩 Yetkili Kanal', value: g.partnerYetkiliKanal ? `<#${g.partnerYetkiliKanal}>` : '❌', inline: true },
            { name: '👮 Yetkili Rol', value: g.partnerYetkiliRol ? `<@&${g.partnerYetkiliRol}>` : '❌', inline: true },
            { name: '🔢 Toplam Onay', value: `${g.partnerSayi || 0}`, inline: true },
            { name: '⏳ Bekleyen', value: `${Object.values(basvuruStore()).filter(b => b.guildId === interaction.guild.id && b.status === 'bekliyor').length}`, inline: true },
            { name: '📝 Tanıtım Yazısı', value: (g.partnerText || '❌ ayarlı değil').slice(0, 800), inline: false },
          ).setFooter({ text: 'Kurulum: /partner ayarla' }).setTimestamp()],
      });
    }
    if (alt === 'liste') {
      const onay = Object.values(basvuruStore()).filter(b => b.guildId === interaction.guild.id && b.status === 'onay').slice(-10).reverse();
      if (!onay.length) return interaction.reply({ content: 'Henüz onaylanan partner yok!', ephemeral: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle(`🤝 Onaylanan Partnerler (${onay.length})`).setDescription(onay.map(b => `✅ <@${b.userId}> — <t:${Math.floor(b.date / 1000)}:D> (\`${b.id}\`)\n🔗 ${b.invite}`).join('\n\n').slice(0, 3900)).setTimestamp()] });
    }
    if (alt === 'durum') {
      const kod = (interaction.options.getString('kod') || '').toUpperCase();
      const b = basvuruStore()[kod] || db().partnerRequests[kod];
      if (!b) return interaction.reply({ content: '❌ Kayıt bulunamadı!', ephemeral: true });
      const durum = b.status === 'bekliyor' ? '⏳ Bekliyor' : b.status === 'onay' || b.status === 'kabul' ? '✅ Onaylandı' : '❌ Reddedildi';
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`🔑 ${kod} — ${durum}`).setDescription(`Başvuran: ${b.userId ? `<@${b.userId}>` : (b.fromGuild || '?')}\nTarih: <t:${Math.floor(b.date / 1000)}:R>${b.redSebep ? `\nRed sebebi: ${b.redSebep}` : ''}`).setTimestamp()] });
    }
    if (alt === 'sifirla') {
      if (!yonetici) return interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true });
      setGuild(interaction.guild.id, { partnerKanal: null, partnerText: null, partnerChat: null, partnerYetkiliKanal: null, partnerYetkiliRol: null });
      return interaction.reply({ embeds: [ok('🗑️ Partner ayarları sıfırlandı.')] });
    }
    if (alt === 'sayac') {
      const hedef = interaction.options.getUser('kullanici');
      if (hedef) return interaction.reply({ embeds: [kisiSayacEmbed(interaction.guild, hedef)] });
      return interaction.reply({ embeds: [sayacEmbed(interaction.guild, 'aylik')], components: sayacRow('aylik') });
    }
    if (alt === 'capraz-istek') {
      // Eski botlar-arası akışı slash üzerinden çalıştır
      if (!yonetici) return interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true });
      await interaction.deferReply();
      const link = interaction.options.getString('davet');
      const sonuc = await caprazIstek(interaction.guild, link, interaction.user, client);
      return interaction.editReply(sonuc);
    }
  },
};

// Eski çapraz-sunucu isteği (hem prefix hem /partner capraz-istek kullanır)
async function caprazIstek(guild, link, isteyen, client) {
  const bizim = pv2Ayar(guild.id);
  if (!bizim.partnerKanal) return { embeds: [err('Önce kurulum yap! `/partner ayarla`')] };
  if (!bizim.partnerText) return { embeds: [err('Önce tanıtım yazısı ayarla! `/partner ayarla`')] };
  const kod = davetKoduBul(link || '');
  if (!kod) return { embeds: [err('Geçerli davet linki at!')] };
  let davet;
  try { davet = await client.fetchInvite(kod); } catch { return { embeds: [err('Davet bulunamadı!')] }; }
  if (!davet.guild || davet.guild.id === guild.id) return { embeds: [err('Kendine istek atamazsın 😅')] };
  const hedef = client.guilds.cache.get(davet.guild.id);
  if (!hedef) return { embeds: [err('Karşı sunucuda ben yokum! Önce beni oraya eklet.')] };
  const hedefAyar = pv2Ayar(hedef.id);
  if (!hedefAyar.partnerKanal) return { embeds: [err(`❌ **${hedef.name}** partner kurmamış!`)] };
  const hedefKanal = hedef.channels.cache.get(hedefAyar.partnerKanal);
  if (!hedefKanal) return { embeds: [err('Karşı kanal silinmiş!')] };
  const d = db();
  if (!d.partnerRequests) d.partnerRequests = {};
  const bekleyen = Object.values(d.partnerRequests).find(r => r.fromGuild === guild.id && r.toGuild === hedef.id && r.status === 'bekliyor');
  if (bekleyen) return { embeds: [err('Zaten bekleyen isteğin var!')] };
  const istekKod = Math.random().toString(36).slice(2, 8).toUpperCase();
  d.partnerRequests[istekKod] = { fromGuild: guild.id, toGuild: hedef.id, fromInvite: link, date: Date.now(), status: 'bekliyor', fromUser: isteyen.id };
  save();
  const gif = await animeGif('hug').catch(() => null);
  const embed = new EmbedBuilder().setColor(config.colors.pink).setTitle('🤝 YENİ ÇAPRAZ PARTNER İSTEĞİ!')
    .setThumbnail(guild.iconURL({ size: 256 }))
    .setDescription(`**${guild.name}** sizinle partner olmak istiyor!\n\n👥 Üye: **${guild.memberCount}**\n💬 Tanıtımları:\n> ${(bizim.partnerText || '').slice(0, 500)}\n\n✅ Kabul → iki kanala da otomatik tanıtım!\n⏱️ Kod: \`${istekKod}\``)
    .setImage(gif || null).setFooter({ text: 'Yönetici onayı gerekir' }).setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`partner_kabul_${istekKod}`).setLabel('✅ Kabul Et').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`partner_red_${istekKod}`).setLabel('❌ Reddet').setStyle(ButtonStyle.Danger),
  );
  try {
    await hedefKanal.send({ content: '📢 **Yeni partner isteği!**', embeds: [embed], components: [row] });
  } catch { return { embeds: [err('Karşı kanala yazamadım!')] }; }
  return { embeds: [ok(`📨 İstek gönderildi → **${hedef.name}**! Kod: \`${istekKod}\` (/partner durum) `)] };
}

const komutlar = [
  {
    name: 'partner-kur', aliases: ['partnerkur', 'psetup'], category: 'Partner',
    description: 'Yeni partner sistemini kurar (prefix sürümü).',
    usage: '!partner-kur #paylaşım @yetkili-rol #chat #yetkili-kanal <tanıtım-yazısı>',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args) {
      const kanallar = [...message.mentions.channels.values()];
      const roller = [...message.mentions.roles.values()];
      if (kanallar.length < 3 || !roller.length) return message.reply({ embeds: [err('Kullanım: `!partner-kur #paylaşım @yetkili-rol #başvuru-chat #yetkili-kanal <tanıtım yazın>`\nÖrn: `!partner-kur #partner @Partner-YT #partner-chat #partner-onay 🌙 Sunucumuz... https://discord.gg/xxxx`')] });
      const temiz = args.filter(a => !/^<#\d+>$/.test(a) && !/^<@&\d+>$/.test(a)).join(' ');
      if (!temiz || temiz.length < 10) return message.reply({ embeds: [err('Tanıtım yazısı en az 10 karakter olmalı! (en sona yaz)')] });
      setGuild(message.guild.id, { partnerKanal: kanallar[0].id, partnerYetkiliRol: roller[0].id, partnerChat: kanallar[1].id, partnerYetkiliKanal: kanallar[2].id, partnerText: temiz });
      return message.reply({ embeds: [ok(`🤝 Kuruldu!\n📢 ${kanallar[0]} • 👮 ${roller[0]} • 💬 ${kanallar[1]} • 📩 ${kanallar[2]}\n\n\`!partner-bilgi\` ile kontrol et. Modern kurulum için \`\/partner ayarla\` de var!`)] });
    },
  },
  {
    name: 'partner-ayarla', aliases: ['partnerayarla'], category: 'Partner',
    description: 'Paylaşım kanalını hızlı ayarlar.', usage: '!partner-ayarla #kanal',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message) {
      const k = message.mentions.channels.first();
      if (!k) return message.reply({ embeds: [err('Kanal etiketle! `!partner-ayarla #partner` (tümü için: `!partner-kur` veya `/partner ayarla`)')] });
      setGuild(message.guild.id, { partnerKanal: k.id });
      return message.reply({ embeds: [ok(`🤝 Partner kanalı ${k} oldu!`)] });
    },
  },
  {
    name: 'partner-text', aliases: ['partnertext'], category: 'Partner',
    description: 'Sunucunun tanıtım yazısını ayarlar.', usage: '!partner-text <yazı>',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args) {
      const yazi = args.join(' ');
      if (!yazi || yazi.length < 10) return message.reply({ embeds: [err('En az 10 karakter! `!partner-text 🌙 Sunucumuz... {davet}`')] });
      setGuild(message.guild.id, { partnerText: yazi });
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle('✅ Partner Yazısı Kaydedildi').setDescription(`**Önizleme:**\n${partnerTextUret(yazi, message.guild, 'https://discord.gg/örnek')}`).setTimestamp()] });
    },
  },
  {
    name: 'partner-bilgi', aliases: ['partnerbilgi'], category: 'Partner',
    description: 'Partner ayarlarını gösterir.', usage: '!partner-bilgi',
    async run(message) {
      const g = pv2Ayar(message.guild.id);
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`🤝 ${message.guild.name} — Partner Bilgi`)
        .addFields(
          { name: '📢 Paylaşım', value: g.partnerKanal ? `<#${g.partnerKanal}>` : '❌', inline: true },
          { name: '💬 Başvuru Chat', value: g.partnerChat ? `<#${g.partnerChat}>` : '❌', inline: true },
          { name: '📩 Yetkili Kanal', value: g.partnerYetkiliKanal ? `<#${g.partnerYetkiliKanal}>` : '❌', inline: true },
          { name: '👮 Yetkili Rol', value: g.partnerYetkiliRol ? `<@&${g.partnerYetkiliRol}>` : '❌', inline: true },
          { name: '🔢 Toplam Onay', value: `${g.partnerSayi || 0}`, inline: true },
          { name: '⏳ Bekleyen', value: `${Object.values(basvuruStore()).filter(b => b.guildId === message.guild.id && b.status === 'bekliyor').length}`, inline: true },
          { name: '📝 Tanıtım', value: (g.partnerText || '❌').slice(0, 800), inline: false },
        ).setFooter({ text: 'Kurulum: !partner-kur veya /partner ayarla' }).setTimestamp()] });
    },
  },
  {
    name: 'partner-istek', aliases: ['partneristek'], category: 'Partner',
    description: 'Başka sunucuya botlar-arası oto istek gönderir.', usage: '!partner-istek <davet-linki>',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args, client) {
      const sonuc = await caprazIstek(message.guild, args[0], message.author, client);
      return message.reply(sonuc);
    },
  },
  {
    name: 'partner-durum', aliases: ['partnerdurum'], category: 'Partner',
    description: 'Başvuru/istek durumunu kodla sorgular.', usage: '!partner-durum <kod>',
    async run(message, args) {
      const kod = (args[0] || '').toUpperCase();
      const b = basvuruStore()[kod] || (db().partnerRequests || {})[kod];
      if (!b) return message.reply({ embeds: [err('Kayıt bulunamadı!')] });
      const durum = b.status === 'bekliyor' ? '⏳ Bekliyor' : (b.status === 'onay' || b.status === 'kabul') ? '✅ Onaylandı' : '❌ Reddedildi';
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`🔑 ${kod} — ${durum}`).setDescription(`Tarih: <t:${Math.floor(b.date / 1000)}:R>${b.redSebep ? `\nSebep: ${b.redSebep}` : ''}`).setTimestamp()] });
    },
  },
  {
    name: 'partner-liste', aliases: ['partnerliste'], category: 'Partner',
    description: 'Onaylanan partnerleri listeler.', usage: '!partner-liste',
    async run(message) {
      const onay = Object.values(basvuruStore()).filter(b => b.guildId === message.guild.id && b.status === 'onay').slice(-10).reverse();
      const capraz = Object.entries(db().partnerRequests || {}).filter(([k, r]) => (r.fromGuild === message.guild.id || r.toGuild === message.guild.id) && r.status === 'kabul');
      if (!onay.length && !capraz.length) return message.reply({ embeds: [err('Henüz partner yok!')] });
      let desc = onay.map(b => `✅ <@${b.userId}> — <t:${Math.floor(b.date / 1000)}:D> (\`${b.id}\`)`).join('\n');
      for (const [kod, r] of capraz.slice(0, 10)) {
        const diger = r.fromGuild === message.guild.id ? r.toGuild : r.fromGuild;
        const g = message.client.guilds.cache.get(diger);
        desc += `\n🤝 **${g ? g.name : diger}** — <t:${Math.floor(r.date / 1000)}:D> (\`${kod}\`)`;
      }
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle('🤝 Partnerler').setDescription(desc.slice(0, 3900)).setTimestamp()] });
    },
  },
  {
    name: 'partner-sifirla', aliases: ['partnersıfırla'], category: 'Partner',
    description: 'Partner ayarlarını sıfırlar.', usage: '!partner-sıfırla',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message) {
      setGuild(message.guild.id, { partnerKanal: null, partnerText: null, partnerChat: null, partnerYetkiliKanal: null, partnerYetkiliRol: null });
      return message.reply({ embeds: [ok('🗑️ Partner ayarları sıfırlandı.')] });
    },
  },
  {
    name: 'partner-sayac', aliases: ['partnersayac', 'psayac'], category: 'Partner',
    description: '🏆 Yetkili partner sayacı (dönemlik liderlik / kişisel karne).', usage: '!partner-sayac [@kullanıcı] [gunluk|haftalik|aylik|yillik]',
    async run(message, args) {
      const hedef = await kisiBulAsync(message, args, 0).catch(() => null);
      if (hedef) return message.reply({ embeds: [kisiSayacEmbed(message.guild, hedef.user)] });
      const ham = String(args[0] || '').toLocaleLowerCase('tr');
      const tur = { gunluk: 'gunluk', günlük: 'gunluk', haftalik: 'haftalik', haftalık: 'haftalik', aylik: 'aylik', aylık: 'aylik', yillik: 'yillik', yıllık: 'yillik' }[ham] || 'aylik';
      return message.reply({ embeds: [sayacEmbed(message.guild, tur)], components: sayacRow(tur) });
    },
  },
  // --- Eski çapraz butonlar (geriye uyumluluk) ---
  {
    name: '__partner_button__', aliases: [], category: 'Sistem', description: 'internal', usage: '',
    async run() {},
    async button(interaction, client) {
      const [_, karar, kod] = interaction.customId.split('_');
      const d = db();
      if (!d.partnerRequests) d.partnerRequests = {};
      const req = d.partnerRequests[kod];
      if (!req) return interaction.reply({ content: '❌ İstek bulunamadı!', ephemeral: true });
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ Sadece yöneticiler!', ephemeral: true });
      if (req.status !== 'bekliyor') return interaction.reply({ content: 'Zaten sonuçlanmış!', ephemeral: true });
      if (karar === 'red') {
        req.status = 'red'; save();
        await interaction.update({ content: `❌ Reddedildi. (\`${kod}\`)`, embeds: [], components: [] }).catch(() => {});
        return;
      }
      req.status = 'kabul'; save();
      const fromG = client.guilds.cache.get(req.fromGuild);
      const toG = client.guilds.cache.get(req.toGuild);
      if (!fromG || !toG) return interaction.reply({ content: '❌ Sunucu bulunamadı!', ephemeral: true });
      const fromAyar = pv2Ayar(fromG.id);
      const toAyar = pv2Ayar(toG.id);
      const fromKanal = fromG.channels.cache.get(fromAyar.partnerKanal);
      const toKanal = toG.channels.cache.get(toAyar.partnerKanal);
      const fromDavet = await otoDavetUret(fromKanal).catch(() => null) || req.fromInvite;
      const karsiDavet = await otoDavetUret(toKanal).catch(() => null);
      fromAyar.partnerSayi = (fromAyar.partnerSayi || 0) + 1;
      toAyar.partnerSayi = (toAyar.partnerSayi || 0) + 1;
      save();
      skorKaydet(req.toGuild, interaction.user.id);
      const gif = await animeGif('happy').catch(() => null);
      try { if (fromKanal) await fromKanal.send({ embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle(`🤝 YENİ PARTNER: ${toG.name}!`).setThumbnail(toG.iconURL({ size: 256 })).setDescription(partnerTextUret(toAyar.partnerText, toG, karsiDavet)).setImage(gif || null).setFooter({ text: `Kod: ${kod}` }).setTimestamp()] }); } catch {}
      try { if (toKanal) await toKanal.send({ embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle(`🤝 YENİ PARTNER: ${fromG.name}!`).setThumbnail(fromG.iconURL({ size: 256 })).setDescription(partnerTextUret(fromAyar.partnerText, fromG, fromDavet)).setImage(gif || null).setFooter({ text: `Kod: ${kod}` }).setTimestamp()] }); } catch {}
      await interaction.update({ content: `✅ Kabul edildi, iki kanala da atıldı! 🎉 (\`${kod}\`)`, embeds: [], components: [] }).catch(() => {});
    },
  },
];

module.exports = komutlar;
module.exports.partnerSlash = partnerSlash;
module.exports.sayacButton = sayacButton;
module.exports.DONEMLER = DONEMLER;
module.exports.skorKaydet = skorKaydet;
module.exports.skorLiderlik = skorLiderlik;
module.exports.skorKisi = skorKisi;
module.exports.handlePv2Button = handlePv2Button;
module.exports.handlePv2Modal = handlePv2Modal;
module.exports.maybePartnerPrompt = maybePartnerPrompt;
