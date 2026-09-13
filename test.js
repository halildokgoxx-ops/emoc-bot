// 🧪 npm test — Discord'a DOKUNMADAN tüm komutları + altyapıyı doğrular.
// Metadata bütünlüğü, alias çakışması, slash şeması, saf fonksiyon unit testleri.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const T = (ad, kosul, detay = '') => {
  if (kosul) { pass++; console.log(`✅ ${ad}`); }
  else { fail++; console.log(`❌ ${ad}${detay ? ' → ' + detay : ''}`); }
};

// ---------- 1. Komut yükleme + metadata ----------
const { Collection } = require('discord.js');
const cmds = new Collection();
for (const f of fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))) {
  const arr = require(`./commands/${f}`);
  const liste = Array.isArray(arr) ? arr : [arr];
  for (const c of liste) {
    if (!c.name || c.name.startsWith('__')) continue;
    cmds.set(c.name.toLowerCase(), c);
  }
}
T('komut sayısı 130+', cmds.size >= 130, String(cmds.size));

const isimler = new Set(), aliaslar = new Map(), metaHata = [];
for (const c of cmds.values()) {
  if (isimler.has(c.name)) metaHata.push('çift isim: ' + c.name);
  isimler.add(c.name);
  if (typeof c.run !== 'function') metaHata.push(c.name + ': run() yok');
  if (!c.description) metaHata.push(c.name + ': açıklama yok');
  if (!c.usage) metaHata.push(c.name + ': usage yok');
  if (!c.category) metaHata.push(c.name + ': kategori yok');
  for (const a of c.aliases || []) {
    const k = String(a).toLowerCase();
    if (isimler.has(k)) metaHata.push(`${c.name}: alias isimle çakışıyor (${a})`);
    if (aliaslar.has(k)) metaHata.push(`${c.name}: alias çakışması (${a} ↔ ${aliaslar.get(k)})`);
    aliaslar.set(k, c.name);
  }
  for (const o of c.slashOptions || []) {
    if (!['string', 'integer', 'user', 'channel', 'role'].includes(o.type)) metaHata.push(`${c.name}: bozuk option tipi`);
    if (!o.name || o.name.length > 32) metaHata.push(`${c.name}: bozuk option adı`);
  }
  if (c.slashArgs && typeof c.slashArgs !== 'function') metaHata.push(c.name + ': slashArgs fonksiyon değil');
  if (c.perms && !Array.isArray(c.perms)) metaHata.push(c.name + ': perms dizi değil');
}
T('komut metadatası temiz', metaHata.length === 0, metaHata.slice(0, 8).join(' | '));

// ---------- 2. utils unit testleri ----------
const u = require('./src/utils');
T('parseSure 10m', u.parseSure('10m') === 600000);
T('parseSure 2h', u.parseSure('2h') === 7200000);
T('parseSure 1d', u.parseSure('1d') === 86400000);
T('parseSure geçersiz', u.parseSure('xyz') === 0);
T('sureYaz 65sn', u.sureYaz(65000) === '1dk 5sn');
T('sureYaz 0', u.sureYaz(0) === '0sn');
T('kufurMu +', u.kufurMu('sen tam bir malsın') === true);
T('kufurMu -', u.kufurMu('merhaba nasılsın') === false);
T('linkMu +', u.linkMu('bak https://google.com') === true);
T('linkMu -', u.linkMu('selam naber') === false);
T('dolandiriciMi +', u.dolandiriciMi('bedava discord.gift/abc al') === true);
T('dolandiriciMi -', u.dolandiriciMi('selam naber') === false);
T('davetKoduBul', u.davetKoduBul('gel https://discord.gg/abc123 hadi') === 'abc123');
T('oto kelime (sa/masa)', u.otoEslesme('sa', 'masa') === false && u.otoEslesme('sa', 'sa naber') === true && u.otoEslesme('sa', 'Sa') === true);
T('oto tam', u.otoEslesme('sa', 'sa', 'tam') === true && u.otoEslesme('sa', 'sa naber', 'tam') === false);
T('oto icerir', u.otoEslesme('sa', 'masa', 'icerir') === true);
T('oto varsayilan kelime', u.otoEslesme('selam', 'iyi selamlar') === false && u.otoEslesme('iyi geceler', 'iyi geceler herkese') === true);
T('rastgele aralık', (() => { const r = u.rastgele(5, 5); return r === 5; })());

// ---------- 3. slash şeması ----------
const { buildSlashPayload } = require('./src/slash');
const r = buildSlashPayload(cmds);
T('slash 100 ve altı', r.payload.length <= 100, String(r.payload.length));
const isimRe = /^[-_\p{L}\p{N}]{1,32}$/u;
const slashHata = [];
for (const p of r.payload) {
  if (!isimRe.test(p.name) || /[A-Z]/.test(p.name)) slashHata.push('isim: ' + p.name);
  if (!p.description || p.description.length > 100) slashHata.push('açıklama: ' + p.name);
  const kontrol = (opts, yol) => {
    let opsiyonelGoruldu = false;
    for (const o of opts || []) {
      if (o.type === 1) { kontrol(o.options, yol + '.' + o.name); continue; }
      if (![3, 4, 6, 7, 8].includes(o.type)) slashHata.push(`tip: ${yol}.${o.name}`);
      if (o.required) { if (opsiyonelGoruldu) slashHata.push(`${yol}.${o.name}: zorunlu sona kalmış`); }
      else opsiyonelGoruldu = true;
    }
  };
  kontrol(p.options, p.name);
}
T('slash şeması geçerli', slashHata.length === 0, slashHata.slice(0, 8).join(' | '));

// ---------- 4. web SEMA temizle ----------
const { SEMA, temizle } = require('./web/server');
const sahteGuild = {
  roles: { cache: new Map([['111111111111111111', {}]]) },
  channels: { cache: new Map([['222222222222222222', {}]]) },
};
T('SEMA dolu', Object.keys(SEMA).length >= 20, String(Object.keys(SEMA).length));
T('temizle bool', temizle('bool', true) === true && temizle('bool', 1) === false);
T('temizle kanal ok', temizle('kanal', '<#222222222222222222>', sahteGuild) === '222222222222222222');
T('temizle kanal yok', temizle('kanal', '<#999999999999999999>', sahteGuild) === null);
T('temizle sayi clamp', temizle('sayi:0:100', '9999') === 100);
T('temizle yazi kes', temizle('yazi:5', 'merhaba dünya') === 'merha');

// ---------- 5. modüller yükleniyor mu ----------
T('tasarim', !!require('./src/tasarim').kart);
T('emo', !!require('./src/emo').E);
T('gif', !!require('./src/gif').animeGif);
T('logger', !!require('./src/logger').logSilinen);
T('embeds rozet', require('./src/embeds').repRozet(100) === '💎 ELMAS');

// ---------- 6b. premium (saf fonksiyonlar, db'ye yazmaz) ----------
const PR = require('./src/premium');
T('sureParse 30d', PR.sureParse('30d') === 30);
T('sureParse 1y', PR.sureParse('1y') === 365);
T('sureParse sinirsiz', PR.sureParse('sinirsiz') === 36500);
T('sureParse bos', PR.sureParse('xyz') === 0);
T('sahipMi yabanci', PR.sahipMi('123') === false);
T('ceza helper', (() => {
  try {
    const DB = require('./src/db');
    const id = '999000111222333444';
    DB.cezaKaydet(id, 'ban', 'test sebep');
    DB.cezaKaydet(id, 'kick', 'test2');
    DB.cezaKaydet(id, 'zzz', 'yok sayilmali');
    const g = DB.cezaGecmisi(id);
    const ok = g.ban === 1 && g.kick === 1 && g.mute === 0 && g.kayitlar.length === 2;
    delete DB.db().cezaGecmisi[id];
    return ok;
  } catch { return false; }
})());
T('premiumMu yok', PR.premiumMu('0') === false);

// ---------- 6. web köprü entegrasyonu (gerçek HTTP, sahte istemci) ----------
(async () => {
  T('bridge modülü yükleniyor', (() => { try { require('./web/bridge'); return true; } catch { return false; } })());
  T('botapi 403 kalkanı + şekil', await (async () => {
    try {
      const express = require('express');
      const { mountBotAPI } = require('./web/botapi');
      const app = express();
      mountBotAPI(app, { user: null, guilds: { cache: new Map() } });
      const srv = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
      const port = srv.address().port;
      const onceki = process.env.BRIDGE_SECRET;
      process.env.BRIDGE_SECRET = 'test-gizli-123';
      const kod1 = await fetch(`http://localhost:${port}/api/bot/ping`).then((r) => r.status).catch(() => 0);
      const kod2 = await fetch(`http://localhost:${port}/api/bot/ping`, { headers: { 'x-bridge-secret': 'yanlis' } }).then((r) => r.status).catch(() => 0);
      const j3 = await fetch(`http://localhost:${port}/api/bot/ping`, { headers: { 'x-bridge-secret': 'test-gizli-123' } }).then((r) => r.json()).catch(() => ({}));
      const j4 = await fetch(`http://localhost:${port}/api/bot/guilds`, { headers: { 'x-bridge-secret': 'test-gizli-123' } }).then((r) => r.json()).catch(() => ({}));
      const j5 = await fetch(`http://localhost:${port}/api/bot/guild/123`, { method: 'POST', headers: { 'x-bridge-secret': 'test-gizli-123', 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.status).catch(() => 0);
      await new Promise((res) => srv.close(res));
      if (onceki === undefined) delete process.env.BRIDGE_SECRET; else process.env.BRIDGE_SECRET = onceki;
      return kod1 === 403 && kod2 === 403 && j3.ok === true && Array.isArray(j4.guilds) && j5 === 404;
    } catch { return false; }
  })());

// ---------- 8. premium OP + level grupları ----------
const PRM = require('./commands/premium');
  T('premium 15 OP komut', (PRM.premiumKomutlar || []).length === 15, String((PRM.premiumKomutlar || []).length));
T('premium grup altlar', ['aktiflestir', 'bilgi', 'ai-kanal'].every((n) => (require('./commands/premium').premiumSlash?.data?.options || []).some((o) => o.name === n)));
T('OP slash hepsi kayitli', ['yapiskan', 'oto-cevap', 'yedek', 'giris-dm', 'seviye-hiz', 'sayac-pro', 'hosgeldin', 'gorusuruz', 'oto-roller', 'tag', 'oto-cekilis', 'davet-odul'].every((n) => r.payload.some((p) => p.name === n)));
T('level grubu kayitli', r.payload.some((p) => p.name === 'level'));

// ---------- 9. EmocAI ----------
const AIM = require('./src/ai');
T('EmocAI kimlik', AIM.SYSTEM.includes('EmocAI'));
T('model yedekli', !!AIM.MODEL && !!AIM.MODEL && AIM.MODEL !== 'llama-3.3-70b-versatile');
T('limit free/prem', AIM.limitFor(false) === 15 && AIM.limitFor(true) === 100);
T('ai-kanal premiumda', (require('./commands/premium').premiumSlash?.data?.options || []).some((o) => o.name === 'ai-kanal'));
T('/ai komutu var', (() => { try { return !!require('./commands/ai'); } catch { return false; } })());

// ---------- 10. free/premium katmanları (ticket-ekle modeli) ----------
T('rol limit sabitleri', (() => { try { const R = require('./commands/roller'); return R.ROL_FREE_LIMIT === 5 && R.ROL_PREM_LIMIT === 20 && R.rolLimiti('0') === 5; } catch { return false; } })());
T('ticket limit sabitleri', (() => { try { const TK = require('./commands/ticket'); return TK.TICKET_FREE_LIMIT === 1 && TK.TICKET_PREM_LIMIT === 3 && TK.ticketLimiti('0') === 1 && TK.sahipUid({ sahip: '5' }, '5:2') === '5' && TK.bosSlot({ acik: {} }, '9') === '9'; } catch { return false; } })());
T('ticket puan fn', (() => { try { const TK = require('./commands/ticket'); return typeof TK.ticketKapatAkis === 'function'; } catch { return false; } })());
T('deneme premium', PR.DENEME_GUN === 7 && typeof PR.denemeKullan === 'function' && typeof PR.denemeHakki === 'function' && (require('./commands/premium').premiumSlash?.data?.options || []).some((o) => o.name === 'dene'));
T('sahip gizli komutlar', ['komut-ac', 'komut-kapat', 'komut-liste', 'restart'].every((n) => cmds.has(n)) && ['komut-ac', 'komut-kapat', 'komut-liste', 'restart'].every((n) => !r.payload.some((p) => p.name === n)));
T('sahip hardcode ID yok', (() => { const t = fs.readFileSync(path.join(__dirname, 'commands', 'sahip.js'), 'utf8'); return !/\d{15,22}/.test(t); })());
T('kura free limit', (() => { const t = fs.readFileSync(path.join(__dirname, 'commands', 'faydali.js'), 'utf8'); return t.includes('premiumMu') && t.includes('Free kura'); })());
T('web liste guard', (() => { const t = fs.readFileSync(path.join(__dirname, 'web', 'server.js'), 'utf8'); return t.includes('LISTE_LIMIT') && t.includes('premium-gerek'); })());
T('oneri modul', (() => {
  try {
    const O = require('./src/oneriler');
    const oyun = O.oyunGetir('2026-09-13');
    return O.OYUNLAR.length >= 20 && !!oyun.ad && !!oyun.aciklama &&
      O.turkceTarih(2015, 7, 5) === '5 Temmuz 2015' &&
      O.TUR_MAP['Action'] === 'Aksiyon' && O.DURUM_MAP.FINISHED === 'Tamamlandı' &&
      typeof O.animeEmbed === 'function' && typeof O.oyunEmbed === 'function' &&
      typeof O.oneriTara === 'function' &&
      ['anime-oneri', 'oyun-oneri', 'oneri-kanal'].every((n) => cmds.has(n));
  } catch { return false; }
})());
T('web JS syntax', (() => {
  try {
    const cp = require('child_process');
    for (const f of ['web/public/app.js', 'web/server.js', 'web/bridge.js', 'web/botapi.js', 'web/aksiyon.js']) {
      cp.execSync(`node --check ${f}`, { cwd: __dirname, stdio: 'pipe' });
    }
    return true;
  } catch { return false; }
})());
T('gorev motoru', (() => {
  try {
    const G = require('./src/gorev');
    const a = G.gorevAyar('0');
    const hw = G.isoHafta(new Date(Date.UTC(2026, 8, 13)));
    return a.aktif === true && a.tur === 'mesaj' && a.gunlukHedef === 20 && a.gunlukOdul === 200 &&
      a.haftalikAktif === false && hw === '2026-W37' && G.gunAnahtar(new Date(Date.UTC(2026, 0, 5))) === '2026-01-05';
  } catch { return false; }
})());
T('gorev komutlari', cmds.has('gorev-ayarla') && cmds.has('gunluk-gorev') && r.payload.some((p) => p.name === 'gorev-ayarla'));
T('oryantasyon', typeof require('./commands/sunucu').oryantasyonKur === 'function' && !(require('./commands/sunucu').sunucuSlash?.data?.options || []).some((o) => o.name === 'oryantasyon'));
T('itiraf akisi', (() => {
  try {
    const O = require('./commands/ozel');
    const internal = O.find((c) => c.name === '__itiraf_internal__');
    return typeof O.itirafSecimSor === 'function' && !!internal && typeof internal.button === 'function' &&
      O.some((c) => c.name === 'itiraf') && O.some((c) => c.name === 'itiraf-ayarla');
  } catch { return false; }
})());
T('oyun motoru', (() => {
  try {
    const O = require('./src/oyun');
    return O.kelimeTemizle('  Merhaba! ') === 'merhaba' && O.sonHarf('Araba') === 'a' &&
      typeof O.oyunSayi === 'function' && typeof O.oyunKelime === 'function';
  } catch { return false; }
})());
T('gorev SEMA', ['gorevAktif', 'gorevKanal', 'gorevTur', 'gorevGunlukMesaj', 'gorevGunlukOdul', 'gorevHaftalikAktif', 'gorevHaftalikMesaj', 'gorevHaftalikOdul'].every((k) => k in require('./web/server').SEMA));
T('medya gif ayikla', (() => { const r = u.medyaAyikla('selam https://cdn.discord.com/a.gif oley'); return r.resim === 'https://cdn.discord.com/a.gif' && r.metin.includes('selam'); })());
T('medya yok', (() => { const r = u.medyaAyikla('sadece yazi'); return r.resim === null; })());
T('SEMA yeni alanlar', ['cikisMesaj', 'sayacMesaj', 'seviyeHiz', 'girisDM'].every((k) => k in require('./web/server').SEMA));
T('SEMA muaf alanlar', ['linkMuaf', 'kufurMuaf', 'spamMuaf', 'capsMuaf', 'yasakMuaf'].every((k) => require('./web/server').SEMA[k] === 'muaf'));
// index.js içinde kullanılan *Map'lerin hepsi tanımlı mı? (tanımsız Map = her mesajda crash)
T('Map tanımları tam', (() => {
  const t = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  const decl = new Set([...t.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new Map\(\)/g)].map((m) => m[1]));
  const kull = new Set([...t.matchAll(/([A-Za-z_$][\w$]*Map)\.(get|set|has|delete|clear)/g)].map((m) => m[1]));
  const eksik = [...kull].filter((k) => !decl.has(k));
  if (eksik.length) console.log('   eksik Map:', eksik.join(', '));
  return eksik.length === 0;
})());

  console.log(`\n📊 SONUÇ: ${pass} geçti, ${fail} kaldı`);
  await new Promise((r) => setTimeout(r, 300)); // kapanan soketler bitsin (win libuv)
  process.exit(fail ? 1 : 0);
})();
