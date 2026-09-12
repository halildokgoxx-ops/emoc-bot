const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, getGuild, setGuild, topRep, save, db } = require('../src/db');
const { sureYaz } = require('../src/utils');
const { ok, err, repRozet, repBar, kisiBulAsync } = require('../src/embeds');
const { kart, RENK, cubuk, sonrakiRozet } = require('../src/tasarim');
const config = require('../config');

const { E, EID } = require('../src/emo');

// ---------- Sunucu itibar ayarları (kalıcı) ----------
// repSuresiDk: iki oy arası bekleme (dk, 0=sınırsız) • repBildirimKanal: hak bitince haber kanalı
function repAyar(gid) {
  const g = getGuild(gid);
  if (g.repSuresiDk === undefined || g.repSuresiDk === null) g.repSuresiDk = 60;
  if (g.repBildirimKanal === undefined) g.repBildirimKanal = null;
  return g;
}
function repSuresiMs(gid) {
  return Math.max(0, repAyar(gid).repSuresiDk ?? 60) * 60000;
}

// ---------- Paylaşılan embed kurucular (prefix + slash ikisi de kullanır) ----------
async function itibarProfilEmbed(client, guild, uye) {
  const d = getUser(guild.id, uye.id);
  const yildiz = E(client, 'yildiz', '⭐');
  const son3 = (d.repLog || []).slice(0, 3).map((l) =>
    `${l.amount === 1 ? '💚' : '💔'} <@${l.from}> → *${String(l.reason).slice(0, 60)}* (<t:${Math.floor(l.date / 1000)}:R>)`
  ).join('\n') || '*Henüz kayıt yok — ilk oyu sen ver!*';
  const sonraki = sonrakiRozet(d.rep);
  return kart(client, {
    renk: RENK.altin,
    baslik: `${yildiz} ${uye.user.username}`,
    aciklama: `**✦ İTİBAR PROFİLİ ✦**\n# \`${d.rep > 0 ? '+' : ''}${d.rep}\` ${repRozet(d.rep)}`,
    kucukResim: uye.user.displayAvatarURL({ size: 256 }),
    alanlar: [
      { name: '🎖️ Unvan', value: `**${repRozet(d.rep)}**`, inline: true },
      { name: '🤝 Verdiği Oy', value: `**${d.repVerilen || 0}**`, inline: true },
      { name: '🚀 Sonraki Rozet', value: sonraki ? `${sonraki.emoji} **${sonraki.ad}**\n${cubuk(d.rep, sonraki.esik)} \`${d.rep}/${sonraki.esik}\` (−${sonraki.kalan})` : '👑 **ZİRVE!** Gidecek yer kalmadı.', inline: false },
      { name: '🕘 Son Hareketler', value: son3.slice(0, 1024), inline: false },
    ],
    altbilgi: '!1 @kullanıcı → +1 • /itibar ver → yetkili oyu',
  });
}

async function itibarTopEmbed(client, guild) {
  const top = topRep(guild.id, 10);
  if (!top.length) return null;
  const tac = E(client, 'tac', '👑');
  let desc = '';
  for (let i = 0; i < top.length; i++) {
    const t = top[i];
    let uye = null;
    try { uye = await guild.members.fetch(t.uid); } catch {}
    const isim = uye ? uye.user.username : `Bilinmeyen (${t.uid})`;
    const madalya = i === 0 ? tac : (['🥇', '🥈', '🥉'][i] || `\`${i + 1}.\``);
    desc += `${madalya} **${isim}** — **${t.rep}** *(${repRozet(t.rep)})*\n`;
  }
  return kart(client, {
    renk: RENK.altin,
    baslik: `🏆 ${guild.name} — İtibar Ligi`,
    aciklama: desc,
    altbilgi: 'Oy ver: !1 @kullanıcı <sebep> veya /itibar ver',
  });
}

async function repVer(message, args, miktar, client) {
  // Hedef önceliği: etiket/ID > cevaplanan mesaj
  let hedef = await kisiBulAsync(message, args, 0);
  let sebep;
  if (!hedef && message.reference && message.reference.messageId) {
    try {
      const ref = await message.channel.messages.fetch(message.reference.messageId);
      if (ref && !ref.author.bot) {
        hedef = await message.guild.members.fetch(ref.author.id).catch(() => null);
        sebep = args.join(' ') || 'Sebep belirtilmedi';
      }
    } catch {}
  }
  if (!hedef) return message.reply({ embeds: [err(`Kullanıcı bulunamadı!\nKullanım: \`!1 @kullanıcı <sebep>\` ya da bir mesaja cevap verip \`!1 <sebep>\` yaz.`)] });
  if (hedef.user.bot) return message.reply({ embeds: [err('Botlara itibar veremezsin!')] });
  if (hedef.id === message.author.id) return message.reply({ embeds: [err('Kendine itibar veremezsin! Kurnazlık yapma 😏')] });

  // Kalıcı, sunucu ayarlı bekleme süresi
  const sureMs = repSuresiMs(message.guild.id);
  const verenData = getUser(message.guild.id, message.author.id);
  if (sureMs > 0) {
    const gecen = Date.now() - (verenData.sonRepVerme || 0);
    if (gecen < sureMs) {
      const kalan = sureMs - gecen;
      const dk = repAyar(message.guild.id).repSuresiDk;
      return message.reply({ embeds: [err(`⏳ Biraz yavaş! **${sureYaz(kalan)}** sonra tekrar oy verebilirsin.\n*(Sunucu kuralı: her ${dk} dakikada 1 oy)*`)] });
    }
  }

  if (sebep === undefined) sebep = args.slice(1).join(' ').slice(0, 200) || '—';

  const hedefData = getUser(message.guild.id, hedef.id);

  hedefData.rep += miktar;
  hedefData.repLog.unshift({ from: message.author.id, amount: miktar, reason: sebep, date: Date.now() });
  hedefData.repLog = hedefData.repLog.slice(0, 20);
  verenData.repVerilen = (verenData.repVerilen || 0) + 1;
  verenData.sonRepVerme = Date.now();
  verenData.repHaberVerildi = false; // yeni tur → bildirim sıfırla
  save();

  // 🏅 İtibar rol ödülü var mı?
  let rolOdul = [];
  try { rolOdul = await repRolKontrol(message.guild, hedef.id, hedefData.rep); } catch {}

  const cli = client || message.client;
  const tik = E(cli, 'tik', '✅');
  const e = new EmbedBuilder()
    .setColor(miktar === 1 ? config.colors.success : config.colors.error)
    .setDescription(miktar === 1
      ? `${tik} **İtibar atıldı!** ${hedef} \`+1\` → yeni puan: **${hedefData.rep}**`
      : `💔 **İtibar alındı!** ${hedef} \`-1\` → yeni puan: **${hedefData.rep}**`)
    .setImage('https://cdn.discordapp.com/emojis/1547743717836857404.gif')
    .setTimestamp();
  if (rolOdul.length) e.addFields({ name: '🎭 Rol Ödülü!', value: rolOdul.join(' '), inline: false });
  return message.reply({ embeds: [e] });
}

module.exports = [
  {
    name: '1', aliases: ['+1', 'rep-ver'], category: 'İtibar',
    description: 'Etiketle ya da mesaja cevap vererek +1 itibar ver!',
    usage: '!1 @kullanıcı | mesaja cevapla: !1',
    run: (m, a, c) => repVer(m, a, 1, c),
  },
  {
    name: '-1', aliases: ['-rep', 'eksirep'], category: 'İtibar',
    description: 'Kaldırıldı — artık sadece itibar verilebilir.',
    usage: '!-1 @kullanıcı',
    async run(message) {
      return message.reply('❌ Eksi itibar **kaldırıldı!** Artık sadece `!1` ile itibar **verebilirsin**, alamazsın. ⭐');
    },
  },
  {
    name: 'itibar', aliases: ['rep', 'sayginlik', 'saygınlık'], category: 'İtibar',
    description: 'Kendi/itibar profili ya da sunucu sıralaması: !itibar / !itibar top',
    usage: '!itibar [@kullanıcı] | !itibar top',
    async run(message, args, client) {
      const cli = client || message.client;
      if ((args[0] || '').toLocaleLowerCase('tr') === 'top') {
        const e = await itibarTopEmbed(cli, message.guild);
        if (!e) return message.reply({ embeds: [err('Bu sunucuda henüz kimse itibar almamış! İlk veren sen ol: `!1 @kullanıcı <sebep>`')] });
        return message.reply({ embeds: [e] });
      }
      const hedef = (await kisiBulAsync(message, args, 0)) || message.member;
      return message.reply({ embeds: [await itibarProfilEmbed(cli, message.guild, hedef)] });
    },
  },
  {
    name: 'itibar-top', aliases: ['reptop', 'top', 'liderlik-itibar', 'itibartop'], category: 'İtibar',
    description: 'Sunucunun itibar sıralamasını gösterir.',
    usage: '!itibar-top',
    async run(message, args, client) {
      const e = await itibarTopEmbed(client || message.client, message.guild);
      if (!e) return message.reply({ embeds: [err('Bu sunucuda henüz kimse itibar almamış! İlk veren sen ol: `!1 @kullanıcı <sebep>`')] });
      return message.reply({ embeds: [e] });
    },
  },
  {
    name: 'itibar-global', aliases: ['global-top', 'globaltop'], category: 'İtibar',
    description: 'Botun olduğu TÜM sunuculardaki global itibar sıralaması. (Benzersiz!)',
    usage: '!itibar-global',
    async run(message) {
      const top = topRep(null, 10);
      if (!top.length) return message.reply({ embeds: [err('Globalde henüz itibar verilmemiş!')] });
      let desc = '';
      const medal = ['🌍🥇', '🌍🥈', '🌍🥉'];
      for (let i = 0; i < top.length; i++) {
        const t = top[i];
        let isim = `ID: ${t.uid}`;
        try { const u = await message.client.users.fetch(t.uid); isim = u.username; } catch {}
        desc += `${medal[i] || `\`${i + 1}.\``} **${isim}** — ⭐ **${t.rep}**\n`;
      }
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.pink).setTitle('🌍 Global İtibar Sıralaması').setDescription(desc).setTimestamp()] });
    },
  },
  {
    name: 'itibar-sifirla', aliases: ['repsifirla', 'itibarsıfırla'], category: 'İtibar',
    description: 'Bir kullanıcının itibarını sıfırlar. (Yönetici)',
    usage: '!itibar-sıfırla @kullanıcı',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args) {
      const hedef = await kisiBulAsync(message, args, 0);
      if (!hedef) return message.reply({ embeds: [err('Kullanıcı bulunamadı! `!itibar-sıfırla @kullanıcı`')] });
      const d = getUser(message.guild.id, hedef.id);
      d.rep = 0; d.repLog = [];
      save();
      return message.reply({ embeds: [ok(`${hedef} adlı kullanıcının itibarı sıfırlandı.`)] });
    },
  },
  {
    name: 'profil', aliases: ['profile', 'me', 'kart'], category: 'İtibar',
    description: 'Birleşik profil kartı: itibar + seviye + para + rozet. (Benzersiz!)',
    usage: '!profil [@kullanıcı]',
    async run(message, args, client) {
      const hedef = (await kisiBulAsync(message, args, 0)) || message.member;
      const d = getUser(message.guild.id, hedef.id);
      const ihtiyac = (d.level || 0) * 100 + 100;
      const xpOran = Math.min(d.xp || 0, ihtiyac);
      const guc = (d.rep || 0) * 10 + (d.level || 0) * 5 + Math.floor((d.para || 0) / 100) + Math.floor((d.mesaj || 0) / 10);
      return message.reply({
        embeds: [kart(client || message.client, {
          baslik: `🪪 ${hedef.user.username}`,
          aciklama: `**✦ PROFİL KARTI ✦** ${repRozet(d.rep)}${require('../src/premium').premiumMu(message.guild.id) ? '\n👑 **PREMIUM SUNUCU ÜYESİ**' : ''}\n⚡ **Güç Puanı:** \`${guc}\``,
          kucukResim: hedef.user.displayAvatarURL({ size: 256 }),
          alanlar: [
            { name: '⭐ İtibar', value: `**${d.rep > 0 ? '+' : ''}${d.rep}**`, inline: true },
            { name: '📈 Seviye', value: `**Sv.${d.level || 0}**\n${cubuk(xpOran, ihtiyac, 8)} \`${xpOran}/${ihtiyac}\``, inline: true },
            { name: '💰 Cüzdan', value: `**${(d.para || 0).toLocaleString('tr-TR')}** 🪙`, inline: true },
            { name: '💬 Mesaj', value: `**${d.mesaj || 0}**`, inline: true },
            { name: '🤝 Verdiği Oy', value: `**${d.repVerilen || 0}**`, inline: true },
            { name: '⚠️ Uyarı', value: `${(d.warns || []).length ? `**${d.warns.length}** ⚠️` : 'Temiz ✨'}`, inline: true },
          ],
          altbilgi: `ID: ${hedef.id} • Katılım: ${new Date(hedef.joinedAt?.getTime() || Date.now()).toLocaleDateString('tr-TR')}`,
        })],
      });
    },
  },
];

// ---------- İtibar rol ödülleri ----------
function repRoller(gid) {
  const g = getGuild(gid);
  if (!Array.isArray(g.repRoller)) g.repRoller = [];
  return g.repRoller;
}
// Puanı geçen rolleri verir, YENİ kazanılanları döndürür
async function repRolKontrol(guild, uyeId, yeniPuan) {
  const kazanilan = [];
  try {
    const liste = repRoller(guild.id).filter((x) => x.puan <= yeniPuan).sort((a, b) => a.puan - b.puan);
    if (!liste.length) return kazanilan;
    const uye = await guild.members.fetch(uyeId).catch(() => null);
    if (!uye) return kazanilan;
    for (const x of liste) {
      const rol = guild.roles.cache.get(x.rolId);
      if (rol && !uye.roles.cache.has(rol.id)) {
        await uye.roles.add(rol).catch(() => {});
        kazanilan.push(rol);
      }
    }
  } catch {}
  return kazanilan;
}

// ================= /itibar SLASH GRUBU (yönetici + herkes) =================
const itibarSlash = {
  data: {
    name: 'itibar',
    description: '⭐ İtibar sistemi: bak, sıralama, ver, ayarlar',
    contexts: [0],
    options: [
      {
        type: 1, name: 'bak', description: 'İtibar profiline bak',
        options: [{ type: 6, name: 'kullanici', description: 'Kimin? (boş = sen)', required: false }],
      },
      { type: 1, name: 'top', description: 'Sunucu itibar sıralaması' },
      {
        type: 1, name: 'ver', description: '[Yetkili] İtibar ver (bekleme yok)',
        options: [
          { type: 6, name: 'kullanici', description: 'Kime?', required: true },
          { type: 4, name: 'miktar', description: 'Kaç puan? (1-10)', required: false, min_value: 1, max_value: 10 },
          { type: 3, name: 'sebep', description: 'Sebep', required: false },
        ],
      },
      {
        type: 1, name: 'sure-ayarla', description: '[Yetkili] İki oy arası bekleme süresi (dakika, 0 = sınırsız)',
        options: [{ type: 4, name: 'dakika', description: 'Dakika (0-4320)', required: true, min_value: 0, max_value: 4320 }],
      },
      {
        type: 1, name: 'bildirim-kanal', description: '[Yetkili] Hak yenilenince haber kanalı (kanalsız = kapat)',
        options: [{ type: 7, name: 'kanal', description: 'Bildirim kanalı', required: false }],
      },
      {
        type: 1, name: 'rol', description: '[Yetkili] Kaç itibarda hangi rol verilsin?',
        options: [
          { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ekle', value: 'ekle' }, { name: 'Liste', value: 'liste' }, { name: 'Sil', value: 'sil' }] },
          { type: 4, name: 'puan', description: 'Kaç itibar? (örn: 50)', required: false, min_value: -100, max_value: 1000 },
          { type: 8, name: 'rol', description: 'Verilecek rol', required: false },
        ],
      },
    ],
  },
  async execute(interaction, client) {
    const alt = interaction.options.getSubcommand();
    if (alt === 'bak') {
      const u = interaction.options.getUser('kullanici');
      const uye = u
        ? await interaction.guild.members.fetch(u.id).catch(() => null)
        : interaction.member;
      if (!uye) return interaction.reply({ content: '❌ Kullanıcı bulunamadı!', ephemeral: true });
      return interaction.reply({ embeds: [await itibarProfilEmbed(client, interaction.guild, uye)] });
    }
    if (alt === 'top') {
      const e = await itibarTopEmbed(client, interaction.guild);
      if (!e) return interaction.reply({ content: 'Henüz itibar verilmemiş! `!1 @kullanıcı <sebep>` ile ilk sen ver.', ephemeral: true });
      return interaction.reply({ embeds: [e] });
    }
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true });
    }
    if (alt === 'al') {
      return interaction.reply({ content: '❌ Eksi itibar **kaldırıldı!** Artık sadece itibar **verilebilir**, alınamaz. ⭐', ephemeral: true });
    }
    if (alt === 'ver') {
      const u = interaction.options.getUser('kullanici');
      const miktar = Math.abs(interaction.options.getInteger('miktar') || 1);
      const sebep = interaction.options.getString('sebep') || 'Yetkili işlemi';
      if (!u || u.bot) return interaction.reply({ content: '❌ Geçerli bir kullanıcı seç!', ephemeral: true });
      const d = getUser(interaction.guild.id, u.id);
      d.rep += miktar;
      d.repLog.unshift({ from: interaction.user.id, amount: miktar, reason: `[Yetkili] ${sebep}`.slice(0, 200), date: Date.now() });
      d.repLog = d.repLog.slice(0, 20);
      save();
      let rolOdul = [];
      try { rolOdul = await repRolKontrol(interaction.guild, u.id, d.rep); } catch {}
      const yildiz = E(client, 'yildiz', '⭐');
      return interaction.reply({ embeds: [ok(`${yildiz} +${miktar} itibar verildi!\n👤 ${u} → yeni puan: **${d.rep}** ${repRozet(d.rep)}\n📝 ${sebep}${rolOdul.length ? `\n🎭 Rol ödülü: ${rolOdul.join(' ')}` : ''}`)] });
    }
    if (alt === 'sure-ayarla') {
      const dk = interaction.options.getInteger('dakika');
      setGuild(interaction.guild.id, { repSuresiDk: dk });
      return interaction.reply({
        embeds: [ok(dk === 0
          ? '⏱️ Bekleme süresi **kapatıldı**! Herkes dilediği kadar oy verebilir.'
          : `⏱️ Bekleme süresi: **${dk} dakika**!\nBiri oy verdikten sonra ${dk} dk bekleyecek, sonra bildirim kanalında haberi gelecek. 🔔`)],
      });
    }
    if (alt === 'bildirim-kanal') {
      const k = interaction.options.getChannel('kanal');
      if (!k) {
        setGuild(interaction.guild.id, { repBildirimKanal: null });
        return interaction.reply({ embeds: [ok('🔕 İtibar bildirimleri **kapatıldı**.')] });
      }
      if (!k.isTextBased()) return interaction.reply({ content: '❌ Yazı kanalı seç!', ephemeral: true });
      setGuild(interaction.guild.id, { repBildirimKanal: k.id });
      const zil = E(client, 'zil', '🔔');
      return interaction.reply({
        embeds: [ok(`${zil} Bildirim kanalı ${k} oldu!\nHakkı yenilenen herkes burada etiketlenecek + **Bildirim Aç/Kapat** butonu alacak.\nKapatanlara sadece isimle haber verilir (etiket yok).`)],
      });
    }
    if (alt === 'rol') {
      const islem = interaction.options.getString('islem');
      const liste = repRoller(interaction.guild.id);
      if (islem === 'liste' || !islem) {
        if (!liste.length) return interaction.reply({ content: 'Kayıtlı itibar rolü yok! Örn: `/itibar rol ekle puan:50 rol:@Altın`', ephemeral: true });
        const desc = [...liste].sort((a, b) => a.puan - b.puan).map((x) => `⭐ **${x.puan}** itibar → <@&${x.rolId}>`).join('\n');
        return interaction.reply({ embeds: [kart(client, { renk: RENK.altin, baslik: '🏅 İtibar Rol Ödülleri', aciklama: desc, altbilgi: 'Puana ulaşan rolü OTOMATİK kapar!' })] });
      }
      if (islem === 'sil') {
        const p = interaction.options.getInteger('puan');
        const i = liste.findIndex((x) => x.puan === p);
        if (i < 0) return interaction.reply({ content: 'Bu puanda kayıt yok!', ephemeral: true });
        liste.splice(i, 1); save();
        return interaction.reply({ embeds: [ok(`🗑️ **${p}** itibar ödülü silindi.`)] });
      }
      // ekle
      const p = interaction.options.getInteger('puan');
      const rol = interaction.options.getRole('rol');
      if (p === null || p === undefined || !rol) return interaction.reply({ content: 'Puan ve rol şart! Örn: `/itibar rol ekle puan:50 rol:@Altın`', ephemeral: true });
      if (rol.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: '❌ Bu rol benden üstte!', ephemeral: true });
      if (rol.managed) return interaction.reply({ content: '❌ Bot rollerine ödül verilemez!', ephemeral: true });
      const var1 = liste.find((x) => x.puan === p);
      if (var1) var1.rolId = rol.id;
      else liste.push({ puan: p, rolId: rol.id });
      save();
      return interaction.reply({ embeds: [ok(`🏅 **${p}** itibara ulaşan herkes artık otomatik **${rol}** alacak!`) ] });
    }
  },
};

// ---------- Hak-yenileme taraması (60sn'de bir index.js çağırır) ----------
async function repBildirimTara(client) {
  try {
    const d = db();
    let degisti = false;
    for (const [, guild] of client.guilds.cache) {
      const g = repAyar(guild.id);
      if (!g.repBildirimKanal) continue;
      const sureMs = (g.repSuresiDk ?? 60) * 60000;
      if (!sureMs) continue;
      const kanal = guild.channels.cache.get(g.repBildirimKanal);
      if (!kanal || !kanal.isTextBased()) continue;
      for (const [key, u] of Object.entries(d.users)) {
        if (!key.startsWith(guild.id + '_')) continue;
        if (!u.sonRepVerme || u.repHaberVerildi) continue;
        if (Date.now() - u.sonRepVerme < sureMs) continue;
        u.repHaberVerildi = true;
        degisti = true;
        const uid = key.slice(guild.id.length + 1);
        try {
          const kisi = await client.users.fetch(uid).catch(() => null);
          if (!kisi) continue;
          const acik = u.repBildirimAcik !== false;
          const zil = E(client, 'zil', '🔔');
          const row = new ActionRowBuilder().addComponents(
            acik
              ? new ButtonBuilder().setCustomId(`rep_bildirim_kapat_${uid}`).setLabel('Bildirim Kapat').setStyle(ButtonStyle.Secondary).setEmoji(EID(client, 'sessiz') || '🔕')
              : new ButtonBuilder().setCustomId(`rep_bildirim_ac_${uid}`).setLabel('Bildirim Aç').setStyle(ButtonStyle.Primary).setEmoji(EID(client, 'zil') || '🔔')
          );
          const icerik = acik
            ? `${kisi} ${zil} **İtibar hakkın yenilendi!** Artık \`!1 @kullanıcı\` ile oy verebilirsin.`
            : `**${kisi.username}**, itibar hakkın yenilendi! *(Bildirimlerin kapalı — açmak için butona bas)*`;
          await kanal.send({ content: icerik, components: [row] }).catch(() => {});
        } catch {}
      }
    }
    if (degisti) save();
  } catch {}
}

// ---------- Bildirim aç/kapat butonu ----------
async function repBildirimButon(interaction, client) {
  const ac = interaction.customId.startsWith('rep_bildirim_ac_');
  const uid = interaction.customId.split('_').pop();
  if (interaction.user.id !== uid) return interaction.reply({ content: '❌ Bu buton sana ait değil!', ephemeral: true });
  const u = getUser(interaction.guild.id, uid);
  u.repBildirimAcik = ac;
  save();
  const row = new ActionRowBuilder().addComponents(
    ac
      ? new ButtonBuilder().setCustomId(`rep_bildirim_kapat_${uid}`).setLabel('Bildirim Kapat').setStyle(ButtonStyle.Secondary).setEmoji(EID(client, 'sessiz') || '🔕')
      : new ButtonBuilder().setCustomId(`rep_bildirim_ac_${uid}`).setLabel('Bildirim Aç').setStyle(ButtonStyle.Primary).setEmoji(EID(client, 'zil') || '🔔')
  );
  await interaction.update({ components: [row] }).catch(() => {});
  return interaction.followUp({
    content: ac
      ? '🔔 Bildirimler **açıldı**! Hakkın yenilenince seni etiketleyeceğim.'
      : '🔕 Bildirimler **kapatıldı**. Artık sadece ismin yazılacak, etiketlenmeyeceksin.',
    ephemeral: true,
  }).catch(() => {});
}

module.exports.itibarSlash = itibarSlash;
module.exports.repBildirimTara = repBildirimTara;
module.exports.repBildirimButon = repBildirimButon;
module.exports.repAyar = repAyar;
