// 🤖 Bot tarafı Köprü API — Render'daki panel buradan ayar okur/yazar.
// Koruma: her istekte `x-bridge-secret` başlığı .env'deki BRIDGE_SECRET ile aynı olmalı.
// BOT_API_URL örn: https://bot.ornek.com  →  https://bot.ornek.com/api/bot/ping
const express = require('express');
const { getGuild, setGuild, save } = require('../src/db');
const { SEMA, temizle } = require('./server');

function mountBotAPI(app, client) {
  const router = express.Router();

  router.use((req, res, next) => {
    const sir = process.env.BRIDGE_SECRET;
    if (!sir || req.headers['x-bridge-secret'] !== sir) {
      return res.status(403).json({ hata: 'yasak' });
    }
    next();
  });

  router.get('/ping', (req, res) => res.json({
    ok: true,
    bot: client.user ? client.user.tag : '?',
    sunucu: client.guilds.cache.size,
    uptime: Math.floor(process.uptime()),
  }));

  router.get('/guilds', (req, res) => {
    const { premiumMu } = require('../src/premium');
    const ids = [...client.guilds.cache.keys()];
    res.json({ guilds: ids, prem: ids.filter((id) => { try { return premiumMu(id); } catch { return false; } }) });
  });

  router.get('/guild/:id', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ hata: 'bot-bu-sunucuda-degil' });
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
  });

  router.get('/vitrin', (req, res) => {
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

  router.post('/guild/:id', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ hata: 'bot-bu-sunucuda-degil' });
    const yama = {};
    const govde = req.body || {};
    for (const [k, tip] of Object.entries(SEMA)) {
      if (!(k in govde)) continue;
      yama[k] = temizle(tip, govde[k], guild);
    }
    setGuild(guild.id, yama);
    save();
    res.json({ ok: true, sayi: Object.keys(yama).length });
  });

  router.get('/istatistik', (req, res) => {
    try {
      const guilds = [...client.guilds.cache.values()];
      const uye = guilds.reduce((a, g) => a + (g.memberCount || 0), 0);
      const oneCikan = guilds.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0)).slice(0, 8)
        .map((g) => ({ ad: g.name, uye: g.memberCount || 0, ikon: g.iconURL({ size: 128 }) }));
      res.json({ sunucu: guilds.length, uye, uptime: Math.floor(process.uptime()), oneCikan });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  router.get('/komutlar', (req, res) => {
    try {
      const liste = [...client.commands.values()].map((c) => ({ ad: c.name, aciklama: c.description || '', kategori: c.category || 'Genel' }));
      res.json({ komutlar: liste, sayi: liste.length });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  // Admin (köprü sahibi doğruladı + secret var — güvenilir hat)
  router.get('/admin/ozet', (req, res) => {
    try {
      const { premiumBilgi } = require('../src/premium');
      const guilds = [...client.guilds.cache.values()];
      const uye = guilds.reduce((a, g) => a + (g.memberCount || 0), 0);
      const prem = [], free = [];
      for (const g of guilds) {
        const b = premiumBilgi(g.id);
        (b ? prem : free).push({ id: g.id, ad: g.name, uye: g.memberCount || 0, bitis: b ? b.bitis : null });
      }
      res.json({
        sunucu: guilds.length, uye, uptime: Math.floor(process.uptime()),
        premiumSayi: prem.length, freeSayi: free.length,
        premium: prem, free: free.slice(0, 60), oturum: null,
      });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  router.get('/admin/kanallar/:id', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ hata: 'yok' });
    const kanallar = [...guild.channels.cache.values()]
      .filter((k) => k.type === 0 || k.type === 2)
      .map((k) => ({ id: k.id, ad: k.name, tip: k.type === 0 ? 'yazi' : 'ses' }))
      .slice(0, 150);
    res.json({ id: guild.id, ad: guild.name, kanallar });
  });

  router.post('/admin/premium', (req, res) => {
    try {
      const { premiumVer, premiumAl } = require('../src/premium');
      const { guildId, islem, gun } = req.body || {};
      if (!client.guilds.cache.get(guildId)) return res.status(404).json({ hata: 'yok' });
      if (islem === 'kapat') premiumAl(guildId);
      else premiumVer(guildId, Math.max(1, Math.min(36500, parseInt(gun, 10) || 30)));
      res.json({ ok: true });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  router.post('/admin/duyuru', async (req, res) => {
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

  router.get('/admin/kodlar', (req, res) => {
    try {
      const d = require('../src/db').db();
      const kodlar = Object.entries((d.premium && d.premium.kodlar) || {}).map(([kod, k]) => ({
        kod, gun: k.gun, kullanan: !!k.kullanan, tarih: k.tarih || null,
      })).sort((a, b) => (b.tarih || 0) - (a.tarih || 0)).slice(0, 100);
      res.json({ kodlar });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  router.post('/admin/kod-uret', (req, res) => {
    try {
      const { kodUret, sureParse } = require('../src/premium');
      const gun = sureParse((req.body || {}).sure || '30d') || 30;
      const kod = kodUret(Math.min(36500, gun), 'WEB-ADMIN');
      res.json({ ok: true, kod });
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  router.post('/admin/kod-sil', (req, res) => {
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

  router.get('/yasakli/:id', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ hata: 'yok' });
    res.json({ kelimeler: getGuild(guild.id).yasakli || [] });
  });

  router.post('/yasakli', (req, res) => {
    try {
      const { guildId, islem, kelime } = req.body || {};
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ hata: 'yok' });
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

  function rolGecerli(guild, id) {
    id = String(id || '').replace(/\D/g, '');
    if (!/^\d{15,25}$/.test(id)) return null;
    const r = guild.roles.cache.get(id);
    if (!r || r.managed) return null;
    if (r.position >= guild.members.me.roles.highest.position) return 'ustte';
    return id;
  }

  router.get('/liste/:id', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ hata: 'yok' });
    const g = getGuild(guild.id);
    res.json({
      seviyeRoller: g.seviyeRoller || [], repRoller: g.repRoller || [],
      davetRolleri: g.davetRolleri || [], otoCevap: g.otoCevap || [],
      tagSistemi: g.tagSistemi || null, otoRolCoklu: g.otoRolCoklu || [],
    });
  });

  router.post('/liste', (req, res) => {
    try {
      const { guildId, liste, islem } = req.body || {};
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ hata: 'yok' });
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
        if (islem === 'sil') g.seviyeRoller = g.seviyeRoller.filter((x) => x.seviye !== parseInt(req.body.seviye, 10));
        else {
          const s = parseInt(req.body.seviye, 10);
          const rid = rolGecerli(guild, req.body.rolId);
          if (!s || s < 1 || s > 100 || !rid || rid === 'ustte') return res.status(400).json({ hata: rid === 'ustte' ? 'rol-ustte' : 'gecersiz' });
          const var1 = g.seviyeRoller.find((x) => x.seviye === s);
          if (var1) var1.rolId = rid; else g.seviyeRoller.push({ seviye: s, rolId: rid });
        }
      } else if (liste === 'repRoller') {
        if (!Array.isArray(g.repRoller)) g.repRoller = [];
        if (islem === 'sil') g.repRoller = g.repRoller.filter((x) => x.puan !== parseInt(req.body.puan, 10));
        else {
          const p = parseInt(req.body.puan, 10);
          const rid = rolGecerli(guild, req.body.rolId);
          if (isNaN(p) || p < -100 || p > 1000 || !rid || rid === 'ustte') return res.status(400).json({ hata: 'gecersiz' });
          const var1 = g.repRoller.find((x) => x.puan === p);
          if (var1) var1.rolId = rid; else g.repRoller.push({ puan: p, rolId: rid });
        }
      } else if (liste === 'davetRolleri') {
        if (!Array.isArray(g.davetRolleri)) g.davetRolleri = [];
        if (islem === 'sil') g.davetRolleri = g.davetRolleri.filter((x) => x.sayi !== parseInt(req.body.sayi, 10));
        else {
          const s = parseInt(req.body.sayi, 10);
          const rid = rolGecerli(guild, req.body.rolId);
          if (!s || s < 1 || s > 10000 || !rid || rid === 'ustte') return res.status(400).json({ hata: 'gecersiz' });
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
          if (!t || !rid || rid === 'ustte') return res.status(400).json({ hata: 'gecersiz' });
          g.tagSistemi = { tag: t.toLocaleLowerCase('tr'), rolId: rid };
        }
      } else if (liste === 'otoRolCoklu') {
        if (!Array.isArray(g.otoRolCoklu)) g.otoRolCoklu = [];
        const rid = rolGecerli(guild, req.body.rolId);
        if (islem === 'temizle') g.otoRolCoklu = [];
        else if (islem === 'sil') g.otoRolCoklu = g.otoRolCoklu.filter((x) => x !== rid);
        else {
          if (!rid || rid === 'ustte') return res.status(400).json({ hata: 'gecersiz' });
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

  router.post('/embed-gonder', async (req, res) => {
    try {
      const r = await require('./aksiyon').embedGonder(client, req.body || {});
      if (r.hata) return res.status(r.hata === 'yok' || r.hata === 'kanal-yok' ? 404 : 400).json(r);
      res.json(r);
    } catch { res.status(500).json({ hata: 'gonderilemedi' }); }
  });

  router.post('/medya-yukle', async (req, res) => {
    try {
      const r = await require('./aksiyon').medyaYukle(client, req.body || {});
      if (r.hata) return res.status(r.hata === 'yok' ? 404 : 400).json(r);
      res.json(r);
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  router.post('/emojirol-tepki', async (req, res) => {
    try {
      const r = await require('./aksiyon').emojirolTepki(client, req.body || {});
      if (r.hata) return res.status(404).json(r);
      res.json(r);
    } catch { res.status(500).json({ hata: 'hata' }); }
  });

  app.use('/api/bot', express.json({ limit: '12mb' }), router);
}

module.exports = { mountBotAPI };
