// 🛡️ Koruma modülü — komut spamı, etkileşim spamı, tekrar suçlu çarpanı,
// premium kod brute-force ve boost-premium sahtekarlık (revoke) denetimi.
const { db, save } = require('./db');

function kdb() {
  const d = db();
  if (!d.koruma) d.koruma = { komutSpam: 0, etkilesimSpam: 0, revoke: 0, kodBrute: 0, olaylar: [] };
  if (!Array.isArray(d.koruma.olaylar)) d.koruma.olaylar = [];
  return d.koruma;
}
function olayEkle(tur, detay) {
  try {
    const k = kdb();
    k.olaylar.unshift({ tur, detay: String(detay || '').slice(0, 160), tarih: Date.now() });
    k.olaylar = k.olaylar.slice(0, 20);
    save();
  } catch {}
}

// ---- Komut rate limit: 10sn'de 8+ → uyarı+ignore, 15sn'de 15+ → 5dk susturma ----
const komutPencere = new Map(); // uid -> [ts]
function komutKontrol(uid) {
  const simdi = Date.now();
  const arr = (komutPencere.get(String(uid)) || []).filter((t) => simdi - t < 15000);
  arr.push(simdi);
  komutPencere.set(String(uid), arr);
  if (komutPencere.size > 2000) komutPencere.clear();
  const on = arr.filter((t) => simdi - t < 10000).length;
  if (on >= 15) {
    try { kdb().komutSpam++; olayEkle('komut-spam', `${uid} (${on}/10sn)`); save(); } catch {}
    return { durum: 'ceza' };
  }
  if (on >= 8) return { durum: 'yavas' };
  return { durum: 'ok' };
}

// ---- Etkileşim (buton/menü) spamı: 10sn'de 20+ → 60sn sessiz ignore ----
const etkPencere = new Map();
const etkYasak = new Map(); // uid -> bitis
function etkilesimYasakliMi(uid) {
  const b = etkYasak.get(String(uid)) || 0;
  if (Date.now() < b) return true;
  etkYasak.delete(String(uid));
  return false;
}
function etkilesimYasakla(uid, ms = 60000) {
  etkYasak.set(String(uid), Date.now() + ms);
}
function etkilesimKontrol(uid) {
  const simdi = Date.now();
  const arr = (etkPencere.get(String(uid)) || []).filter((t) => simdi - t < 10000);
  arr.push(simdi);
  etkPencere.set(String(uid), arr);
  if (etkPencere.size > 2000) etkPencere.clear();
  if (arr.length >= 20) {
    try { kdb().etkilesimSpam++; olayEkle('etkilesim-spam', `${uid} (${arr.length}/10sn)`); save(); } catch {}
    return false;
  }
  return true;
}

// ---- Tekrar suçlu çarpanı: son 7 gün ceza sayısına göre timeout süresi katlanır ----
function tekrarCarpani(uid) {
  try {
    const d = db();
    const liste = (d.cezaGecmisi && d.cezaGecmisi[String(uid)]) || [];
    const esik = Date.now() - 7 * 86400_000;
    const n = liste.filter((k) => k.tarih >= esik).length;
    if (n >= 4) return 4;
    if (n >= 2) return 2;
    return 1;
  } catch { return 1; }
}

// ---- Premium kod brute-force: 10dk'da 5 hatalı → 1sa engel ----
const kodHata = new Map(); // uid -> {sayi, son}
function kodEngelliMi(uid) {
  const k = kodHata.get(String(uid));
  return !!(k && k.sayi >= 5 && Date.now() - k.son < 60 * 60_000);
}
function kodDeneme(uid, basarili) {
  const simdi = Date.now();
  let k = kodHata.get(String(uid)) || { sayi: 0, son: 0 };
  if (simdi - k.son > 10 * 60_000) k = { sayi: 0, son: 0 };
  if (basarili) { kodHata.delete(String(uid)); return { engelli: false }; }
  k.sayi++;
  k.son = simdi;
  kodHata.set(String(uid), k);
  if (k.sayi >= 5) {
    try { kdb().kodBrute++; olayEkle('kod-brute', `${uid} (5 hatalı kod)`); save(); } catch {}
    return { engelli: true };
  }
  return { engelli: false, kalan: 5 - k.sayi };
}

// ---- Boost-premium doğrulama: boostu çekenden premiumu geri al ----
async function destekIdBul(client) {
  try {
    if (globalThis._destekId) return globalThis._destekId;
    const dav = await client.fetchInvite('urYcW4ubqT').catch(() => null);
    if (dav && dav.guild) globalThis._destekId = dav.guild.id;
    return globalThis._destekId || null;
  } catch { return null; }
}
async function boostDogrula(client) {
  const out = { kontrol: 0, revoke: [] };
  try {
    const P = require('./premium');
    const gid = await destekIdBul(client);
    if (!gid) return out;
    const destek = client.guilds.cache.get(gid);
    if (!destek) return out;
    const d = db();
    const sunucular = (d.premium && d.premium.sunucular) || {};
    for (const [sunucuId, s] of Object.entries(sunucular)) {
      if (!s || s.kod !== 'BOOST' || !s.sahip || s.bitis <= Date.now()) continue;
      out.kontrol++;
      let hala = false;
      try {
        let uye = destek.members.cache.get(String(s.sahip));
        if (!uye) uye = await destek.members.fetch(String(s.sahip)).catch(() => null);
        hala = !!(uye && uye.premiumSince);
      } catch {}
      if (!hala) {
        P.premiumAl(sunucuId);
        out.revoke.push(sunucuId);
        try { kdb().revoke++; olayEkle('boost-revoke', `${sunucuId} (sahip: ${s.sahip})`); save(); } catch {}
        try {
          const hedef = client.guilds.cache.get(sunucuId);
          const lcId = hedef ? require('./db').getGuild(sunucuId).logKanal : null;
          const lc = lcId && hedef ? hedef.channels.cache.get(lcId) : null;
          if (lc) lc.send('👑 Boost geri çekildiği için bu sunucunun **boost-premiumu iptal edildi!**').catch(() => {});
        } catch {}
      }
    }
  } catch {}
  return out;
}

function korumaOzet() {
  const k = kdb();
  return {
    komutSpam: k.komutSpam || 0, etkilesimSpam: k.etkilesimSpam || 0,
    revoke: k.revoke || 0, kodBrute: k.kodBrute || 0,
    olaylar: (k.olaylar || []).slice(0, 20),
  };
}

module.exports = {
  komutKontrol, etkilesimKontrol, etkilesimYasakliMi, etkilesimYasakla,
  tekrarCarpani, kodEngelliMi, kodDeneme, boostDogrula, destekIdBul,
  korumaOzet, olayEkle,
};
