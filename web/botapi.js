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

  app.use('/api/bot', express.json({ limit: '200kb' }), router);
}

module.exports = { mountBotAPI };
