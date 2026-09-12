require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ---- Global hata kalkanı: bot asla crash yemesin ----
process.on('unhandledRejection', (hata) => {
  const kod = hata && (hata.code || (hata.rawError && hata.rawError.code));
  if (kod === 10062 || kod === 40060) return; // süresi dolmuş / zaten cevaplanmış etkileşim — normal
  console.error('⚠️ Yakalanan hata (unhandledRejection):', (hata && hata.message) || hata);
});
process.on('uncaughtException', (hata) => {
  console.error('⚠️ Yakalanan hata (uncaughtException):', (hata && hata.message) || hata);
});

const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('./config');
const { load, save, getGuild, getUser } = require('./src/db');
const { kufurMu, linkMu, dolandiriciMi } = require('./src/utils');
const { E } = require('./src/emo');
const { premiumMu } = require('./src/premium');
const slash = require('./src/slash');

load();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
});

client.commands = new Collection();
client.aliases = new Collection();

// ---- Komut yükleyici ----
const cmdFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
let toplam = 0;
for (const f of cmdFiles) {
  const arr = require(`./commands/${f}`);
  const liste = Array.isArray(arr) ? arr : [arr];
  for (const c of liste) {
    if (!c.name || c.name.startsWith('__')) continue;
    client.commands.set(c.name.toLowerCase(), c);
    toplam++;
    for (const a of (c.aliases || [])) client.aliases.set(a.toLowerCase(), c.name.toLowerCase());
  }
}
console.log(`✅ ${toplam} komut yüklendi (${cmdFiles.length} dosya)`);

// ---- Spam + Raid + İhlal takip ----
const spamMap = new Map(); // userId -> [timestamps]
const joinMap = new Map(); // guildId -> [timestamps]
const davetCache = new Map(); // guildId -> Map(davetKodu -> {kullanim, sahibi})
const ihlalMap = new Map(); // `${gid}_${uid}` -> { sayi, son } (5dk pencerede 3 ihlal = oto-timeout)
const sonMesajMap = new Map(); // userId -> { icerik, sayi, zaman } (tekrar spam)
function ihlalKaydet(gid, uid) {
  const key = `${gid}_${uid}`;
  const simdi = Date.now();
  const k = ihlalMap.get(key) || { sayi: 0, son: 0 };
  if (simdi - k.son > 5 * 60_000) k.sayi = 0;
  k.sayi++;
  k.son = simdi;
  ihlalMap.set(key, k);
  return k.sayi;
}
async function otoCeza(message, sebep) {
  try {
    await message.member.timeout(10 * 60_000, 'Üst üste kural ihlali: ' + sebep).catch(() => {});
    const m = await message.channel.send(`🚨 ${message.author} üst üste kural ihlali → **10dk susturuldu!**`).catch(() => null);
    if (m) setTimeout(() => m.delete().catch(() => {}), 8000);
    const gg = getGuild(message.guild.id);
    const lc = gg.logKanal ? message.guild.channels.cache.get(gg.logKanal) : null;
    if (lc) lc.send({ embeds: [new EmbedBuilder().setColor(config.colors.error).setTitle('🚨 Oto-Ceza: 10dk Susturma').setDescription(`${message.author} (\`${message.author.tag}\`)\n📝 Sebep: ${sebep}`).setTimestamp()] }).catch(() => {});
  } catch {}
}

client.once('clientReady', async () => {
  console.log(`🤖 Giriş yapıldı: ${client.user.tag} | ${client.guilds.cache.size} sunucu`);
  await slash.registerSlash(client);
  try { await client.application.emojis.fetch(); console.log(`✨ ${client.application.emojis.cache.size} uygulama emojisi hazır`); } catch {}
  try { require('./web/server').startWeb(client); } catch (e) { console.error('Web panel açılamadı:', e.message); }
  // İtibar hak-yenileme taraması (60sn'de bir bildirim kanalına haber verir)
  setInterval(() => {
    try { require('./commands/itibar').repBildirimTara(client); } catch {}
  }, 60_000);
  client.user.setActivity(`/yardım • ${toplam} komut`, { type: 3 });
  setInterval(() => {
    const tipler = [`/yardım • ${toplam} komut`, `!1 ⭐ itibar ver!`, `🤝 /partner ile oto-partner!`, `${client.guilds.cache.size} sunucu • ${client.users.cache.size} kullanıcı`];
    client.user.setActivity(tipler[Math.floor(Math.random() * tipler.length)], { type: 3 });
  }, 60_000);
  // Tempban kontrolü (60sn'de bir, restart'a dayanıklı)
  setInterval(async () => {
    try {
      const { db, save } = require('./src/db');
      const d = db();
      if (!d.tempbanlar || !d.tempbanlar.length) return;
      const simdi = Date.now();
      const bitenler = d.tempbanlar.filter(t => t.bitis <= simdi);
      d.tempbanlar = d.tempbanlar.filter(t => t.bitis > simdi);
      if (bitenler.length) save();
      for (const t of bitenler) {
        try {
          const g = client.guilds.cache.get(t.guildId);
          if (g) await g.bans.remove(t.userId, 'Tempban süresi doldu').catch(() => {});
        } catch {}
      }
      if (bitenler.length) console.log(`⏳ ${bitenler.length} tempban açıldı`);
    } catch {}
  }, 60_000);
  // Günün sorusu (5dk'da bir kontrol)
  setInterval(() => {
    try { require('./commands/topluluk').gununSorusuTara(client); } catch {}
  }, 5 * 60_000);
  // Bitmemiş çekilişleri zamanla (restart-dayanıklı)
  try {
    const { db } = require('./src/db');
    const d = db();
    if (!d.cekilisler) d.cekilisler = {};
    const { cekilisBitir } = require('./commands/cekilis');
    for (const [id, c] of Object.entries(d.cekilisler)) {
      if (c.bitmis) continue;
      const kalan = c.bitis - Date.now();
      if (kalan <= 0) cekilisBitir(client, id);
      else setTimeout(() => cekilisBitir(client, id), Math.min(kalan, 2147483647));
    }
  } catch {}
  // Oto-çekiliş (premium, 5dk kontrol)
  setInterval(async () => {
    try {
      const CK = require('./commands/cekilis');
      for (const [, guild] of client.guilds.cache) {
        const liste = (getGuild(guild.id).otoCekilis || []).filter((o) => o.kanal && o.aralik && o.odul);
        if (!liste.length) continue;
        const d = require('./src/db').db();
        if (!d.cekilisler) d.cekilisler = {};
        for (const o of liste) {
          if (Date.now() - (o.son || 0) < o.aralik) continue;
          const kanal = guild.channels.cache.get(o.kanal);
          if (!kanal || !kanal.isTextBased()) continue;
          o.son = Date.now();
          require('./src/db').save();
          const c = {
            id: null, guildId: guild.id, channelId: kanal.id,
            isim: o.odul, odul: o.odul, bitis: Date.now() + Math.min(o.aralik, 7 * 86400_000),
            sart: 'yok', kazanan: 1, maks: 0, min: 0,
            katilan: [], bitmis: false, olusturan: client.user.id,
          };
          const oniz = { ...c, id: '...' };
          const msg = await kanal.send({ embeds: [CK.cekilisEmbed(client, guild, oniz)], components: [CK.cekilisRow(client, oniz)] }).catch(() => null);
          if (!msg) continue;
          c.id = msg.id;
          d.cekilisler[c.id] = c;
          require('./src/db').save();
          await msg.edit({ embeds: [CK.cekilisEmbed(client, guild, c)], components: [CK.cekilisRow(client, c)] }).catch(() => {});
          setTimeout(() => CK.cekilisBitir(client, c.id), Math.min(7 * 86400_000, 2147483647));
        }
      }
    } catch {}
  }, 5 * 60_000);
  // Premium süre kontrolü (saatte bir, bitenleri loga yaz)
  setInterval(async () => {
    try {
      const P = require('./src/premium');
      const bitenler = P.suresiDolmusTemizle();
      for (const gid of bitenler) {
        try {
          const gg = client.guilds.cache.get(gid);
          if (!gg) continue;
          const lc = getGuild(gid).logKanal ? gg.channels.cache.get(getGuild(gid).logKanal) : null;
          if (lc) lc.send('👑 Bu sunucunun **PREMIUM süresi doldu!** Yenilemek için kurucuyla iletişime geç.').catch(() => {});
        } catch {}
      }
      if (bitenler.length) console.log(`👑 ${bitenler.length} premium süresi doldu`);
    } catch {}
  }, 3600_000);
});

// ---- Mesaj sistemi ----
client.on('messageCreate', async (message) => {
  try {
    if (!message.guild || message.author.bot) return;
    // --- Partner chat tetikleyici (butonlu başvuru daveti) ---
    try { require('./commands/partner').maybePartnerPrompt(message); } catch {}
    const prefix = config.prefix;
    const g = getGuild(message.guild.id);
    const u = getUser(message.guild.id, message.author.id);

    // --- AFK çıkışı ---
    if (u.afk) {
      u.afk = null; save();
      message.reply(`👋 Tekrar hoşgeldin ${message.author}! AFK modundan çıktın.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
    }
    // --- AFK etiket bilgisi ---
    if (message.mentions.users.size) {
      for (const [id, usr] of message.mentions.users) {
        if (id === message.author.id) continue;
        const hedef = getUser(message.guild.id, id);
        if (hedef.afk) message.reply(`💤 ${usr.username} şu an AFK: *${hedef.afk.reason}* (<t:${Math.floor(hedef.afk.date / 1000)}:R>)`).catch(() => {});
      }
    }

    // --- XP / Seviye (premium x2 + özel hız + min/max + bekleme) ---
    const gg = getGuild(message.guild.id);
    const hizCarpan = Math.max(1, Math.min(5, gg.seviyeHiz || 1));
    const xpCarpan = (premiumMu(message.guild.id) ? 2 : 1) * hizCarpan;
    const xpMin = Math.max(1, Math.min(200, gg.xpMin || 5));
    const xpMax = Math.max(xpMin, Math.min(200, gg.xpMax || 15));
    const xpSog = Math.max(0, Math.min(600, gg.xpSoguma || 0)) * 1000;
    const xpKey = `${message.guild.id}_${message.author.id}`;
    let xpKazan = 0;
    if (Date.now() - (xpSogumaMap.get(xpKey) || 0) >= xpSog) {
      xpKazan = (Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin) * xpCarpan;
      xpSogumaMap.set(xpKey, Date.now());
    }
    u.xp = (u.xp || 0) + xpKazan;
    u.mesaj = (u.mesaj || 0) + 1;
    const ihtiyac = (u.level || 0) * 100 + 100;
    if (u.xp >= ihtiyac) {
      u.level = (u.level || 0) + 1;
      u.xp = 0;
      // 🏆 Seviye rol ödülü var mı?
      let odulRol = null;
      try {
        const roller = getGuild(message.guild.id).seviyeRoller || [];
        const eslesme = roller.find((r) => r.seviye === u.level);
        if (eslesme) {
          const rol = message.guild.roles.cache.get(eslesme.rolId);
          if (rol && message.member) {
            await message.member.roles.add(rol).catch(() => {});
            odulRol = rol;
          }
        }
      } catch {}
      const roket = E(client, 'roket', '🚀');
      const parti = E(client, 'parti', '🎉');
      try {
        const gAyar = getGuild(message.guild.id);
        const sablon = String(gAyar.seviyeMesaj || '').trim();
        const degis = (s) => String(s)
          .split('{user}').join(`${message.author}`)
          .split('{kullanıcı}').join(message.author.username)
          .split('{kullanici}').join(message.author.username)
          .split('{ad}').join(message.author.username)
          .split('{level}').join(String(u.level))
          .split('{seviye}').join(String(u.level))
          .split('{xp}').join(String(u.xp || 0))
          .split('{sunucu}').join(message.guild.name);
        const aciklama = (sablon ? degis(sablon) : `${message.author} **Sv.${u.level}** oldu! GG!\n${odulRol ? `🎭 Ödül rolü kazandın: ${odulRol}` : `💡 Ödüllü seviyeler için \`/seviye-rol liste\` yaz!`}`).slice(0, 4000);
        const emb = new EmbedBuilder().setColor(config.colors.gold)
          .setTitle(`${roket} SEVİYE ATLADI! ${parti}`)
          .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
          .setDescription(aciklama)
          .setFooter({ text: 'Emoç • Seviye Sistemi' }).setTimestamp();
        if (gAyar.seviyeOzel) {
          await message.author.send({ embeds: [emb] }).catch(async () => {
            const h = gAyar.seviyeKanal || gAyar.levelBildirimKanal
              ? (message.guild.channels.cache.get(gAyar.seviyeKanal || gAyar.levelBildirimKanal) || message.channel)
              : message.channel;
            await h.send({ embeds: [emb] }).catch(() => {});
          });
        } else {
          const hedefKanal = (gAyar.seviyeKanal || gAyar.levelBildirimKanal)
            ? (message.guild.channels.cache.get(gAyar.seviyeKanal || gAyar.levelBildirimKanal) || message.channel)
            : message.channel;
          await hedefKanal.send({ embeds: [emb] }).catch(() => {});
        }
      } catch {}
    }
    // Günlük görev ilerleme (mesaj)
    try {
      const { db } = require('./src/db');
      const gun = new Date().toISOString().slice(0, 10);
      const key = `${message.guild.id}_${message.author.id}_${gun}`;
      const d = db();
      if (!d.gorevler[key]) d.gorevler[key] = { ilerleme: 0, tamam: false };
      const kay = d.gorevler[key];
      if (!kay.tamam) {
        kay.ilerleme = Math.min(20, (kay.ilerleme || 0) + 1);
        if (kay.ilerleme >= 20) {
          kay.tamam = true;
          u.para = (u.para || 0) + 200;
          message.reply('🎯 Günlük görev tamamlandı! **+200 coin** 🪙').catch(() => {});
        }
      }
    } catch {}
    save();

    // ================= OTO-MOD (prefix yoksa da çalışır) =================
    const uyeYetkili = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);
    const muafRol = (liste) => (liste || []).some((id) => message.member?.roles.cache.has(id));
    const muafKanal = (liste) => (liste || []).includes(message.channel.id);
    const dokunulmaz = uyeYetkili || muafRol(g.yoneticiRol) || muafRol(g.moderatorRol);
    if (!dokunulmaz) {
      // Yasaklı kelime
      if ((g.yasakli || []).some(k => message.content.toLocaleLowerCase('tr').includes(k)) && !muafRol(g.yasakMuaf) && !muafKanal(g.yasakMuafKanal)) {
        await message.delete().catch(() => {});
        const w = await message.channel.send(`${message.author} 🚫 Yasaklı kelime kullandın!`).catch(() => null);
        if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
        return;
      }
      // Anti-küfür (+ 3. ihlalde oto-timeout)
      if (g.antiKufur && kufurMu(message.content) && !muafRol(g.kufurMuaf) && !muafKanal(g.kufurMuafKanal)) {
        await message.delete().catch(() => {});
        const n = ihlalKaydet(message.guild.id, message.author.id);
        if (n >= 3) {
          ihlalMap.delete(`${message.guild.id}_${message.author.id}`);
          await otoCeza(message, 'üst üste küfür (3/3)');
        } else {
          const w = await message.channel.send(`${message.author} 🤬 Küfür yasak! (${n}/3)`).catch(() => null);
          if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
        }
        return;
      }
      // Anti-dolandırıcılık (sahte nitro/steam/airdrop tuzakları)
      if (g.antiLink && dolandiriciMi(message.content) && !muafRol(g.linkMuaf) && !muafKanal(g.linkMuafKanal)) {
        await message.delete().catch(() => {});
        const n = ihlalKaydet(message.guild.id, message.author.id);
        if (n >= 3) {
          ihlalMap.delete(`${message.guild.id}_${message.author.id}`);
          await otoCeza(message, 'dolandırıcılık linki (3/3)');
        } else {
          const w = await message.channel.send(`${message.author} 🚨 Sahte link tuzağı yasak! Hesabını çaldırma, bu linklere TIKLAMA! (${n}/3)`).catch(() => null);
          if (w) setTimeout(() => w.delete().catch(() => {}), 6000);
        }
        return;
      }
      // Anti-link (+ 3. ihlalde oto-timeout)
      if (g.antiLink && linkMu(message.content) && !muafRol(g.linkMuaf) && !muafKanal(g.linkMuafKanal)) {
        await message.delete().catch(() => {});
        const n = ihlalKaydet(message.guild.id, message.author.id);
        if (n >= 3) {
          ihlalMap.delete(`${message.guild.id}_${message.author.id}`);
          await otoCeza(message, 'üst üste link (3/3)');
        } else {
          const w = await message.channel.send(`${message.author} 🔗 Link atmak yasak! (${n}/3)`).catch(() => null);
          if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
        }
        return;
      }
      // Davet Koruması (premium): izinsiz davet linklerini sil
      if (g.govDavet && !muafRol(g.davetMuaf)) {
        try {
          if (premiumMu(message.guild.id) && /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/\S+/i.test(message.content)) {
            await message.delete().catch(() => {});
            const w = await message.channel.send(`${message.author} 🔗 Davet paylaşımı korumalı, sildim!`).catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
            return;
          }
        } catch {}
      }
      // Caps engel
      if (g.capsEngel && message.content.length >= 8 && !muafRol(g.capsMuaf) && !muafKanal(g.capsMuafKanal)) {
        const harf = message.content.replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ]/g, '');
        if (harf.length >= 6 && harf === harf.toUpperCase()) {
          await message.delete().catch(() => {});
          const w = await message.channel.send(`${message.author} 🔠 CAPS kapat!`).catch(() => null);
          if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
          return;
        }
      }
      // Tekrar spam (aynı mesajı 15sn içinde 3x atma)
      if (g.antiSpam && message.content.length > 5 && !muafRol(g.spamMuaf) && !muafKanal(g.spamMuafKanal)) {
        const simdi = Date.now();
        const s = sonMesajMap.get(message.author.id);
        if (s && s.icerik === message.content && simdi - s.zaman < 15000) {
          s.sayi++;
          s.zaman = simdi;
          if (s.sayi >= 3) {
            sonMesajMap.delete(message.author.id);
            await message.delete().catch(() => {});
            const w = await message.channel.send(`${message.author} 📢 Aynı mesajı atıp durma!`).catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
            return;
          }
        } else {
          sonMesajMap.set(message.author.id, { icerik: message.content, sayi: 1, zaman: simdi });
        }
      }
      // Anti-spam (5sn içinde 5 mesaj)
      if (g.antiSpam && !muafRol(g.spamMuaf) && !muafKanal(g.spamMuafKanal)) {
        const simdi = Date.now();
        const arr = spamMap.get(message.author.id) || [];
        const taze = arr.filter(t => simdi - t < 5000);
        taze.push(simdi);
        spamMap.set(message.author.id, taze);
        if (taze.length >= 5) {
          spamMap.set(message.author.id, []);
          await message.member.timeout(60_000, 'Spam').catch(() => {});
          const w = await message.channel.send(`${message.author} 📢 Spam yapma! 1dk susturuldun.`).catch(() => null);
          if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
          return;
        }
      }
    }

    // --- Oto-cevap (premium) ---
    try {
      const goc = getGuild(message.guild.id);
      if (goc.otoCevap && goc.otoCevap.length && !message.content.startsWith(prefix)) {
        const txt = message.content.toLocaleLowerCase('tr');
        const eslesme = goc.otoCevap.find((o) => o.tetik && txt.includes(o.tetik));
        if (eslesme) {
          await message.reply(String(eslesme.cevap).slice(0, 1500)).catch(() => {});
          return;
        }
      }
    } catch {}
    // --- EmocAI kanal sohbeti (premium, komutsuz) ---
    try {
      const gAI = getGuild(message.guild.id);
      if (gAI.aiKanal && message.channel.id === gAI.aiKanal && !message.content.startsWith(prefix) && premiumMu(message.guild.id)) {
        const AI = require('./src/ai');
        if (AI.sogumaKontrol(message.author.id)) {
          const kalan = AI.kalanHak(message.guild.id, message.author.id, true);
          if (kalan <= 0) {
            await message.reply('⏳ Bugünkü AI hakkın bitti! Yarın yine beklerim 😉').catch(() => {});
          } else {
            await message.channel.sendTyping().catch(() => {});
            try {
              const cevap = await AI.aiCevapla({
                guildAd: message.guild.name, kullaniciAd: message.author.username,
                soru: message.content.slice(0, 500), kanalId: message.channel.id, premium: true,
              });
              AI.hakTuket(message.guild.id, message.author.id);
              await message.reply(`✦ ${cevap.slice(0, 1900)}`).catch(() => {});
            } catch {
              await message.reply('❌ Şu an cevap veremiyorum!').catch(() => {});
            }
          }
        }
        return;
      }
    } catch {}
    // --- Komut değilse çık ---
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const isim = (args.shift() || '').toLowerCase();
    if (!isim) return;
    const cmd = client.commands.get(isim) || client.commands.get(client.aliases.get(isim));
    if (!cmd) return;

    // Yetki kontrolü
    if (cmd.perms && !message.member.permissions.has(cmd.perms[0])) {
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.error).setTitle('❌ Yetkin yok!').setDescription('Bu komut için gerekli yetkin bulunmuyor.')] });
    }
    // Bot yetkisi
    if (cmd.botPerms && !message.guild.members.me.permissions.has(cmd.botPerms[0])) {
      return message.reply('❌ Benim yetkim yetmiyor! (Yönetici ver)');
    }

    await cmd.run(message, args, client);
  } catch (e) {
    console.error('Komut hatası:', e);
    try { message.reply('❌ Bir hata oldu! Sahibime söyle.'); } catch {}
  }
});

// ---- Yeni üye ----
client.on('guildMemberAdd', async (member) => {
  try {
    if (member.user.bot) {
      const g = getGuild(member.guild.id);
      if (g.antiBot) {
        await member.kick('Anti-Bot aktif').catch(() => {});
        return;
      }
      // 🤖 Bot Filtresi: onaylanmamış (doğrulanmamış) botları engelle
      if (g.govBot && !member.user.verified) {
        await member.kick('Bot Filtresi: onaylanmamış bot').catch(() => {});
        guvenlikLog(member.guild, '🤖 Onaylanmamış Bot Engellendi',
          `${member.user.tag} (\`${member.id}\`)\nDoğrulanmamış bot sunucuya alınmadı.`).catch(() => {});
        return;
      }
    }
    // 🛡️ Hesap Filtresi (premium): X günden yeni hesapları alma
    try {
      const hg = getGuild(member.guild.id);
      if (hg.govHesap && !member.user.bot && premiumMu(member.guild.id)) {
        const sinir = Math.max(1, Math.min(30, hg.govHesapGun || 7));
        const yas = (Date.now() - member.user.createdTimestamp) / 86400000;
        if (yas < sinir) {
          await member.kick(`Hesap filtresi (${sinir} günden yeni)`).catch(() => {});
          guvenlikLog(member.guild, '🛡️ Hesap Filtresi',
            `${member.user.tag} (\`${member.id}\`)\n📅 Hesap yaşı: **${yas.toFixed(1)} gün** (< ${sinir} gün) → sunucuya alınmadı.`).catch(() => {});
          return;
        }
      }
    } catch {}
    // 🥷 Alt hesap koruması (<3 gün = kick, <7 gün = 10dk gözlem)
    try {
      const gg = getGuild(member.guild.id);
      if (gg.altKoruma && !member.user.bot) {
        const gun = (Date.now() - member.user.createdTimestamp) / 86400000;
        if (gun < 3) {
          await member.kick('Alt hesap koruması (3 günden yeni)').catch(() => {});
          logger.gonder(member.guild, new EmbedBuilder().setColor(config.colors.error).setTitle('🥷 Alt Hesap Engellendi!')
            .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
            .setDescription(`${member.user.tag} (\`${member.id}\`)\n📅 Hesap yaşı: **${gun.toFixed(1)} gün** → otomatik atıldı.`).setTimestamp()).catch(() => {});
          return;
        } else if (gun < 7) {
          await member.timeout(10 * 60_000, 'Yeni hesap gözlemi').catch(() => {});
          logger.gonder(member.guild, new EmbedBuilder().setColor(config.colors.warn).setTitle('👀 Şüpheli Yeni Hesap!')
            .setDescription(`${member} (\`${member.user.tag}\`)\n📅 Hesap yaşı: **${gun.toFixed(1)} gün** → 10dk gözlem susturması.`).setTimestamp()).catch(() => {});
        }
      }
    } catch {}
    const g = getGuild(member.guild.id);

    // Anti-raid: 10sn içinde 5+ giriş → TÜM kanalları kilitle + 10dk sonra otomatik aç
    if (g.antiRaid) {
      const simdi = Date.now();
      const arr = joinMap.get(member.guild.id) || [];
      const taze = arr.filter(t => simdi - t < 10_000);
      taze.push(simdi);
      joinMap.set(member.guild.id, taze);
      if (taze.length >= 5) {
        joinMap.set(member.guild.id, []);
        await logger.antiNuke(member.guild, 'toplu giriş (**raid saldırısı**)').catch(() => {});
        setTimeout(async () => {
          try {
            for (const [, k] of member.guild.channels.cache) {
              if (k.isTextBased() && !k.isThread() && !k.isVoiceBased()) {
                await k.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: null }).catch(() => {});
              }
            }
            logger.gonder(member.guild, new EmbedBuilder().setColor(config.colors.success).setTitle('🔓 Raid Kilidi Otomatik Açıldı').setDescription('10 dakika doldu, kanallar açıldı.\nŞüpheli bir durum varsa `/sunucu-kilit` ile kapatabilirsin.').setTimestamp()).catch(() => {});
          } catch {}
        }, 10 * 60_000);
        return;
      }
    }

    // 🧲 Yapışkan rol iadesi (premium)
    try {
      const d = require('./src/db');
      if (getGuild(member.guild.id).yapiskan) {
        const kayit = (d.db().yapiskan || {})[`${member.guild.id}_${member.id}`];
        if (kayit && kayit.length && !member.user.bot) {
          let n = 0;
          for (const rid of kayit.slice(0, 15)) {
            const r = member.guild.roles.cache.get(rid);
            if (r && !r.managed && r.position < member.guild.members.me.roles.highest.position) {
              try { await member.roles.add(r); n++; } catch {}
            }
          }
          if (n) member.send(`🎭 **${member.guild.name}** — eski rollerinden **${n}** tanesi geri verildi! Tekrar hoş geldin!`).catch(() => {});
        }
      }
    } catch {}
    // 💌 Giriş DM (premium)
    try {
      const dm = getGuild(member.guild.id).girisDM;
      if (dm && !member.user.bot) {
        const txt = String(dm).replace(/{kullanıcı}/g, `${member}`).replace(/{sunucu}/g, member.guild.name).replace(/{üye}/g, `${member.guild.memberCount}`).slice(0, 1500);
        await member.send(txt).catch(() => {});
      }
    } catch {}
    // Oto-rol (+ premium çoklu)
    if (g.otoRol) {
      const rol = member.guild.roles.cache.get(g.otoRol);
      if (rol) await member.roles.add(rol).catch(() => {});
    }
    if (g.otoRolCoklu && g.otoRolCoklu.length) {
      for (const rid of g.otoRolCoklu.slice(0, 3)) {
        const r = member.guild.roles.cache.get(rid);
        if (r) await member.roles.add(r).catch(() => {});
      }
    }
    // 📨 Davet takibi + sayaç + davet ödülleri (premium)
    try {
      if (premiumMu(member.guild.id)) {
        let davetEdenId = null;
        try {
          let onceki = davetCache.get(member.guild.id);
          if (!onceki) {
            const davetler = await member.guild.invites.fetch().catch(() => null);
            onceki = new Map();
            if (davetler) for (const [kod, d] of davetler) onceki.set(kod, { kullanim: d.uses || 0, sahibi: d.inviterId || null });
            davetCache.set(member.guild.id, onceki);
          } else {
            const simdi = await member.guild.invites.fetch().catch(() => null);
            if (simdi) {
              for (const [kod, d] of simdi) {
                const eski = onceki.get(kod);
                if (eski && (d.uses || 0) > eski.kullanim) davetEdenId = d.inviterId || eski.sahibi;
                onceki.set(kod, { kullanim: d.uses || 0, sahibi: d.inviterId || (eski ? eski.sahibi : null) });
              }
            }
          }
        } catch {}
        if (davetEdenId && !member.user.bot) {
          const inv = getUser(member.guild.id, davetEdenId);
          inv.davetSayisi = (inv.davetSayisi || 0) + 1;
          getUser(member.guild.id, member.id).davetEden = davetEdenId;
          for (const dr of (getGuild(member.guild.id).davetRolleri || [])) {
            if (inv.davetSayisi >= dr.sayi) {
              const rr = member.guild.roles.cache.get(dr.rolId);
              const invUye = await member.guild.members.fetch(davetEdenId).catch(() => null);
              if (rr && invUye && !invUye.roles.cache.has(rr.id)) {
                await invUye.roles.add(rr).catch(() => {});
                const lc0 = getGuild(member.guild.id).logKanal ? member.guild.channels.cache.get(getGuild(member.guild.id).logKanal) : null;
                if (lc0) lc0.send(`📨 ${invUye} **${inv.davetSayisi}** davet yaptı → ${rr} kazandı!`).catch(() => {});
              }
            }
          }
          save();
        }
        try { await require('./commands/premium').premiumSayacGuncelle(client, member.guild, member, davetEdenId); } catch {}
      }
    } catch {}

    // Hesap yaşı kontrolü (şüpheli)
    const yas = Date.now() - member.user.createdTimestamp;
    const supheli = yas < 7 * 86400_1000;

    // Hoşgeldin (premium embed varsa o, yoksa klasik)
    if (g.hosgeldinKanal) {
      const k = member.guild.channels.cache.get(g.hosgeldinKanal);
      if (k) {
        if (g.hgEmbed && premiumMu(member.guild.id)) {
          const { hgVedaEmbed } = require('./commands/premium');
          k.send({ embeds: [hgVedaEmbed(client, member.guild, member, g.hgEmbed, true)] }).catch(() => {});
        } else {
          const txt = (g.hosgeldinMesaj || '👋 Hoşgeldin {kullanıcı}! {sunucu} sunucusuna katıldın. {üye}. üyesin! 🎉')
            .replace(/{kullanıcı}/g, `${member}`).replace(/{sunucu}/g, member.guild.name).replace(/{üye}/g, `${member.guild.memberCount}`);
          const { medyaAyikla } = require('./src/utils');
          const { metin, resim } = medyaAyikla(txt);
          let gif = resim || null;
          try { if (!gif) gif = await require('./src/gif').animeGif('wave'); } catch {}
          const e = new EmbedBuilder().setColor(config.colors.success).setTitle(`👋 Hoşgeldin, ${member.user.username}!`)
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setDescription(`${metin}${supheli ? '\n\n⚠️ *Hesap 7 günden yeni, dikkat!*' : ''}`)
            .setImage(gif || null)
            .setFooter({ text: `${member.guild.name} • ${member.guild.memberCount}. üye 🎉` }).setTimestamp();
          k.send({ embeds: [e] }).catch(() => {});
        }
      }
    }
    // Sayaç
    if (g.sayacHedef && g.sayacKanal) {
      const k = member.guild.channels.cache.get(g.sayacKanal);
      if (k) {
        const kalan = g.sayacHedef - member.guild.memberCount;
        if (kalan <= 0) {
          k.send(`🎯 **HEDEF TAMAMLANDI!** ${g.sayacHedef} üyeye ulaştık! 🎉`).catch(() => {});
          const { setGuild } = require('./src/db');
          setGuild(member.guild.id, { sayacHedef: 0, sayacKanal: null });
        } else if (g.sayacMesaj) {
          const { medyaAyikla } = require('./src/utils');
          const ham = String(g.sayacMesaj)
            .replace(/{kullanıcı}/g, `${member}`).replace(/{sunucu}/g, member.guild.name)
            .replace(/{üye}/g, `${member.guild.memberCount}`).replace(/{hedef}/g, `${g.sayacHedef}`).replace(/{kalan}/g, `${kalan}`);
          const { metin, resim } = medyaAyikla(ham);
          const e2 = new EmbedBuilder().setColor(config.colors.main).setDescription(metin || '*...*').setTimestamp();
          if (resim) e2.setImage(resim);
          k.send({ embeds: [e2] }).catch(() => {});
        } else {
          k.send(`📥 ${member} katıldı! **${g.sayacHedef}** üye olmasına **${kalan}** kaldı!`).catch(() => {});
        }
      }
    }
  } catch (e) { console.error(e); }
});

client.on('guildMemberRemove', async (member) => {
  try {
    // 🧲 Yapışkan rol kaydı (premium)
    try {
      const gg = getGuild(member.guild.id);
      if (gg.yapiskan && !member.user.bot) {
        const d = require('./src/db');
        if (!d.db().yapiskan) d.db().yapiskan = {};
        d.db().yapiskan[`${member.guild.id}_${member.id}`] = member.roles.cache
          .filter((r) => r.id !== member.guild.id && !r.managed)
          .map((r) => r.id);
        d.save();
      }
    } catch {}
    const g = getGuild(member.guild.id);
    if (g.cikisKanal) {
      const k = member.guild.channels.cache.get(g.cikisKanal);
      if (k) {
        if (g.vedaEmbed && premiumMu(member.guild.id)) {
          const { hgVedaEmbed } = require('./commands/premium');
          const t = String(g.vedaEmbed.mesaj || '').replace(/{kullanıcı}/g, member.user.tag).replace(/{sunucu}/g, member.guild.name).slice(0, 1500);
          k.send({ embeds: [hgVedaEmbed(member.client, member.guild, member.user, { baslik: g.vedaEmbed.baslik, mesaj: t }, false)] }).catch(() => {});
        } else if (g.cikisMesaj) {
          const { medyaAyikla } = require('./src/utils');
          const ham = String(g.cikisMesaj)
            .replace(/{kullanıcı}/g, `${member}`).replace(/{sunucu}/g, member.guild.name).replace(/{üye}/g, `${member.guild.memberCount}`);
          const { metin, resim } = medyaAyikla(ham);
          const e = new EmbedBuilder().setColor(config.colors.main).setTitle(`👋 ${member.user.username} ayrıldı`)
            .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
            .setDescription(metin || '*...*').setTimestamp();
          if (resim) e.setImage(resim);
          k.send({ embeds: [e] }).catch(() => {});
        } else {
          k.send(`👋 **${member.user.tag}** aramızdan ayrıldı. Güle güle...`).catch(() => {});
        }
      }
    }
    try { await require('./commands/premium').premiumSayacGuncelle(member.client, member.guild, null, null); } catch {}
    // Sayaç çıkışı
    if (g.sayacHedef && g.sayacKanal) {
      const k = member.guild.channels.cache.get(g.sayacKanal);
      if (k) k.send(`📤 ${member.user.tag} ayrıldı. Hedefe **${g.sayacHedef - member.guild.memberCount}** kaldı.`).catch(() => {});
    }
  } catch {}
});

// ================= AŞIRI DETAYLI LOG SİSTEMİ =================
const logger = require('./src/logger');
const { AuditLogEvent } = require('discord.js');

client.on('messageDelete', (m) => logger.logSilinen(m).catch(() => {}));
client.on('messageUpdate', (e, y) => logger.logDuzenlenen(e, y).catch(() => {}));

client.on('messageDeleteBulk', async (msgs) => {
  try {
    const ilk = msgs.first();
    if (!ilk || !ilk.guild) return;
    const audit = await logger.executorBul(ilk.guild, AuditLogEvent.MessageBulkDelete, ilk.channel.id).catch(() => null);
    await logger.gonder(ilk.guild, new EmbedBuilder().setColor(config.colors.error).setTitle('🧹 Toplu Mesaj Silindi')
      .addFields(
        { name: '📍 Kanal', value: `${ilk.channel}`, inline: true },
        { name: '🗑️ Adet', value: `**${msgs.size}**`, inline: true },
        { name: '🧨 Silen', value: audit ? `${audit.executor} (\`${audit.executor.tag}\`)` : 'Bilinmiyor', inline: false },
      ).setTimestamp());
  } catch {}
});

client.on('guildBanAdd', async (ban) => {
  try {
    const audit = await logger.executorBul(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id).catch(() => null);
    await logger.gonder(ban.guild, new EmbedBuilder().setColor(config.colors.error).setTitle('🔨 Üye Banlandı')
      .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: '👤 Banlanan', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: false },
        { name: '👮 Banlayan', value: audit ? `${audit.executor} (\`${audit.executor.tag}\`)` : 'Bilinmiyor', inline: true },
        { name: '📝 Sebep', value: (audit?.reason || ban.reason || 'Belirtilmedi').slice(0, 500), inline: false },
      ).setTimestamp());
    await logger.patlamaKontrol(ban.guild, 'ban').catch(() => {});
  } catch {}
});

client.on('guildBanRemove', async (ban) => {
  try {
    const audit = await logger.executorBul(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id).catch(() => null);
    await logger.gonder(ban.guild, new EmbedBuilder().setColor(config.colors.success).setTitle('🔓 Ban Kaldırıldı')
      .addFields(
        { name: '👤 Üye', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: false },
        { name: '👮 Kaldıran', value: audit ? `${audit.executor} (\`${audit.executor.tag}\`)` : 'Bilinmiyor', inline: true },
      ).setTimestamp());
  } catch {}
});

client.on('guildMemberUpdate', async (eski, yeni) => {
  try {
    // 💎 Booster oto-senkron (boost basana ver, çekene al)
    try {
      const bRol = yeni.guild.roles.cache.find((r) => r.name === '💎 Booster');
      if (bRol) {
        if (yeni.premiumSince && !yeni.roles.cache.has(bRol.id)) await yeni.roles.add(bRol).catch(() => {});
        else if (!yeni.premiumSince && eski.premiumSince && yeni.roles.cache.has(bRol.id)) await yeni.roles.remove(bRol).catch(() => {});
      }
    } catch {}
    // 🚀 Destek sunucusuna boost → en büyük sunucunda PREMIUM!
    try {
      if (!eski.premiumSince && yeni.premiumSince) {
        if (!globalThis._destekId) {
          try {
            const dav = await client.fetchInvite('urYcW4ubqT').catch(() => null);
            if (dav && dav.guild) globalThis._destekId = dav.guild.id;
          } catch {}
        }
        if (globalThis._destekId && yeni.guild.id === globalThis._destekId) {
          const P = require('./src/premium');
          const adaylar = [];
          for (const [, g] of client.guilds.cache) {
            if (g.id === globalThis._destekId) continue;
            let uye = g.members.cache.get(yeni.id);
            if (!uye) uye = await g.members.fetch(yeni.id).catch(() => null);
            if (uye && !uye.user.bot) adaylar.push(g);
          }
          adaylar.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
          if (adaylar.length) {
            const hedef = adaylar[0];
            const mevcut = P.premiumBilgi(hedef.id);
            const gun = 30;
            if (mevcut) P.premiumVer(hedef.id, Math.ceil((mevcut.bitis - Date.now()) / 86400000) + gun);
            else P.premiumVer(hedef.id, gun);
            try {
              await yeni.send(`🚀 **Boost için teşekkürler!** Desteğinin karşılığı olarak **${hedef.name}** sunucunda **👑 PREMIUM** aktifleşti (30 gün)! İyi eğlenceler! 💜`);
            } catch {}
            try {
              const DB = require('./src/db');
              const lcId = DB.getGuild(hedef.id).logKanal;
              const lc = lcId ? hedef.channels.cache.get(lcId) : null;
              if (lc) lc.send(`🚀 ${yeni} destek sunucusuna boost bastı → **${hedef.name}** sunucusunda 👑 PREMIUM aktif!`).catch(() => {});
            } catch {}
          } else {
            try { await yeni.send('🚀 Boost için teşekkürler! Botun olduğu bir sunucuya katıl, premiumu en kalabalık sunucuna açayım! 💜'); } catch {}
          }
        }
      }
    } catch {}
    // Timeout değişimi
    const eT = eski.communicationDisabledUntilTimestamp;
    const yT = yeni.communicationDisabledUntilTimestamp;
    if ((eT || 0) !== (yT || 0)) {
      const audit = await logger.executorBul(yeni.guild, AuditLogEvent.MemberUpdate, yeni.id).catch(() => null);
      if (yT && yT > Date.now()) {
        await logger.gonder(yeni.guild, new EmbedBuilder().setColor(config.colors.warn).setTitle('🔇 Susturma (Timeout)')
          .addFields(
            { name: '👤 Üye', value: `${yeni.user.tag}`, inline: true },
            { name: '👮 Veren', value: audit ? `${audit.executor}` : 'Bilinmiyor', inline: true },
            { name: '⏳ Bitiş', value: `<t:${Math.floor(yT / 1000)}:F>`, inline: false },
            { name: '📝 Sebep', value: (audit?.reason || 'Belirtilmedi').slice(0, 300), inline: false },
          ).setTimestamp());
      } else {
        await logger.gonder(yeni.guild, new EmbedBuilder().setColor(config.colors.success).setTitle('🔊 Susturma Kalktı')
          .setDescription(`👤 ${yeni.user.tag}\n👮 ${audit ? `${audit.executor}` : 'Süre doldu / bilinmiyor'}`).setTimestamp());
      }
      return;
    }
    // Nick değişimi
    if (eski.nickname !== yeni.nickname) {
      const audit = await logger.executorBul(yeni.guild, AuditLogEvent.MemberUpdate, yeni.id).catch(() => null);
      await logger.gonder(yeni.guild, new EmbedBuilder().setColor(config.colors.main).setTitle('✏️ Nick Değişti')
        .addFields(
          { name: '👤 Üye', value: `${yeni.user.tag}`, inline: true },
          { name: '👮 Değiştiren', value: audit ? `${audit.executor}` : 'Kendisi olabilir', inline: true },
          { name: '⬅️ Eski', value: eski.nickname || '*yok*', inline: true },
          { name: '➡️ Yeni', value: yeni.nickname || '*yok*', inline: true },
        ).setTimestamp());
      return;
    }
    // Rol değişimi
    const eR = new Set(eski.roles.cache.keys());
    const yR = new Set(yeni.roles.cache.keys());
    const eklenen = [...yR].filter(r => !eR.has(r) && r !== yeni.guild.id);
    const cikarilan = [...eR].filter(r => !yR.has(r) && r !== yeni.guild.id);
    if (eklenen.length || cikarilan.length) {
      const audit = await logger.executorBul(yeni.guild, AuditLogEvent.MemberRoleUpdate, yeni.id).catch(() => null);
      const satir = [];
      for (const r of eklenen) satir.push(`➕ <@&${r}>`);
      for (const r of cikarilan) satir.push(`➖ <@&${r}>`);
      await logger.gonder(yeni.guild, new EmbedBuilder().setColor(config.colors.main).setTitle('🎭 Rol Değişti')
        .setDescription(`👤 ${yeni.user.tag}\n👮 ${audit ? `${audit.executor}` : 'Bilinmiyor'}\n\n${satir.join('\n').slice(0, 1500)}`).setTimestamp());
    }
  } catch {}
});

function kanalLog(baslik, renk, kanal, ekstra = null) {
  return logger.gonder(kanal.guild, new EmbedBuilder().setColor(renk).setTitle(baslik)
    .addFields(
      { name: '📍 Kanal', value: `**#${kanal.name}** (\`${kanal.id}\`)`, inline: true },
      { name: '📌 Tip', value: `${kanal.type}`, inline: true },
      ...(ekstra ? [{ name: '👮 İşlemi Yapan', value: ekstra, inline: false }] : []),
    ).setTimestamp());
}

client.on('channelCreate', async (k) => {
  try {
    if (!k.guild) return;
    const a = await logger.executorBul(k.guild, AuditLogEvent.ChannelCreate, k.id).catch(() => null);
    await kanalLog('📗 Kanal Açıldı', config.colors.success, k, a ? `${a.executor}` : null);
  } catch {}
});
client.on('channelDelete', async (k) => {
  try {
    if (!k.guild) return;
    const a = await logger.executorBul(k.guild, AuditLogEvent.ChannelDelete, k.id).catch(() => null);
    await kanalLog('📕 Kanal Silindi!', config.colors.error, k, a ? `${a.executor} (\`${a.executor.tag}\`)` : 'Bilinmiyor');
    await logger.patlamaKontrol(k.guild, 'kanal-silme').catch(() => {});
  } catch {}
});
client.on('channelUpdate', async (e, y) => {
  try {
    if (!y.guild || y.isThread()) return;
    const degisen = [];
    if (e.name !== y.name) degisen.push(`İsim: **${e.name}** → **${y.name}**`);
    if (e.topic !== y.topic) degisen.push(`Konu değişti`);
    if ((e.rateLimitPerUser || 0) !== (y.rateLimitPerUser || 0)) degisen.push(`Yavaş mod: **${e.rateLimitPerUser || 0}sn** → **${y.rateLimitPerUser || 0}sn** 🐢`);
    if ((e.nsfw || false) !== (y.nsfw || false)) degisen.push(`NSFW: **${y.nsfw ? 'açıldı' : 'kapatıldı'}**`);
    if (!degisen.length) return;
    const a = await logger.executorBul(y.guild, AuditLogEvent.ChannelUpdate, y.id).catch(() => null);
    await logger.gonder(y.guild, new EmbedBuilder().setColor(config.colors.warn).setTitle('🔧 Kanal Güncellendi')
      .setDescription(`📍 ${y}\n👮 ${a ? `${a.executor}` : 'Bilinmiyor'}\n\n${degisen.join('\n')}`).setTimestamp());
  } catch {}
});

client.on('roleCreate', async (r) => {
  try {
    const a = await logger.executorBul(r.guild, AuditLogEvent.RoleCreate, r.id).catch(() => null);
    await logger.gonder(r.guild, new EmbedBuilder().setColor(config.colors.success).setTitle('🎭 Rol Oluşturuldu')
      .setDescription(`<@&${r.id}> **${r.name}**\n👮 ${a ? `${a.executor}` : 'Bilinmiyor'}`).setTimestamp());
  } catch {}
});
client.on('roleDelete', async (r) => {
  try {
    const a = await logger.executorBul(r.guild, AuditLogEvent.RoleDelete, r.id).catch(() => null);
    await logger.gonder(r.guild, new EmbedBuilder().setColor(config.colors.error).setTitle('🗑️ Rol Silindi!')
      .setDescription(`**${r.name}** (\`${r.id}\`)\n👮 ${a ? `${a.executor} (\`${a.executor.tag}\`)` : 'Bilinmiyor'}`).setTimestamp());
    await logger.patlamaKontrol(r.guild, 'rol-silme').catch(() => {});
  } catch {}
});
client.on('roleUpdate', async (e, y) => {
  try {
    const degisen = [];
    if (e.name !== y.name) degisen.push(`İsim: **${e.name}** → **${y.name}**`);
    if (e.color !== y.color) degisen.push(`Renk: \`${e.hexColor}\` → \`${y.hexColor}\` 🎨`);
    if (e.permissions.bitfield !== y.permissions.bitfield) {
      const yeni = y.permissions.toArray().filter(p => !e.permissions.toArray().includes(p));
      const giden = e.permissions.toArray().filter(p => !y.permissions.toArray().includes(p));
      if (yeni.length) degisen.push(`➕ İzin: ${yeni.map(p => `\`${p}\``).join(', ')}`);
      if (giden.length) degisen.push(`➖ İzin: ${giden.map(p => `\`${p}\``).join(', ')}`);
      if (yeni.includes('Administrator')) degisen.push(`🚨 **YÖNETİCİ İZNİ VERİLDİ!**`);
    }
    if (!degisen.length) return;
    const a = await logger.executorBul(y.guild, AuditLogEvent.RoleUpdate, y.id).catch(() => null);
    await logger.gonder(y.guild, new EmbedBuilder().setColor(config.colors.warn).setTitle('🎭 Rol Güncellendi')
      .setDescription(`<@&${y.id}> **${y.name}**\n👮 ${a ? `${a.executor}` : 'Bilinmiyor'}\n\n${degisen.join('\n').slice(0, 1500)}`).setTimestamp());
  } catch {}
});

client.on('guildUpdate', async (e, y) => {
  try {
    const degisen = [];
    if (e.name !== y.name) degisen.push(`İsim: **${e.name}** → **${y.name}**`);
    if (e.icon !== y.icon) degisen.push(`🖼️ Sunucu fotoğrafı değişti`);
    if (e.banner !== y.banner) degisen.push(`🏞️ Banner değişti`);
    if (e.verificationLevel !== y.verificationLevel) degisen.push(`🔒 Doğrulama: **${y.verificationLevel}**`);
    if (!degisen.length) return;
    const a = await logger.executorBul(y, AuditLogEvent.GuildUpdate, y.id).catch(() => null);
    await logger.gonder(y, new EmbedBuilder().setColor(config.colors.warn).setTitle('⚙️ Sunucu Ayarı Değişti')
      .setDescription(`👮 ${a ? `${a.executor}` : 'Bilinmiyor'}\n\n${degisen.join('\n')}`).setTimestamp());
  } catch {}
});

client.on('inviteCreate', async (i) => {
  try {
    await logger.gonder(i.guild, new EmbedBuilder().setColor(config.colors.success).setTitle('🔗 Davet Oluşturuldu')
      .setDescription(`\`${i.code}\` → ${i.channel}\n👮 ${i.inviter || 'Bilinmiyor'}\n⏳ Süre: ${i.maxAge ? `${i.maxAge}sn` : 'Süresiz'} • 🎟️ ${i.maxUses || 'sınırsız'} kullanım`).setTimestamp());
  } catch {}
});
client.on('inviteDelete', async (i) => {
  try {
    await logger.gonder(i.guild, new EmbedBuilder().setColor(config.colors.error).setTitle('🗑️ Davet Silindi')
      .setDescription(`\`${i.code}\` → ${i.channel}`).setTimestamp());
  } catch {}
});

client.on('voiceStateUpdate', async (e, y) => {
  try {
    if (!y.guild || y.member.user.bot) return;
    if (!e.channel && y.channel) {
      await logger.gonder(y.guild, new EmbedBuilder().setColor(config.colors.success).setTitle('🔊 Sese Girdi').setDescription(`${y.member} → **${y.channel.name}**`).setTimestamp());
    } else if (e.channel && !y.channel) {
      await logger.gonder(y.guild, new EmbedBuilder().setColor(config.colors.error).setTitle('🔇 Sesten Çıktı').setDescription(`${y.member} ← **${e.channel.name}**`).setTimestamp());
    } else if (e.channel && y.channel && e.channel.id !== y.channel.id) {
      await logger.gonder(y.guild, new EmbedBuilder().setColor(config.colors.main).setTitle('🔀 Ses Değiştirdi').setDescription(`${y.member}: **${e.channel.name}** → **${y.channel.name}**`).setTimestamp());
    }
  } catch {}
});

// ---- Slash + Buton + Menü + Modal ----
client.on('userUpdate', async (eski, yeni) => {
  try {
    if (!eski || eski.username === yeni.username) return;
    const yeniAd = yeni.username.toLocaleLowerCase('tr');
    for (const [, guild] of client.guilds.cache) {
      try {
        const ts = getGuild(guild.id).tagSistemi;
        if (!ts || !ts.tag || !ts.rolId) continue;
        const uye = await guild.members.fetch(yeni.id).catch(() => null);
        if (!uye || uye.user.bot) continue;
        const rol = guild.roles.cache.get(ts.rolId);
        if (!rol) continue;
        const varMi = yeniAd.includes(String(ts.tag).toLocaleLowerCase('tr'));
        if (varMi && !uye.roles.cache.has(rol.id)) await uye.roles.add(rol).catch(() => {});
        else if (!varMi && uye.roles.cache.has(rol.id)) await uye.roles.remove(rol).catch(() => {});
      } catch {}
    }
  } catch {}
});
// ---- Güvenlik logu (güvenlik kanalı → yoksa log kanalı) ----
async function guvenlikLog(guild, baslik, aciklama) {
  try {
    const g = getGuild(guild.id);
    const k = guild.channels.cache.get(g.guvenlikKanal || g.logKanal);
    if (k && k.isTextBased()) {
      await k.send({ embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle(baslik).setDescription(aciklama).setTimestamp()] }).catch(() => {});
    }
  } catch {}
}

// ---- Limit takip (yasak/atma/kanal/rol) ----
const limitMap = new Map(); // `${gid}_${uid}_${tur}` -> [timestamp]
function limitKaydet(gid, uid, tur, sayi, dakika) {
  const key = `${gid}_${uid}_${tur}`;
  const simdi = Date.now();
  const pencere = Math.max(1, dakika || 1) * 60_000;
  const arr = (limitMap.get(key) || []).filter((t) => simdi - t < pencere);
  arr.push(simdi);
  if (limitMap.size > 5000) limitMap.clear();
  limitMap.set(key, arr);
  return arr.length;
}
async function limitCeza(guild, executor, turAd, detay) {
  try {
    if (!executor || executor.bot) return;
    if (executor.id === guild.ownerId) return;
    const uye = await guild.members.fetch(executor.id).catch(() => null);
    if (uye && !uye.permissions.has(PermissionFlagsBits.Administrator)) {
      const enUst = guild.members.me.roles.highest;
      const alinacak = [...uye.roles.cache.values()].filter((r) => r.id !== guild.id && !r.managed && r.position < enUst.position);
      for (const r of alinacak) await uye.roles.remove(r, 'Limit aşımı: ' + turAd).catch(() => {});
      await uye.timeout(10 * 60_000, 'Limit aşımı: ' + turAd).catch(() => {});
    }
    guvenlikLog(guild, '🚨 Limit Aşımı: ' + turAd,
      `${executor} (\`${executor.tag}\`)\n${detay || ''}\nRoller alındı + 10dk susturma uygulandı.`).catch(() => {});
  } catch {}
}
function limitKontrol(guild, executor, tur, turAd, sayi, dakika, detay) {
  if (!executor || executor.bot) return;
  const n = limitKaydet(guild.id, executor.id, tur, sayi, dakika);
  if (n === (Math.max(1, sayi || 3) + 1)) limitCeza(guild, executor, turAd, detay);
}
async function sonExecutor(guild, tip, ms = 10000) {
  try {
    const logs = await guild.fetchAuditLogs({ type: tip, limit: 3 });
    return logs.entries.find((x) => Date.now() - x.createdTimestamp < ms) || null;
  } catch { return null; }
}

// ---- Yasaklama / Atma / Kanal / Rol limitleri ----
client.on('guildBanAdd', async (ban) => {
  try {
    const g = getGuild(ban.guild.id);
    if (!g.govYasak) return;
    const audit = await require('./src/logger').executorBul(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id).catch(() => null);
    if (!audit || !audit.executor) return;
    limitKontrol(ban.guild, audit.executor, 'yasak', 'Yasaklama Limiti',
      g.govYasakSayi || 3, g.govYasakDakika || 1, `Hedef: ${ban.user.tag}`);
  } catch {}
});
client.on('guildMemberRemove', async (member) => {
  try {
    const g = getGuild(member.guild.id);
    if (!g.govAtma) return;
    const audit = await require('./src/logger').executorBul(member.guild, AuditLogEvent.MemberKick, member.id).catch(() => null);
    if (!audit || !audit.executor) return; // kendi ayrıldı
    limitKontrol(member.guild, audit.executor, 'atma', 'Atma Limiti',
      g.govAtmaSayi || 3, g.govAtmaDakika || 1, `Hedef: ${member.user ? member.user.tag : member.id}`);
  } catch {}
});
client.on('channelCreate', async (kanal) => {
  try {
    if (!kanal.guild) return;
    const g = getGuild(kanal.guild.id);
    if (!g.govKanal) return;
    const e = await sonExecutor(kanal.guild, AuditLogEvent.ChannelCreate).catch(() => null);
    if (!e || !e.executor) return;
    limitKontrol(kanal.guild, e.executor, 'kanal', 'Kanal Limitlemeleri',
      g.govKanalSayi || 3, g.govKanalDakika || 1, `Kanal açıldı: #${kanal.name}`);
  } catch {}
});
client.on('channelDelete', async (kanal) => {
  try {
    if (!kanal.guild) return;
    const g = getGuild(kanal.guild.id);
    if (!g.govKanal) return;
    const e = await sonExecutor(kanal.guild, AuditLogEvent.ChannelDelete).catch(() => null);
    if (!e || !e.executor) return;
    limitKontrol(kanal.guild, e.executor, 'kanal', 'Kanal Limitlemeleri',
      g.govKanalSayi || 3, g.govKanalDakika || 1, `Kanal silindi: #${kanal.name}`);
  } catch {}
});
client.on('roleCreate', async (rol) => {
  try {
    const g = getGuild(rol.guild.id);
    if (!g.govRol) return;
    const e = await sonExecutor(rol.guild, AuditLogEvent.RoleCreate).catch(() => null);
    if (!e || !e.executor) return;
    limitKontrol(rol.guild, e.executor, 'rol', 'Rol Limitlemeleri',
      g.govRolSayi || 3, g.govRolDakika || 1, `Rol açıldı: @${rol.name}`);
  } catch {}
});
client.on('roleDelete', async (rol) => {
  try {
    const g = getGuild(rol.guild.id);
    if (!g.govRol) return;
    const e = await sonExecutor(rol.guild, AuditLogEvent.RoleDelete).catch(() => null);
    if (!e || !e.executor) return;
    limitKontrol(rol.guild, e.executor, 'rol', 'Rol Limitlemeleri',
      g.govRolSayi || 3, g.govRolDakika || 1, `Rol silindi: @${rol.name}`);
  } catch {}
});

// ---- Anti-Webhook: izinsiz webhookları sil ----
client.on('webhooksUpdate', async (kanal) => {
  try {
    if (!kanal.guild) return;
    const g = getGuild(kanal.guild.id);
    if (!g.govWebhook) return;
    const e = await sonExecutor(kanal.guild, AuditLogEvent.WebhookCreate).catch(() => null);
    if (!e || !e.executor || e.executor.bot || e.executor.id === client.user.id) return;
    const wh = await kanal.fetchWebhooks().catch(() => null);
    const hedef = wh && e.target && e.target.id ? wh.get(e.target.id) : null;
    if (hedef && (!hedef.owner || hedef.owner.id !== client.user.id)) {
      await hedef.delete('Anti-Webhook: izinsiz').catch(() => {});
      guvenlikLog(kanal.guild, '🔗 İzinsiz Webhook Silindi',
        `${e.executor} (\`${e.executor.tag}\`)\n#${kanal.name} kanalındaki izinsiz webhook kaldırıldı.`).catch(() => {});
    }
  } catch {}
});

// ---- Emoji/Sticker limiti: yetkisiz eklemeleri kaldır ----
async function medyaDenetle(guild, tip, hedef, ad) {
  try {
    const g = getGuild(guild.id);
    if (!g.govEmoji) return;
    const e = await sonExecutor(guild, tip).catch(() => null);
    if (!e || !e.executor || e.executor.bot || e.executor.id === client.user.id) return;
    const uye = await guild.members.fetch(e.executor.id).catch(() => null);
    if (uye && uye.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) return;
    await hedef.delete('Emoji Limiti: yetkisiz ekleme').catch(() => {});
    guvenlikLog(guild, '☺️ Yetkisiz Medya Kaldırıldı',
      `${e.executor} (\`${e.executor.tag}\`)\nİzinsiz eklenen ${ad} kaldırıldı.`).catch(() => {});
  } catch {}
}
client.on('emojiCreate', async (emoji) => {
  await medyaDenetle(emoji.guild, AuditLogEvent.EmojiCreate, emoji, 'emoji');
});
client.on('stickerCreate', async (sticker) => {
  await medyaDenetle(sticker.guild, AuditLogEvent.StickerCreate, sticker, 'sticker');
});

// ---- Emoji Rol: tepki verene rol ver / alınca geri al ----
function emojiEsles(kayit, emoji) {
  if (!kayit || !emoji) return false;
  const k = String(kayit).trim();
  const idEsles = k.match(/(\d{15,25})/);
  if (idEsles) return String(emoji.id) === idEsles[1];
  if (emoji.id) return false;
  return emoji.name === k;
}
async function tepkiEsles(guild, reaction, user) {
  try {
    if (!guild || !user || user.bot) return null;
    const g = getGuild(guild.id);
    const liste = g.emojiRoller || [];
    if (!liste.length) return null;
    if (reaction.partial) await reaction.fetch().catch(() => null);
    const kanalId = reaction.message.channelId;
    const mesajId = reaction.message.id;
    for (const k of liste) {
      if (k.kanal && String(k.kanal) !== String(kanalId)) continue;
      if (k.mesajId && String(k.mesajId) !== String(mesajId)) continue;
      if (!emojiEsles(k.emoji, reaction.emoji)) continue;
      const rol = guild.roles.cache.get(String(k.rol).replace(/\D/g, ''));
      if (!rol || rol.managed) continue;
      if (rol.position >= guild.members.me.roles.highest.position) continue;
      const uye = await guild.members.fetch(user.id).catch(() => null);
      if (!uye || uye.user.bot) continue;
      return { uye, rol };
    }
  } catch {}
  return null;
}
client.on('messageReactionAdd', async (reaction, user) => {
  const r = await tepkiEsles(reaction.message.guild, reaction, user).catch(() => null);
  if (r) await r.uye.roles.add(r.rol, 'Emoji rol').catch(() => {});
});
client.on('messageReactionRemove', async (reaction, user) => {
  const r = await tepkiEsles(reaction.message.guild, reaction, user).catch(() => null);
  if (r) await r.uye.roles.remove(r.rol, 'Emoji rol').catch(() => {});
});
async function emojiRolTepkiKoy(guild, onlyIndex = -1) {
  const sonuc = [];
  try {
    const g = getGuild(guild.id);
    const liste = g.emojiRoller || [];
    for (let i = 0; i < liste.length; i++) {
      if (onlyIndex >= 0 && i !== onlyIndex) continue;
      const k = liste[i];
      try {
        const kanal = guild.channels.cache.get(String(k.kanal));
        if (!kanal || !kanal.isTextBased()) { sonuc.push({ i, ok: false, hata: 'kanal-yok' }); continue; }
        const mesaj = await kanal.messages.fetch(String(k.mesajId)).catch(() => null);
        if (!mesaj) { sonuc.push({ i, ok: false, hata: 'mesaj-yok' }); continue; }
        const em = String(k.emoji).trim();
        const idEsles = em.match(/(\d{15,25})/);
        const tepki = idEsles ? (guild.emojis.cache.get(idEsles[1]) || idEsles[1]) : em;
        await mesaj.react(tepki).catch(() => { throw new Error('tepki-olmadi'); });
        sonuc.push({ i, ok: true });
      } catch (e) { sonuc.push({ i, ok: false, hata: 'tepki-olmadi' }); }
    }
  } catch {}
  return sonuc;
}

client.on('interactionCreate', async (interaction) => {
  try {
    // 1) Slash komutlar
    if (interaction.isChatInputCommand()) {
      return slash.handleSlash(interaction, client, slash.getSlashHarita());
    }
    // 2) Modallar (partner başvuru + ret sebebi)
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'pv2_modal' || interaction.customId.startsWith('pv2_redmodal_')) {
        const p = require('./commands/partner');
        return p.handlePv2Modal(interaction, client);
      }
      return;
    }
    // Yardım menüsü index'te değil, komut içindeki collector bakıyor — ama süresi dolarsa burası yedek
    if (interaction.isStringSelectMenu() && interaction.customId === 'yardim_menu') {
      const { yardimEmbed, yardimRow } = require('./commands/genel');
      await interaction.update({ embeds: [await yardimEmbed(client, interaction.values[0])], components: yardimRow(client) }).catch(() => {});
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
      const arr = require('./commands/ticket');
      const internal = arr.find(c => c.name === '__ticket_internal__');
      if (internal?.select) return internal.select(interaction, client);
    }
    if (interaction.isButton()) {
      if (interaction.customId === 'pv2_basvuru' || interaction.customId.startsWith('pv2_onay_') || interaction.customId.startsWith('pv2_red_')) {
        const p = require('./commands/partner');
        return p.handlePv2Button(interaction, client);
      }
      if (interaction.customId.startsWith('duel_kabul_') || interaction.customId.startsWith('duel_red_')) {
        const y = require('./commands/yeni');
        return y.handleDuelButton(interaction, client);
      }
      if (interaction.customId.startsWith('rep_bildirim_ac_') || interaction.customId.startsWith('rep_bildirim_kapat_')) {
        const r = require('./commands/itibar');
        return r.repBildirimButon(interaction, client);
      }
      if (interaction.customId === 'sunucu_kur_onay' || interaction.customId === 'sunucu_kur_iptal') {
        const s = require('./commands/sunucu');
        return s.handleSunucuButton(interaction, client);
      }
      if (interaction.customId.startsWith('gv_')) {
        const gv = require('./commands/guvenlik');
        return gv.handleGuvButton(interaction, client);
      }
      if (interaction.customId.startsWith('cekilis_katil_')) {
        const ck = require('./commands/cekilis');
        return ck.handleCekilisButton(interaction, client);
      }
      if (interaction.customId.startsWith('rolal_')) {
        const rl = require('./commands/roller');
        return rl.handleRolAlButton(interaction, client);
      }
      if (interaction.customId.startsWith('partner_kabul_') || interaction.customId.startsWith('partner_red_')) {
        const arr = require('./commands/partner');
        const internal = arr.find(c => c.name === '__partner_button__');
        if (internal?.button) return internal.button(interaction, client);
      }
      if (interaction.customId === 'ticket_kapat' || interaction.customId === 'ticket_kilit') {
        const arr = require('./commands/ticket');
        const internal = arr.find(c => c.name === '__ticket_internal__');
        if (internal?.button) return internal.button(interaction, client);
      }
    }
  } catch (e) { console.error('Interaction hatası:', e); }
});

if (!config.token) {
  console.error('❌ TOKEN yok! .env dosyasına TOKEN=... yaz.');
  process.exit(1);
}
client.login(config.token).catch(e => {
  console.error('❌ Giriş başarısız! Tokeni kontrol et:', e.message);
});
