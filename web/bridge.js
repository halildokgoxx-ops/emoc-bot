// 🌖 EMOÇ Köprü — Render'da TEK BAŞINA çalışır (bota discord.js ile BAĞLANMAZ).
// Discord OAuth2 girişi burada yapılır; ayarlar BOT_API_URL'deki bota
// x-bridge-secret ile iletilir. Kalıcı veri TUTMAZ (bot tarafında durur).
// Çalıştır: npm run kopru
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const sessions = new Map(); // sid -> { token, exp, user }
setInterval(() => {
  const simdi = Date.now();
  for (const [k, v] of sessions) if (v.exp < simdi) sessions.delete(k);
}, 3600_000).unref?.();

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

const BOT = () => (process.env.BOT_API_URL || '').replace(/\/$/, '');
const SIR = () => process.env.BRIDGE_SECRET || '';

async function botAPI(yol, init = {}) {
  if (!BOT() || !SIR()) {
    const e = new Error('Köprü ayarı eksik: BOT_API_URL + BRIDGE_SECRET env gerekli!');
    e.kod = 500;
    throw e;
  }
  const r = await fetch(BOT() + yol, {
    ...init,
    headers: { 'x-bridge-secret': SIR(), 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!r.ok) {
    const e = new Error('bot ' + r.status);
    e.kod = r.status;
    throw e;
  }
  return r.json();
}

function yonetebilirMi(g) {
  try { return g.owner || (BigInt(g.permissions) & 0x20n); }
  catch { return false; }
}

function startKopru() {
  const app = express();
  app.use(express.json({ limit: '200kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  const PORT = process.env.PORT || 3100;
  const bazURL = () => (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

  app.get('/health', async (req, res) => {
    let bot = null;
    try {
      const p = await botAPI('/api/bot/ping');
      bot = { tag: p.bot, sunucu: p.sunucu };
    } catch (e) { bot = { hata: e.message }; }
    res.json({ ok: true, kopru: true, bot });
  });

  app.get('/davet', (req, res) => {
    const id = process.env.CLIENT_ID || '';
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

  app.get('/api/me', (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    const sahipler = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean).map(String);
    res.json({ user: s.user, admin: sahipler.includes(String(s.user.id)) });
  });

  function adminMi(req, res) {
    const s = oturum(req);
    if (!s) { res.status(401).json({ hata: 'giris-yok' }); return null; }
    const sahipler = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean).map(String);
    if (!sahipler.includes(String(s.user.id))) { res.status(403).json({ hata: 'admin-degil' }); return null; }
    return s;
  }

  app.get('/api/istatistik', async (req, res) => {
    try { res.json(await botAPI('/api/bot/istatistik')); }
    catch { res.json({ sunucu: 0, uye: 0, oneCikan: [] }); }
  });

  app.get('/api/vitrin', async (req, res) => {
    try { res.json(await botAPI('/api/bot/vitrin')); }
    catch { res.json({ vitrin: [] }); }
  });

  app.get('/api/komutlar', async (req, res) => {
    try { res.json(await botAPI('/api/bot/komutlar')); }
    catch { res.json({ komutlar: [], sayi: 0 }); }
  });

  app.get('/api/admin/ozet', async (req, res) => {
    if (!adminMi(req, res)) return;
    try {
      const j = await botAPI('/api/bot/admin/ozet');
      j.oturum = sessions.size;
      res.json(j);
    } catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  app.get('/api/admin/kanallar/:id', async (req, res) => {
    if (!adminMi(req, res)) return;
    try { res.json(await botAPI(`/api/bot/admin/kanallar/${req.params.id}`)); }
    catch (e) { res.status(e.kod === 404 ? 404 : 502).json({ hata: 'bot-hatasi' }); }
  });

  app.post('/api/admin/premium', async (req, res) => {
    if (!adminMi(req, res)) return;
    try { res.json(await botAPI('/api/bot/admin/premium', { method: 'POST', body: JSON.stringify(req.body || {}) })); }
    catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  app.post('/api/admin/duyuru', async (req, res) => {
    if (!adminMi(req, res)) return;
    try { res.json(await botAPI('/api/bot/admin/duyuru', { method: 'POST', body: JSON.stringify(req.body || {}) })); }
    catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  app.get('/api/admin/kodlar', async (req, res) => {
    if (!adminMi(req, res)) return;
    try { res.json(await botAPI('/api/bot/admin/kodlar')); }
    catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  app.post('/api/admin/kod-uret', async (req, res) => {
    if (!adminMi(req, res)) return;
    try { res.json(await botAPI('/api/bot/admin/kod-uret', { method: 'POST', body: JSON.stringify(req.body || {}) })); }
    catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  app.post('/api/admin/kod-sil', async (req, res) => {
    if (!adminMi(req, res)) return;
    try { res.json(await botAPI('/api/bot/admin/kod-sil', { method: 'POST', body: JSON.stringify(req.body || {}) })); }
    catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  async function yasakliKontrol(req, res) {
    const s = oturum(req);
    if (!s) { res.status(401).json({ hata: 'giris-yok' }); return null; }
    const gid = req.params.id || (req.body || {}).guildId;
    try {
      const gs = await discordAPI(s.token, '/users/@me/guilds');
      const g = gs.find((x) => x.id === gid);
      if (!g || !(g.owner || (BigInt(g.permissions) & 0x20n))) { res.status(403).json({ hata: 'yetki-yok' }); return null; }
    } catch { res.status(500).json({ hata: 'discord' }); return null; }
    return gid;
  }

  app.get('/api/yasakli/:id', async (req, res) => {
    if (!(await yasakliKontrol(req, res))) return;
    try { res.json(await botAPI(`/api/bot/yasakli/${req.params.id}`)); }
    catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  app.get('/api/liste/:id', async (req, res) => {
    if (!(await yasakliKontrol(req, res))) return;
    try { res.json(await botAPI(`/api/bot/liste/${req.params.id}`)); }
    catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  app.post('/api/liste', async (req, res) => {
    if (!(await yasakliKontrol(req, res))) return;
    try { res.json(await botAPI('/api/bot/liste', { method: 'POST', body: JSON.stringify(req.body || {}) })); }
    catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  app.post('/api/yasakli', async (req, res) => {
    if (!(await yasakliKontrol(req, res))) return;
    try { res.json(await botAPI('/api/bot/yasakli', { method: 'POST', body: JSON.stringify(req.body || {}) })); }
    catch { res.status(502).json({ hata: 'bot-hatasi' }); }
  });

  app.get('/api/guilds', async (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    try {
      const gs = await discordAPI(s.token, '/users/@me/guilds');
      let botSunucu = [];
      let premSet = new Set();
      try {
        const j = await botAPI('/api/bot/guilds');
        botSunucu = j.guilds || [];
        premSet = new Set(j.prem || []);
      } catch (e) { return res.status(502).json({ hata: 'bota-erisilemiyor', detay: e.message }); }
      const liste = gs
        .filter((x) => yonetebilirMi(x) && botSunucu.includes(x.id))
        .map((x) => ({ id: x.id, ad: x.name, ikon: x.icon, sahip: !!x.owner, prem: premSet.has(x.id) }));
      res.json({ guilds: liste });
    } catch { res.status(500).json({ hata: 'discord-erisilemedi' }); }
  });

  app.get('/api/guild/:id', async (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    try {
      const gs = await discordAPI(s.token, '/users/@me/guilds');
      const g = gs.find((x) => x.id === req.params.id);
      if (!g || !yonetebilirMi(g)) return res.status(403).json({ hata: 'yetki-yok' });
      const j = await botAPI(`/api/bot/guild/${req.params.id}`);
      res.json(j);
    } catch (e) { res.status(e.kod === 404 ? 404 : 502).json({ hata: 'bot-hatasi', detay: e.message }); }
  });

  app.post('/api/guild/:id', async (req, res) => {
    const s = oturum(req);
    if (!s) return res.status(401).json({ hata: 'giris-yok' });
    try {
      const gs = await discordAPI(s.token, '/users/@me/guilds');
      const g = gs.find((x) => x.id === req.params.id);
      if (!g || !yonetebilirMi(g)) return res.status(403).json({ hata: 'yetki-yok' });
      const j = await botAPI(`/api/bot/guild/${req.params.id}`, { method: 'POST', body: JSON.stringify(req.body || {}) });
      res.json(j);
    } catch (e) { res.status(e.kod === 404 ? 404 : 502).json({ hata: 'bot-hatasi', detay: e.message }); }
  });

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));

  app.listen(PORT, () => console.log(`🌖 Köprü açık: http://localhost:${PORT} → bot: ${BOT() || '(ayarlanmadı!)'}`));
}

if (require.main === module) startKopru();

module.exports = { startKopru };
