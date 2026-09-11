// Küçük yardımcılar
function parseSure(str) {
  if (!str) return 0;
  const m = String(str).toLowerCase().match(/^(\d+)\s*(sn|saniye|s|dk|dakika|m|saat|h|gün|gun|d|hafta|w)?$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const b = m[2] || 's';
  if (['sn', 'saniye', 's'].includes(b)) return n * 1000;
  if (['dk', 'dakika', 'm'].includes(b)) return n * 60 * 1000;
  if (['saat', 'h'].includes(b)) return n * 3600 * 1000;
  if (['gün', 'gun', 'd'].includes(b)) return n * 86400 * 1000;
  if (['hafta', 'w'].includes(b)) return n * 7 * 86400 * 1000;
  return 0;
}

function sureYaz(ms) {
  if (!ms || ms <= 0) return '0sn';
  const sn = Math.floor(ms / 1000);
  if (sn < 60) return `${sn}sn`;
  const dk = Math.floor(sn / 60);
  if (dk < 60) return `${dk}dk ${sn % 60}sn`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa}sa ${dk % 60}dk`;
  const g = Math.floor(sa / 24);
  return `${g}gün ${sa % 24}sa`;
}

function rastgele(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Günlük seed — herkesin kaderi gün değişince değişir ama gün boyu sabit
function gunlukSeed(str) {
  const gun = new Date().toISOString().slice(0, 10);
  let h = 0;
  const s = `${gun}:${str}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function seedRandom(seed) {
  let t = seed + 0x6D2B79F5;
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KUFURLER = ['amk', 'aq', 'orospu', 'piç', 'pic', 'sik', 'yarrak', 'göt', 'got', 'amcık', 'amcik', 'ibne', 'pezevenk', 'kahpe', 'sürtük', 'surtuk', 'salak', 'aptal', 'mal', 'gerizekalı', 'gerizekali', 'oç', 'oc'];
function kufurMu(text) {
  const t = ' ' + text.toLowerCase().replace(/[^a-zçğıöşü ]/gi, ' ') + ' ';
  return KUFURLER.some(k => t.includes(k));
}

const LINK_REGEX = /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i;
function linkMu(text) {
  return LINK_REGEX.test(text);
}

// Sahte nitro/steam/airdrop dolandırıcılık linkleri
const SCAM_LISTE = [
  'discord.gift', 'discordnitro', 'nitro-gl', 'free-nitro', 'free nitro', 'nitro-free',
  'claim-nitro', 'nitro-claim', 'discord-gift', 'gift-nitro', 'discorduapp', 'disccord',
  'dicsord', 'discorcl', 'discordapp-gift', 'steamcomminuty', 'steam-nitro',
  'airdrop', 'claim-airdrop', 'free-steam', 'csgo-skins-free', 'skins-free',
];
function dolandiriciMi(text) {
  const t = String(text || '').toLowerCase();
  return SCAM_LISTE.some((k) => t.includes(k));
}

function davetKoduBul(text) {
  const m = String(text).match(/(?:discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)([a-zA-Z0-9-]+)/);
  return m ? m[1] : null;
}

// Mesajdaki ilk resim/gif linkini ayıkla (panelden gif ekleme için)
const RESIM_RE = /(https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(\?\S*)?)/i;
function medyaAyikla(metin) {
  const m = String(metin || '').match(RESIM_RE);
  if (!m) return { metin: String(metin || ''), resim: null };
  return { metin: String(metin).replace(m[0], '').trim(), resim: m[0] };
}

module.exports = { parseSure, sureYaz, rastgele, gunlukSeed, seedRandom, kufurMu, linkMu, dolandiriciMi, davetKoduBul, medyaAyikla };
