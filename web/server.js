// 🌐 EMOÇ Web Panel — bot ile AYNI process'te çalışır (Render'da tek servis!).
// Discord OAuth2 girişi → sunucularını seç → tüm bot ayarlarını webden yönet.
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { getGuild, setGuild, save } = require('../src/db');

const sessions = new Map(); // sid -> { token, exp, user }
setInterval(() => {
  const simdi = Date.now();
  for (const [k, v] of sessions) if (v.exp < simdi) sessions.delete(k);
}, 3600_000).unref?.();

// Webden değiştirilebilir ayar şeması: key -> tip
const SEMA = {
  antiLink: 'bool', antiKufur: 'bool', antiSpam: 'bool', antiRaid: 'bool',
  antiBot: 'bool', capsEngel: 'bool', altKoruma: 'bool',
  logKanal: 'kanal', hosgeldinKanal: 'kanal', cikisKanal: 'kanal',
  sayacKanal: 'kanal', repBildirimKanal: 'kanal', partnerKanal: 'kanal',
  partnerChat: 'kanal', partnerYetkiliKanal: 'kanal', itirafKanal: 'kanal',
  gununSorusuKanal: 'kanal',
  otoRol: 'rol', partnerYetkiliRol: 'rol',
  hosgeldinMesaj: 'yazi:500', partnerText: 'yazi:1500',
  sayacHedef: 'sayi:0:100000', repSuresiDk: 'sayi:0:4320',
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
    const [, , min, max] = tip.split(':').map(Number);
    let n = parseInt(v, 10);
    if (isNaN(n)) n = 0;
    return Math.max(min, Math.min(max, n));
  }
  return null;
}

function startWeb(client) {
  const app = express();
  app.use(express.json({ limit: '200kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
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
    if (s) sessions.delete(s.sid);
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
    res.json({ user: s.user });
  });

  app.get('/api/guilds', async (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    try {
      const gs = await discordAPI(s.token, '/users/@me/guilds');
      const liste = gs
        .filter((x) => x.owner || (BigInt(x.permissions) & 0x20n))
        .filter((x) => client.guilds.cache.has(x.id))
        .map((x) => ({ id: x.id, ad: x.name, ikon: x.icon, sahip: !!x.owner }));
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
      res.json({ id: guild.id, ad: guild.name, ayarlar, kanallar, roller });
    } catch { res.status(500).json({ hata: 'sunucu-hatasi' }); }
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
      setGuild(guild.id, yama);
      save();
      res.json({ ok: true, sayi: Object.keys(yama).length });
    } catch { res.status(500).json({ hata: 'kaydedilemedi' }); }
  });

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));

  app.listen(PORT, () => console.log(`🌐 Web panel: http://localhost:${PORT} (dışa: ${bazURL()})`));
}

module.exports = { startWeb };
