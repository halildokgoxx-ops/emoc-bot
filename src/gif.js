// Anime GIF yardımcısı — key gerektirmeyen ücretsiz anime API'leri kullanır.
// Önce waifu.pics, olmazsa nekos.best dener. İkisi de anime GIF verir.
const cache = new Map(); // kategori -> { url, zaman }

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'EmocBot/2.0' } });
  if (!res.ok) throw new Error('api ' + res.status);
  return res.json();
}

async function animeGif(kategori = 'hug') {
  const kat = String(kategori || 'hug').toLowerCase();
  const c = cache.get(kat);
  if (c && Date.now() - c.zaman < 60_000) return c.url;
  // 1) waifu.pics
  try {
    const j = await fetchJson(`https://api.waifu.pics/sfw/${encodeURIComponent(kat)}`);
    if (j && j.url) { cache.set(kat, { url: j.url, zaman: Date.now() }); return j.url; }
  } catch {}
  // 2) nekos.best (kategori eşlemesi)
  const nekosMap = { hug: 'hug', kiss: 'kiss', slap: 'slap', pat: 'pat', poke: 'poke', cuddle: 'cuddle', cry: 'cry', dance: 'dance', happy: 'happy', wink: 'wink', smile: 'smile', wave: 'wave', bonk: 'bonk', kick: 'kick' };
  try {
    const nk = nekosMap[kat] || 'hug';
    const j = await fetchJson(`https://nekos.best/api/v2/${nk}`);
    const url = j && j.results && j.results[0] && j.results[0].url;
    if (url) { cache.set(kat, { url, zaman: Date.now() }); return url; }
  } catch {}
  return null;
}

// Tenor'da daha fazlası butonu için arama linki
function tenorLink(arama) {
  const q = encodeURIComponent(`${arama} anime gif`).replace(/%20/g, '-');
  return `https://tenor.com/search/${q}-gifs`;
}

const ANIME_KATEGORILER = ['hug', 'kiss', 'slap', 'pat', 'poke', 'cuddle', 'cry', 'dance', 'happy', 'wink', 'smile', 'wave', 'bonk', 'smug', 'blush', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'kick', 'yeet', 'blush'];

module.exports = { animeGif, tenorLink, ANIME_KATEGORILER };
