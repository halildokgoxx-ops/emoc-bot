// Bot aksiyonları — hem direkt panel (server.js) hem köprü-botu (botapi.js) kullanır.
const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('../src/db');

function degiskenKoy(metin, guild) {
  return String(metin || '')
    .split('{sunucu}').join(guild.name)
    .split('{uye}').join(String(guild.memberCount || 0));
}

async function embedGonder(client, { guildId, channelId, baslik, aciklama, renk }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { hata: 'yok' };
  const kanal = guild.channels.cache.get(channelId);
  if (!kanal || !kanal.isTextBased()) return { hata: 'kanal-yok' };
  const acik = String(aciklama || '').slice(0, 4000);
  if (!acik.trim() && !baslik) return { hata: 'bos' };
  const emb = new EmbedBuilder()
    .setDescription(degiskenKoy(acik, guild) || '...')
    .setColor(/^#[0-9a-f]{6}$/i.test(String(renk || '')) ? String(renk) : '#8b7cf6')
    .setTimestamp();
  if (baslik) emb.setTitle(String(baslik).slice(0, 256));
  await kanal.send({ embeds: [emb] });
  return { ok: true };
}

async function medyaYukle(client, { guildId, tip, dosyalar }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { hata: 'yok' };
  if (!['emoji', 'sticker'].includes(tip)) return { hata: 'tip' };
  const liste = Array.isArray(dosyalar) ? dosyalar.slice(0, 10) : [];
  const sonuc = [];
  for (const d of liste) {
    const hamAd = String((d && d.ad) || 'yeni');
    try {
      const ad = hamAd.toLocaleLowerCase('tr').replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'medya';
      const buf = Buffer.from(String((d && d.data) || '').split(',').pop(), 'base64');
      const limit = tip === 'emoji' ? 262144 : 524288;
      if (!buf.length || buf.length > limit) { sonuc.push({ ad: hamAd.slice(0, 32), ok: false, hata: 'boyut' }); continue; }
      if (tip === 'emoji') await guild.emojis.create({ attachment: buf, name: ad });
      else await guild.stickers.create({ file: buf, name: ad.slice(0, 30) || 'sticker', tags: ad.slice(0, 30) || 'sticker' });
      sonuc.push({ ad, ok: true });
    } catch { sonuc.push({ ad: hamAd.slice(0, 32), ok: false, hata: 'olusturulamadi' }); }
  }
  return { ok: true, sonuc };
}

async function emojirolTepki(client, { guildId, index = -1 }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { hata: 'yok' };
  const liste = getGuild(guild.id).emojiRoller || [];
  const sonuc = [];
  for (let i = 0; i < liste.length; i++) {
    if (index >= 0 && i !== index) continue;
    const k = liste[i];
    try {
      const kanal = guild.channels.cache.get(String(k.kanal));
      if (!kanal || !kanal.isTextBased()) { sonuc.push({ i, ok: false, hata: 'kanal-yok' }); continue; }
      const mesaj = await kanal.messages.fetch(String(k.mesajId)).catch(() => null);
      if (!mesaj) { sonuc.push({ i, ok: false, hata: 'mesaj-yok' }); continue; }
      const em = String(k.emoji).trim();
      const idEsles = em.match(/(\d{15,25})/);
      const tepki = idEsles ? (guild.emojis.cache.get(idEsles[1]) || idEsles[1]) : em;
      await mesaj.react(tepki);
      sonuc.push({ i, ok: true });
    } catch { sonuc.push({ i, ok: false, hata: 'tepki-olmadi' }); }
  }
  return { ok: true, sonuc };
}

async function adminUye(client, { guildId, userId, islem, sebep, sureDk }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { hata: 'yok' };
  const uid = String(userId || '').replace(/\D/g, '');
  if (!/^\d{15,25}$/.test(uid)) return { hata: 'uye-yok' };
  const { getUser, save } = require('../src/db');
  if (islem === 'bilgi') {
    const m = await guild.members.fetch(uid).catch(() => null);
    if (!m) return { hata: 'bulunamadi' };
    const d = getUser(guildId, uid);
    return {
      ok: true,
      uye: {
        id: m.id, tag: m.user.tag, bot: !!m.user.bot, katilma: m.joinedTimestamp || null,
        roller: [...m.roles.cache.values()].filter((r) => r.id !== guild.id).map((r) => r.name),
        warns: d.warns || [], level: d.level || 0, xp: d.xp || 0,
        mesaj: d.mesaj || 0, rep: d.rep || 0, para: d.para || 0,
      },
    };
  }
  if (islem === 'uyar') {
    const d = getUser(guildId, uid);
    if (!Array.isArray(d.warns)) d.warns = [];
    d.warns.push({ mod: 'ADMIN-WEB', reason: String(sebep || 'Admin uyarısı').slice(0, 300), date: Date.now() });
    save();
    return { ok: true, sayi: d.warns.length };
  }
  if (islem === 'uyaritemizle') {
    const d = getUser(guildId, uid);
    d.warns = [];
    save();
    return { ok: true };
  }
  const m = await guild.members.fetch(uid).catch(() => null);
  if (!m) return { hata: 'bulunamadi' };
  if (m.id === guild.ownerId || m.id === client.user.id || m.permissions.has('Administrator')) {
    return { hata: 'dokunulmaz' };
  }
  const neden = String(sebep || 'Admin işlemi (web)').slice(0, 200);
  try {
    if (islem === 'sustur') {
      const dk = Math.max(1, Math.min(40320, parseInt(sureDk, 10) || 10));
      await m.timeout(dk * 60_000, neden);
    } else if (islem === 'at') await m.kick(neden);
    else if (islem === 'yasakla') await guild.members.ban(uid, { reason: neden, deleteMessageSeconds: 0 });
    else if (islem === 'yasakkaldir') await guild.members.unban(uid, neden);
    else return { hata: 'islem' };
  } catch { return { hata: 'yetki' }; }
  try {
    const g = getGuild(guild.id);
    const lc = g.logKanal ? guild.channels.cache.get(g.logKanal) : null;
    if (lc && lc.isTextBased()) {
      await lc.send({
        embeds: [new EmbedBuilder().setColor(0xffc93c).setTitle('👑 Admin İşlem (web)')
          .setDescription(`${m.user.tag} (\`${uid}\`)\nİşlem: **${islem}**\nSebep: ${neden}`).setTimestamp()],
      }).catch(() => {});
    }
  } catch {}
  return { ok: true };
}

function adminPremiumSure({ guildId, islem, gun }) {
  try {
    const d = require('../src/db').db();
    const s = d.premium && d.premium.sunucular && d.premium.sunucular[String(guildId)];
    if (!s) return { hata: 'premium-yok' };
    const ms = Math.max(1, Math.min(36500, parseInt(gun, 10) || 0)) * 86400000;
    s.bitis = islem === 'kisalt' ? s.bitis - ms : s.bitis + ms;
    require('../src/db').save();
    return { ok: true, bitis: s.bitis };
  } catch { return { hata: 'hata' }; }
}

function adminAnalitik(client) {
  try {
    const d = require('../src/db').db();
    const users = Object.entries(d.users || {});
    const top = (fn, n = 8) => users
      .map(([k, v]) => ({ uid: k.split('_')[1], d: fn(v) || 0 }))
      .filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, n);
    const kat = {};
    for (const c of client.commands.values()) kat[c.category || 'Genel'] = (kat[c.category || 'Genel'] || 0) + 1;
    let toplamPara = 0, toplamUyari = 0, toplamMesaj = 0;
    for (const [, v] of users) {
      toplamPara += v.para || 0;
      toplamUyari += (v.warns || []).length;
      toplamMesaj += v.mesaj || 0;
    }
    return {
      ok: true,
      topMesaj: top((v) => v.mesaj),
      topPara: top((v) => v.para),
      topSeviye: top((v) => (v.level || 0) * 100000 + (v.xp || 0)),
      topRep: top((v) => v.rep),
      toplamPara, toplamUyari, toplamMesaj,
      kategoriler: Object.entries(kat).map(([ad, sayi]) => ({ ad, sayi })).sort((a, b) => b.sayi - a.sayi),
    };
  } catch { return { hata: 'hata' }; }
}

function adminSunucuFull(client, guildId) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { hata: 'yok' };
    const kanallar = [...guild.channels.cache.values()];
    const roller = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id);
    return {
      ok: true,
      id: guild.id, ad: guild.name, uye: guild.memberCount || 0,
      yazi: kanallar.filter((k) => k.type === 0).length,
      ses: kanallar.filter((k) => k.type === 2).length,
      kategori: kanallar.filter((k) => k.type === 4).length,
      roller: roller.map((r) => ({ ad: r.name, uye: r.members ? r.members.size : 0 })).sort((a, b) => b.uye - a.uye).slice(0, 20),
      emoji: guild.emojis.cache.size,
      sticker: guild.stickers.cache.size,
      boost: guild.premiumSubscriptionCount || 0,
      kurulus: guild.createdTimestamp,
    };
  } catch { return { hata: 'hata' }; }
}

function adminKomutlar(client) {
  try {
    const d = require('../src/db').db();
    const kapali = d.kapaliKomutlar || [];
    const liste = [...client.commands.values()].map((c) => ({
      ad: c.name, kategori: c.category || 'Genel', kapali: kapali.includes(c.name.toLowerCase()),
    })).sort((a, b) => a.ad.localeCompare(b.ad));
    return { ok: true, komutlar: liste };
  } catch { return { hata: 'hata' }; }
}

function adminKomutDurum(client, { komut, islem }) {
  try {
    const ad = String(komut || '').toLowerCase();
    if (!ad || !client.commands.has(ad)) return { hata: 'yok' };
    const d = require('../src/db').db();
    if (!Array.isArray(d.kapaliKomutlar)) d.kapaliKomutlar = [];
    if (islem === 'kapat' && !d.kapaliKomutlar.includes(ad)) d.kapaliKomutlar.push(ad);
    if (islem === 'ac') d.kapaliKomutlar = d.kapaliKomutlar.filter((x) => x !== ad);
    require('../src/db').save();
    return { ok: true };
  } catch { return { hata: 'hata' }; }
}

function adminBakim({ aktif, mesaj }) {
  try {
    const d = require('../src/db').db();
    d.bakim = aktif ? { aktif: true, mesaj: String(mesaj || '').slice(0, 300), tarih: Date.now() } : null;
    require('../src/db').save();
    return { ok: true, bakim: d.bakim };
  } catch { return { hata: 'hata' }; }
}

module.exports = {
  embedGonder, medyaYukle, emojirolTepki,
  adminUye, adminPremiumSure, adminAnalitik, adminSunucuFull,
  adminKomutlar, adminKomutDurum, adminBakim,
};
