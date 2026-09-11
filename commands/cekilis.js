// 🎉 Modern butonlu çekiliş sistemi: /cekilis baslat / bitir / iptal
// Şartlı katılım (itibar/seviye/üyelik), maks-min kontenjan, restart-dayanıklı.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getUser, db, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { kart, RENK, cubuk } = require('../src/tasarim');
const { E, EID } = require('../src/emo');
const { parseSure, sureYaz } = require('../src/utils');

function cekStore() {
  const d = db();
  if (!d.cekilisler) d.cekilisler = {};
  return d.cekilisler;
}

function sartAd(s) {
  return { yok: 'Herkes katılabilir 🎈', rep5: 'En az **5** itibar ⭐', sv3: 'En az **Sv.3** 📈', gun7: '**7+** günlük üyelik 📅' }[s] || 'Herkes';
}

async function sartKontrol(guild, uid, sart) {
  if (!sart || sart === 'yok') return { ok: true };
  if (sart === 'rep5') {
    const d = getUser(guild.id, uid);
    return (d.rep || 0) >= 5 ? { ok: true } : { ok: false, sebep: 'En az **5** itibarın olmalı! (`!1` ile topla)' };
  }
  if (sart === 'sv3') {
    const d = getUser(guild.id, uid);
    return (d.level || 0) >= 3 ? { ok: true } : { ok: false, sebep: 'En az **Sv.3** olmalısın! (Sohbet et, XP kazan)' };
  }
  if (sart === 'gun7') {
    const m = await guild.members.fetch(uid).catch(() => null);
    if (!m) return { ok: false, sebep: 'Sunucuda bulunamadın!' };
    const gun = (Date.now() - (m.joinedTimestamp || Date.now())) / 86400000;
    return gun >= 7 ? { ok: true } : { ok: false, sebep: `En az **7** günlük üye olmalısın! (Sen: ${gun.toFixed(0)} gün)` };
  }
  return { ok: true };
}

function cekilisEmbed(client, guild, c) {
  const hediye = E(client, '7373redgift', '🎁');
  const n = (c.katilan || []).length;
  return kart(client, {
    renk: RENK.vurgu,
    baslik: `${hediye} ${c.isim}`,
    aciklama: `**✦ ÇEKİLİŞ ✦**\n## 🎁 Ödül: **${c.odul}**`,
    kucukResim: guild.iconURL({ size: 256 }) || undefined,
    alanlar: [
      { name: '⏱️ Bitiş', value: `<t:${Math.floor(c.bitis / 1000)}:R>\n<t:${Math.floor(c.bitis / 1000)}:F>`, inline: true },
      { name: '🏆 Kazanan', value: `**${c.kazanan}** kişi`, inline: true },
      { name: '👥 Katılım', value: `**${n}**${c.maks ? ` / ${c.maks}` : ''}${c.maks ? `\n${cubuk(n, c.maks, 8)}` : ''}`, inline: true },
      { name: '📋 Katılım Şartı', value: sartAd(c.sart), inline: false },
    ],
    altbilgi: `ID: ${c.id} • Katılmak için butona bas!`,
  });
}

function cekilisRow(client, c, kapali = false) {
  const n = (c.katilan || []).length;
  const dolu = c.maks && n >= c.maks;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cekilis_katil_${c.id}`)
      .setLabel(dolu ? 'Kontenjan Doldu!' : `🎉 Katıl${n ? ` (${n})` : ''}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji(EID(client, '7373redgift') || '🎉')
      .setDisabled(kapali || dolu)
  );
}

function hedefBul(guild, idOpt) {
  const store = cekStore();
  if (idOpt) {
    const c = store[String(idOpt)];
    if (!c || c.guildId !== guild.id || c.bitmis) return { hata: 'Aktif çekiliş bulunamadı! (ID hatalı ya da bitmiş)' };
    return { cekilis: c };
  }
  const aktif = Object.values(store).filter((c) => c.guildId === guild.id && !c.bitmis);
  if (!aktif.length) return { hata: 'Aktif çekiliş yok!' };
  if (aktif.length > 1) {
    return { hata: `Birden fazla aktif var! ID ile seç:\n${aktif.map((c) => `• **${c.isim}** → \`${c.id}\``).join('\n')}` };
  }
  return { cekilis: aktif[0] };
}

async function cekilisBitir(client, id) {
  const store = cekStore();
  const c = store[id];
  if (!c || c.bitmis) return;
  c.bitmis = true;
  save();
  const guild = client.guilds.cache.get(c.guildId);
  if (!guild) return;
  const kanal = guild.channels.cache.get(c.channelId);
  const tik = E(client, '495202greentick', '✅');
  const katilan = [...new Set(c.katilan || [])];
  const duyur = async (embeds, icerik = null) => {
    if (kanal) {
      try {
        const msg = await kanal.messages.fetch(c.id).catch(() => null);
        if (msg) await msg.edit({ embeds, components: [cekilisRow(client, c, true)] }).catch(() => {});
      } catch {}
    }
    if (icerik && kanal) await kanal.send(icerik).catch(() => {});
  };
  // Yetersiz katılım → iptal
  if (!katilan.length || katilan.length < (c.min || 0)) {
    await duyur([kart(client, {
      renk: RENK.hata,
      baslik: `😢 ${c.isim} — İptal`,
      aciklama: `Katılım yetersiz! **${katilan.length}** kişi katıldı${c.min ? ` (en az ${c.min} gerekliydi)` : ''}.`,
      altbilgi: `ID: ${c.id}`,
    })]);
    return;
  }
  // Kazananlar
  const karisik = katilan.sort(() => Math.random() - 0.5).slice(0, c.kazanan || 1);
  const gecerli = [];
  for (const uid of karisik) {
    const m = await guild.members.fetch(uid).catch(() => null);
    if (m) gecerli.push(m);
  }
  if (!gecerli.length) {
    await duyur([kart(client, { renk: RENK.hata, baslik: `😢 ${c.isim}`, aciklama: 'Kazananlar sunucudan ayrılmış!' })]);
    return;
  }
  const etiket = gecerli.map((m) => `${m}`).join(' ');
  await duyur([kart(client, {
    renk: RENK.altin,
    baslik: `${E(client, '7373redgift', '🎉')} ${c.isim} — SONUÇ!`,
    aciklama: `## 🎁 Ödül: **${c.odul}**\n\n# 🏆 ${etiket}\n\n**TEBRİKLER!** Ödülün için yetkiliye yaz! ${tik}`,
    alanlar: [{ name: '👥 Katılım', value: `**${katilan.length}** kişi`, inline: true }],
    altbilgi: `ID: ${c.id} • Bol şans bir dahakine!`,
  })], { content: `🎉 **ÇEKİLİŞ BİTTİ!** ${etiket}\n🎁 **${c.odul}** kazandın!` });
}

async function handleCekilisButton(interaction, client) {
  const id = interaction.customId.replace('cekilis_katil_', '');
  const c = cekStore()[id];
  if (!c || c.bitmis) return interaction.reply({ content: '❌ Bu çekiliş sona ermiş!', ephemeral: true });
  if (c.guildId !== interaction.guild.id) return interaction.reply({ content: '❌ Yanlış sunucu!', ephemeral: true });
  const uid = interaction.user.id;
  if ((c.katilan || []).includes(uid)) return interaction.reply({ content: '😎 Zaten katılıyorsun! Bol şans!', ephemeral: true });
  if (c.maks && c.katilan.length >= c.maks) return interaction.reply({ content: '😢 Kontenjan dolmuş!', ephemeral: true });
  const kontrol = await sartKontrol(interaction.guild, uid, c.sart);
  if (!kontrol.ok) return interaction.reply({ content: `❌ Katılamazsın: ${kontrol.sebep}`, ephemeral: true });
  c.katilan.push(uid);
  save();
  await interaction.update({
    embeds: [cekilisEmbed(client, interaction.guild, c)],
    components: [cekilisRow(client, c)],
  }).catch(() => {});
  return interaction.followUp({ content: `✅ Katıldın! Bol şans 🍀 (**${c.katilan.length}** katılımcı)`, ephemeral: true }).catch(() => {});
}

const cekilisSlash = {
  data: {
    name: 'cekilis',
    description: '🎉 Modern çekiliş sistemi (şartlı, butonlu)',
    contexts: [0],
    options: [
      {
        type: 1, name: 'baslat', description: 'Yeni çekiliş başlat',
        options: [
          { type: 3, name: 'isim', description: 'Çekiliş adı (örn: Nitro Çekilişi)', required: true },
          { type: 3, name: 'odul', description: 'Ödül nedir?', required: true },
          { type: 3, name: 'sure', description: 'Süre (örn: 10m, 1h, 1d)', required: true },
          {
            type: 3, name: 'sart', description: 'Katılım şartı', required: false,
            choices: [
              { name: 'Herkes', value: 'yok' }, { name: 'En az 5 itibar', value: 'rep5' },
              { name: 'En az Sv.3', value: 'sv3' }, { name: '7+ günlük üyelik', value: 'gun7' },
            ],
          },
          { type: 4, name: 'kazanan', description: 'Kazanan sayısı (varsayılan 1)', required: false, min_value: 1, max_value: 10 },
          { type: 4, name: 'maks', description: 'Maks katılımcı (boş = sınırsız)', required: false, min_value: 2, max_value: 1000 },
          { type: 4, name: 'min', description: 'Min katılımcı (altında iptal)', required: false, min_value: 2, max_value: 1000 },
        ],
      },
      {
        type: 1, name: 'bitir', description: 'Çekilişi hemen bitir',
        options: [{ type: 3, name: 'id', description: 'Mesaj ID (tek aktif varsa boş bırak)', required: false }],
      },
      {
        type: 1, name: 'iptal', description: 'Çekilişi iptal et',
        options: [
          { type: 3, name: 'id', description: 'Mesaj ID (tek aktif varsa boş bırak)', required: false },
          { type: 3, name: 'sebep', description: 'İptal sebebi', required: false },
        ],
      },
    ],
  },
  async execute(interaction, client) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: '❌ Mesajları Yönet yetkisi gerek!', ephemeral: true });
    }
    const alt = interaction.options.getSubcommand();
    if (alt === 'baslat') {
      const isim = interaction.options.getString('isim').slice(0, 100);
      const odul = interaction.options.getString('odul').slice(0, 200);
      const sure = parseSure(interaction.options.getString('sure'));
      const sart = interaction.options.getString('sart') || 'yok';
      const kazanan = interaction.options.getInteger('kazanan') || 1;
      const maks = interaction.options.getInteger('maks') || 0;
      const min = interaction.options.getInteger('min') || 0;
      const premCek = require('../src/premium').premiumMu(interaction.guild.id);
      const maksSure = premCek ? 30 * 86400_000 : 7 * 86400_000;
      const maksKatilim = premCek ? 1000 : 200;
      if (!sure || sure < 30_000 || sure > maksSure) {
        return interaction.reply({ content: premCek ? '❌ Süre 30sn-30gün arası olmalı! Örn: `10m`, `2h`, `1d`' : '❌ Süre 30sn-7gün arası olmalı! (👑 Premium ile 30 güne kadar!)', ephemeral: true });
      }
      if (maks && maks > maksKatilim) {
        return interaction.reply({ content: premCek ? '❌ Maks 1000 olabilir!' : '❌ Free limit 200 kişi! (👑 Premium ile 1000!)', ephemeral: true });
      }
      if (maks && min && maks < min) {
        return interaction.reply({ content: '❌ Maks katılımcı min değerden küçük olamaz!', ephemeral: true });
      }
      const c = {
        id: null, guildId: interaction.guild.id, channelId: interaction.channel.id,
        isim, odul, bitis: Date.now() + sure, sart, kazanan, maks, min,
        katilan: [], bitmis: false, olusturan: interaction.user.id,
      };
      const msg = await interaction.reply({
        embeds: [cekilisEmbed(client, interaction.guild, { ...c, id: '...', katilan: [] })],
        components: [cekilisRow(client, { ...c, katilan: [] })],
        fetchReply: true,
      }).catch(() => null);
      if (!msg) return;
      c.id = msg.id;
      cekStore()[c.id] = c;
      save();
      await msg.edit({ embeds: [cekilisEmbed(client, interaction.guild, c)], components: [cekilisRow(client, c)] }).catch(() => {});
      setTimeout(() => cekilisBitir(client, c.id), Math.min(sure, 2147483647));
      return interaction.followUp({
        content: `✅ Çekiliş başlatıldı! ID: \`${c.id}\`\nBitir: \`/cekilis bitir\` • İptal: \`/cekilis iptal\``,
        ephemeral: true,
      }).catch(() => {});
    }
    if (alt === 'bitir') {
      const { cekilis, hata } = hedefBul(interaction.guild, interaction.options.getString('id'));
      if (hata) return interaction.reply({ content: `❌ ${hata}`, ephemeral: true });
      await interaction.reply({ content: `⏳ **${cekilis.isim}** bitiriliyor...`, ephemeral: true });
      return cekilisBitir(client, cekilis.id);
    }
    if (alt === 'iptal') {
      const { cekilis, hata } = hedefBul(interaction.guild, interaction.options.getString('id'));
      if (hata) return interaction.reply({ content: `❌ ${hata}`, ephemeral: true });
      const sebep = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
      cekilis.bitmis = true;
      cekilis.iptal = true;
      save();
      try {
        const kanal = interaction.guild.channels.cache.get(cekilis.channelId);
        const msg = await kanal?.messages.fetch(cekilis.id).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [kart(client, {
              renk: RENK.hata, baslik: `🚫 ${cekilis.isim} — İPTAL`,
              aciklama: `📝 Sebep: *${sebep}*\n👥 Katılım: **${(cekilis.katilan || []).length}**`,
            })],
            components: [cekilisRow(client, cekilis, true)],
          }).catch(() => {});
        }
      } catch {}
      return interaction.reply({ content: `🚫 **${cekilis.isim}** iptal edildi. (${sebep})`, ephemeral: true });
    }
  },
};

module.exports = [];
module.exports.cekilisSlash = cekilisSlash;
module.exports.cekilisBitir = cekilisBitir;
module.exports.handleCekilisButton = handleCekilisButton;
module.exports.cekilisEmbed = cekilisEmbed;
module.exports.cekilisRow = cekilisRow;
