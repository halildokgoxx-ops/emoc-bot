// 🎯 Görev motoru — günlük + haftalık, mesaj/ses/ikisi, ayarlanabilir hedef + ödül + kanal.
// Web her şeyi ayarlar, bottan sadece aç/kapa yapılır.
const { EmbedBuilder } = require('discord.js');
const { db, save, getGuild, getUser } = require('./db');
const config = require('../config');

const TURLER = ['mesaj', 'ses', 'ikisi'];
const TUR_AD = { mesaj: '💬 Mesaj', ses: '🎙️ Ses', ikisi: '💬+🎙️ Mesaj & Ses' };

function sayi(v, def, min, max) {
  let n = parseInt(v, 10);
  if (isNaN(n)) n = def;
  return Math.max(min, Math.min(max, n));
}

function gorevAyar(gid) {
  const g = getGuild(gid);
  const tur = TURLER.includes(g.gorevTur) ? g.gorevTur : 'mesaj';
  return {
    aktif: g.gorevAktif !== false,
    kanal: g.gorevKanal || null,
    tur,
    gunlukHedef: sayi(g.gorevGunlukMesaj ?? 20, 20, 1, 500),
    gunlukOdul: sayi(g.gorevGunlukOdul ?? 200, 200, 0, 100000),
    haftalikAktif: g.gorevHaftalikAktif === true,
    haftalikHedef: sayi(g.gorevHaftalikMesaj ?? 100, 100, 1, 5000),
    haftalikOdul: sayi(g.gorevHaftalikOdul ?? 1000, 1000, 0, 100000),
  };
}

function gunAnahtar(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function isoHafta(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const gun = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - gun + 3);
  const ilkPersembe = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const ilkGun = (ilkPersembe.getUTCDay() + 6) % 7;
  ilkPersembe.setUTCDate(ilkPersembe.getUTCDate() - ilkGun + 3);
  const hafta = 1 + Math.round((t - ilkPersembe) / (7 * 86400_000));
  return `${t.getUTCFullYear()}-W${String(hafta).padStart(2, '0')}`;
}

function kaynakSayilir(tur, kaynak) {
  if (tur === 'ikisi') return true;
  return tur === kaynak;
}

async function duyur(client, guild, kanalId, userId, baslik, metin, replyFn) {
  const icerik = { content: `<@${userId}> ${metin}` };
  if (replyFn) {
    try { await replyFn(metin); return; } catch {}
  }
  try {
    const kanal = kanalId ? guild.channels.cache.get(kanalId) : null;
    if (kanal && kanal.isTextBased()) {
      await kanal.send({
        embeds: [new EmbedBuilder().setColor(config.colors.gold).setTitle(baslik).setDescription(`<@${userId}> ${metin}`).setTimestamp()],
      });
      return;
    }
  } catch {}
}

// İlerleme işletir. Döndürür: { gunluk: {ilerleme, hedef, tamamlandi}, haftalik: {...} | null }
async function gorevIlerle(client, guild, userId, miktar, kaynak, replyFn) {
  const ayar = gorevAyar(guild.id);
  if (!ayar.aktif) return null;
  if (!kaynakSayilir(ayar.tur, kaynak)) return null;
  const d = db();
  if (!d.gorevler) d.gorevler = {};
  const sonuc = { gunluk: null, haftalik: null };
  const u = getUser(guild.id, userId);

  // Günlük
  {
    const key = `${guild.id}_${userId}_${gunAnahtar()}`;
    if (!d.gorevler[key]) d.gorevler[key] = { ilerleme: 0, tamam: false };
    const kay = d.gorevler[key];
    if (!kay.tamam) {
      kay.ilerleme = Math.min(ayar.gunlukHedef, (kay.ilerleme || 0) + miktar);
      if (kay.ilerleme >= ayar.gunlukHedef) {
        kay.tamam = true;
        u.para = (u.para || 0) + ayar.gunlukOdul;
        await duyur(client, guild, ayar.kanal, userId,
          '🎯 Günlük Görev Tamamlandı!',
          `🎯 Günlük görev tamamlandı! **+${ayar.gunlukOdul} coin** 🪙`, replyFn);
      }
      sonuc.gunluk = { ilerleme: kay.ilerleme, hedef: ayar.gunlukHedef, tamamlandi: !!kay.tamam };
    } else {
      sonuc.gunluk = { ilerleme: kay.ilerleme, hedef: ayar.gunlukHedef, tamamlandi: true };
    }
  }
  // Haftalık
  if (ayar.haftalikAktif) {
    const key = `${guild.id}_${userId}_H${isoHafta()}`;
    if (!d.gorevler[key]) d.gorevler[key] = { ilerleme: 0, tamam: false };
    const kay = d.gorevler[key];
    if (!kay.tamam) {
      kay.ilerleme = Math.min(ayar.haftalikHedef, (kay.ilerleme || 0) + miktar);
      if (kay.ilerleme >= ayar.haftalikHedef) {
        kay.tamam = true;
        u.para = (u.para || 0) + ayar.haftalikOdul;
        await duyur(client, guild, ayar.kanal, userId,
          '🏆 Haftalık Görev Tamamlandı!',
          `🏆 Haftalık görev tamamlandı! **+${ayar.haftalikOdul} coin** 🪙`, replyFn);
      }
      sonuc.haftalik = { ilerleme: kay.ilerleme, hedef: ayar.haftalikHedef, tamamlandi: !!kay.tamam };
    } else {
      sonuc.haftalik = { ilerleme: kay.ilerleme, hedef: ayar.haftalikHedef, tamamlandi: true };
    }
  }
  // Eski gün kayıtlarını buda (şişmesin)
  try {
    const keys = Object.keys(d.gorevler);
    if (keys.length > 5000) {
      const bugun = gunAnahtar(), buHafta = 'H' + isoHafta();
      for (const k of keys) {
        if (k.endsWith('_' + bugun) || k.includes('_' + buHafta)) continue;
        delete d.gorevler[k];
      }
    }
  } catch {}
  save();
  return sonuc;
}

function gorevDurum(gid, uid) {
  const ayar = gorevAyar(gid);
  const d = db();
  const g = (d.gorevler || {})[`${gid}_${uid}_${gunAnahtar()}`] || { ilerleme: 0, tamam: false };
  const h = (d.gorevler || {})[`${gid}_${uid}_H${isoHafta()}`] || { ilerleme: 0, tamam: false };
  return { ayar, gunluk: g, haftalik: h };
}

module.exports = { TURLER, TUR_AD, gorevAyar, gunAnahtar, isoHafta, gorevIlerle, gorevDurum };
