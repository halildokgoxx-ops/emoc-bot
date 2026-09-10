const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getUser, save, db } = require('../src/db');
const { ok, err, kisiBulAsync } = require('../src/embeds');
const { rastgele, gunlukSeed, seedRandom } = require('../src/utils');
const { animeGif, tenorLink, ANIME_KATEGORILER } = require('../src/gif');
const config = require('../config');

// ---- Düello bekleyenleri (ram) ----
const duellolar = new Map(); // `${guildId}_${meydanOkuyanId}` -> { rakipId, bahis, kanalId, mesajId, bitis }

function gucHesapla(gid, uid) {
  const d = getUser(gid, uid);
  return (d.level || 0) * 10 + (d.rep || 0) * 5 + rastgele(1, 100);
}

async function duelBitir(client, guildId, meydanId, kabulEdildi, redmi = false) {
  const key = `${guildId}_${meydanId}`;
  const du = duellolar.get(key);
  if (!du) return;
  duellolar.delete(key);
  try {
    const guild = client.guilds.cache.get(guildId);
    const kanal = guild?.channels.cache.get(du.kanalId);
    if (!kanal) return;
    const mesaj = await kanal.messages.fetch(du.mesajId).catch(() => null);
    if (redmi) {
      if (mesaj) await mesaj.edit({ content: `😅 Düello reddedildi! Başka zaman...`, embeds: [], components: [] }).catch(() => {});
      return;
    }
    if (!kabulEdildi) {
      if (mesaj) await mesaj.edit({ content: `⏱️ Süre doldu, düello iptal!`, embeds: [], components: [] }).catch(() => {});
      return;
    }
    // SAVAŞ ANİMASYONU
    const meydan = await client.users.fetch(meydanId).catch(() => null);
    const rakip = await client.users.fetch(du.rakipId).catch(() => null);
    if (!mesaj || !meydan || !rakip) return;
    const gif1 = await animeGif('kick');
    await mesaj.edit({
      content: `⚔️ **DÜELLO BAŞLADI!** ${meydan} VS ${rakip}`,
      embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle('⚔️ 1. Raund!').setDescription(`${meydan} saldırıyor...`).setImage(gif1 || null).setTimestamp()],
      components: [],
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    const gif2 = await animeGif('slap');
    await mesaj.edit({
      embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle('⚔️ 2. Raund!').setDescription(`${rakip} karşılık veriyor... POW! 💥`).setImage(gif2 || null).setTimestamp()],
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    // SONUÇ
    const gucA = gucHesapla(guildId, meydanId);
    const gucB = gucHesapla(guildId, du.rakipId);
    const kazananId = gucA === gucB ? (Math.random() < 0.5 ? meydanId : du.rakipId) : (gucA > gucB ? meydanId : du.rakipId);
    const kazanan = kazananId === meydanId ? meydan : rakip;
    const kaybeden = kazananId === meydanId ? rakip : meydan;
    let paraNotu = '';
    if (du.bahis > 0) {
      const kD = getUser(guildId, kazananId);
      const kayD = getUser(guildId, kazananId === meydanId ? du.rakipId : meydanId);
      const odenen = Math.min(du.bahis, kayD.para || 0);
      kayD.para = (kayD.para || 0) - odenen;
      kD.para = (kD.para || 0) + odenen;
      save();
      paraNotu = `\n💰 **${odenen.toLocaleString('tr-TR')} coin** el değiştirdi!`;
    }
    const gif3 = await animeGif('happy');
    await mesaj.edit({
      content: `🏆 **KAZANAN: ${kazanan}!**`,
      embeds: [new EmbedBuilder().setColor(config.colors.gold).setTitle(`🏆 ${kazanan.username} KAZANDI!`)
        .setDescription(`⚔️ ${meydan} (güç: **${gucA}**) vs ${rakip} (güç: **${gucB}**)\n${kaybeden} yere serildi... GG! 🎉${paraNotu}`)
        .setImage(gif3 || null).setTimestamp()],
    }).catch(() => {});
  } catch {}
}

async function handleDuelButton(interaction, client) {
  // duel_kabul_<meydanId>_<bahis>  /  duel_red_<meydanId>
  const parca = interaction.customId.split('_');
  const karar = parca[1];
  const meydanId = parca[2];
  const key = `${interaction.guild.id}_${meydanId}`;
  const du = duellolar.get(key);
  if (!du) return interaction.reply({ content: '❌ Bu düello artık geçerli değil!', ephemeral: true });
  if (interaction.user.id !== du.rakipId) return interaction.reply({ content: '❌ Bu düello sana değil!', ephemeral: true });
  if (karar === 'red') {
    await interaction.deferUpdate().catch(() => {});
    return duelBitir(client, interaction.guild.id, meydanId, false, true);
  }
  // kabul: bahis kontrolü (rakibin parası)
  if (du.bahis > 0) {
    const rD = getUser(interaction.guild.id, interaction.user.id);
    if ((rD.para || 0) < du.bahis) {
      duellolar.delete(key);
      return interaction.reply({ content: `❌ Paran yetmiyor! Bahis: **${du.bahis}** coin, senin: **${rD.para || 0}**`, ephemeral: true });
    }
  }
  await interaction.deferUpdate().catch(() => {});
  return duelBitir(client, interaction.guild.id, meydanId, true);
}

const komutlar = [
  {
    name: 'anime', aliases: [], category: 'Eğlence',
    description: 'Anime GIF atar (öp, sarıl, tokat...). Tenor linkiyle!',
    usage: '!anime <kategori> [@kullanıcı]',
    slashOptions: [
      { type: 'string', name: 'kategori', description: 'Gif kategorisi', required: false, choices: ANIME_KATEGORILER.slice(0, 23).map(k => ({ name: k, value: k })) },
      { type: 'user', name: 'kullanici', description: 'Kime?', required: false },
    ],
    async run(message, args) {
      let kat = (args[0] || 'hug').toLowerCase();
      if (!ANIME_KATEGORILER.includes(kat)) kat = ANIME_KATEGORILER[rastgele(0, ANIME_KATEGORILER.length - 1)];
      const hedef = message.mentions.users.first();
      const gif = await animeGif(kat);
      const baslik = hedef ? `${message.author.username} → ${hedef.username} (${kat})` : `${message.author.username} (${kat})`;
      const e = new EmbedBuilder().setColor(config.colors.pink).setTitle(`🌸 ${baslik}`).setImage(gif || null).setFooter({ text: 'Anime GIF • waifu.pics' }).setTimestamp();
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('🌐 Tenor\'da Daha Fazla').setStyle(ButtonStyle.Link).setURL(tenorLink(`anime ${kat}`)));
      return message.reply({ embeds: [e], components: gif ? [row] : [] });
    },
  },
  {
    name: 'duello', aliases: ['düello', 'duel', 'vs'], category: 'Eğlence',
    description: 'Birine anime düellosu teklif edersin (para bahisli!). BENZERSİZ!',
    usage: '!duello @rakip [bahis]',
    async run(message, args, client) {
      const rakip = message.mentions.members.first();
      const bahis = Math.max(0, parseInt(args[1], 10) || 0);
      if (!rakip) return message.reply({ embeds: [err('Rakip etiketle! `!duello @kullanıcı 100`')] });
      if (rakip.id === message.author.id) return message.reply({ embeds: [err('Kendinle düello yapamazsın 😅')] });
      if (rakip.user.bot) return message.reply({ embeds: [err('Botla düello olmaz!')] });
      if (bahis > 0) {
        const d = getUser(message.guild.id, message.author.id);
        if ((d.para || 0) < bahis) return message.reply({ embeds: [err(`Paran yetmiyor! Bahis: **${bahis}**, senin: **${d.para || 0}** ('!günlük' ile kazan)`)] });
      }
      const key = `${message.guild.id}_${message.author.id}`;
      if (duellolar.has(key)) return message.reply({ embeds: [err('Zaten bekleyen düellon var!')] });
      const gif = await animeGif('smile');
      const e = new EmbedBuilder().setColor(config.colors.error).setTitle('⚔️ DÜELLO TEKLİFİ!')
        .setDescription(`${message.author} → ${rakip} meydan okudu!\n💰 Bahis: **${bahis} coin**\n\n${rakip}, kabul ediyor musun? (60sn)`)
        .setImage(gif || null).setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duel_kabul_${message.author.id}_${bahis}`).setLabel('⚔️ Kabul').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duel_red_${message.author.id}`).setLabel('🏳️ Reddet').setStyle(ButtonStyle.Secondary),
      );
      const msg = await message.reply({ embeds: [e], components: [row] });
      duellolar.set(key, { rakipId: rakip.id, bahis, kanalId: message.channel.id, mesajId: msg.id, bitis: Date.now() + 60_000 });
      setTimeout(() => { if (duellolar.has(key)) duelBitir(client || message.client, message.guild.id, message.author.id, false); }, 61_000);
    },
  },
  {
    name: 'sunucu-dna', aliases: ['dna', 'sunucudna'], category: 'Özel',
    description: 'Sunucunun karakter analizini çıkarır (DNA kartı). BENZERSİZ!',
    usage: '!sunucu-dna',
    async run(message) {
      const g = message.guild;
      const r = seedRandom(gunlukSeed(g.id))();
      const tipler = [
        { ad: '🌪️ KAOS ÜSSÜ', desc: 'Burada her an her şey olabilir. Sıkılmak yasak!' },
        { ad: '☕ SAMİMİ KAHVE', desc: 'Sıcak, tatlı, herkes birbirini tanıyor.' },
        { ad: '🎮 OYUN ARENASI', desc: 'Rekabet havada uçuşuyor, GG bitmiyor!' },
        { ad: '🌙 GECE KUŞLARI', desc: 'Asıl hayat gece 02:00\'de başlıyor.' },
        { ad: '🤝 PARTNER İMPARATORLUĞU', desc: 'Herkesle dost, her yerde tanıtım!' },
        { ad: '👑 EFSANE LOCASI', desc: 'Az ama öz. Kalite burada!' },
      ];
      const tip = tipler[Math.floor(r * tipler.length)];
      const botOran = Math.round((g.members.cache.filter(m => m.user.bot).size / Math.max(1, g.memberCount)) * 100);
      const gif = await animeGif('dance');
      return message.reply({
        embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`🧬 ${g.name} — SUNUCU DNA`)
          .setThumbnail(g.iconURL({ size: 256 }))
          .addFields(
            { name: '🧪 Karakter', value: `**${tip.ad}**\n*${tip.desc}*`, inline: false },
            { name: '👥 Üye', value: `${g.memberCount}`, inline: true },
            { name: '🤖 Bot Oranı', value: `%${botOran}`, inline: true },
            { name: '🚀 Boost', value: `Lv.${g.premiumTier} (${g.premiumSubscriptionCount || 0})`, inline: true },
            { name: '💬 Kanal', value: `${g.channels.cache.size}`, inline: true },
            { name: '🎭 Rol', value: `${g.roles.cache.size}`, inline: true },
            { name: '😀 Emoji', value: `${g.emojis.cache.size}`, inline: true },
          ).setImage(gif || null).setFooter({ text: 'DNA her gün yeniden hesaplanır 🧬' }).setTimestamp()],
      });
    },
  },
  {
    name: 'partner-radar', aliases: ['radar'], category: 'Partner',
    description: 'Vitrindeki sunucularla eşleşme yüzdesini tarar. BENZERSİZ!',
    usage: '!partner-radar',
    async run(message) {
      const v = db().vitrin.filter(x => x.guildId !== message.guild.id);
      if (!v.length) return message.reply({ embeds: [err('Radarda kimse yok! Yönetici `!vitrin-ekle <açıklama>` ile vitrine eklensin.')] });
      const sec = v.sort(() => Math.random() - 0.5).slice(0, 3);
      const gif = await animeGif('wink');
      const satir = sec.map(x => {
        const eslesme = 55 + (gunlukSeed(message.guild.id + x.guildId) % 45);
        const bar = '█'.repeat(Math.round(eslesme / 10)) + '░'.repeat(10 - Math.round(eslesme / 10));
        return `🌍 **${x.name}** (${x.members} üye)\n${bar} **%${eslesme} eşleşme**\n> ${x.desc}\n🔗 ${x.invite}`;
      }).join('\n\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.pink).setTitle('📡 PARTNER RADAR — Sana uygun sunucular').setDescription(satir).setImage(gif || null).setFooter({ text: 'Başvuru: o sunucunun partner chat kanalına yaz!' }).setTimestamp()] });
    },
  },
  {
    name: 'ruh-esi', aliases: ['ruhesis', 'soulmate'], category: 'Eğlence',
    description: 'Sunucudaki ruh eşini bulur 💘 BENZERSİZ!',
    usage: '!ruh-esi',
    async run(message) {
      const adaylar = message.guild.members.cache.filter(m => !m.user.bot && m.id !== message.author.id);
      if (!adaylar.size) return message.reply({ embeds: [err('Aday yok!')] });
      const sec = adaylar.random();
      const oran = 60 + (gunlukSeed(message.author.id + sec.id) % 41);
      const gif = await animeGif('kiss');
      return message.reply({
        embeds: [new EmbedBuilder().setColor(config.colors.pink).setTitle(`💘 Ruh Eşin: ${sec.user.username}!`)
          .setDescription(`${message.author} + ${sec} = **%${oran} uyum!**\n${oran > 90 ? '💍 EVLENİN ARTIK!' : oran > 75 ? '💕 Çok uyumlusunuz!' : '🙂 Fena değil!'}`)
          .setThumbnail(sec.user.displayAvatarURL({ size: 256 })).setImage(gif || null).setTimestamp()],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('🌐 Tenor\'da Aşk GIFleri').setStyle(ButtonStyle.Link).setURL(tenorLink('anime love')))],
      });
    },
  },
  {
    name: 'qr', aliases: ['qrcode', 'karekod'], category: 'Genel',
    description: 'Yazıdan QR kod üretir. (İşlevli!)',
    usage: '!qr <yazı>',
    async run(message, args) {
      const yazi = args.join(' ');
      if (!yazi) return message.reply({ embeds: [err('Ne çevireyim? `!qr https://discord.gg/xxxx`')] });
      if (yazi.length > 500) return message.reply({ embeds: [err('En fazla 500 karakter!')] });
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(yazi)}`;
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle('🔳 QR Kodun Hazır!').setDescription(`\`${yazi.slice(0, 200)}\``).setImage(url).setTimestamp()] });
    },
  },
  {
    name: 'sifre-uret', aliases: ['sifre', 'password'], category: 'Genel',
    description: 'Güçlü şifre üretir. (İşlevli!)',
    usage: '!sifre-uret [uzunluk]',
    async run(message, args) {
      const crypto = require('crypto');
      let uzunluk = parseInt(args[0], 10) || 12;
      uzunluk = Math.max(4, Math.min(64, uzunluk));
      const alfabe = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
      let sifre = '';
      const bytes = crypto.randomBytes(uzunluk);
      for (let i = 0; i < uzunluk; i++) sifre += alfabe[bytes[i] % alfabe.length];
      try {
        await message.author.send(`🔐 Şifren (**${uzunluk}** karakter, kimseyle paylaşma!):\n\`${sifre}\``);
        return message.reply({ embeds: [ok('📨 Şifren DM\'ne gönderildi! (güvenlik için)')] });
      } catch {
        return message.reply(`🔐 Şifren (DM kapalı, buradan al, sonra sil!): ||\`${sifre}\`||`);
      }
    },
  },
  {
    name: 'hesapla', aliases: ['hesap', 'calc', 'mat'], category: 'Genel',
    description: 'Hesap makinesi. Örn: !hesapla 15*8+120',
    usage: '!hesapla <işlem>',
    async run(message, args) {
      let islem = args.join(' ').replace(/x/gi, '*').replace(/,/g, '.').replace(/\^/g, '**');
      if (!islem || !/^[0-9+\-*/().%\s*]*$/.test(islem)) return message.reply({ embeds: [err('Sadece sayı ve + - * / ( ) % ^ kullan! `!hesapla 15*8+120`')] });
      try {
        const sonuc = Function(`"use strict"; return (${islem})`)();
        if (typeof sonuc !== 'number' || !isFinite(sonuc)) throw new Error();
        return message.reply(`🧮 \`${args.join(' ')}\` = **${sonuc}**`);
      } catch { return message.reply({ embeds: [err('Hesaplanamadı!')] }); }
    },
  },
  {
    name: 'motivasyon', aliases: ['motive'], category: 'Eğlence',
    description: 'Günün motivasyon sözünü anime gifiyle verir.',
    usage: '!motivasyon',
    async run(message) {
      const s = ['Vazgeçen kaybeder, devam eden kazanır! 💪', 'Bugün dünden %1 daha iyi ol, yeter! 🌱', 'Kimse inanmasa da sen kendine inan! ⭐', 'Küçük adımlar büyük zaferler getirir! 🏆', 'Yorgunsan dinlen, ama bırakma! 🔥', 'Hayallerin için bir adım at, bugün! 🚀'];
      const gif = await animeGif('happy');
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.gold).setTitle('💪 Günün Motivasyonu').setDescription(`*"${s[rastgele(0, s.length - 1)]}"*`).setImage(gif || null).setTimestamp()] });
    },
  },
];

module.exports = komutlar;
module.exports.handleDuelButton = handleDuelButton;
