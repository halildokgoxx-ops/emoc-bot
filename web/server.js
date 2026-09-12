// 🌐 EMOÇ Web Panel — bot ile AYNI process'te çalışır (Render'da tek servis!).
// Discord OAuth2 girişi → sunucularını seç → tüm bot ayarlarını webden yönet.
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { getGuild, setGuild, save } = require('../src/db');

const fs = require('fs');
const OTURUM_DOSYA = path.join(__dirname, '..', 'data', 'oturumlar.json');
const sessions = new Map(); // sid -> { token, exp, user }
try {
  const ham = fs.readFileSync(OTURUM_DOSYA, 'utf8');
  const obje = JSON.parse(ham || '{}');
  const simdi = Date.now();
  for (const [k, v] of Object.entries(obje)) {
    if (v && v.exp > simdi && v.token && v.user) sessions.set(k, v);
  }
} catch {}
let oturumKayitZaman = null;
function oturumKaydet() {
  clearTimeout(oturumKayitZaman);
  oturumKayitZaman = setTimeout(() => {
    try {
      const obje = {};
      for (const [k, v] of sessions) obje[k] = v;
      fs.mkdirSync(path.dirname(OTURUM_DOSYA), { recursive: true });
      fs.writeFileSync(OTURUM_DOSYA, JSON.stringify(obje));
    } catch {}
  }, 500);
}
setInterval(() => {
  const simdi = Date.now();
  let degisti = false;
  for (const [k, v] of sessions) if (v.exp < simdi) { sessions.delete(k); degisti = true; }
  if (degisti) oturumKaydet();
}, 3600_000).unref?.();

// Premium sunucu gerektiren panel ayarları (free kayıtta atılır)
const PREMIUM_AYARLAR = new Set([
  'yapiskan', 'seviyeHiz', 'girisDM', 'girisDMAt',
  'sesXP', 'sesXPDakika', 'sesXPMin', 'sesXPAfk',
  'prefix', 'davetRolu', 'govDavet', 'govHesap', 'webhookOnayKanal',
  'etiketAktif', 'etiketRol',
]);
// Webden değiştirilebilir ayar şeması: key -> tip
const SEMA = {
  antiLink: 'bool', antiKufur: 'bool', antiSpam: 'bool', antiRaid: 'bool',
  antiBot: 'bool', capsEngel: 'bool', altKoruma: 'bool',
  yapiskan: 'bool', logAktif: 'bool',
  linkMuaf: 'muaf', kufurMuaf: 'muaf', spamMuaf: 'muaf', capsMuaf: 'muaf', yasakMuaf: 'muaf',
  linkMuafKanal: 'muafKanal', kufurMuafKanal: 'muafKanal', spamMuafKanal: 'muafKanal',
  capsMuafKanal: 'muafKanal', yasakMuafKanal: 'muafKanal',
  logKanal: 'kanal', hosgeldinKanal: 'kanal', cikisKanal: 'kanal',
  sayacKanal: 'kanal', repBildirimKanal: 'kanal', partnerKanal: 'kanal',
  partnerChat: 'kanal', partnerYetkiliKanal: 'kanal', itirafKanal: 'kanal',
  gununSorusuKanal: 'kanal', aiKanal: 'kanal',
  guvenlikKanal: 'kanal', seviyeKanal: 'kanal', davetKanal: 'kanal', davetCikisKanal: 'kanal',
  otoRol: 'rol', partnerYetkiliRol: 'rol',
  hosgeldinMesaj: 'yazi:1000', partnerText: 'yazi:1500',
  cikisMesaj: 'yazi:1000', sayacMesaj: 'yazi:500', girisDM: 'yazi:1000',
  seviyeMesaj: 'yazi:500', yeniIsimSablon: 'yazi:100',
  davetGirisMesaj: 'yazi:1000', davetCikisMesaj: 'yazi:1000',
  sayacHedef: 'sayi:0:100000', repSuresiDk: 'sayi:0:4320', seviyeHiz: 'sayi:1:5',
  xpMin: 'sayi:1:100', xpMax: 'sayi:1:200', xpSoguma: 'sayi:0:600',
  sesXPDakika: 'sayi:1:100', sesXPMin: 'sayi:1:10',
  yoneticiRol: 'rolCoklu', moderatorRol: 'rolCoklu',
  girisEtiketKanal: 'muafKanal',
  // açma/kapama bayrakları
  mesajXP: 'bool', sesXP: 'bool', sesXPAfk: 'bool', seviyeOzel: 'bool',
  otoRolAktif: 'bool', hosgeldinResim: 'bool', hosgeldinAt: 'bool',
  girisDMAt: 'bool', girisEtiket: 'bool', cikisAt: 'bool',
  davetGirisAt: 'bool', davetCikisAt: 'bool', davetRolu: 'bool',
  takmaTemizle: 'bool', yeniIsimAktif: 'bool', isimFiltre: 'bool', isimFiltreBaglanti: 'bool',
  // otomatik moderasyon konfigleri (json obje)
  amReklam: 'json', amKufur: 'json', amLink: 'json', amKelime: 'json',
  amTekrar: 'json', amFlood: 'json', amCaps: 'json', amEmoji: 'json',
  amEtiket: 'json', amUzun: 'json', amKarakter: 'json', amFoto: 'json',
  logOlaylar: 'json', isimKelimeler: 'json', gomuluMesajlar: 'json',
  emojiRoller: 'json', denetimNot: 'yazi:500',
  govDavet: 'bool', govHesap: 'bool', govRol: 'bool', govBot: 'bool',
  govYasak: 'bool', govAtma: 'bool', govKanal: 'bool', govWebhook: 'bool', govEmoji: 'bool',
  govKanalSayi: 'sayi:1:50', govKanalDakika: 'sayi:1:60',
  govYasakSayi: 'sayi:1:50', govYasakDakika: 'sayi:1:60',
  govAtmaSayi: 'sayi:1:50', govAtmaDakika: 'sayi:1:60',
  govRolSayi: 'sayi:1:50', govRolDakika: 'sayi:1:60',
  govHesapGun: 'sayi:1:30', davetMuaf: 'muaf',
  prefix: 'yazi:5', starboard: 'json', webhookOnayKanal: 'kanal',
  etiketAktif: 'bool', etiketRol: 'rol',
};

async function discordAPI(token, yol, init = {}) {
  const r = await fetch(`https://discord.com/api/v10${yol}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error('discord ' + r.status);
  return r.json();
}

function oturum(req) {
  const m = (req.headers.cookie || '').match(/emoc_sid=([a-f0-9]+)/);
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s || s.exp < Date.now()) { sessions.delete(m[1]); return null; }
  return { sid: m[1], ...s };
}

function temizle(tip, v, guild) {
  if (tip === 'bool') return v === true;
  if (tip === 'rol' || tip === 'kanal') {
    if (!v) return null;
    const id = String(v).replace(/\D/g, '');
    if (!/^\d{15,25}$/.test(id)) return null;
    const col = tip === 'rol' ? guild.roles.cache : guild.channels.cache;
    return col.has(id) ? id : null;
  }
  if (tip.startsWith('yazi')) {
    const max = parseInt(tip.split(':')[1], 10) || 500;
    return String(v || '').slice(0, max);
  }
  if (tip.startsWith('sayi')) {
    const parca = tip.split(':');
    const min = Number(parca[1] ?? 0) || 0;
    const max = Number(parca[2] ?? 0) || 0;
    let n = parseInt(v, 10);
    if (isNaN(n)) n = min;
    if (max > 0) n = Math.min(max, n);
    return Math.max(min, n);
  }
  if (tip === 'muaf') {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => String(x).replace(/\D/g, '')))]
      .filter((id) => /^\d{15,25}$/.test(id) && guild.roles.cache.has(id)).slice(0, 10);
  }
  if (tip === 'rolCoklu') {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => String(x).replace(/\D/g, '')))]
      .filter((id) => /^\d{15,25}$/.test(id) && guild.roles.cache.has(id)).slice(0, 10);
  }
  if (tip === 'muafKanal') {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => String(x).replace(/\D/g, '')))]
      .filter((id) => /^\d{15,25}$/.test(id) && guild.channels.cache.has(id)).slice(0, 20);
  }
  if (tip === 'json') {
    try {
      if (v === null || v === undefined) return null;
      const s = JSON.stringify(v);
      if (!s || s.length > 20000) return null;
      return JSON.parse(s);
    } catch { return null; }
  }
  return null;
}

function startWeb(client) {
  const app = express();
  app.use(express.json({ limit: '12mb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  try { require('./botapi').mountBotAPI(app, client); } catch (e) { console.error('Bot API açılamadı:', e.message); }
  const PORT = process.env.PORT || 3000;
  const bazURL = () => (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

  app.get('/health', (req, res) => res.json({
    ok: true, bot: client.user ? client.user.tag : '?',
    sunucu: client.guilds.cache.size, uptime: Math.floor(process.uptime()),
  }));

  app.get('/davet', (req, res) => {
    const id = process.env.CLIENT_ID || (client.user && client.user.id) || '';
    res.redirect(`https://discord.com/oauth2/authorize?client_id=${id}&permissions=8&scope=bot%20applications.commands`);
  });

  app.get('/login', (req, res) => {
    const url = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || ''}` +
      `&redirect_uri=${encodeURIComponent(bazURL() + '/callback')}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
  });

  app.get('/logout', (req, res) => {
    const s = oturum(req);
    if (s) { sessions.delete(s.sid); oturumKaydet(); }
    res.setHeader('Set-Cookie', 'emoc_sid=; HttpOnly; Path=/; Max-Age=0');
    res.redirect('/');
  });

  app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/?hata=giris');
    try {
      if (!process.env.CLIENT_SECRET) throw new Error('CLIENT_SECRET yok');
      const body = new URLSearchParams({
        client_id: process.env.CLIENT_ID || '',
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: bazURL() + '/callback',
      });
      const r = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!r.ok) throw new Error('token alınamadı');
      const j = await r.json();
      const me = await discordAPI(j.access_token, '/users/@me');
      const sid = crypto.randomBytes(24).toString('hex');
      sessions.set(sid, {
        token: j.access_token,
        exp: Date.now() + ((j.expires_in || 604800) * 1000),
        user: { id: me.id, username: me.username, avatar: me.avatar },
      });
      oturumKaydet();
      const secure = bazURL().startsWith('https') ? '; Secure' : '';
      res.setHeader('Set-Cookie', `emoc_sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${secure}`);
      res.redirect('/app');
    } catch (e) {
      console.error('OAuth hatası:', e.message);
      res.redirect('/?hata=oauth');
    }
  });

  async function erisebilir(sess, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;
    const gs = await discordAPI(sess.token, '/users/@me/guilds');
    const g = gs.find((x) => x.id === guildId);
    if (!g) return null;
    if (!(g.owner || (BigInt(g.permissions) & 0x20n))) return null; // Sunucuyu Yönet
    return { guild, bilgi: g };
  }

  app.get('/api/me', (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    const sahipler = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean).map(String);
    res.json({ user: s.user, admin: sahipler.includes(String(s.user.id)) });
  });

  app.get('/api/istatistik', (req, res) => {
    try {
      const guilds = [...client.guilds.cache.values()];
      const uye = guilds.reduce((a, g) => a + (g.memberCount || 0), 0);
      const oneCikan = guilds.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0)).slice(0, 8)
        .map((g) => ({ ad: g.name, uye: g.memberCount || 0, ikon: g.iconURL({ size: 128 }) }));
      res.json({ sunucu: guilds.length, uye, uptime: Math.floor(process.uptime()), oneCikan });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  app.get('/api/komutlar', (req, res) => {
    try {
      const liste = [...client.commands.values()].map((c) => ({ ad: c.name, aciklama: c.description || '', kategori: c.category || 'Genel' }));
      res.json({ komutlar: liste, sayi: liste.length });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  function adminKontrol(req, res) {
    const s = oturum(req);
    if (!s) { res.status(401).json({ hata: 'giris-yok' }); return null; }
    const sahipler = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean).map(String);
    if (!sahipler.includes(String(s.user.id))) { res.status(403).json({ hata: 'admin-degil' }); return null; }
    return s;
  }

  app.get('/api/admin/ozet', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const { premiumBilgi } = require('../src/premium');
      const guilds = [...client.guilds.cache.values()];
      const uye = guilds.reduce((a, g) => a + (g.memberCount || 0), 0);
      const prem = [], free = [];
      for (const g of guilds) {
        const b = premiumBilgi(g.id);
        (b ? prem : free).push({ id: g.id, ad: g.name, uye: g.memberCount || 0, bittis: b ? b.bitis : null });
      }
      res.json({
        sunucu: guilds.length, uye, uptime: Math.floor(process.uptime()),
        premiumSayi: prem.length, freeSayi: free.length,
        premium: prem, free: free.slice(0, 60), oturum: sessions.size,
      });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  app.get('/api/admin/kanallar/:id', (req, res) => {
    if (!adminKontrol(req, res)) return;
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ hata: 'yok' });
    const kanallar = [...guild.channels.cache.values()]
      .filter((k) => k.type === 0 || k.type === 2)
      .map((k) => ({ id: k.id, ad: k.name, tip: k.type === 0 ? 'yazi' : 'ses' }))
      .slice(0, 150);
    res.json({ id: guild.id, ad: guild.name, kanallar });
  });

  app.post('/api/admin/premium', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const { premiumVer, premiumAl } = require('../src/premium');
      const { guildId, islem, gun } = req.body || {};
      if (!client.guilds.cache.get(guildId)) return res.status(404).json({ hata: 'yok' });
      if (islem === 'kapat') premiumAl(guildId);
      else premiumVer(guildId, Math.max(1, Math.min(36500, parseInt(gun, 10) || 30)));
      res.json({ ok: true });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  app.post('/api/admin/duyuru', async (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const { guildId, channelId, mesaj, everyone } = req.body || {};
      const guild = client.guilds.cache.get(guildId);
      const kanal = guild?.channels.cache.get(channelId);
      if (!kanal || !kanal.isTextBased()) return res.status(404).json({ hata: 'kanal-yok' });
      const metin = String(mesaj || '').slice(0, 1800);
      if (!metin) return res.status(400).json({ hata: 'bos-mesaj' });
      await kanal.send({ content: (everyone ? '@everyone ' : '') + metin, allowedMentions: everyone ? { parse: ['everyone'] } : undefined });
      res.json({ ok: true });
    } catch { res.status(500).json({ hata: 'gonderilemedi' }); }
  });

  app.get('/api/admin/kodlar', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const d = require('../src/db').db();
      const kodlar = Object.entries((d.premium && d.premium.kodlar) || {}).map(([kod, k]) => ({
        kod, gun: k.gun, kullanan: !!k.kullanan, tarih: k.tarih || null,
      })).sort((a, b) => (b.tarih || 0) - (a.tarih || 0)).slice(0, 100);
      res.json({ kodlar });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  app.post('/api/admin/kod-uret', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const { kodUret, sureParse } = require('../src/premium');
      const gun = sureParse((req.body || {}).sure || '30d') || 30;
      const kod = kodUret(Math.min(36500, gun), 'WEB-ADMIN');
      res.json({ ok: true, kod });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  // Web-içi panel duyurusu: giriş yapan herkes görür, sadece admin yazar
  app.get('/api/duyuru', (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    try {
      const d = require('../src/db').db();
      res.json({ duyuru: d.panelDuyuru || null, bakim: d.bakim || null });
    } catch { res.json({ duyuru: null, bakim: null }); }
  });
  app.post('/api/admin/duyuru-panel', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const d = require('../src/db').db();
      const { baslik, metin } = req.body || {};
      if (!String(metin || '').trim()) d.panelDuyuru = null;
      else {
        d.panelDuyuru = {
          baslik: String(baslik || 'Duyuru').slice(0, 100),
          metin: String(metin).slice(0, 1000),
          tarih: Date.now(),
        };
      }
      require('../src/db').save();
      res.json({ ok: true, duyuru: d.panelDuyuru || null });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  app.post('/api/admin/kod-sil', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const d = require('../src/db').db();
      const kod = String((req.body || {}).kod || '').trim().toUpperCase();
      if (d.premium?.kodlar?.[kod]) {
        delete d.premium.kodlar[kod];
        require('../src/db').save();
        return res.json({ ok: true });
      }
      res.status(404).json({ hata: 'bulunamadi' });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  // Detaylı sunucu listesi + ban/çıkar + web oturumları (sadece kurucular)
  function sunucuDetayListe() {
    const d = require('../src/db').db();
    return [...client.guilds.cache.values()].map((g) => {
      let prem = null;
      try {
        const b = require('../src/premium').premiumBilgi(g.id);
        if (b) prem = b;
      } catch {}
      const gec = (d.sunucuGecmis || {})[g.id] || {};
      const yasak = (d.yasakSunucular || {})[g.id] || null;
      return {
        id: g.id, ad: g.name, uye: g.memberCount || 0,
        ikon: (() => { try { return g.iconURL({ size: 64 }); } catch { return null; } })(),
        prem: !!prem, bitis: prem ? prem.bitis : null,
        yasak: yasak ? { sebep: yasak.sebep || '', tarih: yasak.tarih || null } : null,
        eklenmeSayisi: (gec.eklenme || []).length,
        ilkEklenme: (gec.eklenme || [])[0] ? gec.eklenme[0].tarih : null,
        sonEklenme: (gec.eklenme || []).length ? gec.eklenme[gec.eklenme.length - 1].tarih : null,
        cikarmaSayisi: (gec.cikarma || []).length,
        sonCikarma: (gec.cikarma || []).length ? gec.cikarma[gec.cikarma.length - 1].tarih : null,
        ekleyenler: (gec.ekleyenler || []).slice(-5),
      };
    });
  }
  app.get('/api/admin/sunucular-detay', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try { res.json({ sunucular: sunucuDetayListe() }); }
    catch { res.status(500).json({ hata: 'hata' }); }
  });
  app.post('/api/admin/sunucu-ban', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const { guildId, islem, sebep } = req.body || {};
      const d = require('../src/db').db();
      if (!d.yasakSunucular) d.yasakSunucular = {};
      if (islem === 'unban') delete d.yasakSunucular[guildId];
      else d.yasakSunucular[guildId] = { sebep: String(sebep || 'Belirtilmedi').slice(0, 200), tarih: Date.now() };
      require('../src/db').save();
      if (islem !== 'unban') {
        const g = client.guilds.cache.get(guildId);
        if (g) g.leave().catch(() => {});
      }
      res.json({ ok: true });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });
  app.post('/api/admin/sunucudan-cik', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const { guildId } = req.body || {};
      const g = client.guilds.cache.get(guildId);
      if (!g) return res.status(404).json({ hata: 'yok' });
      g.leave().catch(() => {});
      res.json({ ok: true });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });
  app.get('/api/admin/saglik', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const d = require('../src/db').db();
      const mem = process.memoryUsage();
      res.json({
        uptime: Math.floor(process.uptime()),
        bellekMB: Math.round(mem.heapUsed / 1048576),
        kullancilar: Object.keys(d.users || {}).length,
        sunucular: Object.keys(d.guilds || {}).length,
        vitrin: (d.vitrin || []).length,
        oturum: sessions.size,
      });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });
  // Admin toplu (aksiyon.js) — direkt mod
  async function adminSarmala(req, res, fn) {
    if (!adminKontrol(req, res)) return;
    try {
      const r = await fn(client, req.body || {}, req.params || {});
      const kod = !r ? 500 : r.hata === 'yok' || r.hata === 'bulunamadi' ? 404 : r.hata === 'uye-yok' || r.hata === 'islem' || r.hata === 'premium-yok' ? 400 : r.hata === 'dokunulmaz' ? 403 : r.hata === 'yetki' ? 500 : 200;
      if (kod !== 200) return res.status(kod).json(r);
      res.json(r);
    } catch { res.status(500).json({ hata: 'hata' }); }
  }
  app.post('/api/admin/uye', (req, res) => adminSarmala(req, res, require('./aksiyon').adminUye));
  app.post('/api/admin/premium-sure', (req, res) => adminSarmala(req, res, (c, govde) => require('./aksiyon').adminPremiumSure(govde)));
  app.get('/api/admin/analitik', (req, res) => adminSarmala(req, res, require('./aksiyon').adminAnalitik));
  app.get('/api/admin/sunucu-full/:id', (req, res) => adminSarmala(req, res, (c, g, p) => require('./aksiyon').adminSunucuFull(c, p.id)));
  app.get('/api/admin/komutlar', (req, res) => adminSarmala(req, res, require('./aksiyon').adminKomutlar));
  app.post('/api/admin/komut-durum', (req, res) => adminSarmala(req, res, require('./aksiyon').adminKomutDurum));
  app.post('/api/admin/bakim', (req, res) => adminSarmala(req, res, (c, govde) => require('./aksiyon').adminBakim(govde)));
  app.get('/api/admin/yedek', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try { res.json(require('../src/db').db()); }
    catch { res.status(500).json({ hata: 'hata' }); }
  });
  app.get('/api/admin/oturumlar', (req, res) => {
    if (!adminKontrol(req, res)) return;
    try {
      const liste = [...sessions.entries()].map(([k, v]) => ({
        anahtar: String(k).slice(0, 8) + '…',
        id: v.user.id, username: v.user.username, bitis: v.exp,
      })).sort((a, b) => b.bitis - a.bitis).slice(0, 100);
      res.json({ oturumlar: liste, sayi: sessions.size });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  // 🚫 Yasaklı kelime yönetimi (yönetici yetkisi + botun olduğu sunucu)
  async function yasakliYetki(req, res) {
    const s = oturum(req);
    if (!s) { res.status(401).json({ hata: 'giris-yok' }); return null; }
    const gid = req.params.id || (req.body || {}).guildId;
    const guild = client.guilds.cache.get(gid);
    if (!guild) { res.status(404).json({ hata: 'yok' }); return null; }
    try {
      const gs = await discordAPI(s.token, '/users/@me/guilds');
      const g = gs.find((x) => x.id === gid);
      if (!g || !(g.owner || (BigInt(g.permissions) & 0x20n))) { res.status(403).json({ hata: 'yetki-yok' }); return null; }
    } catch { res.status(500).json({ hata: 'discord' }); return null; }
    return guild;
  }

  app.get('/api/yasakli/:id', async (req, res) => {
    const guild = await yasakliYetki(req, res);
    if (!guild) return;
    res.json({ kelimeler: getGuild(guild.id).yasakli || [] });
  });

  app.post('/api/yasakli', async (req, res) => {
    const guild = await yasakliYetki(req, res);
    if (!guild) return;
    try {
      const { islem, kelime } = req.body || {};
      const g = getGuild(guild.id);
      if (!Array.isArray(g.yasakli)) g.yasakli = [];
      const k = String(kelime || '').toLocaleLowerCase('tr').trim().slice(0, 50);
      if (islem === 'ekle') {
        if (!k) return res.status(400).json({ hata: 'bos' });
        if (!g.yasakli.includes(k)) g.yasakli.push(k);
      } else if (islem === 'sil') {
        g.yasakli = g.yasakli.filter((x) => x !== k);
      } else return res.status(400).json({ hata: 'islem' });
      save();
      res.json({ ok: true, kelimeler: g.yasakli });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  // 📊 Gelişmiş listeler (ödül rolleri, oto-cevap, tag, çoklu oto-rol)
  function rolGecerli(guild, id) {
    id = String(id || '').replace(/\D/g, '');
    if (!/^\d{15,25}$/.test(id)) return null;
    const r = guild.roles.cache.get(id);
    if (!r || r.managed) return null;
    if (r.position >= guild.members.me.roles.highest.position) return 'ustte';
    return id;
  }

  app.get('/api/liste/:id', async (req, res) => {
    const guild = await yasakliYetki(req, res);
    if (!guild) return;
    const g = getGuild(guild.id);
    res.json({
      seviyeRoller: g.seviyeRoller || [], repRoller: g.repRoller || [],
      davetRolleri: g.davetRolleri || [], otoCevap: g.otoCevap || [],
      tagSistemi: g.tagSistemi || null, otoRolCoklu: g.otoRolCoklu || [],
    });
  });

  app.post('/api/liste', async (req, res) => {
    const guild = await yasakliYetki(req, res);
    if (!guild) return;
    try {
      const { liste, islem } = req.body || {};
      // Premium listeler webden de kilitli!
      if (['otoCevap', 'tagSistemi', 'davetRolleri', 'otoRolCoklu'].includes(liste)) {
        try {
          if (!require('../src/premium').premiumMu(guild.id)) {
            return res.status(403).json({ hata: 'premium-gerekli' });
          }
        } catch {}
      }
      const g = getGuild(guild.id);
      if (liste === 'seviyeRoller') {
        if (!Array.isArray(g.seviyeRoller)) g.seviyeRoller = [];
        if (islem === 'sil') {
          g.seviyeRoller = g.seviyeRoller.filter((x) => x.seviye !== parseInt(req.body.seviye, 10));
        } else {
          const s = parseInt(req.body.seviye, 10);
          const rid = rolGecerli(guild, req.body.rolId);
          if (!s || s < 1 || s > 100 || !rid) return res.status(400).json({ hata: 'gecersiz' });
          if (rid === 'ustte') return res.status(400).json({ hata: 'rol-ustte' });
          const var1 = g.seviyeRoller.find((x) => x.seviye === s);
          if (var1) var1.rolId = rid; else g.seviyeRoller.push({ seviye: s, rolId: rid });
        }
      } else if (liste === 'repRoller') {
        if (!Array.isArray(g.repRoller)) g.repRoller = [];
        if (islem === 'sil') {
          g.repRoller = g.repRoller.filter((x) => x.puan !== parseInt(req.body.puan, 10));
        } else {
          const p = parseInt(req.body.puan, 10);
          const rid = rolGecerli(guild, req.body.rolId);
          if (isNaN(p) || p < -100 || p > 1000 || !rid) return res.status(400).json({ hata: 'gecersiz' });
          if (rid === 'ustte') return res.status(400).json({ hata: 'rol-ustte' });
          const var1 = g.repRoller.find((x) => x.puan === p);
          if (var1) var1.rolId = rid; else g.repRoller.push({ puan: p, rolId: rid });
        }
      } else if (liste === 'davetRolleri') {
        if (!Array.isArray(g.davetRolleri)) g.davetRolleri = [];
        if (islem === 'sil') {
          g.davetRolleri = g.davetRolleri.filter((x) => x.sayi !== parseInt(req.body.sayi, 10));
        } else {
          const s = parseInt(req.body.sayi, 10);
          const rid = rolGecerli(guild, req.body.rolId);
          if (!s || s < 1 || s > 10000 || !rid) return res.status(400).json({ hata: 'gecersiz' });
          if (rid === 'ustte') return res.status(400).json({ hata: 'rol-ustte' });
          const var1 = g.davetRolleri.find((x) => x.sayi === s);
          if (var1) var1.rolId = rid; else g.davetRolleri.push({ sayi: s, rolId: rid });
        }
      } else if (liste === 'otoCevap') {
        if (!Array.isArray(g.otoCevap)) g.otoCevap = [];
        if (islem === 'sil') {
          const t = String(req.body.tetik || '').toLocaleLowerCase('tr');
          g.otoCevap = g.otoCevap.filter((x) => x.tetik !== t);
        } else {
          const t = String(req.body.tetik || '').toLocaleLowerCase('tr').slice(0, 50);
          const c = String(req.body.cevap || '').slice(0, 500);
          if (!t || !c) return res.status(400).json({ hata: 'gecersiz' });
          if (g.otoCevap.length >= 20) return res.status(400).json({ hata: 'dolu' });
          const var1 = g.otoCevap.find((x) => x.tetik === t);
          if (var1) var1.cevap = c; else g.otoCevap.push({ tetik: t, cevap: c });
        }
      } else if (liste === 'tagSistemi') {
        if (islem === 'kapat') g.tagSistemi = null;
        else {
          const t = String(req.body.tag || '').slice(0, 20);
          const rid = rolGecerli(guild, req.body.rolId);
          if (!t || !rid) return res.status(400).json({ hata: 'gecersiz' });
          if (rid === 'ustte') return res.status(400).json({ hata: 'rol-ustte' });
          g.tagSistemi = { tag: t.toLocaleLowerCase('tr'), rolId: rid };
        }
      } else if (liste === 'otoRolCoklu') {
        if (!Array.isArray(g.otoRolCoklu)) g.otoRolCoklu = [];
        const rid = rolGecerli(guild, req.body.rolId);
        if (islem === 'temizle') g.otoRolCoklu = [];
        else if (islem === 'sil') g.otoRolCoklu = g.otoRolCoklu.filter((x) => x !== rid);
        else {
          if (!rid) return res.status(400).json({ hata: 'gecersiz' });
          if (rid === 'ustte') return res.status(400).json({ hata: 'rol-ustte' });
          if (!g.otoRolCoklu.includes(rid)) {
            if (g.otoRolCoklu.length >= 3) return res.status(400).json({ hata: 'dolu' });
            g.otoRolCoklu.push(rid);
          }
        }
      } else return res.status(400).json({ hata: 'liste' });
      save();
      res.json({ ok: true });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  // Embed gönder / medya yükle / emoji-rol tepki (direkt mod: aynı process)
  async function aksiyonYetki(req, res) {
    const guild = await yasakliYetki(req, res);
    if (!guild) return null;
    return guild;
  }
  app.post('/api/embed-gonder', async (req, res) => {
    const guild = await aksiyonYetki(req, res);
    if (!guild) return;
    try {
      const r = await require('./aksiyon').embedGonder(client, { guildId: guild.id, ...(req.body || {}) });
      if (r.hata) return res.status(r.hata === 'yok' || r.hata === 'kanal-yok' ? 404 : 400).json(r);
      res.json(r);
    } catch { res.status(500).json({ hata: 'gonderilemedi' }); }
  });
  app.post('/api/medya-yukle', async (req, res) => {
    const guild = await aksiyonYetki(req, res);
    if (!guild) return;
    try {
      const r = await require('./aksiyon').medyaYukle(client, { guildId: guild.id, ...(req.body || {}) });
      if (r.hata) return res.status(r.hata === 'yok' ? 404 : 400).json(r);
      res.json(r);
    } catch { res.status(500).json({ hata: 'hata' }); }
  });
  app.post('/api/emojirol-tepki', async (req, res) => {
    const guild = await aksiyonYetki(req, res);
    if (!guild) return;
    try {
      const r = await require('./aksiyon').emojirolTepki(client, { guildId: guild.id, ...(req.body || {}) });
      if (r.hata) return res.status(404).json(r);
      res.json(r);
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  app.get('/api/guilds', async (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    try {
      const gs = await discordAPI(s.token, '/users/@me/guilds');
      const liste = gs
        .filter((x) => x.owner || (BigInt(x.permissions) & 0x20n))
        .filter((x) => client.guilds.cache.has(x.id))
        .map((x) => ({ id: x.id, ad: x.name, ikon: x.icon, sahip: !!x.owner, prem: require('../src/premium').premiumMu(x.id) }));
      res.json({ guilds: liste });
    } catch { res.status(500).json({ hata: 'discord-erisilemedi' }); }
  });

  app.get('/api/guild/:id', async (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    try {
      const bulunan = await erisebilir(s, req.params.id);
      if (!bulunan) return res.status(403).json({ hata: 'yetki-yok' });
      const { guild } = bulunan;
      const g = getGuild(guild.id);
      const ayarlar = {};
      for (const k of Object.keys(SEMA)) ayarlar[k] = g[k] ?? null;
      const kanallar = [...guild.channels.cache.values()]
        .filter((k) => k.type === 0 || k.type === 2)
        .map((k) => ({ id: k.id, ad: k.name, tip: k.type === 0 ? 'yazi' : 'ses' }))
        .slice(0, 150);
      const roller = [...guild.roles.cache.values()]
        .filter((r) => r.id !== guild.id && !r.managed)
        .map((r) => ({ id: r.id, ad: r.name, renk: r.hexColor }))
        .slice(0, 100);
      res.json({ id: guild.id, ad: guild.name, uye: guild.memberCount || 0, ayarlar, kanallar, roller, prem: (() => { try { return require('../src/premium').premiumMu(guild.id); } catch { return false; } })() });
    } catch { res.status(500).json({ hata: 'sunucu-hatasi' }); }
  });

  app.get('/api/vitrin', (req, res) => {
    try {
      const d = require('../src/db').db();
      const liste = (d.vitrin || []).slice(0, 12).map((x) => ({
        ad: String(x.ad || x.name || 'Sunucu').slice(0, 60),
        desc: String(x.desc || x.aciklama || '').slice(0, 160),
        uye: x.uye ?? x.members ?? null,
        davet: String(x.davet || x.invite || ''),
      })).filter((x) => x.davet);
      res.json({ vitrin: liste });
    } catch { res.json({ vitrin: [] }); }
  });

  app.post('/api/guild/:id', async (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    try {
      const bulunan = await erisebilir(s, req.params.id);
      if (!bulunan) return res.status(403).json({ hata: 'yetki-yok' });
      const { guild } = bulunan;
      const yama = {};
      const govde = req.body || {};
      for (const [k, tip] of Object.entries(SEMA)) {
        if (!(k in govde)) continue;
        yama[k] = temizle(tip, govde[k], guild);
      }
      // Premium ayarlar free sunucularda kaydedilmez
      let premEngel = 0;
      try {
        if (!require('../src/premium').premiumMu(guild.id)) {
          for (const k of PREMIUM_AYARLAR) if (k in yama) { delete yama[k]; premEngel++; }
        }
      } catch {}
      setGuild(guild.id, yama);
      save();
      res.json({ ok: true, sayi: Object.keys(yama).length, premEngel });
    } catch { res.status(500).json({ hata: 'kaydedilemedi' }); }
  });

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));

  if (process.env.ENABLE_WEB === '0') { console.log('🌐 Web panel kapalı (ENABLE_WEB=0)'); return; }
  const server = app.listen(PORT, () => console.log(`🌐 Web panel: http://localhost:${PORT} (dışa: ${bazURL()})`));
  server.on('error', (e) => console.error('🌐 Web panel açılamadı, bot çalışmaya devam ediyor:', e.message));
}

  module.exports = { startWeb, SEMA, PREMIUM_AYARLAR, temizle, discordAPI };
