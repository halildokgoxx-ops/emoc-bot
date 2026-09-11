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
    res.json({ guilds: [...client.guilds.cache.keys()] });
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
    res.json({ id: guild.id, ad: guild.name, ayarlar, kanallar, roller });
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

  app.use('/api/bot', express.json({ limit: '200kb' }), router);
}

module.exports = { mountBotAPI };
