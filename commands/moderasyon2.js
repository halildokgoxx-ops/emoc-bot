const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuild, setGuild, getUser, db, save } = require('../src/db');
const { ok, err, kisiBulAsync, repRozet } = require('../src/embeds');
const { parseSure, sureYaz } = require('../src/utils');
const config = require('../config');

function renkCoz(s) {
  const map = { kirmizi: '#FF0000', kırmızı: '#FF0000', mavi: '#0000FF', yesil: '#00FF00', yeşil: '#00FF00', sari: '#FFFF00', sarı: '#FFFF00', mor: '#800080', pembe: '#FF69B4', turuncu: '#FFA500', siyah: '#000000', beyaz: '#FFFFFF', gri: '#808080', lacivert: '#000080', bordo: '#800000', camgobegi: '#00CED1' };
  s = (s || '').toLocaleLowerCase('tr').trim();
  if (map[s]) return map[s];
  const h = s.replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(h)) return '#' + h.toUpperCase();
  if (/^[0-9a-f]{3}$/i.test(h)) return '#' + h.split('').map(c => c + c).join('').toUpperCase();
  return null;
}

async function modLog(message, text) {
  const g = getGuild(message.guild.id);
  if (!g.logKanal) return;
  const k = message.guild.channels.cache.get(g.logKanal);
  if (k) k.send({ embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle('📋 Mod Log').setDescription(text).setTimestamp()] }).catch(() => {});
}

module.exports = [
  {
    name: 'forceban', aliases: ['force-ban', 'idban'], category: 'Moderasyon',
    description: 'Sunucuda olmayan birini ID ile banlar.', usage: '!forceban <ID> [sebep]',
    perms: [PermissionFlagsBits.BanMembers],
    async run(message, args) {
      const id = (args[0] || '').replace(/\D/g, '');
      if (!/^\d{15,22}$/.test(id)) return message.reply({ embeds: [err('Geçerli ID yaz! `!forceban 123456789012345678 reklam`')] });
      const sebep = args.slice(1).join(' ') || 'Sebep belirtilmedi';
      try { await message.guild.members.ban(id, { reason: `${message.author.tag}: ${sebep}` }); }
      catch { return message.reply({ embeds: [err('Banlayamadım! (ID hatalı veya zaten banlı)')] }); }
      modLog(message, `🔨 <@${id}> (\`${id}\`) **force-banlandı** • ${message.author} • ${sebep}`);
      return message.reply({ embeds: [ok(`🔨 \`${id}\` banlandı.\n📝 Sebep: *${sebep}*`)] });
    },
  },
  {
    name: 'tempban', aliases: ['temp-ban', 'sureliban', 'süreli-ban'], category: 'Moderasyon',
    description: 'Süreli ban atar, süre bitince otomatik açılır!', usage: '!tempban @kullanıcı <süre> [sebep]',
    perms: [PermissionFlagsBits.BanMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      const sure = parseSure(args[1]);
      if (!h) return message.reply({ embeds: [err('Kullanıcı bulunamadı! `!tempban @kullanıcı 1d reklam`')] });
      if (!sure || sure < 60_000 || sure > 30 * 86400_000) return message.reply({ embeds: [err('Süre 1dk-30gün arası olmalı! `!tempban @k 1d spam`')] });
      if (!h.bannable) return message.reply({ embeds: [err('Onu banlayamam!')] });
      const sebep = args.slice(2).join(' ') || 'Sebep belirtilmedi';
      await h.ban({ reason: `[TEMP ${sureYaz(sure)}] ${message.author.tag}: ${sebep}` }).catch(() => null);
      const d = db();
      if (!d.tempbanlar) d.tempbanlar = [];
      d.tempbanlar.push({ guildId: message.guild.id, userId: h.id, bitis: Date.now() + sure });
      save();
      modLog(message, `⏳ ${h.user.tag} **${sureYaz(sure)} banlandı** • ${message.author} • ${sebep}`);
      return message.reply({ embeds: [ok(`⏳ ${h.user.tag} **${sureYaz(sure)}** banlandı!\n🔓 Açılma: <t:${Math.floor((Date.now() + sure) / 1000)}:F>\n📝 ${sebep}`)] });
    },
  },
  {
    name: 'banlist', aliases: ['ban-list', 'yasaklilar', 'yasaklılar'], category: 'Moderasyon',
    description: 'Banlıları sebepleriyle listeler.', usage: '!banlist',
    perms: [PermissionFlagsBits.BanMembers],
    async run(message) {
      const banlar = await message.guild.bans.fetch().catch(() => null);
      if (!banlar || !banlar.size) return message.reply({ embeds: [ok('🎉 Banlı kimse yok! Tertemiz.')] });
      const desc = [...banlar.values()].slice(0, 20).map((b, i) => `\`${i + 1}.\` **${b.user.tag}** (\`${b.user.id}\`)\n> 📝 ${b.reason || 'sebep yok'}`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.error).setTitle(`🔨 Ban Listesi (${banlar.size})`).setDescription(desc.slice(0, 3900)).setFooter({ text: 'Kaldırmak: !unban <ID>' }).setTimestamp()] });
    },
  },
  {
    name: 'sicil', aliases: ['sabıka', 'sabika', 'karnen'], category: 'Moderasyon',
    description: 'Kullanıcının tüm sicilini + RİSK puanını gösterir! (Caydırıcı 😈)',
    usage: '!sicil [@kullanıcı]',
    async run(message, args) {
      const h = (await kisiBulAsync(message, args, 0)) || message.member;
      const d = getUser(message.guild.id, h.id);
      const yasGun = Math.floor((Date.now() - h.user.createdTimestamp) / 86400000);
      const sus = h.communicationDisabledUntilTimestamp && h.communicationDisabledUntilTimestamp > Date.now();
      // RİSK SKORU
      let risk = 0; const neden = [];
      if (yasGun < 7) { risk += 30; neden.push('🆕 Hesap 7 günden yeni (+30)'); }
      else if (yasGun < 30) { risk += 10; neden.push('🌱 Hesap 30 günden yeni (+10)'); }
      const uyariPuan = Math.min(30, (d.warns || []).length * 10);
      if (uyariPuan) { risk += uyariPuan; neden.push(`⚠️ ${d.warns.length} uyarı (+${uyariPuan})`); }
      if ((d.rep || 0) < 0) { risk += 20; neden.push(`👎 Negatif itibar (${d.rep}) (+20)`); }
      if (!h.user.avatar) { risk += 10; neden.push('🖼️ Profil fotoğrafı yok (+10)'); }
      if ((d.rep || 0) >= 25) { risk = Math.max(0, risk - 15); neden.push(`⭐ Yüksek itibar (-15)`); }
      risk = Math.min(100, risk);
      const karar = risk >= 70 ? '🚨 TEHLİKELİ' : risk >= 40 ? '⚠️ RİSKLİ' : risk >= 15 ? '👀 DİKKAT' : '✅ TEMİZ';
      const renk = risk >= 70 ? config.colors.error : risk >= 40 ? config.colors.warn : risk >= 15 ? config.colors.gold : config.colors.success;
      const uyarilar = (d.warns || []).slice(-5).map((w, i) => `\`${i + 1}.\` *${w.reason}* (<t:${Math.floor(w.date / 1000)}:R>)`).join('\n') || 'Yok ✨';
      return message.reply({
        embeds: [new EmbedBuilder().setColor(renk).setTitle(`📁 ${h.user.tag} — SİCİL DOSYASI`)
          .setThumbnail(h.user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: '☢️ Risk Skoru', value: `**%${risk} — ${karar}**\n${'█'.repeat(Math.round(risk / 10))}${'░'.repeat(10 - Math.round(risk / 10))}`, inline: false },
            { name: '📊 Neden?', value: neden.join('\n') || 'Temiz kayıt', inline: false },
            { name: '⚠️ Uyarı', value: `${(d.warns || []).length} adet`, inline: true },
            { name: '⭐ İtibar', value: `${d.rep} ${repRozet(d.rep)}`, inline: true },
            { name: '🔇 Susturma', value: sus ? `Evet (<t:${Math.floor(h.communicationDisabledUntilTimestamp / 1000)}:R>)` : 'Hayır', inline: true },
            { name: '📈 Seviye', value: `Sv.${d.level || 0} (${d.mesaj || 0} mesaj)`, inline: true },
            { name: '📅 Hesap Yaşı', value: `${yasGun} gün`, inline: true },
            { name: '📥 Katılım', value: `<t:${Math.floor((h.joinedAt?.getTime() || Date.now()) / 1000)}:R>`, inline: true },
            { name: '🕘 Son Uyarılar', value: uyarilar.slice(0, 1000), inline: false },
          ).setFooter({ text: `ID: ${h.id} • Uyar! Sicilin kabarıyor...` }).setTimestamp()],
      });
    },
  },
  {
    name: 'susturulanlar', aliases: ['mutelist', 'timeout-liste'], category: 'Moderasyon',
    description: 'Şu an susturmalı (timeout) üyeleri listeler.', usage: '!susturulanlar',
    perms: [PermissionFlagsBits.ModerateMembers],
    async run(message) {
      const liste = message.guild.members.cache.filter(m => m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now());
      if (!liste.size) return message.reply({ embeds: [ok('🔊 Susturulan kimse yok!')] });
      const desc = [...liste.values()].slice(0, 20).map(m => `🔇 ${m} — bitiyor: <t:${Math.floor(m.communicationDisabledUntilTimestamp / 1000)}:R>`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle(`🔇 Susturulanlar (${liste.size})`).setDescription(desc).setTimestamp()] });
    },
  },
  {
    name: 'sunucu-kilit', aliases: ['panik', 'lockdown'], category: 'Moderasyon',
    description: '🚨 PANİK BUTONU: tüm yazı kanallarını kilitler! (Raid kalkanı)',
    usage: '!sunucu-kilit [sebep]',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message, args) {
      const sebep = args.join(' ') || 'Sebep belirtilmedi';
      let sayi = 0;
      for (const [, k] of message.guild.channels.cache) {
        if (k.isTextBased() && !k.isThread() && !k.isVoiceBased()) {
          try { await k.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }); sayi++; } catch {}
        }
      }
      modLog(message, `🚨 **SUNUCU KİLİTLENDİ** (${sayi} kanal) • ${message.author} • ${sebep}`);
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.error).setTitle('🚨 SUNUCU KİLİTLENDİ!').setDescription(`🛡️ **${sayi}** kanal kilitlendi.\n📝 Sebep: *${sebep}*\n\nAçmak için: \`!sunucu-ac\``).setTimestamp()] });
    },
  },
  {
    name: 'sunucu-ac', aliases: ['panikac', 'lockdownac'], category: 'Moderasyon',
    description: 'Panik kilidini açar (tüm kanallar).', usage: '!sunucu-ac',
    perms: [PermissionFlagsBits.ManageGuild],
    async run(message) {
      let sayi = 0;
      for (const [, k] of message.guild.channels.cache) {
        if (k.isTextBased() && !k.isThread() && !k.isVoiceBased()) {
          try { await k.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }); sayi++; } catch {}
        }
      }
      modLog(message, `🔓 **Sunucu kilidi açıldı** (${sayi} kanal) • ${message.author}`);
      return message.reply({ embeds: [ok(`🔓 **${sayi}** kanalın kilidi açıldı! Rahat nefes alabilirsiniz 😮‍💨`)] });
    },
  },
  {
    name: 'toplu-rol', aliases: ['massrole'], category: 'Moderasyon',
    description: 'Herkese/botlara/insanlara toplu rol verir ya da alır.', usage: '!toplu-rol <ver|al> @rol [hepsi|insanlar|botlar]',
    perms: [PermissionFlagsBits.ManageRoles],
    slashOptions: [
      { type: 'string', name: 'islem', description: 'Ver/Al', required: true, choices: [{ name: 'Ver', value: 'ver' }, { name: 'Al', value: 'al' }] },
      { type: 'role', name: 'rol', description: 'Rol', required: true },
      { type: 'string', name: 'hedef', description: 'Kime?', required: false, choices: [{ name: 'Herkes', value: 'hepsi' }, { name: 'İnsanlar', value: 'insanlar' }, { name: 'Botlar', value: 'botlar' }] },
    ],
    slashArgs: (i) => { const a = [i.options.getString('islem')]; const r = i.options.getRole('rol'); if (r) a.push(`<@&${r.id}>`); const h = i.options.getString('hedef'); if (h) a.push(h); return a; },
    async run(message, args) {
      const islem = (args[0] || '').toLowerCase();
      const rol = message.mentions.roles.first();
      const hedef = (args.slice(1).join(' ').toLowerCase().includes('bot') ? 'botlar' : args.slice(1).join(' ').toLowerCase().includes('insan') ? 'insanlar' : 'hepsi');
      if (!['ver', 'al'].includes(islem) || !rol) return message.reply({ embeds: [err('`!toplu-rol ver @Üye insanlar`\n`!toplu-rol al @Üye botlar`')] });
      if (rol.position >= message.guild.members.me.roles.highest.position) return message.reply({ embeds: [err('Bu rol benden üstte! Rolümü yükselt.')] });
      if (rol.managed) return message.reply({ embeds: [err('Bot rollerine toplu işlem yapamam!')] });
      const durum = await message.reply(`⏳ Üyeler taranıyor...`);
      const uyeler = await message.guild.members.fetch().catch(() => message.guild.members.cache);
      let liste = [...uyeler.values()].filter(m => !m.user.bot || hedef !== 'insanlar').filter(m => m.user.bot || hedef !== 'botlar');
      if (islem === 'ver') liste = liste.filter(m => !m.roles.cache.has(rol.id));
      else liste = liste.filter(m => m.roles.cache.has(rol.id));
      liste = liste.slice(0, 500);
      let basarili = 0;
      for (const m of liste) {
        try { if (islem === 'ver') await m.roles.add(rol); else await m.roles.remove(rol); basarili++; } catch {}
        if (basarili % 20 === 0) await durum.edit(`⏳ İşleniyor... **${basarili}/${liste.length}**`).catch(() => {});
      }
      modLog(message, `🎭 Toplu rol **${islem}**: ${rol.name} → **${basarili}** üye (${hedef}) • ${message.author}`);
      return durum.edit({ content: `✅ Bitti! ${rol} rolü **${basarili}** üyeye **${islem === 'ver' ? 'verildi' : 'alındı'}**! (${hedef})` }).catch(() => {});
    },
  },
  {
    name: 'rol-olustur', aliases: ['rololustur'], category: 'Moderasyon',
    description: 'Rol oluşturur. (!rol-olustur Moderatör mavi)', usage: '!rol-olustur <isim> [renk]',
    perms: [PermissionFlagsBits.ManageRoles],
    async run(message, args) {
      const isim = args[0];
      if (!isim) return message.reply({ embeds: [err('`!rol-olustur Moderatör mavi`\nRenkler: kırmızı, mavi, yeşil, sarı, mor, pembe, turuncu veya #FF0000')] });
      const renk = renkCoz(args[1]) || '#5865F2';
      const rol = await message.guild.roles.create({ name: isim.slice(0, 50), color: renk, reason: message.author.tag }).catch(() => null);
      if (!rol) return message.reply({ embeds: [err('Oluşturamadım!')] });
      return message.reply({ embeds: [ok(`🎭 ${rol} oluşturuldu! Renk: \`${renk}\``)] });
    },
  },
  {
    name: 'rol-sil', aliases: ['rolsil'], category: 'Moderasyon',
    description: 'Rol siler.', usage: '!rol-sil @rol',
    perms: [PermissionFlagsBits.ManageRoles],
    async run(message) {
      const rol = message.mentions.roles.first();
      if (!rol) return message.reply({ embeds: [err('`!rol-sil @rol`')] });
      const isim = rol.name;
      await rol.delete(`${message.author.tag} sildi`).catch(() => null);
      modLog(message, `🗑️ Rol silindi: **${isim}** • ${message.author}`);
      return message.reply({ embeds: [ok(`🗑️ **${isim}** rolü silindi.`)] });
    },
  },
  {
    name: 'rol-renk', aliases: ['rolrenk'], category: 'Moderasyon',
    description: 'Rol rengini değiştirir.', usage: '!rol-renk @rol <renk>',
    perms: [PermissionFlagsBits.ManageRoles],
    async run(message, args) {
      const rol = message.mentions.roles.first();
      const renk = renkCoz(args[1] || args[0]);
      if (!rol || !renk) return message.reply({ embeds: [err('`!rol-renk @rol mavi` (veya #0000FF)')] });
      await rol.setColor(renk).catch(() => null);
      return message.reply({ embeds: [new EmbedBuilder().setColor(renk).setTitle('🎨 Renk Değişti!').setDescription(`${rol} → \`${renk}\``).setTimestamp()] });
    },
  },
  {
    name: 'rol-bilgi', aliases: ['rolbilgi'], category: 'Moderasyon',
    description: 'Rol bilgisini gösterir.', usage: '!rol-bilgi [@rol]',
    async run(message) {
      const rol = message.mentions.roles.first();
      if (!rol) return message.reply({ embeds: [err('`!rol-bilgi @rol`')] });
      const onemli = rol.permissions.toArray().filter(p => ['Administrator', 'BanMembers', 'KickMembers', 'ManageGuild', 'ManageChannels', 'ManageRoles', 'MentionEveryone', 'ModerateMembers'].includes(p));
      return message.reply({
        embeds: [new EmbedBuilder().setColor(rol.color || config.colors.main).setTitle(`🎭 @${rol.name}`)
          .addFields(
            { name: '👥 Kişi', value: `${rol.members.size}`, inline: true },
            { name: '🎨 Renk', value: `${rol.hexColor}`, inline: true },
            { name: '📌 Sıra', value: `${rol.position}`, inline: true },
            { name: '👆 Ayrı Göster', value: rol.hoist ? 'Evet' : 'Hayır', inline: true },
            { name: '📣 Etiketlenebilir', value: rol.mentionable ? 'Evet' : 'Hayır', inline: true },
            { name: '🤖 Bot Rolü', value: rol.managed ? 'Evet' : 'Hayır', inline: true },
            { name: '🔑 Tehlikeli İzinler', value: onemli.map(p => `\`${p}\``).join(', ') || 'Yok ✅', inline: false },
            { name: '📅 Oluşturulma', value: `<t:${Math.floor(rol.createdTimestamp / 1000)}:R>`, inline: true },
          ).setTimestamp()],
      });
    },
  },
  {
    name: 'kanal-bilgi', aliases: ['kanalbilgi'], category: 'Moderasyon',
    description: 'Kanal bilgisini gösterir.', usage: '!kanal-bilgi [#kanal]',
    async run(message) {
      const k = message.mentions.channels.first() || message.channel;
      const tipAd = { 0: '💬 Yazı', 2: '🔊 Ses', 4: '📁 Kategori', 5: '📢 Duyuru', 13: '🎤 Sahne', 15: '🧵 Forum' }[k.type] ?? `Tip ${k.type}`;
      return message.reply({
        embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`#️⃣ #${k.name}`)
          .addFields(
            { name: '📌 Tip', value: tipAd, inline: true },
            { name: '🐢 Yavaş Mod', value: `${k.rateLimitPerUser || 0}sn`, inline: true },
            { name: '🔞 NSFW', value: k.nsfw ? 'Evet' : 'Hayır', inline: true },
            { name: '📝 Konu', value: (k.topic || 'Yok').slice(0, 300), inline: false },
            { name: '🔒 İzin Ezme', value: `${k.permissionOverwrites.cache.size} adet`, inline: true },
            { name: '📅 Açılma', value: `<t:${Math.floor(k.createdTimestamp / 1000)}:R>`, inline: true },
          ).setTimestamp()],
      });
    },
  },
  {
    name: 'kanal-ac', aliases: ['kanalac'], category: 'Moderasyon',
    description: 'Kanal açar. (!kanal-ac sohbet yazı)', usage: '!kanal-ac <isim> [yazı|ses]',
    perms: [PermissionFlagsBits.ManageChannels],
    slashOptions: [
      { type: 'string', name: 'isim', description: 'Kanal ismi', required: true },
      { type: 'string', name: 'tur', description: 'Tip', required: false, choices: [{ name: '💬 Yazı', value: 'yazi' }, { name: '🔊 Ses', value: 'ses' }] },
    ],
    async run(message, args) {
      const isim = (args[0] || '').toLowerCase().replace(/[^-a-z0-9çğıöşü_]/gi, '-').slice(0, 50);
      if (!isim) return message.reply({ embeds: [err('`!kanal-ac sohbet` veya `!kanal-ac müzik ses`')] });
      const ses = (args[1] || '').toLowerCase().startsWith('ses');
      const k = await message.guild.channels.create({ name: isim, type: ses ? ChannelType.GuildVoice : ChannelType.GuildText, reason: message.author.tag }).catch(() => null);
      if (!k) return message.reply({ embeds: [err('Açamadım!')] });
      return message.reply({ embeds: [ok(`${ses ? '🔊' : '💬'} ${k} açıldı!`)] });
    },
  },
  {
    name: 'kanal-sil', aliases: ['kanalsil'], category: 'Moderasyon',
    description: 'Kanal siler. (Bulunduğun kanalı silmek için: !kanal-sil onay)', usage: '!kanal-sil [#kanal]',
    perms: [PermissionFlagsBits.ManageChannels],
    async run(message, args) {
      const hedef = message.mentions.channels.first();
      if (hedef) {
        const isim = hedef.name;
        modLog(message, `🗑️ Kanal silindi: **#${isim}** • ${message.author}`);
        await hedef.delete(`${message.author.tag} sildi`).catch(() => null);
        return message.reply({ embeds: [ok(`🗑️ **#${isim}** silindi.`)] }).catch(() => {});
      }
      if ((args[0] || '').toLowerCase() === 'onay') {
        const isim = message.channel.name;
        modLog(message, `🗑️ Kanal silindi: **#${isim}** (kendi kanalı) • ${message.author}`);
        await message.channel.delete(`${message.author.tag} sildi`).catch(() => null);
        return;
      }
      return message.reply({ embeds: [err('Kanal etiketle! `!kanal-sil #kanal`\n⚠️ Bulunduğun kanalı silmek için: `!kanal-sil onay`')] });
    },
  },
  {
    name: 'cek', aliases: ['sesecek', 'getir'], category: 'Moderasyon',
    description: 'Kullanıcıyı senin ses kanalına çeker.', usage: '!çek @kullanıcı',
    perms: [PermissionFlagsBits.MoveMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      const benim = message.member.voice.channel;
      if (!h) return message.reply({ embeds: [err('`!çek @kullanıcı`')] });
      if (!benim) return message.reply({ embeds: [err('Önce bir ses kanalına gir!')] });
      if (!h.voice.channel) return message.reply({ embeds: [err(`${h.user.username} seste değil!`)] });
      await h.voice.setChannel(benim).catch(() => null);
      return message.reply({ embeds: [ok(`🔊 ${h} yanına çekildi! (${benim.name})`)] });
    },
  },
  {
    name: 'kes', aliases: ['sestenat', 'disconnect'], category: 'Moderasyon',
    description: 'Kullanıcının ses bağlantısını keser.', usage: '!kes @kullanıcı',
    perms: [PermissionFlagsBits.MoveMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      if (!h) return message.reply({ embeds: [err('`!kes @kullanıcı`')] });
      if (!h.voice.channel) return message.reply({ embeds: [err(`${h.user.username} zaten seste değil!`)] });
      await h.voice.disconnect().catch(() => null);
      modLog(message, `🔇 ${h.user.tag} sesten atıldı • ${message.author}`);
      return message.reply({ embeds: [ok(`🔇 ${h} sesten atıldı!`)] });
    },
  },
  {
    name: 'tasi', aliases: ['tası', 'moveall'], category: 'Moderasyon',
    description: 'Bir ses kanalındaki herkesi başka ses kanalına taşır.', usage: '!taşı #kaynak-ses #hedef-ses',
    perms: [PermissionFlagsBits.MoveMembers],
    async run(message) {
      const kanallar = [...message.mentions.channels.values()].filter(k => k.isVoiceBased());
      if (kanallar.length < 2) return message.reply({ embeds: [err('İki SES kanalı etiketle! `!taşı #lobi #oyun`')] });
      const [kaynak, hedef] = kanallar;
      let sayi = 0;
      for (const [, m] of kaynak.members) {
        try { await m.voice.setChannel(hedef); sayi++; } catch {}
      }
      modLog(message, `🔊 Toplu taşıma: ${kaynak.name} → ${hedef.name} (**${sayi}** kişi) • ${message.author}`);
      return message.reply({ embeds: [ok(`🔊 **${sayi}** kişi ${kaynak} → ${hedef} taşındı!`)] });
    },
  },
  {
    name: 'dehoist', aliases: ['isim-temizle'], category: 'Moderasyon',
    description: 'Başı sembollü nickleri temizler (liste hilesi önleme).',
    usage: '!dehoist',
    perms: [PermissionFlagsBits.ManageNicknames],
    async run(message) {
      const durum = await message.reply('🧹 Nickler taranıyor...');
      const supheliler = message.guild.members.cache.filter(m => m.nickname && /^[^\p{L}\p{N}]/u.test(m.nickname) && m.manageable);
      let sayi = 0;
      for (const [, m] of [...supheliler.values()].slice(0, 40)) {
        const temiz = m.nickname.replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 32) || 'Üye';
        try { await m.setNickname(temiz, 'Dehoist'); sayi++; await new Promise(r => setTimeout(r, 800)); } catch {}
      }
      modLog(message, `🧹 Dehoist: **${sayi}** nick temizlendi • ${message.author}`);
      return durum.edit(`✅ **${sayi}** kişinin nicki temizlendi! (sembol başlıklar silindi)`).catch(() => {});
    },
  },
  {
    name: 'davet-olustur', aliases: ['davetolustur', 'invite-olustur'], category: 'Moderasyon',
    description: 'Süreli/süresiz davet linki oluşturur.', usage: '!davet-olustur [#kanal] [süre]',
    perms: [PermissionFlagsBits.CreateInstantInvite],
    async run(message, args) {
      const kanal = message.mentions.channels.first() || message.channel;
      if (!kanal.isTextBased() && !kanal.isVoiceBased()) return message.reply({ embeds: [err('Bu kanala davet açılamaz!')] });
      const sure = parseSure(args.find(a => !a.startsWith('<#')) || '');
      const sn = sure ? Math.floor(sure / 1000) : 0;
      const davet = await kanal.createInvite({ maxAge: sn, maxUses: 0, reason: message.author.tag }).catch(() => null);
      if (!davet) return message.reply({ embeds: [err('Davet açamadım!')] });
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle('🔗 Davet Hazır!').setDescription(`${davet.url}\n📍 Kanal: ${kanal}\n⏳ Süre: ${sn ? sureYaz(sn * 1000) : 'Süresiz'}`).setTimestamp()] });
    },
  },
  {
    name: 'karantina', aliases: ['jail', 'kafes'], category: 'Moderasyon',
    description: 'Üyeyi karantinaya alır: rolleri alınır, Susturulmuş + 1 saat susturma. (Caydırıcı! ☢️)',
    usage: '!karantina @kullanıcı [sebep]',
    perms: [PermissionFlagsBits.ModerateMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      if (!h) return message.reply({ embeds: [err('`!karantina @kullanıcı <sebep>`')] });
      if (!h.manageable) return message.reply({ embeds: [err('Onu karantinaya alamam! (Rolüm yetmiyor)')] });
      if (h.id === message.author.id) return message.reply({ embeds: [err('Kendini karantinaya alamazsın!')] });
      const sebep = args.slice(1).join(' ') || 'Sebep belirtilmedi';
      const d = getUser(message.guild.id, h.id);
      d.karantinaRoller = h.roles.cache.filter((r) => r.id !== message.guild.id).map((r) => r.id);
      save();
      try { await h.roles.set([], `${message.author.tag}: karantina`); } catch {}
      const sus = message.guild.roles.cache.find((r) => r.name === 'Susturulmuş');
      if (sus) await h.roles.add(sus).catch(() => {});
      await h.timeout(60 * 60 * 1000, 'Karantina: ' + sebep).catch(() => {});
      modLog(message, `☢️ ${h.user.tag} **karantinaya** alındı (${d.karantinaRoller.length} rol alındı) • ${message.author} • ${sebep}`);
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.error).setTitle('☢️ KARANTİNA!').setDescription(`${h} karantinaya alındı!\n🎭 **${d.karantinaRoller.length}** rolü alındı\n🔇 1 saat susturuldu\n📝 ${sebep}`).setTimestamp()] });
    },
  },
  {
    name: 'karantina-kaldir', aliases: ['unjail', 'karantinakaldir'], category: 'Moderasyon',
    description: 'Karantinayı bitirir, eski rolleri geri verir.',
    usage: '!karantina-kaldir @kullanıcı',
    perms: [PermissionFlagsBits.ModerateMembers],
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      if (!h) return message.reply({ embeds: [err('`!karantina-kaldir @kullanıcı`')] });
      const d = getUser(message.guild.id, h.id);
      await h.timeout(null).catch(() => {});
      const sus = message.guild.roles.cache.find((r) => r.name === 'Susturulmuş');
      if (sus) await h.roles.remove(sus).catch(() => {});
      const geri = (d.karantinaRoller || []).filter((id) => message.guild.roles.cache.has(id));
      let verilen = 0;
      for (const id of geri.slice(0, 20)) {
        try { await h.roles.add(id); verilen++; } catch {}
      }
      d.karantinaRoller = [];
      save();
      modLog(message, `✅ ${h.user.tag} karantinadan çıkarıldı (**${verilen}** rol iade) • ${message.author}`);
      return message.reply({ embeds: [ok(`✅ ${h} karantinadan çıktı!\n🎭 **${verilen}** eski rolü iade edildi.`)] });
    },
  },
];
