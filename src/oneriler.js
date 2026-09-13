// 🎬🎮 Günün Anime + Oyun Önerisi — AniList (animes) + hazır liste (oyunlar), tam Türkçe kart.
// Anime kartı Yumi düzeninin aynısıdır, imza Emoç'tür.
const { EmbedBuilder } = require('discord.js');
const { getGuild, save } = require('./db');
const { gunlukSeed, seedRandom } = require('./utils');

const ANILIST = 'https://graphql.anilist.co';

// AniList türleri → Türkçe
const TUR_MAP = {
  Action: 'Aksiyon', Adventure: 'Macera', Comedy: 'Komedi', Drama: 'Dram',
  Fantasy: 'Fantazi', Horror: 'Korku', Mecha: 'Mecha', Music: 'Müzik',
  Mystery: 'Gizem', Psychological: 'Psikolojik', Romance: 'Romantik',
  'Sci-Fi': 'Bilim Kurgu', 'Slice of Life': 'Günlük Yaşam', Sports: 'Spor',
  Supernatural: 'Doğaüstü', Thriller: 'Gerilim',
};
// Bilinen etiketler → Türkçe (bilinmeyen İngilizce kalır)
const ETIKET_MAP = {
  'Super Power': 'Süper Güç', Shounen: 'Shounen', Henshin: 'Henshin',
  Space: 'Uzay', 'Martial Arts': 'Dövüş Sanatları', School: 'Okul',
  Demons: 'İblisler', Magic: 'Büyü', Military: 'Askeri', Swordplay: 'Kılıç',
  Guns: 'Silahlar', Racing: 'Yarış', Samurai: 'Samuray', Ninja: 'Ninja',
  Pirates: 'Korsanlar', Zombies: 'Zombiler', Vampires: 'Vampirler',
  'Time Travel': 'Zaman Yolculuğu', 'Alternate Universe': 'Alternatif Evren',
  'Urban Fantasy': 'Şehir Fantazisi', 'Battle Royale': 'Ölüm Oyunu',
  'Anti-Hero': 'Anti-Kahraman', Cyborg: 'Siborg', Tomboy: 'Erkeksi Kız',
  Tsundere: 'Tsundere', 'Male Protagonist': 'Erkek Başrol',
  'Female Protagonist': 'Kadın Başrol', Revenge: 'İntikam',
  Survival: 'Hayatta Kalma', Mystery: 'Gizem', Horror: 'Korku',
  Tragedy: 'Trajedi', 'Coming of Age': 'Büyüme Hikayesi',
};
const DURUM_MAP = {
  FINISHED: 'Tamamlandı', RELEASING: 'Devam Ediyor',
  NOT_YET_RELEASED: 'Yakında', CANCELLED: 'İptal Edildi', HIATUS: 'Ara Verdi',
};
const FORMAT_MAP = {
  TV: 'TV', MOVIE: 'Film', OVA: 'OVA', ONA: 'ONA',
  SPECIAL: 'Özel', MANGA: 'Manga', MUSIC: 'Müzik',
};
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function turkceTarih(y, m, d) {
  if (!y) return '?';
  if (!m) return `${y}`;
  const ay = AYLAR[m - 1] || '';
  if (!d) return `${ay} ${y}`;
  return `${d} ${ay} ${y}`;
}

function htmlTemizle(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(i|b|em|strong)>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function ingilizceTurkce(metin) {
  const ham = String(metin || '').trim().slice(0, 1200);
  if (!ham) return '';
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(ham)}&langpair=en|tr`, {
      headers: { 'User-Agent': 'EmocBot/2.0' },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error('ceviri ' + r.status);
    const j = await r.json();
    let c = (j.responseData && j.responseData.translatedText) || '';
    // MyMemory bazen sorguyu aynen döndürür veya hata yazar
    if (!c || /QUERY LENGTH LIMIT|INVALID/i.test(c)) throw new Error('boş');
    return c.replace(/\(Source:/gi, '(Kaynak:').slice(0, 1500);
  } catch {
    return ham.slice(0, 1500);
  }
}

async function anilistSorgu(query, degisken) {
  const r = await fetch(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'EmocBot/2.0' },
    body: JSON.stringify({ query, variables: degisken }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('anilist ' + r.status);
  const j = await r.json();
  if (j.errors) throw new Error('anilist hata');
  return j.data;
}

const gunlukCache = new Map(); // `${tur}_${gun}` -> veri

async function animeGetir(gun) {
  const key = `anime_${gun}`;
  if (gunlukCache.get(key)) return gunlukCache.get(key);
  const data = await anilistSorgu(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          id title { romaji english }
          description genres tags { name rank isMediaSpoiler }
          format episodes duration startDate { year month day }
          studios { nodes { name } } averageScore status popularity
          coverImage { large color } siteUrl
        }
      }
    }`, { page: 1, perPage: 30 });
  const liste = (data.Page && data.Page.media) || [];
  if (!liste.length) throw new Error('liste boş');
  const seed = gunlukSeed('anime_' + gun);
  const sira = Math.floor(seedRandom(seed)() * Math.min(25, liste.length));
  const a = liste[sira];
  const aciklamaEN = htmlTemizle(a.description);
  const aciklama = await ingilizceTurkce(aciklamaEN);
  const turler = (a.genres || []).map((g) => TUR_MAP[g] || g);
  const etiketler = (a.tags || [])
    .filter((t) => !t.isMediaSpoiler)
    .sort((x, y) => (x.rank || 99) - (y.rank || 99))
    .slice(0, 12)
    .map((t) => ETIKET_MAP[t.name] || t.name);
  const veri = {
    baslik: `${a.title.romaji}${a.title.english && a.title.english !== a.title.romaji ? ` (${a.title.english})` : ''}`,
    aciklama,
    tur: turler.join(', ') || '?',
    tema: etiketler.join(', ') || '?',
    format: FORMAT_MAP[a.format] || a.format || '?',
    bolum: a.episodes || '?',
    sure: a.duration ? `${a.duration} dk` : '?',
    cikis: turkceTarih(a.startDate.year, a.startDate.month, a.startDate.day),
    studyo: (a.studios.nodes[0] && a.studios.nodes[0].name) || '?',
    puan: a.averageScore ? `${a.averageScore}/100` : '?',
    durum: DURUM_MAP[a.status] || a.status || '?',
    populerite: a.popularity ? `#${a.popularity}` : '?',
    trend: `#${sira + 1}`,
    resim: a.coverImage.large,
    renk: /^#[0-9a-f]{6}$/i.test(a.coverImage.color || '') ? a.coverImage.color : '#8B5CF6',
    link: a.siteUrl,
  };
  gunlukCache.set(key, veri);
  if (gunlukCache.size > 10) gunlukCache.clear();
  return veri;
}

function animeEmbed(client, v) {
  const e = new EmbedBuilder().setColor(v.renk)
    .setTitle(`Günün Anime Önerisi: ${v.baslik}`)
    .setDescription(v.aciklama)
    .addFields(
      { name: 'Tür', value: String(v.tur).slice(0, 500) || '?', inline: true },
      { name: 'Tema', value: String(v.tema).slice(0, 1000) || '?', inline: true },
      { name: 'Format', value: String(v.format), inline: true },
      { name: 'Bölüm Sayısı', value: String(v.bolum), inline: true },
      { name: 'Süre', value: String(v.sure), inline: true },
      { name: 'Çıkış Tarihi', value: String(v.cikis), inline: true },
      { name: 'Stüdyo', value: String(v.studyo).slice(0, 200), inline: true },
      { name: 'Puan', value: String(v.puan), inline: true },
      { name: 'Durum', value: String(v.durum), inline: true },
      { name: 'Popülerite', value: String(v.populerite), inline: true },
      { name: 'Trend', value: String(v.trend), inline: true },
      { name: '🔗 Detay', value: v.link ? `[AniList'te Aç](${v.link})` : '-', inline: true },
    )
    .setImage(v.resim || null)
    .setFooter({ text: 'Emoç • Günün Anime Önerisi' })
    .setTimestamp();
  try {
    const ikon = client?.user?.displayAvatarURL({ size: 64 });
    if (ikon) e.setAuthor({ name: 'Emoç', iconURL: ikon });
  } catch {}
  return e;
}

// ---- 🎮 Hazır oyun listesi (günlük deterministik seçim) ----
const OYUNLAR = [
  { ad: 'Minecraft', tur: 'Sandbox, Hayatta Kalma', yil: '2011', puan: '93/100', sure: 'Sınırsız', aciklama: 'Bloklardan kendi dünyanı kur! Tek başına kaleni dik veya arkadaşlarınla devasa şehirler inşa et. Yaratıcılığın sınırı yok.' },
  { ad: 'Grand Theft Auto V', tur: 'Aksiyon, Açık Dünya', yil: '2013', puan: '97/100', sure: '50+ saat', aciklama: 'Los Santos sokaklarında üç suçlunun hikayesi! Soygunlar yap, şehri keşfet, GTA Online ile arkadaşlarınla takıl.' },
  { ad: 'Elden Ring', tur: 'RPG, Souls-like', yil: '2022', puan: '96/100', sure: '60+ saat', aciklama: 'FromSoftware efsanesi! Devasa açık dünyada zorlu bosslar, gizli zindanlar ve unutulmaz bir macera seni bekliyor.' },
  { ad: 'The Witcher 3: Wild Hunt', tur: 'RPG, Açık Dünya', yil: '2015', puan: '93/100', sure: '100+ saat', aciklama: 'Rivialı Geralt olarak canavar avla, seçimlerinle hikayeyi şekillendir. Gelmiş geçmiş en iyi RPGlerden biri!' },
  { ad: 'Red Dead Redemption 2', tur: 'Aksiyon, Western', yil: '2018', puan: '97/100', sure: '60+ saat', aciklama: 'Vahşi batıda Arthur Morgan ile nefes kesen bir hikaye. At sür, avlan, çeteni yönet. Sinema gibi oyun!' },
  { ad: 'Valorant', tur: 'FPS, Taktiksel', yil: '2020', puan: '80/100', sure: 'Sınırsız', aciklama: 'Ajan yeteneklerinle 5v5 taktiksel savaş! Nişanını konuştur, spike kur, raundu kazan. Türkiye sunucusu aktif!' },
  { ad: 'League of Legends', tur: 'MOBA', yil: '2009', puan: '78/100', sure: 'Sınırsız', aciklama: '160+ şampiyon arasından seç, koridorunu domine et, nexusu yık! Arkadaşlarınla premade gir, derecelide yüksel.' },
  { ad: 'Counter-Strike 2', tur: 'FPS, Rekabetçi', yil: '2023', puan: '82/100', sure: 'Sınırsız', aciklama: 'Efsane geri döndü! Source 2 motoruyla yenilenen CS2de reflekslerini test et, rankını yükselt.' },
  { ad: 'Fortnite', tur: 'Battle Royale', yil: '2017', puan: '78/100', sure: 'Sınırsız', aciklama: '100 kişi, bir ada, tek kazanan! İnşa et, savaş, Victory Royale al. Sürekli etkinliklerle hiç sıkmaz.' },
  { ad: 'Roblox', tur: 'Platform, Sosyal', yil: '2006', puan: '75/100', sure: 'Sınırsız', aciklama: 'Milyonlarca oyuncu yapımı oyun tek platformda! Adopt Me, Brookhaven, Blox Fruits... Arkadaşlarınla gir, eğlenceye dal.' },
  { ad: 'Among Us', tur: 'Sosyal Deduction', yil: '2018', puan: '82/100', sure: 'Parti oyunu', aciklama: 'Kim imposter?! Görevleri yap, katili bul, arkadaşlarına yalan söyle (oyunda!). Kalabalıkla efsane olur.' },
  { ad: 'Fall Guys', tur: 'Party, Battle Royale', yil: '2020', puan: '80/100', sure: 'Sınırsız', aciklama: 'Şirin fasulyelerle çılgın parkurlar! 60 kişiden sona kalan taçı kapar. Kahkaha garantili!' },
  { ad: 'Rocket League', tur: 'Spor, Araba Futbolu', yil: '2015', puan: '85/100', sure: 'Sınırsız', aciklama: 'Arabalarla futbol! Uç, takla at, gol at. Öğrenmesi kolay, ustalaşması zor. Derecelide efsane ol!' },
  { ad: 'Overwatch 2', tur: 'FPS, Hero Shooter', yil: '2022', puan: '76/100', sure: 'Sınırsız', aciklama: '32 kahraman, 5v5 takım savaşı! Tank, DPS veya destek oyna, takımınla zafere uç.' },
  { ad: 'Apex Legends', tur: 'Battle Royale, FPS', yil: '2019', puan: '88/100', sure: 'Sınırsız', aciklama: 'Efsanelerle battle royale! Kay, tırman, yeteneklerini kullan. Hızlı ve akıcı çatışma arayanlara!' },
  { ad: 'PUBG: Battlegrounds', tur: 'Battle Royale', yil: '2017', puan: '72/100', sure: 'Sınırsız', aciklama: 'Battle royalein atası! Erangelde lootla, alanı oyna, tavuk yemeğini kap. Gerçekçi çatışma sevenlere.' },
  { ad: 'Stardew Valley', tur: 'Simülasyon, Çiftlik', yil: '2016', puan: '89/100', sure: '80+ saat', aciklama: 'Şehirden kaç, çiftliğini kur! Ek, biç, madencilik yap, kasabalılarla kaynaş. Huzurun oyunu.' },
  { ad: 'Terraria', tur: 'Sandbox, Macera', yil: '2011', puan: '83/100', sure: '60+ saat', aciklama: '2D Minecraft gibi ama boss avlı! Kaz, inşa et, bossları kes. Arkadaşlarla sunucu kur, maceraya dal.' },
  { ad: 'Hollow Knight', tur: 'Metroidvania', yil: '2017', puan: '90/100', sure: '30+ saat', aciklama: 'Küçük şövalyeyle devasa böcek krallığı! Zorlu bosslar, gizemli hikaye, muhteşem atmosfer. Silksong öncesi şart!' },
  { ad: 'God of War Ragnarök', tur: 'Aksiyon, Hikaye', yil: '2022', puan: '94/100', sure: '30+ saat', aciklama: 'Kratos ve Atreus İskandinav mitolojisinde! Baltanı savur, tanrılarla savaş. Destansı baba-oğul hikayesi.' },
  { ad: "Marvel's Spider-Man 2", tur: 'Aksiyon, Açık Dünya', yil: '2023', puan: '90/100', sure: '25+ saat', aciklama: 'New Yorkta ağ atarak süzül! Peter ve Miles ile Venom tehdidine karşı savaş. En akıcı hisseden oyunlardan!' },
  { ad: 'Cyberpunk 2077', tur: 'RPG, Açık Dünya', yil: '2020', puan: '86/100', sure: '50+ saat', aciklama: 'Night Cityde V ol! Neon ışıklar, çeteler, cyberware. 2.0 güncellemesiyle yepyeni bir oyun gibi!' },
  { ad: 'Baldur\'s Gate 3', tur: 'RPG, Sıra Tabanlı', yil: '2023', puan: '96/100', sure: '100+ saat', aciklama: 'Yılın oyunu! D&D evreninde seçimlerin her şeyi değiştirir. Arkadaşlarınla co-op oyna, hikayeyi birlikte yaz.' },
  { ad: 'EA Sports FC 25', tur: 'Spor, Futbol', yil: '2024', puan: '75/100', sure: 'Sınırsız', aciklama: 'Sanal çimlerin kralı! Ultimate Team kur, Pro Clubs arkadaşlarınla oyna, Süper Lig keyfi!' },
  { ad: 'Brawl Stars', tur: 'MOBA, Mobil', yil: '2018', puan: '79/100', sure: 'Sınırsız', aciklama: 'Telefondan 3v3 hızlı maçlar! 80+ karakter, hesaplaşma ve soygun modları. Her yerde oyna!' },
  { ad: 'PUBG Mobile', tur: 'Battle Royale, Mobil', yil: '2018', puan: '74/100', sure: 'Sınırsız', aciklama: 'Telefonda battle royale! Erangel, Livik haritaları, klan savaşları. Mobil oyunun zirvesi!' },
];

function oyunGetir(gun) {
  const seed = gunlukSeed('oyun_' + gun);
  const sira = Math.floor(seedRandom(seed)() * OYUNLAR.length);
  return { ...OYUNLAR[sira], trend: `#${sira + 1}` };
}

function oyunEmbed(client, o) {
  const e = new EmbedBuilder().setColor(0x00D4FF)
    .setTitle(`Günün Oyun Önerisi: ${o.ad}`)
    .setDescription(o.aciklama)
    .addFields(
      { name: 'Tür', value: String(o.tur).slice(0, 300), inline: true },
      { name: 'Çıkış', value: String(o.yil), inline: true },
      { name: 'Puan', value: String(o.puan), inline: true },
      { name: 'Oynanış Süresi', value: String(o.sure), inline: true },
      { name: 'Trend', value: String(o.trend), inline: true },
      { name: '👥 Tavsiye', value: 'Arkadaşlarınla oyna, daha çok eğlen!', inline: true },
    )
    .setFooter({ text: 'Emoç • Günün Oyun Önerisi' })
    .setTimestamp();
  try {
    const ikon = client?.user?.displayAvatarURL({ size: 64 });
    if (ikon) e.setAuthor({ name: 'Emoç', iconURL: ikon });
  } catch {}
  return e;
}

function gunAnahtar(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// Günlük oto-paylaşım: kanalı ayarlı sunuculara bugünün önerisini atar.
async function oneriGonder(client, guild, tur) {
  const g = getGuild(guild.id);
  const bugun = gunAnahtar();
  const kanalId = tur === 'anime' ? g.animeOneriKanal : g.oyunOneriKanal;
  const rolId = tur === 'anime' ? g.animeRol : g.oyunRol;
  const sonKey = tur === 'anime' ? 'animeOneriSon' : 'oyunOneriSon';
  if (!kanalId) return { atlandi: 'kanal-yok' };
  if (g[sonKey] === bugun) return { atlandi: 'bugun-atildi' };
  const kanal = guild.channels.cache.get(kanalId);
  if (!kanal || !kanal.isTextBased()) return { atlandi: 'kanal-yok' };
  let embed;
  if (tur === 'anime') {
    const veri = await animeGetir(bugun);
    embed = animeEmbed(client, veri);
  } else {
    embed = oyunEmbed(client, oyunGetir(bugun));
  }
  const rol = rolId ? guild.roles.cache.get(rolId) : null;
  await kanal.send({ content: rol ? `${rol}` : null, embeds: [embed] });
  const { setGuild } = require('./db');
  setGuild(guild.id, { [sonKey]: bugun });
  return { ok: true };
}

async function oneriTara(client) {
  for (const [, guild] of client.guilds.cache) {
    for (const tur of ['anime', 'oyun']) {
      try { await oneriGonder(client, guild, tur); }
      catch {}
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

module.exports = {
  TUR_MAP, ETIKET_MAP, DURUM_MAP, FORMAT_MAP, OYUNLAR,
  turkceTarih, htmlTemizle, animeGetir, animeEmbed,
  oyunGetir, oyunEmbed, oneriGonder, oneriTara, gunAnahtar,
};
