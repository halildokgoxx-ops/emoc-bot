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
const { kufurMu, linkMu, dolandiriciMi, otoEslesme } = require('./src/utils');
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
const xpSogumaMap = new Map(); // `${gid}_${uid}` -> son XP zamanı (seviye bekleme süresi)
async function seviyeMesajGonder(guild, user, level, odulRol, yedekKanal) {
  try {
    const gAyar = getGuild(guild.id);
    const sablon = String(gAyar.seviyeMesaj || '').trim();
    const degis = (s) => String(s)
      .split('{user}').join(String(user))
      .split('{kullanıcı}').join(user.username)
      .split('{kullanici}').join(user.username)
      .split('{ad}').join(user.username)
      .split('{level}').join(String(level))
      .split('{seviye}').join(String(level))
      .split('{xp}').join('0')
      .split('{sunucu}').join(guild.name);
    const roket = E(client, 'roket', '🚀');
    const parti = E(client, 'parti', '🎉');
    const aciklama = (sablon ? degis(sablon) : String(user) + ' **Sv.' + level + '** oldu! GG!\n' + (odulRol ? '\u{1F3AD} Ödül rolü kazandın: ' + odulRol : '\u{1F4A1} Ödüllü seviyeler için /seviye-rol liste yaz!')).slice(0, 4000);
    const { EmbedBuilder: EBSEV } = require('discord.js');
    const emb = new EBSEV().setColor(config.colors.gold)
      .setTitle(roket + ' SEVİYE ATLADI! ' + parti)
      .setThumbnail(user.displayAvatarURL({ size: 128 }))
      .setDescription(aciklama)
      .setFooter({ text: 'Emoç • Seviye Sistemi' }).setTimestamp();
    if (gAyar.seviyeOzel) {
      const dmK = await user.send({ embeds: [emb] }).catch(() => null);
      if (dmK) return;
    }
    const hedefKanal = (gAyar.seviyeKanal || gAyar.levelBildirimKanal)
      ? (guild.channels.cache.get(gAyar.seviyeKanal || gAyar.levelBildirimKanal) || yedekKanal || null)
      : (yedekKanal || null);
    if (hedefKanal && hedefKanal.isTextBased()) await hedefKanal.send({ embeds: [emb] }).catch(() => {});
  } catch {}
} // `${gid}_${uid}` -> son XP zamanı (seviye bekleme süresi)
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
// ---- Sunucu özel ön eki (premium) ----
function sunucuPrefix(gid) {
  try {
    const ozel = String(getGuild(gid).prefix || '').trim();
    if (ozel && premiumMu(gid)) return ozel.slice(0, 5);
  } catch {}
  return config.prefix;
}
const amIhlalMap = new Map(); // `${gid}_${uid}_${kural}` -> { sayi, son }
const amFloodMap = new Map(); // flood penceresi: userId -> [ts]
const amFotoMap = new Map(); // foto penceresi: userId -> [ts]
function amCfg(g, ad) {
  const v = g[ad];
  return (v && typeof v === 'object') ? v : null;
}
async function amKuralIslet(message, kural, cfg, sebepKisa) {
  const gid = message.guild.id, uid = message.author.id;
  if (cfg.mesajSil !== false) await message.delete().catch(() => {});
  const key = gid + '_' + uid + '_' + kural;
  const simdi = Date.now();
  let k = amIhlalMap.get(key);
  if (!k || simdi - k.son > 5 * 60_000) k = { sayi: 0, son: 0 };
  k.sayi++;
  k.son = simdi;
  amIhlalMap.set(key, k);
  if (amIhlalMap.size > 5000) amIhlalMap.clear();
  const uyari = Math.max(1, parseInt(cfg.uyari, 10) || 3);
  const neden = 'AutoMod ' + kural + ': ' + sebepKisa;
  const logla = async (ek) => {
    try {
      const w = await message.channel.send(ek).catch(() => null);
      if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
    } catch {}
  };
  if (k.sayi < uyari) {
    await logla(message.author + ' \u26A0\uFE0F ' + sebepKisa + ' (' + k.sayi + '/' + uyari + ')');
    return;
  }
  amIhlalMap.delete(key);
  // 🧠 Akıllı ceza: tekrar suçluda süre katlanır (son 7 gün siciline göre 1x/2x/4x)
  let carpan = 1;
  try { carpan = require('./src/koruma').tekrarCarpani(uid); } catch {}
  try {
    if (cfg.yasakla) {
      await message.guild.members.ban(uid, { reason: neden }).catch(() => {});
      try { require('./src/db').cezaKaydet(uid, 'ban', `AutoMod ${kural}: ${sebepKisa}`); } catch {}
      await logla(message.author + ' \u26D4 yasakland\u0131! (' + sebepKisa + ')');
    } else if (cfg.sunucudanAt) {
      await message.member.kick(neden).catch(() => {});
      try { require('./src/db').cezaKaydet(uid, 'kick', `AutoMod ${kural}: ${sebepKisa}`); } catch {}
      await logla(message.author + ' sunucudan at\u0131ld\u0131! (' + sebepKisa + ')');
    } else {
      const sure = Math.min(24 * 3600_000, 10 * 60_000 * carpan);
      const sureYaz = sure >= 3600000 ? `${Math.round(sure / 3600000)}sa` : `${Math.round(sure / 60000)}dk`;
      await message.member.timeout(sure, neden).catch(() => {});
      try { require('./src/db').cezaKaydet(uid, 'mute', `${sureYaz} • AutoMod ${kural}: ${sebepKisa}`); } catch {}
      await logla(message.author + ` ${sureYaz} susturuldu! (${sebepKisa})${carpan > 1 ? ` 🔁 tekrar suçlu (x${carpan})` : ''}`);
    }
  } catch {}
  if (!require('./src/logger').logOlayAcik(gid, 'modAuto')) return;
  try {
    const gg = getGuild(gid);
    const lk = gg.guvenlikKanal || gg.logKanal ? message.guild.channels.cache.get(gg.guvenlikKanal || gg.logKanal) : null;
    if (lk && lk.isTextBased()) {
      const { EmbedBuilder: EB } = require('discord.js');
      await lk.send({ embeds: [new EB().setColor(0xff3d71).setTitle('\u{1F6E1}\uFE0F AutoMod cezas\u0131').setDescription(message.author.tag + ' (\u0060' + uid + '\u0060)\nKural: **' + kural + '**\nSebep: ' + sebepKisa).setTimestamp()] }).catch(() => {});
    }
  } catch {}
}
async function otoCeza(message, sebep) {
  try {
    await message.member.timeout(10 * 60_000, 'Üst üste kural ihlali: ' + sebep).catch(() => {});
    try { require('./src/db').cezaKaydet(message.author.id, 'mute', `10dk • ${sebep}`); } catch {}
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
  // Ticket oto-kapatma taraması (10dk'da bir, X gün inaktif ticketları kapatır)
  setInterval(async () => {
    try {
      const { db, save: _save } = require('./src/db');
      const d = db();
      for (const [gid, gg] of Object.entries(d.guilds || {})) {
        const tk = gg.ticket;
        if (!tk || !tk.otoKapat || !tk.acik) continue;
        const guild = client.guilds.cache.get(gid);
        if (!guild) continue;
        for (const [uid, vv] of Object.entries(tk.acik)) {
          const kay = (vv && typeof vv === 'object') ? vv : null;
          if (!kay || !kay.sonAktivite) continue;
          if (Date.now() - kay.sonAktivite < tk.otoKapat * 86400_000) continue;
          const kanal = guild.channels.cache.get(kay.kanal);
          if (!kanal) { delete tk.acik[uid]; _save(); continue; }
          try {
            await require('./commands/ticket').ticketKapatAkis(guild, kanal, {
              sahipId: uid, kapatan: '⏰ Oto-kapatma', sebep: `${tk.otoKapat} gün inaktiflik`,
            });
          } catch {}
        }
      }
    } catch {}
  }, 10 * 60_000);
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
  // Günün anime + oyun önerisi (10dk'da bir kontrol, kanalı ayarlıysa günde 1 kez)
  setInterval(() => {
    try { require('./src/oneriler').oneriTara(client); } catch {}
  }, 10 * 60_000);
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
  // Boost-premium doğrulama (saatte bir: boostu çekenin premiumu iptal!)
  setInterval(async () => {
    try {
      const r = await require('./src/koruma').boostDogrula(client);
      if (r.revoke.length) console.log(`🛡️ ${r.revoke.length} haksız boost-premium iptal: ${r.revoke.join(',')}`);
    } catch {}
  }, 3600_000);
});

// ---- Mesaj sistemi ----
client.on('messageCreate', async (message) => {
  try {
    if (!message.guild || message.author.bot) return;
    // --- Partner chat tetikleyici (butonlu başvuru daveti) ---
    try { require('./commands/partner').maybePartnerPrompt(message); } catch {}
    // --- Partner sayaç: yetkilinin davetli texti → +1 ---
    try { require('./commands/partner').maybePartnerSkor(message); } catch {}
    const prefix = sunucuPrefix(message.guild.id);
    const g = getGuild(message.guild.id);
    const u = getUser(message.guild.id, message.author.id);

    // --- AFK çıkışı ---
    if (u.afk) {
      u.afk = null; save();
      message.reply(`👋 Tekrar hoşgeldin ${message.author}! AFK modundan çıktın.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
    }
    // --- 🤫 İtiraf kanalı: yazanı sil, hesaplı/gizli seçim sor ---
    try {
      const ggI = getGuild(message.guild.id);
      if (ggI.itirafKanal && message.channel.id === ggI.itirafKanal && !message.content.startsWith(prefix)) {
        const yazi = String(message.content || '').trim().slice(0, 1500);
        if (yazi) {
          await message.delete().catch(() => {});
          await require('./commands/ozel').itirafSecimSor(message.channel, message.author, yazi);
        }
        return;
      }
    } catch {}
    // --- Ticket aktivite damgası (oto-kapatma sayacı) ---
    try {
      const tk0 = g.ticket;
      if (tk0 && tk0.acik) {
        for (const vv0 of Object.values(tk0.acik)) {
          const kk0 = (vv0 && typeof vv0 === 'object') ? vv0 : null;
          if (kk0 && kk0.kanal === message.channel.id) { kk0.sonAktivite = Date.now(); save(); break; }
        }
      }
    } catch {}
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
    const hizCarpan = premiumMu(message.guild.id) ? Math.max(1, Math.min(5, gg.seviyeHiz || 1)) : 1;
    const xpCarpan = (premiumMu(message.guild.id) ? 2 : 1) * hizCarpan;
    const xpMin = Math.max(1, Math.min(200, gg.xpMin || 5));
    const xpMax = Math.max(xpMin, Math.min(200, gg.xpMax || 15));
    const xpSog = Math.max(0, Math.min(600, gg.xpSoguma || 0)) * 1000;
    const xpKey = `${message.guild.id}_${message.author.id}`;
    let xpKazan = 0;
    if (gg.mesajXP !== false && Date.now() - (xpSogumaMap.get(xpKey) || 0) >= xpSog) {
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
      await seviyeMesajGonder(message.guild, message.author, u.level, odulRol, message.channel);
    }
    // Günlük/haftalık görev ilerleme (mesaj)
    try {
      await require('./src/gorev').gorevIlerle(client, message.guild, message.author.id, 1, 'mesaj',
        (t) => message.reply(t).catch(() => {}));
    } catch {}
    save();

    // ================= OTO-MOD (prefix yoksa da çalışır) =================
    const uyeYetkili = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);
    const muafRol = (liste) => (liste || []).some((id) => message.member?.roles.cache.has(id));
    const muafKanal = (liste) => (liste || []).includes(message.channel.id);
    const dokunulmaz = uyeYetkili || muafRol(g.yoneticiRol) || muafRol(g.moderatorRol);
    const icerik = message.content || '';
    const icerikLow = icerik.toLocaleLowerCase('tr');
    const amMuafR = (...ls) => ls.some((l) => muafRol(l));
    const amMuafK = (...ls) => ls.some((l) => muafKanal(l));
    const cfgKelime = amCfg(g, 'amKelime');
    const cfgKufur = amCfg(g, 'amKufur');
    const cfgReklam = amCfg(g, 'amReklam');
    const cfgLink = amCfg(g, 'amLink');
    const cfgCaps = amCfg(g, 'amCaps');
    const cfgTekrar = amCfg(g, 'amTekrar');
    const cfgFlood = amCfg(g, 'amFlood');
    const cfgEmoji = amCfg(g, 'amEmoji');
    const cfgEtiket = amCfg(g, 'amEtiket');
    const cfgUzun = amCfg(g, 'amUzun');
    const cfgKarakter = amCfg(g, 'amKarakter');
    const cfgFoto = amCfg(g, 'amFoto');
    if (!dokunulmaz) {
      // Yasakli kelime (+panel listesi)
      {
        const kelimeler = [...(g.yasakli || []), ...((cfgKelime && cfgKelime.kelimeler) || [])].map((k) => String(k).toLocaleLowerCase('tr')).filter(Boolean);
        if (kelimeler.length && kelimeler.some((k) => icerikLow.includes(k)) && !amMuafR(cfgKelime && cfgKelime.muafRol, g.yasakMuaf) && !amMuafK(cfgKelime && cfgKelime.muafKanal, g.yasakMuafKanal)) {
          if (cfgKelime) {
            if (cfgKelime.enabled) { await amKuralIslet(message, 'kelime', cfgKelime, 'Yasakli kelime'); return; }
          } else {
            await message.delete().catch(() => {});
            const w = await message.channel.send(message.author + ' \u{1F6AB} Yasakl\u0131 kelime kulland\u0131n!').catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
            return;
          }
        }
      }
      // Kufur
      if (kufurMu(icerik) && !amMuafR(cfgKufur && cfgKufur.muafRol, g.kufurMuaf) && !amMuafK(cfgKufur && cfgKufur.muafKanal, g.kufurMuafKanal)) {
        if (cfgKufur) {
          if (cfgKufur.enabled) { await amKuralIslet(message, 'kufur', cfgKufur, 'K\u00FCf\u00FCr yasak!'); return; }
        } else if (g.antiKufur) {
          await message.delete().catch(() => {});
          const n = ihlalKaydet(message.guild.id, message.author.id);
          if (n >= 3) {
            ihlalMap.delete(message.guild.id + '_' + message.author.id);
            await otoCeza(message, '\u00FCst \u00FCste k\u00FCf\u00FCr (3/3)');
          } else {
            const w = await message.channel.send(message.author + ' \u{1F921} K\u00FCf\u00FCr yasak! (' + n + '/3)').catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
          }
          return;
        }
      }
      // Reklam / dolandiricilik metni
      if (dolandiriciMi(icerik) && !amMuafR(cfgReklam && cfgReklam.muafRol, g.linkMuaf) && !amMuafK(cfgReklam && cfgReklam.muafKanal, g.linkMuafKanal)) {
        if (cfgReklam) {
          if (cfgReklam.enabled) { await amKuralIslet(message, 'reklam', cfgReklam, 'Reklam/doland\u0131r\u0131c\u0131l\u0131k'); return; }
        } else if (!cfgLink && g.antiLink) {
          await message.delete().catch(() => {});
          const n = ihlalKaydet(message.guild.id, message.author.id);
          if (n >= 3) {
            ihlalMap.delete(message.guild.id + '_' + message.author.id);
            await otoCeza(message, 'doland\u0131r\u0131c\u0131l\u0131k linki (3/3)');
          } else {
            const w = await message.channel.send(message.author + ' \u{1F6A8} Sahte link tuza\u011F\u0131 yasak! Hesab\u0131n\u0131 \u00E7ald\u0131rma, bu linklere TIKLAMA! (' + n + '/3)').catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 6000);
          }
          return;
        }
      }
      // Linkler
      if (linkMu(icerik) && !amMuafR(cfgLink && cfgLink.muafRol, g.linkMuaf) && !amMuafK(cfgLink && cfgLink.muafKanal, g.linkMuafKanal)) {
        if (cfgLink) {
          if (cfgLink.enabled) { await amKuralIslet(message, 'link', cfgLink, 'Link atmak yasak!'); return; }
        } else if (!cfgReklam && g.antiLink) {
          await message.delete().catch(() => {});
          const n = ihlalKaydet(message.guild.id, message.author.id);
          if (n >= 3) {
            ihlalMap.delete(message.guild.id + '_' + message.author.id);
            await otoCeza(message, '\u00FCst \u00FCste link (3/3)');
          } else {
            const w = await message.channel.send(message.author + ' \u{1F517} Link atmak yasak! (' + n + '/3)').catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
          }
          return;
        }
      }
      // Davet Korumasi (premium): izinsiz davet linklerini sil
      if (g.govDavet && !muafRol(g.davetMuaf)) {
        try {
          if (premiumMu(message.guild.id) && /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/\S+/i.test(icerik)) {
            await message.delete().catch(() => {});
            const w = await message.channel.send(message.author + ' \u{1F517} Davet payla\u015F\u0131m\u0131 korumal\u0131, sildim!').catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
            return;
          }
        } catch {}
      }
      // Caps
      if (icerik.length >= 8 && !amMuafR(cfgCaps && cfgCaps.muafRol, g.capsMuaf) && !amMuafK(cfgCaps && cfgCaps.muafKanal, g.capsMuafKanal)) {
        const harf = icerik.replace(/[^a-zA-Z\u00E7\u00C7\u011F\u011E\u0131\u0130\u00F6\u00D6\u015F\u015E\u00FC\u00DC]/g, '');
        if (harf.length >= 6 && harf === harf.toUpperCase()) {
          if (cfgCaps) {
            if (cfgCaps.enabled) { await amKuralIslet(message, 'caps', cfgCaps, 'CAPS kapat!'); return; }
          } else if (g.capsEngel) {
            await message.delete().catch(() => {});
            const w = await message.channel.send(message.author + ' \u{1F520} CAPS kapat!').catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
            return;
          }
        }
      }
      // Tekrar spam (ayni mesaji 15sn icinde 3x)
      if (icerik.length > 5 && !amMuafR(cfgTekrar && cfgTekrar.muafRol, g.spamMuaf) && !amMuafK(cfgTekrar && cfgTekrar.muafKanal, g.spamMuafKanal)) {
        const simdi = Date.now();
        const s = sonMesajMap.get(message.author.id);
        if (s && s.icerik === icerik && simdi - s.zaman < 15000) {
          s.sayi++;
          s.zaman = simdi;
          if (s.sayi >= 3) {
            sonMesajMap.delete(message.author.id);
            if (cfgTekrar && cfgTekrar.enabled) { await amKuralIslet(message, 'tekrar', cfgTekrar, 'Ayn\u0131 mesaj\u0131 at\u0131p durma!'); return; }
            if (!cfgTekrar && g.antiSpam) {
              await message.delete().catch(() => {});
              const w = await message.channel.send(message.author + ' \u{1F4E2} Ayn\u0131 mesaj\u0131 at\u0131p durma!').catch(() => null);
              if (w) setTimeout(() => w.delete().catch(() => {}), 4000);
              return;
            }
          }
        } else {
          sonMesajMap.set(message.author.id, { icerik, sayi: 1, zaman: simdi });
        }
      }
      // Flood (hizli mesaj)
      if (!amMuafR(cfgFlood && cfgFlood.muafRol, g.spamMuaf) && !amMuafK(cfgFlood && cfgFlood.muafKanal, g.spamMuafKanal)) {
        if (cfgFlood && cfgFlood.enabled) {
          const pencere = Math.max(3, parseInt(cfgFlood.sure, 10) || 10) * 1000;
          const limit = Math.max(2, parseInt(cfgFlood.limit, 10) || 5);
          const simdi = Date.now();
          const arr = (amFloodMap.get(message.author.id) || []).filter((x) => simdi - x < pencere);
          arr.push(simdi);
          amFloodMap.set(message.author.id, arr);
          if (arr.length >= limit) {
            amFloodMap.set(message.author.id, []);
            await amKuralIslet(message, 'flood', cfgFlood, 'Flood yapma!');
            return;
          }
        } else if (!cfgFlood && g.antiSpam) {
          const simdi = Date.now();
          const arr = spamMap.get(message.author.id) || [];
          const taze = arr.filter((x) => simdi - x < 5000);
          taze.push(simdi);
          spamMap.set(message.author.id, taze);
          if (taze.length >= 5) {
            spamMap.set(message.author.id, []);
            await message.member.timeout(60_000, 'Spam').catch(() => {});
            const w = await message.channel.send(message.author + ' \u{1F4E2} Spam yapma! 1dk susturuldun.').catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
            return;
          }
        }
      }
      // Asiri emoji
      if (cfgEmoji && cfgEmoji.enabled && !amMuafR(cfgEmoji.muafRol) && !amMuafK(cfgEmoji.muafKanal)) {
        const say = ((icerik.match(/<a?:\w+:\d+>/g) || []).length) + ((icerik.match(/\p{Extended_Pictographic}/gu) || []).length);
        if (say > (parseInt(cfgEmoji.limit, 10) || 6)) { await amKuralIslet(message, 'emoji', cfgEmoji, '\u00C7ok fazla emoji!'); return; }
      }
      // Asiri etiketleme
      if (cfgEtiket && cfgEtiket.enabled && !amMuafR(cfgEtiket.muafRol) && !amMuafK(cfgEtiket.muafKanal)) {
        const say = message.mentions.users.size + message.mentions.roles.size + ((icerik.match(/@everyone|@here/g) || []).length);
        if (say > (parseInt(cfgEtiket.limit, 10) || 3)) { await amKuralIslet(message, 'etiket', cfgEtiket, '\u00C7ok fazla etiket!'); return; }
      }
      // Uzun metin
      if (cfgUzun && cfgUzun.enabled && !amMuafR(cfgUzun.muafRol) && !amMuafK(cfgUzun.muafKanal)) {
        if (icerik.split('\n').length > (parseInt(cfgUzun.limit, 10) || 6)) { await amKuralIslet(message, 'uzun', cfgUzun, '\u00C7ok uzun mesaj!'); return; }
      }
      // Karakter siniri
      if (cfgKarakter && cfgKarakter.enabled && !amMuafR(cfgKarakter.muafRol) && !amMuafK(cfgKarakter.muafKanal)) {
        if (icerik.length > (parseInt(cfgKarakter.limit, 10) || 500)) { await amKuralIslet(message, 'karakter', cfgKarakter, '\u00C7ok uzun mesaj!'); return; }
      }
      // Fotograf spami
      if (cfgFoto && cfgFoto.enabled && !amMuafR(cfgFoto.muafRol) && !amMuafK(cfgFoto.muafKanal)) {
        const adet = [...message.attachments.values()].filter((a) => (a.contentType || '').startsWith('image/')).length;
        if (adet > 0) {
          const simdi = Date.now();
          const arr = (amFotoMap.get(message.author.id) || []).filter((x) => simdi - x.t < 60000);
          for (let i = 0; i < adet; i++) arr.push({ t: simdi });
          amFotoMap.set(message.author.id, arr);
          if (arr.length >= (parseInt(cfgFoto.limit, 10) || 5)) {
            amFotoMap.set(message.author.id, []);
            await amKuralIslet(message, 'foto', cfgFoto, 'Foto\u011Fraf spam\u0131!');
            return;
          }
        }
      }
    }

    // ---- 🎮 Oyun kanalları (sayı-sayma + kelime-türetme, her sunucuda oto) ----
    try {
      const kanalAd = (message.channel.name || '').toLocaleLowerCase('tr');
      if (!message.content.startsWith(prefix)) {
        const OY = require('./src/oyun');
        if (kanalAd.includes('sayı-sayma') || kanalAd.includes('sayi-sayma')) {
          await OY.oyunSayi(message);
          return;
        }
        if (kanalAd.includes('kelime-türetme') || kanalAd.includes('kelime-turetme')) {
          await OY.oyunKelime(message);
          return;
        }
      }
    } catch {}
    // --- Oto-cevap (premium) ---
    try {
      const goc = getGuild(message.guild.id);
      if (goc.otoCevap && goc.otoCevap.length && !message.content.startsWith(prefix)) {
        const eslesme = goc.otoCevap.find((o) => o.tetik && otoEslesme(o.tetik, message.content, o.mod));
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
    // Bakım modu + kapalı komut (admin paneli)
    try {
      const dd = require('./src/db').db();
      if (dd.bakim && dd.bakim.aktif && !require('./src/premium').sahipMi(message.author.id)) {
        return message.reply('🛠️ Bot şu an **bakımda!** ' + String(dd.bakim.mesaj || 'Birazdan dönüyoruz.')).catch(() => {});
      }
      if ((dd.kapaliKomutlar || []).includes(cmd.name.toLowerCase())) {
        return message.reply('🔒 Bu komut yönetim tarafından kapatıldı!').catch(() => {});
      }
    } catch {}
    // Komut spam kalkanı (sahipler muaf): 8/10sn → uyar, 15/10sn → 5dk sustur
    try {
      if (!require('./src/premium').sahipMi(message.author.id)) {
        const son = require('./src/koruma').komutKontrol(message.author.id);
        if (son.durum === 'ceza') {
          await message.member.timeout(5 * 60_000, 'Komut spami').catch(() => {});
          try { require('./src/db').cezaKaydet(message.author.id, 'mute', '5dk • Komut spami'); } catch {}
          const m = await message.reply('🚨 Komut spami tespit edildi! **5dk susturuldun.**').catch(() => null);
          if (m) setTimeout(() => m.delete().catch(() => {}), 8000);
          return;
        }
        if (son.durum === 'yavas') {
          const m = await message.reply('⏳ Yavaşla! Çok hızlı komut kullanıyorsun.').catch(() => null);
          if (m) setTimeout(() => m.delete().catch(() => {}), 4000);
          return;
        }
      }
    } catch {}

    await cmd.run(message, args, client);
  } catch (e) {
    console.error('Komut hatası:', e);
    // Sadece komut denemesinde cevap ver — normal sohbete hata mesajı atma
    try {
      let pref = '!';
      try { pref = sunucuPrefix(message.guild.id); } catch {}
      if (message.content.startsWith(pref)) await message.reply('❌ Bir hata oldu! Sahibime söyle.');
    } catch {}
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
      if (getGuild(member.guild.id).yapiskan && premiumMu(member.guild.id)) {
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
      if (dm && !member.user.bot && premiumMu(member.guild.id)) {
        const txt = String(dm).replace(/{kullanıcı}/g, `${member}`).replace(/{sunucu}/g, member.guild.name).replace(/{üye}/g, `${member.guild.memberCount}`).slice(0, 1500);
        await member.send(txt).catch(() => {});
      }
    } catch {}
    // Oto-rol (+ premium çoklu)
    if (g.otoRol && g.otoRolAktif !== false) {
      const rol = member.guild.roles.cache.get(g.otoRol);
      if (rol) await member.roles.add(rol).catch(() => {});
    }
    if (g.otoRolCoklu && g.otoRolCoklu.length && premiumMu(member.guild.id)) {
      for (const rid of g.otoRolCoklu.slice(0, 3)) {
        const r = member.guild.roles.cache.get(rid);
        if (r) await member.roles.add(r).catch(() => {});
      }
    }
    // 🏷️ Takma ad araçları
    try {
      const tg = getGuild(member.guild.id);
      const botRol = member.guild.members.me.roles.highest;
      const degistirebilir = !member.user.bot && member.manageable && botRol;
      // İsim filtresi: yasaklı kelime varsa sunucudan çıkar
      if (tg.isimFiltre && Array.isArray(tg.isimKelimeler) && tg.isimKelimeler.length && !member.user.bot) {
        const ad = String(member.displayName || member.user.username).toLocaleLowerCase('tr');
        const kotu = tg.isimKelimeler.some((k) => k && ad.includes(String(k).toLocaleLowerCase('tr')));
        const baglanti = tg.isimFiltreBaglanti && /(discord\.gg|discord\.com\/invite|https?:\/\/)/i.test(String(member.displayName || ''));
        if (kotu || baglanti) {
          await member.ban({ reason: 'İsim filtresi: yasaklı takma ad' }).catch(() => {});
          guvenlikLog(member.guild, '🏷️ İsim Filtresi',
            member.user.tag + ' (\u0060' + member.id + '\u0060)\nYasaklı takma ad nedeniyle yasaklandı.').catch(() => {});
          return;
        }
      }
      // Takma adları temizle: alfabe dışı karakterleri sil
      if (tg.takmaTemizle && degistirebilir) {
        const temiz = String(member.displayName).replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
        if (temiz && temiz !== member.displayName) await member.setNickname(temiz, 'Takma ad temizleme').catch(() => {});
      }
      // Yeni üye ismi: şablonu uygula
      if (tg.yeniIsimAktif && degistirebilir) {
        const sablon = String(tg.yeniIsimSablon || '{kullanıcı}');
        const isim = sablon.split('{kullanıcı}').join(member.user.username).split('{kullanici}').join(member.user.username).split('{ad}').join(member.user.username).trim().slice(0, 32);
        if (isim && isim !== member.displayName) await member.setNickname(isim, 'Yeni üye ismi').catch(() => {});
      }
    } catch {}
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
        if (davetEdenId && g.davetGirisAt !== false && g.davetKanal) {
          const dk = member.guild.channels.cache.get(g.davetKanal);
          if (dk && dk.isTextBased()) {
            try {
              const davetEden = await member.guild.members.fetch(davetEdenId).catch(() => null);
              const txt = String(g.davetGirisMesaj || '{davet eden} adlı üye {yeni üye} adlı üyeyi sunucuya davet etti.')
                .replace(/{davet eden}/g, davetEden ? String(davetEden) : 'Biri')
                .replace(/{yeni üye}/g, String(member))
                .replace(/{üye sayısı}/g, String(member.guild.memberCount))
                .replace(/{sunucu}/g, member.guild.name).slice(0, 1500);
              await dk.send(txt).catch(() => {});
            } catch {}
          }
        }
      }
    } catch {}

    try {
      if (logger.logOlayAcik(member.guild.id, 'uyeKatildi') && !member.user.bot) {
        const kk = getGuild(member.guild.id).logKanal ? member.guild.channels.cache.get(getGuild(member.guild.id).logKanal) : null;
        if (kk && kk.isTextBased()) {
          const { EmbedBuilder: EB2 } = require('discord.js');
          await kk.send({ embeds: [new EB2().setColor(config.colors.success).setTitle('\u{1F44B} \u00DCye Kat\u0131ld\u0131').setThumbnail(member.user.displayAvatarURL({ size: 64 })).setDescription(String(member) + ' (\u0060' + member.user.tag + '\u0060)\n\u{1F465} \u00DCye say\u0131s\u0131: **' + member.guild.memberCount + '**').setTimestamp()] }).catch(() => {});
        }
      }
    } catch {}
    // Hesap yaşı kontrolü (şüpheli)
    const yas = Date.now() - member.user.createdTimestamp;
    const supheli = yas < 7 * 86400_1000;

    // Hoşgeldin (premium embed varsa o, yoksa klasik)
    if (g.hosgeldinKanal && g.hosgeldinAt !== false) {
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
      if (gg.yapiskan && !member.user.bot && premiumMu(member.guild.id)) {
        const d = require('./src/db');
        if (!d.db().yapiskan) d.db().yapiskan = {};
        d.db().yapiskan[`${member.guild.id}_${member.id}`] = member.roles.cache
          .filter((r) => r.id !== member.guild.id && !r.managed)
          .map((r) => r.id);
        d.save();
      }
    } catch {}
    const g = getGuild(member.guild.id);
    if (g.cikisKanal && g.cikisAt !== false) {
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
    try {
      const ayr = getUser(member.guild.id, member.id);
      if (ayr.davetEden && premiumMu(member.guild.id)) {
        const inv = getUser(member.guild.id, ayr.davetEden);
        inv.davetSayisi = Math.max(0, (inv.davetSayisi || 1) - 1);
        save();
        if (g.davetCikisAt !== false && g.davetCikisKanal) {
          const dk = member.guild.channels.cache.get(g.davetCikisKanal);
          if (dk && dk.isTextBased()) {
            const eden = await member.guild.members.fetch(ayr.davetEden).catch(() => null);
            const txt = String(g.davetCikisMesaj || '{davet eden} tarafından davet edilen {ayrılan} sunucudan ayrıldı.')
              .replace(/{davet eden}/g, eden ? String(eden) : 'Biri')
              .replace(/{ayrılan}/g, String(member.user ? member.user.tag : 'biri'))
              .replace(/{sunucu}/g, member.guild.name).slice(0, 1500);
            await dk.send(txt).catch(() => {});
          }
        }
      }
    } catch {}
    try {
      if (logger.logOlayAcik(member.guild.id, 'uyeAyrildi')) {
        const gk = getGuild(member.guild.id);
        const kk = gk.logKanal ? member.guild.channels.cache.get(gk.logKanal) : null;
        if (kk && kk.isTextBased()) {
          const { EmbedBuilder: EB3 } = require('discord.js');
          await kk.send({ embeds: [new EB3().setColor(config.colors.error).setTitle('\u{1F44B} \u00DCye Ayr\u0131ld\u0131').setThumbnail(member.user.displayAvatarURL({ size: 64 })).setDescription(String(member.user.tag) + ' (\u0060' + member.id + '\u0060)').setTimestamp()] }).catch(() => {});
        }
      }
    } catch {}
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
    if (!logger.logOlayAcik(ilk.guild.id, 'mesajSil')) return;
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
    if (!logger.logOlayAcik(ban.guild.id, 'uyeYasak', 'modYasak')) { await logger.patlamaKontrol(ban.guild, 'ban').catch(() => {}); return; }
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
    if (!logger.logOlayAcik(ban.guild.id, 'uyeYasakKaldir', 'modYasakKaldir')) return;
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
            const dav = await client.fetchInvite('bRkPbqAVa4').catch(() => null);
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
            if (mevcut) P.premiumVer(hedef.id, Math.ceil((mevcut.bitis - Date.now()) / 86400000) + gun, mevcut.kod || 'ADMIN', mevcut.sahip || yeni.id);
            else P.premiumVer(hedef.id, gun, 'BOOST', yeni.id);
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
      if (!logger.logOlayAcik(yeni.guild.id, 'uyeSus', 'modSus', 'modSusKaldir')) return;
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
      if (!logger.logOlayAcik(yeni.guild.id, 'uyeAd')) return;
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
      if (!logger.logOlayAcik(yeni.guild.id, 'uyeRol')) return;
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
    if (!logger.logOlayAcik(k.guild.id, 'kanalOlustur')) return;
    const a = await logger.executorBul(k.guild, AuditLogEvent.ChannelCreate, k.id).catch(() => null);
    await kanalLog('📗 Kanal Açıldı', config.colors.success, k, a ? `${a.executor}` : null);
  } catch {}
});
client.on('channelDelete', async (k) => {
  try {
    if (!k.guild) return;
    if (!logger.logOlayAcik(k.guild.id, 'kanalSil')) { await logger.patlamaKontrol(k.guild, 'kanal-silme').catch(() => {}); return; }
    const a = await logger.executorBul(k.guild, AuditLogEvent.ChannelDelete, k.id).catch(() => null);
    await kanalLog('📕 Kanal Silindi!', config.colors.error, k, a ? `${a.executor} (\`${a.executor.tag}\`)` : 'Bilinmiyor');
    await logger.patlamaKontrol(k.guild, 'kanal-silme').catch(() => {});
  } catch {}
});
client.on('channelUpdate', async (e, y) => {
  try {
    if (!y.guild || y.isThread()) return;
    if (!logger.logOlayAcik(y.guild.id, 'kanalGuncelle')) return;
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
    if (!logger.logOlayAcik(r.guild.id, 'rolOlustur')) return;
    const a = await logger.executorBul(r.guild, AuditLogEvent.RoleCreate, r.id).catch(() => null);
    await logger.gonder(r.guild, new EmbedBuilder().setColor(config.colors.success).setTitle('🎭 Rol Oluşturuldu')
      .setDescription(`<@&${r.id}> **${r.name}**\n👮 ${a ? `${a.executor}` : 'Bilinmiyor'}`).setTimestamp());
  } catch {}
});
client.on('roleDelete', async (r) => {
  try {
    if (!logger.logOlayAcik(r.guild.id, 'rolSil')) { await logger.patlamaKontrol(r.guild, 'rol-silme').catch(() => {}); return; }
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
    if (!logger.logOlayAcik(y.guild.id, 'rolGuncelle')) return;
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
    if (!logger.logOlayAcik(y.id, 'sunucuGuncelle')) return;
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
    if (!logger.logOlayAcik(y.guild.id, 'uyeSes')) return;
    if (!e.channel && y.channel) {
      await logger.gonder(y.guild, new EmbedBuilder().setColor(config.colors.success).setTitle('🔊 Sese Girdi').setDescription(`${y.member} → **${y.channel.name}**`).setTimestamp());
    } else if (e.channel && !y.channel) {
      await logger.gonder(y.guild, new EmbedBuilder().setColor(config.colors.error).setTitle('🔇 Sesten Çıktı').setDescription(`${y.member} ← **${e.channel.name}**`).setTimestamp());
    } else if (e.channel && y.channel && e.channel.id !== y.channel.id) {
      await logger.gonder(y.guild, new EmbedBuilder().setColor(config.colors.main).setTitle('🔀 Ses Değiştirdi').setDescription(`${y.member}: **${e.channel.name}** → **${y.channel.name}**`).setTimestamp());
    }
  } catch {}
});

// ---- Sunucu etiketi: tam otomatik (birincil sunucu etiketi + eski kullanıcı-adı etiketi) ----
async function etiketKontrol(guild, userId) {
  try {
    const g = getGuild(guild.id);
    if (!g.etiketAktif || !g.etiketRol) return;
    if (!premiumMu(guild.id)) return;
    const rol = guild.roles.cache.get(String(g.etiketRol).replace(/\D/g, ''));
    if (!rol || rol.managed) return;
    if (rol.position >= guild.members.me.roles.highest.position) return;
    const uye = await guild.members.fetch(userId).catch(() => null);
    if (!uye || uye.user.bot) return;
    let varMi = false;
    // 1) Discord birincil sunucu (profil) etiketi — isim girmeden otomatik
    try {
      const tam = await guild.client.users.fetch(userId).catch(() => null);
      const pg = tam && tam.primaryGuild;
      if (pg && pg.identityEnabled !== false && String(pg.identityGuildId || '') === String(guild.id)) varMi = true;
    } catch {}
    // 2) Eski yöntem: kullanıcı adında geçen etiket (uyumluluk)
    try {
      const ts = getGuild(guild.id).tagSistemi;
      if (ts && ts.tag && uye.user.username.toLocaleLowerCase('tr').includes(String(ts.tag).toLocaleLowerCase('tr'))) varMi = true;
    } catch {}
    if (varMi && !uye.roles.cache.has(rol.id)) await uye.roles.add(rol, 'Sunucu etiketi').catch(() => {});
    else if (!varMi && uye.roles.cache.has(rol.id)) await uye.roles.remove(rol, 'Sunucu etiketi').catch(() => {});
  } catch {}
}
// ---- Slash + Buton + Menü + Modal ----
client.on('userUpdate', async (eski, yeni) => {
  try {
    if (!eski) return;
    const adDegisti = eski.username !== yeni.username;
    for (const [, guild] of client.guilds.cache) {
      try {
        // Eski kullanıcı-adı etiketi
        if (adDegisti) {
          const yeniAd = String(yeni.username || '').toLocaleLowerCase('tr');
          const ts = getGuild(guild.id).tagSistemi;
          if (ts && ts.tag && ts.rolId) {
            const uye = await guild.members.fetch(yeni.id).catch(() => null);
            if (uye && !uye.user.bot) {
              const rol = guild.roles.cache.get(ts.rolId);
              if (rol) {
                const varMi = yeniAd.includes(String(ts.tag).toLocaleLowerCase('tr'));
                if (varMi && !uye.roles.cache.has(rol.id)) await uye.roles.add(rol).catch(() => {});
                else if (!varMi && uye.roles.cache.has(rol.id)) await uye.roles.remove(rol).catch(() => {});
              }
            }
          }
        }
        // Yeni tam otomatik etiket kontrolü
        await etiketKontrol(guild, yeni.id);
      } catch {}
    }
  } catch {}
});
client.on('guildMemberUpdate', async (eski, yeni) => {
  try { await etiketKontrol(yeni.guild, yeni.id); } catch {}
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

// ---- Anti-Webhook (premium): izinsiz webhook → onay akışı ----
const whOnayMap = new Map(); // onayId -> { guildId, kanalId, isim, avatar, isteyenId }
let whOnaySayac = 0;
client.on('webhooksUpdate', async (kanal) => {
  try {
    if (!kanal.guild) return;
    const g = getGuild(kanal.guild.id);
    if (!g.govWebhook || !premiumMu(kanal.guild.id)) return;
    const e = await sonExecutor(kanal.guild, AuditLogEvent.WebhookCreate).catch(() => null);
    if (!e || !e.executor || e.executor.bot || e.executor.id === client.user.id) return;
    const wh = await kanal.fetchWebhooks().catch(() => null);
    const hedef = wh && e.target && e.target.id ? wh.get(e.target.id) : null;
    if (!hedef || (hedef.owner && hedef.owner.id === client.user.id)) return;
    const isim = hedef.name || 'webhook';
    const avatar = hedef.avatarURL ? hedef.avatarURL() : null;
    await hedef.delete('Anti-Webhook: onaysız').catch(() => {});
    // Onay kanalı yoksa direkt sil + log (eski davranış)
    const onayKanal = g.webhookOnayKanal ? kanal.guild.channels.cache.get(g.webhookOnayKanal) : null;
    if (!onayKanal || !onayKanal.isTextBased()) {
      guvenlikLog(kanal.guild, '🔗 İzinsiz Webhook Silindi',
        `${e.executor} (\`${e.executor.tag}\`)\n#${kanal.name} kanalındaki izinsiz webhook kaldırıldı.`).catch(() => {});
      return;
    }
    if (whOnayMap.size > 50) whOnayMap.clear();
    const oid = `${Date.now().toString(36)}${(whOnaySayac++ % 1296).toString(36)}`;
    whOnayMap.set(oid, { guildId: kanal.guild.id, kanalId: kanal.id, isim, avatar, isteyenId: e.executor.id });
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    await onayKanal.send({
      content: `<@${e.executor.id}> webhook açmak istiyor!`,
      embeds: [new EmbedBuilder().setColor(config.colors.warn).setTitle('🪝 Webhook Onay İsteği')
        .setDescription(`👤 İsteyen: ${e.executor} (\`${e.executor.tag}\`)\n🆔 ID: \`${e.executor.id}\`\n📛 İsim: **${isim}**\n#️⃣ Kanal: <#${kanal.id}>\n\nOnaylarsan webhook açılır, reddedersen açılmaz.`)
        .setTimestamp()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wh_onay_${oid}`).setLabel('Onayla').setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId(`wh_red_${oid}`).setLabel('Reddet').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
      )],
    }).catch(() => {});
  } catch {}
});
async function webhookOnayButon(interaction) {
  try {
    const parca = interaction.customId.split('_');
    const aksiyon = parca[1];
    const oid = parca.slice(2).join('_');
    const kayit = whOnayMap.get(oid);
    if (!kayit) return interaction.reply({ content: '❌ Bu istek artık geçerli değil!', ephemeral: true }).catch(() => {});
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true }).catch(() => {});
    }
    const guild = interaction.guild;
    whOnayMap.delete(oid);
    if (aksiyon === 'red') {
      await interaction.update({ content: `✖️ Webhook isteği reddedildi.`, embeds: [], components: [] }).catch(() => {});
      guvenlikLog(guild, '🪝 Webhook Reddedildi',
        `<@${kayit.isteyenId}> adlı üyenin **${kayit.isim}** webhook isteği ${interaction.user} tarafından reddedildi.`).catch(() => {});
      return;
    }
    const kanal = guild.channels.cache.get(kayit.kanalId);
    if (!kanal || !kanal.isTextBased()) {
      await interaction.update({ content: '❌ Kanal bulunamadı!', embeds: [], components: [] }).catch(() => {});
      return;
    }
    let yeni = null;
    try {
      yeni = await kanal.createWebhook({ name: kayit.isim.slice(0, 80), avatar: kayit.avatar, reason: `Webhook onayı: ${interaction.user.tag}` });
    } catch {}
    if (!yeni) {
      await interaction.update({ content: '❌ Webhook açılamadı (izin/kota)!', embeds: [], components: [] }).catch(() => {});
      return;
    }
    await interaction.update({ content: `✅ Webhook açıldı: **${kayit.isim}** (<#${kayit.kanalId}>)`, embeds: [], components: [] }).catch(() => {});
    try {
      const isteyen = await guild.members.fetch(kayit.isteyenId).catch(() => null);
      if (isteyen) await isteyen.send(`✅ **${guild.name}** sunucusunda webhook isteğin onaylandı!\n🔗 URL: ||${yeni.url}||\n⚠️ Bu bağlantıyı kimseyle paylaşma!`).catch(() => {});
    } catch {}
    guvenlikLog(guild, '🪝 Webhook Onaylandı',
      `<@${kayit.isteyenId}> adlı üyenin **${kayit.isim}** webhook isteği ${interaction.user} tarafından onaylandı.`).catch(() => {});
  } catch {}
}

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
client.on('emojiUpdate', async (eski, yeni) => {
  try {
    if (!logger.logOlayAcik(yeni.guild.id, 'emojiGuncelle')) return;
    const { EmbedBuilder: EB4 } = require('discord.js');
    await logger.gonder(yeni.guild, new EB4().setColor(config.colors.warn).setTitle('\u{1F3A8} Emoji G\u00FCncellendi').setDescription(String(eski.name || '?') + ' \u2192 **' + String(yeni.name || '?') + '**').setTimestamp());
  } catch {}
});
client.on('emojiDelete', async (emoji) => {
  try {
    if (!logger.logOlayAcik(emoji.guild.id, 'emojiSil')) return;
    const { EmbedBuilder: EB5 } = require('discord.js');
    await logger.gonder(emoji.guild, new EB5().setColor(config.colors.error).setTitle('\u{1F5D1}\uFE0F Emoji Silindi').setDescription('**' + String(emoji.name || '?') + '**').setTimestamp());
  } catch {}
});
client.on('emojiCreate', async (emoji) => {
  try {
    if (logger.logOlayAcik(emoji.guild.id, 'emojiOlustur')) {
      const { EmbedBuilder: EB6 } = require('discord.js');
      await logger.gonder(emoji.guild, new EB6().setColor(config.colors.success).setTitle('\u{1F600} Emoji Olu\u015Fturuldu').setDescription(String(emoji) + ' **' + String(emoji.name || '?') + '**').setTimestamp());
    }
  } catch {}
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
  // ⭐ Starboard (premium): eşik yıldızı alan mesajı panoya taşı
  try {
    const guild = reaction.message.guild;
    if (!guild || user.bot) return;
    const sb = getGuild(guild.id).starboard;
    if (!sb || !sb.kanal || reaction.emoji.name !== '⭐') return;
    if (!premiumMu(guild.id)) return;
    if (reaction.partial) await reaction.fetch().catch(() => null);
    const msg = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
    if (!msg || (msg.author && msg.author.bot)) return;
    if ((reaction.count || 0) < (sb.esik || 3)) return;
    if (!sb.gonderilen) sb.gonderilen = {};
    if (sb.gonderilen[msg.id]) return;
    const pano = guild.channels.cache.get(sb.kanal);
    if (!pano || !pano.isTextBased()) return;
    const resim = [...msg.attachments.values()].find((a) => (a.contentType || '').startsWith('image/'));
    const m = await pano.send({
      embeds: [new EmbedBuilder().setColor(config.colors.gold)
        .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL({ size: 64 }) })
        .setDescription(String(msg.content || '*[medya]*').slice(0, 2000))
        .setImage(resim ? resim.url : null)
        .addFields({ name: '🔗 Kaynak', value: `[Mesaja git](${msg.url})` })
        .setFooter({ text: `⭐ ${reaction.count} • #${msg.channel.name}` }).setTimestamp()],
    }).catch(() => null);
    if (m) {
      sb.gonderilen[msg.id] = m.id;
      const keys = Object.keys(sb.gonderilen);
      if (keys.length > 200) keys.slice(0, keys.length - 200).forEach((k) => delete sb.gonderilen[k]);
      save();
    }
  } catch {}
});
client.on('messageReactionRemove', async (reaction, user) => {
  const r = await tepkiEsles(reaction.message.guild, reaction, user).catch(() => null);
  if (r) await r.uye.roles.remove(r.rol, 'Emoji rol').catch(() => {});
});
const sesMap = new Map(); // `${gid}_${uid}` -> ses giris zamani
setInterval(async () => {
  try {
    for (const [, guild] of client.guilds.cache) {
      try {
        const g = getGuild(guild.id);
        if (!g.sesXP || !premiumMu(guild.id)) continue;
        const dkXp = Math.max(1, Math.min(100, g.sesXPDakika || 5));
        const minKatilim = Math.max(1, Math.min(10, g.sesXPMin || 2));
        const afkId = guild.afkChannelId;
        const odadakiler = [...guild.members.cache.values()].filter((m) =>
          !m.user.bot && m.voice.channelId && m.voice.channelId !== afkId &&
          !m.voice.mute && !m.voice.deaf && !m.voice.selfMute && !m.voice.selfDeaf);
        if (!odadakiler.length) continue;
        for (const m of odadakiler) {
          try {
            const kanaldakiler = odadakiler.filter((x) => x.voice.channelId === m.voice.channelId).length;
            if (kanaldakiler < minKatilim) continue;
            const u = getUser(guild.id, m.id);
            u.xp = (u.xp || 0) + dkXp;
            u.mesaj = u.mesaj || 0;
            const ihtiyac = (u.level || 0) * 100 + 100;
            if (u.xp >= ihtiyac) {
              u.level = (u.level || 0) + 1;
              u.xp = 0;
              let odulRol = null;
              try {
                const roller = getGuild(guild.id).seviyeRoller || [];
                const eslesme = roller.find((r) => r.seviye === u.level);
                if (eslesme) {
                  const rol = guild.roles.cache.get(eslesme.rolId);
                  if (rol) { await m.roles.add(rol).catch(() => {}); odulRol = rol; }
                }
              } catch {}
              await seviyeMesajGonder(guild, m.user, u.level, odulRol);
            }
          } catch {}
        }
        save();
      } catch {}
    }
    } catch {}
  }, 60_000).unref?.();
// ---- Görev ses takibi (60sn'de 1 puan, free dahil, restart-dayanıklı) ----
setInterval(async () => {
  try {
    const G = require('./src/gorev');
    for (const [, guild] of client.guilds.cache) {
      try {
        const ayar = G.gorevAyar(guild.id);
        if (!ayar.aktif || (ayar.tur !== 'ses' && ayar.tur !== 'ikisi')) continue;
        const afkId = guild.afkChannelId;
        const odadakiler = [...guild.members.cache.values()].filter((m) =>
          !m.user.bot && m.voice.channelId && m.voice.channelId !== afkId &&
          !m.voice.mute && !m.voice.deaf && !m.voice.selfMute && !m.voice.selfDeaf);
        for (const m of odadakiler) {
          try { await G.gorevIlerle(client, guild, m.id, 1, 'ses', null); } catch {}
        }
      } catch {}
    }
  } catch {}
}, 60_000).unref?.();
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

// ---- Sunucu geçmiş takibi (admin paneli için: eklenme/çıkarılma/kim ekledi) ----
function gecmisKaydet(gid, ad, alan, veri) {
  try {
    const dd = require('./src/db');
    const d = dd.db();
    if (!d.sunucuGecmis) d.sunucuGecmis = {};
    if (!d.sunucuGecmis[gid]) d.sunucuGecmis[gid] = { ad: ad || gid, eklenme: [], cikarma: [], ekleyenler: [] };
    const k = d.sunucuGecmis[gid];
    if (ad) k.ad = ad;
    if (alan === 'eklenme') {
      k.eklenme.push({ tarih: Date.now() });
      if (k.eklenme.length > 50) k.eklenme = k.eklenme.slice(-50);
      if (veri && veri.ekleyen) {
        k.ekleyenler.push({ ...veri.ekleyen, tarih: Date.now() });
        if (k.ekleyenler.length > 20) k.ekleyenler = k.ekleyenler.slice(-20);
      }
    } else if (alan === 'cikarma') {
      k.cikarma.push({ tarih: Date.now() });
      if (k.cikarma.length > 50) k.cikarma = k.cikarma.slice(-50);
    }
    dd.save();
  } catch {}
}
client.on('guildCreate', async (guild) => {
  try {
    try {
      const dy = require('./src/db').db();
      if (dy.yasakSunucular && dy.yasakSunucular[guild.id]) {
        await guild.leave().catch(() => {});
        return;
      }
    } catch {}
    let ekleyen = null;
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 3 });
      const e = logs.entries.find((x) => x.target && x.target.id === client.user.id && Date.now() - x.createdTimestamp < 120000);
      if (e && e.executor) ekleyen = { id: e.executor.id, tag: e.executor.tag };
    } catch {}
    gecmisKaydet(guild.id, guild.name, 'eklenme', { ekleyen });
  } catch {}
});
client.on('guildDelete', async (guild) => {
  try { gecmisKaydet(guild.id, guild.name, 'cikarma'); } catch {}
});

client.on('interactionCreate', async (interaction) => {
  try {
    // 0) Etkileşim spam kalkanı (buton/menü flood → 60sn sessiz)
    try {
      const uid0 = interaction.user && interaction.user.id;
      const PP0 = require('./src/premium');
      if (uid0 && !PP0.sahipMi(uid0)) {
        const K0 = require('./src/koruma');
        if (K0.etkilesimYasakliMi(uid0)) return;
        if (!K0.etkilesimKontrol(uid0)) { K0.etkilesimYasakla(uid0); return; }
      }
    } catch {}
    // 1) Slash komutlar
    if (interaction.isChatInputCommand()) {
      try {
        const dd = require('./src/db').db();
        const PP = require('./src/premium');
        if (dd.bakim && dd.bakim.aktif && !PP.sahipMi(interaction.user.id)) {
          return interaction.reply({ content: '🛠️ Bot şu an **bakımda!** ' + String(dd.bakim.mesaj || 'Birazdan dönüyoruz.'), ephemeral: true }).catch(() => {});
        }
        if ((dd.kapaliKomutlar || []).includes(interaction.commandName.toLowerCase())) {
          return interaction.reply({ content: '🔒 Bu komut yönetim tarafından kapatıldı!', ephemeral: true }).catch(() => {});
        }
      } catch {}
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
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('ticket_')) {
      const arr = require('./commands/ticket');
      const internal = arr.find(c => c.name === '__ticket_internal__');
      if (internal?.userSelect) return internal.userSelect(interaction, client);
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
      if (interaction.customId === 'sunucu_kur_onay' || interaction.customId === 'sunucu_kur_iptal' || interaction.customId === 'sunucu_oryantasyon_kur') {
        const s = require('./commands/sunucu');
        return s.handleSunucuButton(interaction, client);
      }
      if (interaction.customId.startsWith('gv_')) {
        const gv = require('./commands/guvenlik');
        return gv.handleGuvButton(interaction, client);
      }
      if (interaction.customId.startsWith('wh_onay_') || interaction.customId.startsWith('wh_red_')) {
        return webhookOnayButon(interaction);
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
      if (interaction.customId.startsWith('partner_sayac_')) {
        const p = require('./commands/partner');
        if (p.sayacButton) return p.sayacButton(interaction, client);
      }
      if (interaction.customId.startsWith('ticket_acil_')) {
        const arr = require('./commands/ticket');
        const internal = arr.find(c => c.name === '__ticket_internal__');
        if (internal?.aciliyet) return internal.aciliyet(interaction, client);
      }
      if (interaction.customId.startsWith('ticket_')) {
        const arr = require('./commands/ticket');
        const internal = arr.find(c => c.name === '__ticket_internal__');
        if (internal?.button) return internal.button(interaction, client);
      }
      if (interaction.customId.startsWith('itiraf_')) {
        const arr = require('./commands/ozel');
        const internal = arr.find(c => c.name === '__itiraf_internal__');
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
