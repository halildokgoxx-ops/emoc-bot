// 👑 Premium sistemi: kod üret (kurucu) → sunucuda aktifleştir → süreli avantajlar.
// Premium SADECE kodun girildiği sunucuda geçerlidir!
const { db, save } = require('./db');

function SAHIPLER() {
  return [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean).map(String);
}
function sahipMi(uid) {
  return SAHIPLER().includes(String(uid));
}

function premDB() {
  const d = db();
  if (!d.premium) d.premium = { kodlar: {}, sunucular: {} };
  if (!d.premium.kodlar) d.premium.kodlar = {};
  if (!d.premium.sunucular) d.premium.sunucular = {};
  return d.premium;
}

function premiumMu(gid) {
  const s = premDB().sunucular[String(gid)];
  return !!(s && s.bitis > Date.now());
}

function premiumBilgi(gid) {
  const s = premDB().sunucular[String(gid)];
  if (!s || s.bitis <= Date.now()) return null;
  return s;
}

const HARFLER = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function kodUret(gun, olusturan) {
  const p = premDB();
  const parca = () => Array.from({ length: 4 }, () => HARFLER[Math.floor(Math.random() * HARFLER.length)]).join('');
  let kod;
  do { kod = `EMOC-${parca()}-${parca()}`; } while (p.kodlar[kod]);
  p.kodlar[kod] = { gun, olusturan: String(olusturan), kullanan: null, kullanim: null, tarih: Date.now() };
  save();
  return kod;
}

function sureParse(str) {
  const s = String(str || '').toLocaleLowerCase('tr').trim();
  if (['sinirsiz', 'sınırsız', 'sinirsiz♾️', 'omur', 'ömür', 'lifetime'].includes(s)) return 36500;
  let m = s.match(/^(\d+)\s*(gün|gun|g|d)?$/);
  if (m) return parseInt(m[1], 10);
  m = s.match(/^(\d+)\s*(ay|aylik|aylık)$/);
  if (m) return parseInt(m[1], 10) * 30;
  m = s.match(/^(\d+)\s*(yıl|yil|y|sene)$/);
  if (m) return parseInt(m[1], 10) * 365;
  return 0;
}

function kodKullan(kod, gid, uid) {
  kod = String(kod || '').trim().toUpperCase();
  const p = premDB();
  const k = p.kodlar[kod];
  if (!k) return { hata: 'Kod bulunamadı! Harfleri kontrol et.' };
  if (k.kullanan) return { hata: 'Bu kod zaten kullanılmış!' };
  k.kullanan = String(uid);
  k.kullanim = Date.now();
  p.sunucular[String(gid)] = { bitis: Date.now() + k.gun * 86400000, kod };
  save();
  return { ok: true, bitis: p.sunucular[String(gid)].bitis, gun: k.gun };
}

function premiumVer(gid, gun) {
  premDB().sunucular[String(gid)] = { bitis: Date.now() + gun * 86400000, kod: 'ADMIN' };
  save();
}

// Deneme premiumu: sunucu başına 1 kez, 7 gün
const DENEME_GUN = 7;
function denemeHakki(gid) {
  const p = premDB();
  if (premiumMu(gid)) return { hata: 'Bu sunucuda zaten aktif premium var!' };
  if (p.deneme && p.deneme[String(gid)]) return { hata: 'Bu sunucu deneme hakkını zaten kullandı!' };
  return { ok: true };
}
function denemeKullan(gid, uid) {
  const h = denemeHakki(gid);
  if (h.hata) return h;
  const p = premDB();
  if (!p.deneme) p.deneme = {};
  p.deneme[String(gid)] = { kullanan: String(uid), tarih: Date.now() };
  p.sunucular[String(gid)] = { bitis: Date.now() + DENEME_GUN * 86400000, kod: 'DENEME' };
  save();
  return { ok: true, bitis: p.sunucular[String(gid)].bitis, gun: DENEME_GUN };
}

function premiumAl(gid) {
  delete premDB().sunucular[String(gid)];
  save();
}

// Süresi dolanları temizler, silinen sunucu listesini döndürür
function suresiDolmusTemizle() {
  const p = premDB();
  const giden = [];
  for (const [gid, s] of Object.entries(p.sunucular)) {
    if (!s || s.bitis <= Date.now()) {
      delete p.sunucular[gid];
      giden.push(gid);
    }
  }
  if (giden.length) save();
  return giden;
}

module.exports = {
  SAHIPLER, sahipMi, premiumMu, premiumBilgi,
  kodUret, sureParse, kodKullan, premiumVer, premiumAl, suresiDolmusTemizle,
  DENEME_GUN, denemeHakki, denemeKullan,
};
