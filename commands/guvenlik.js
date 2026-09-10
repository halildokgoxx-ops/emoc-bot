const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuild, setGuild, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { kart, RENK, cubuk } = require('../src/tasarim');
const config = require('../config');

function panelEmbed(g, guild, client) {
  const kalkanlar = [
    ['🔗', 'Link', g.antiLink], ['🤬', 'Küfür', g.antiKufur], ['📢', 'Spam', g.antiSpam],
    ['⚔️', 'Raid', g.antiRaid], ['🤖', 'Bot', g.antiBot], ['🔠', 'Caps', g.capsEngel],
    ['🥷', 'Alt-Hesap', g.altKoruma],
  ];
  const aktif = kalkanlar.filter(k => k[2]).length;
  const satir = (dizi) => dizi.map(([e, ad, acik]) => `${acik ? '🟢' : '🔴'} ${e} ${ad}`).join('\n');
  return kart(client, {
    renk: aktif >= 6 ? RENK.basari : aktif >= 3 ? RENK.uyari : RENK.hata,
    baslik: `🛡️ ${guild.name}`,
    aciklama: `**✦ GÜVENLİK KONTROL MERKEZİ ✦**\n${cubuk(aktif, 7)} **${aktif}/7 kalkan aktif**`,
    kucukResim: guild.iconURL({ size: 256 }) || undefined,
    alanlar: [
      { name: '🛡️ Oto-Mod Kalkanları', value: satir(kalkanlar.slice(0, 3)), inline: true },
      { name: 'ㅤ', value: satir(kalkanlar.slice(3)), inline: true },
      { name: '⚙️ Sistemler', value: `📋 Log ${g.logKanal ? `<#${g.logKanal}>` : '`kapalı`'}\n👋 HG ${g.hosgeldinKanal ? `<#${g.hosgeldinKanal}>` : '`kapalı`'}\n🚪 Çıkış ${g.cikisKanal ? `<#${g.cikisKanal}>` : '`kapalı`'}`, inline: true },
      { name: '🎭 Oto-Rol', value: g.otoRol ? `<@&${g.otoRol}>` : '`kapalı`', inline: true },
      { name: '🎯 Sayaç', value: g.sayacHedef ? `**${g.sayacHedef}** ${g.sayacKanal ? `(<#${g.sayacKanal}>)` : ''}` : '`kapalı`', inline: true },
      { name: '🚫 Yasaklı Kelime', value: `**${(g.yasakli || []).length}** adet`, inline: true },
    ],
    altbilgi: 'Puanın için /güvenlik-skor • Değiştir: /güvenlik-ayarla',
  });
}

// Butonlu interaktif panel: kalkanlara dokun = aç/kapat
const GV_KEY = [
  ['antiLink', 'Link'], ['antiKufur', 'Küfür'], ['antiSpam', 'Spam'], ['antiRaid', 'Raid'],
  ['antiBot', 'Bot'], ['capsEngel', 'Caps'], ['altKoruma', 'Alt-Hesap'],
];
function panelRows(g) {
  const btn = ([key, ad]) => new ButtonBuilder()
    .setCustomId(`gv_t_${key}`)
    .setLabel(`${g[key] ? '🟢' : '🔴'} ${ad}`)
    .setStyle(g[key] ? ButtonStyle.Success : ButtonStyle.Secondary);
  return [
    new ActionRowBuilder().addComponents(GV_KEY.slice(0, 4).map(btn)),
    new ActionRowBuilder().addComponents([...GV_KEY.slice(4).map(btn),
      new ButtonBuilder().setCustomId('gv_ultra').setLabel('🚨 Ultra').setStyle(ButtonStyle.Danger)]),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gv_yenile').setLabel('🔄 Yenile').setStyle(ButtonStyle.Primary)),
  ];
}

async function handleGuvButton(interaction, client) {
  const id = interaction.customId;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true });
  }
  const g = getGuild(interaction.guild.id);
  if (id === 'gv_ultra') {
    for (const [key] of GV_KEY) g[key] = true;
    save();
  } else if (id.startsWith('gv_t_')) {
    const key = id.replace('gv_t_', '');
    if (typeof g[key] !== 'boolean') return interaction.reply({ content: '❌ Bilinmeyen ayar!', ephemeral: true });
    g[key] = !g[key];
    save();
  }
  await interaction.update({ embeds: [panelEmbed(g, interaction.guild, client)], components: panelRows(g) }).catch(() => {});
}

module.exports = [
  {
    name: 'guvenlik', aliases: ['güvenlik', 'koruma', 'security'], category: 'Güvenlik',
    description: 'Güvenlik panelini gösterir.', usage: '!güvenlik',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args, client) {
      const g = getGuild(message.guild.id);
      return message.reply({ embeds: [panelEmbed(g, message.guild, client || message.client)], components: panelRows(g) });
    },
  },
  {
    name: 'guvenlik-ayarla', aliases: ['güvenlik-ayarla', 'koruma-ayarla'], category: 'Güvenlik',
    description: 'Güvenlik ayarı değiştirir. (anti-link/anti-küfür/anti-spam/anti-raid/anti-bot/caps-engel/alt-koruma aç|kapat)',
    usage: '!güvenlik-ayarla <özellik> <aç|kapat>',
    perms: [PermissionFlagsBits.ManageGuild],
    slashOptions: [
      { type: 'string', name: 'ozellik', description: 'Hangi koruma?', required: true, choices: [{ name: 'Anti-Link', value: 'anti-link' }, { name: 'Anti-Küfür', value: 'anti-küfür' }, { name: 'Anti-Spam', value: 'anti-spam' }, { name: 'Anti-Raid', value: 'anti-raid' }, { name: 'Anti-Bot', value: 'anti-bot' }, { name: 'Caps-Engel', value: 'caps-engel' }, { name: 'Alt-Hesap Koruması', value: 'alt-koruma' }] },
      { type: 'string', name: 'durum', description: 'Aç/Kapat', required: true, choices: [{ name: 'Aç 🟢', value: 'aç' }, { name: 'Kapat 🔴', value: 'kapat' }] },
    ],
    async run(message, args) {
      const oz = (args[0] || '').toLocaleLowerCase('tr');
      const durum = (args[1] || '').toLocaleLowerCase('tr');
      const map = { 'anti-link': 'antiLink', 'antilink': 'antiLink', 'anti-küfür': 'antiKufur', 'antikufur': 'antiKufur', 'anti-kufur': 'antiKufur', 'anti-spam': 'antiSpam', 'antispam': 'antiSpam', 'anti-raid': 'antiRaid', 'antiraid': 'antiRaid', 'anti-bot': 'antiBot', 'antibot': 'antiBot', 'caps-engel': 'capsEngel', 'caps': 'capsEngel', 'alt-koruma': 'altKoruma', 'altkoruma': 'altKoruma', 'althesap': 'altKoruma' };
      const key = map[oz];
      if (!key || !['aç', 'ac', 'kapat'].includes(durum)) return message.reply({ embeds: [err('Kullanım: `!güvenlik-ayarla anti-link aç`\nÖzellikler: anti-link, anti-küfür, anti-spam, anti-raid, anti-bot, caps-engel')] });
      const acik = durum.startsWith('a');
      setGuild(message.guild.id, { [key]: acik });
      return message.reply({ embeds: [ok(`🔒 **${oz}** ${acik ? '🟢 açıldı' : '🔴 kapatıldı'}.`)] });
    },
  },
  {
    name: 'log-ayarla', aliases: ['logayarla'], category: 'Güvenlik',
    description: 'Mod-log kanalını ayarlar.', usage: '!log-ayarla #kanal',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message) {
      const k = message.mentions.channels.first();
      if (!k) return message.reply({ embeds: [err('Kanal etiketle! `!log-ayarla #log`')] });
      setGuild(message.guild.id, { logKanal: k.id });
      return message.reply({ embeds: [ok(`📋 Log kanalı ${k} oldu.`)] });
    },
  },
  {
    name: 'hosgeldin-ayarla', aliases: ['hg-ayarla', 'hoşgeldin-ayarla'], category: 'Güvenlik',
    description: 'Hoşgeldin ve çıkış kanallarını ayarlar.', usage: '!hoşgeldin-ayarla #kanal | çıkış için: !hoşgeldin-ayarla çıkış #kanal',
    perms: [PermissionFlagsBits.ManageGuild],
    slashOptions: [
      { type: 'string', name: 'tur', description: 'Hangi kanal?', required: true, choices: [{ name: 'Hoşgeldin', value: 'hg' }, { name: 'Çıkış', value: 'cikis' }] },
      { type: 'channel', name: 'kanal', description: 'Kanal seç', required: true },
    ],
    slashArgs: (i) => { const k = i.options.getChannel('kanal'); return i.options.getString('tur') === 'cikis' ? ['çıkış', `<#${k.id}>`] : [`<#${k.id}>`]; },
    async run(message, args) {
      if (args[0] === 'çıkış' || args[0] === 'cikis') {
        const k = message.mentions.channels.first();
        if (!k) return message.reply({ embeds: [err('`!hoşgeldin-ayarla çıkış #kanal`')] });
        setGuild(message.guild.id, { cikisKanal: k.id });
        return message.reply({ embeds: [ok(`👋 Çıkış kanalı ${k} oldu.`)] });
      }
      const k = message.mentions.channels.first();
      if (!k) return message.reply({ embeds: [err('`!hoşgeldin-ayarla #kanal`')] });
      setGuild(message.guild.id, { hosgeldinKanal: k.id });
      return message.reply({ embeds: [ok(`👋 Hoşgeldin kanalı ${k} oldu.\n💡 Mesajı değiştir: \`!hosgeldin-mesaj Hoşgeldin {kullanıcı}!\` ({kullanıcı} {sunucu} {üye} desteklenir)`)] });
    },
  },
  {
    name: 'hosgeldin-mesaj', aliases: ['hg-mesaj'], category: 'Güvenlik',
    description: 'Hoşgeldin mesajını değiştirir.', usage: '!hoşgeldin-mesaj <yazı>',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args) {
      const yazi = args.join(' ');
      if (!yazi) return message.reply({ embeds: [err('Yazı yaz! Değişkenler: {kullanıcı} {sunucu} {üye}')] });
      setGuild(message.guild.id, { hosgeldinMesaj: yazi });
      return message.reply({ embeds: [ok(`✅ Hoşgeldin mesajı: *${yazi}*`)] });
    },
  },
  {
    name: 'oto-rol', aliases: ['otorol'], category: 'Güvenlik',
    description: 'Yeni gelenlere otomatik rol verir.', usage: '!oto-rol @rol  |  kapatmak: !oto-rol kapat',
    perms: [PermissionFlagsBits.ManageRoles],
    slashOptions: [
      { type: 'role', name: 'rol', description: 'Verilecek rol', required: false },
      { type: 'string', name: 'islem', description: 'Kapatmak için', required: false, choices: [{ name: 'Kapat', value: 'kapat' }] },
    ],
    slashArgs: (i) => { if (i.options.getString('islem') === 'kapat') return ['kapat']; const r = i.options.getRole('rol'); return r ? [`<@&${r.id}>`] : []; },
    async run(message, args) {
      if (args[0] === 'kapat') { setGuild(message.guild.id, { otoRol: null }); return message.reply({ embeds: [ok('🎭 Oto-rol kapatıldı.')] }); }
      const r = message.mentions.roles.first();
      if (!r) return message.reply({ embeds: [err('Rol etiketle! `!oto-rol @Üye`')] });
      setGuild(message.guild.id, { otoRol: r.id });
      return message.reply({ embeds: [ok(`🎭 Oto-rol ${r} oldu.`)] });
    },
  },
  {
    name: 'sayac', aliases: ['sayaç'], category: 'Güvenlik',
    description: 'Sayaç ayarlar. Yeni üye gelince kalanı söyler.', usage: '!sayaç <hedef> #kanal  |  kapat: !sayaç kapat',
    perms: [PermissionFlagsBits.ManageGuild],
    slashOptions: [
      { type: 'integer', name: 'hedef', description: 'Üye hedefi', required: false },
      { type: 'channel', name: 'kanal', description: 'Sayaç kanalı', required: false },
      { type: 'string', name: 'islem', description: 'Kapatmak için', required: false, choices: [{ name: 'Kapat', value: 'kapat' }] },
    ],
    slashArgs: (i) => { if (i.options.getString('islem') === 'kapat') return ['kapat']; const h = i.options.getInteger('hedef'); const k = i.options.getChannel('kanal'); return [`${h ?? ''}`, ...(k ? [`<#${k.id}>`] : [])]; },
    async run(message, args) {
      if (args[0] === 'kapat') { setGuild(message.guild.id, { sayacHedef: 0, sayacKanal: null }); return message.reply({ embeds: [ok('🎯 Sayaç kapatıldı.')] }); }
      const hedef = parseInt(args[0], 10);
      const k = message.mentions.channels.first();
      if (!hedef || !k) return message.reply({ embeds: [err('`!sayaç 1000 #kanal`')] });
      setGuild(message.guild.id, { sayacHedef: hedef, sayacKanal: k.id });
      return message.reply({ embeds: [ok(`🎯 Sayaç: **${hedef}** üye hedefi ${k} kanalında!`)] });
    },
  },
  {
    name: 'yasakli-ekle', aliases: ['yasaklı-ekle', 'yasakla-kelime'], category: 'Güvenlik',
    description: 'Yasaklı kelime ekler/çıkarır/listeler.', usage: '!yasaklı-ekle <kelime> | !yasaklı-ekle sil <kelime> | !yasaklı-ekle liste',
    perms: [PermissionFlagsBits.ManageGuild],
    slashOptions: [
      { type: 'string', name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ekle', value: 'ekle' }, { name: 'Sil', value: 'sil' }, { name: 'Liste', value: 'liste' }] },
      { type: 'string', name: 'kelime', description: 'Kelime', required: false },
    ],
    slashArgs: (i) => { const t = i.options.getString('islem'); const k = i.options.getString('kelime') || ''; return t === 'liste' ? ['liste'] : t === 'sil' ? ['sil', k] : [k]; },
    async run(message, args) {
      const g = getGuild(message.guild.id);
      if (!g.yasakli) g.yasakli = [];
      if (args[0] === 'liste') return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle('🚫 Yasaklı Kelimeler').setDescription(g.yasakli.map((k, i) => `\`${i + 1}.\` ${k}`).join('\n') || 'Yok.').setTimestamp()] });
      if (args[0] === 'sil') {
        const kel = (args[1] || '').toLowerCase();
        g.yasakli = g.yasakli.filter(k => k !== kel); save();
        return message.reply({ embeds: [ok(`✅ \`${kel}\` yasaklıdan çıkarıldı.`)] });
      }
      const kel = (args[0] || '').toLowerCase();
      if (!kel) return message.reply({ embeds: [err('Kelime yaz!')] });
      if (!g.yasakli.includes(kel)) g.yasakli.push(kel);
      save();
      return message.reply({ embeds: [ok(`🚫 \`${kel}\` yasaklandı. Yazanların mesajı silinir.`)] });
    },
  },
  {
    name: 'guvenlik-skor', aliases: ['güvenlik-skor', 'skor', 'guvenlikskor'], category: 'Güvenlik',
    description: 'Sunucunun güvenlik puanını hesaplar (0-100). BENZERSİZ!',
    usage: '!güvenlik-skor',
    async run(message) {
      const g = message.guild;
      const ay = getGuild(g.id);
      let puan = 0; const detay = [];
      const ekle = (kosul, p, ad) => { if (kosul) { puan += p; detay.push(`✅ ${ad} (+${p})`); } else detay.push(`❌ ${ad} (+0)`); };
      ekle(g.verificationLevel >= 2, 15, 'Doğrulama seviyesi (Orta+)');
      ekle(g.explicitContentFilter >= 1, 10, 'Medya filtresi açık');
      ekle(g.premiumTier >= 1, 5, 'Boost var');
      ekle(!!ay.logKanal, 10, 'Log kanalı');
      ekle(ay.antiLink, 10, 'Anti-Link');
      ekle(ay.antiKufur, 10, 'Anti-Küfür');
      ekle(ay.antiSpam, 10, 'Anti-Spam');
      ekle(ay.antiRaid, 10, 'Anti-Raid');
      ekle(ay.antiBot, 5, 'Anti-Bot');
      ekle(!!ay.altKoruma, 5, 'Alt Hesap Koruması');
      ekle(!!ay.otoRol, 5, 'Oto-rol');
      ekle((ay.yasakli || []).length > 0, 5, 'Yasaklı kelime listesi');
      ekle(g.roles.cache.size >= 5, 5, 'Rol yapısı');
      puan = Math.min(100, puan);
      const seviye = puan >= 80 ? '🟢 ÇOK GÜVENLİ' : puan >= 50 ? '🟡 ORTA' : '🔴 RİSKLİ';
      return message.reply({ embeds: [new EmbedBuilder().setColor(puan >= 80 ? config.colors.success : puan >= 50 ? config.colors.warn : config.colors.error).setTitle(`🛡️ Güvenlik Skoru: ${puan}/100 — ${seviye}`).setDescription(detay.join('\n')).setFooter({ text: '!güvenlik yazarak eksikleri kapat' }).setTimestamp()] });
    },
  },
  {
    name: 'guvenlik-ultra', aliases: ['güvenlik-ultra', 'tamkoruma', 'maxkoruma'], category: 'Güvenlik',
    description: '🚨 TEK TIKLA EN ÜST DÜZEY: tüm kalkanlar + log + üye rolü + doğrulama!',
    usage: '!güvenlik-ultra',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args, client) {
      const g = getGuild(message.guild.id);
      const acilan = [];
      const hazır = [];
      const kalkanlar = [
        ['antiLink', '🔗 Anti-Link'], ['antiKufur', '🤬 Anti-Küfür'], ['antiSpam', '📢 Anti-Spam'],
        ['antiRaid', '⚔️ Anti-Raid'], ['antiBot', '🤖 Anti-Bot'], ['capsEngel', '🔠 Caps-Engel'],
        ['altKoruma', '🥷 Alt Hesap Koruması'],
      ];
      for (const [key, ad] of kalkanlar) {
        if (g[key]) hazır.push(ad);
        else { g[key] = true; acilan.push(`${ad} 🟢`); }
      }
      // Log kanalı yoksa aç + kilitle
      const logVar = g.logKanal && message.guild.channels.cache.get(g.logKanal);
      if (!logVar) {
        const log = await message.guild.channels.create({ name: '📜・loglar', type: ChannelType.GuildText, reason: 'Ultra güvenlik' }).catch(() => null);
        if (log) {
          await log.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false }).catch(() => {});
          g.logKanal = log.id;
          acilan.push('📋 Log kanalı açıldı + kilitlendi');
        }
      } else hazır.push('📋 Log kanalı');
      // Oto-rol yoksa Üye rolü aç
      if (!g.otoRol || !message.guild.roles.cache.get(g.otoRol)) {
        const rol = await message.guild.roles.create({ name: '🎭 Üye', color: '#8B5CF6', reason: 'Ultra güvenlik' }).catch(() => null);
        if (rol) { g.otoRol = rol.id; acilan.push('🎭 Oto-rol (Üye) kuruldu'); }
      } else hazır.push('🎭 Oto-rol');
      save();
      // Sunucu doğrulaması en üst düzeye (botun yetkisi dahilinde)
      try {
        if (message.guild.verificationLevel < 2) {
          await message.guild.setVerificationLevel(2, 'Ultra güvenlik');
          acilan.push('🔒 Doğrulama: Orta+ (5dk üyelik şartı)');
        } else hazır.push('🔒 Doğrulama');
      } catch {}
      try {
        if (message.guild.explicitContentFilter < 2) {
          await message.guild.setExplicitContentFilter(2, 'Ultra güvenlik');
          acilan.push('🖼️ Medya filtresi: herkeste açık');
        } else hazır.push('🖼️ Medya filtresi');
      } catch {}
      const cli = client || message.client;
      return message.reply({
        embeds: [kart(cli, {
          renk: RENK.basari,
          baslik: '🛡️ ULTRA GÜVENLİK AKTİF!',
          aciklama: `**✦ EN ÜST DÜZEY KORUMA ✦**\n${acilan.length ? '' : 'Zaten her şey açıkmış, efsanesin! 😎'}`,
          alanlar: [
            ...(acilan.length ? [{ name: '🟢 Şimdi Açılanlar', value: acilan.join('\n').slice(0, 1024), inline: false }] : []),
            ...(hazır.length ? [{ name: '✅ Zaten Açık Olanlar', value: hazır.join('\n').slice(0, 1024), inline: false }] : []),
            { name: '⚔️ Her Zaman Devrede', value: '3 ihlal = oto-timeout • Raid = oto-kilit • Scam link kalkanı • Anti-nuke', inline: false },
          ],
          altbilgi: 'Skorun için: /güvenlik-skor • Panel: /güvenlik',
        })],
      });
    },
  },
];

module.exports.handleGuvButton = handleGuvButton;
