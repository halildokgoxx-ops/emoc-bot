// 🛠️ /sunucu kur — Anime/Manga topluluk template'i + bot oto-bağlantıları
// SADECE sunucu sahibi + butonlu onay. Önce her şeyi siler, sonra kurar.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const { getGuild, setGuild, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { kart, RENK } = require('../src/tasarim');
const { E } = require('../src/emo');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bekleyen = new Map(); // guildId -> { userId, bitis }

// ---------- ROLLER ----------
const ROLLER = [
  { ad: '👑 Owner', renk: '#FF0000', hosit: true, admin: true },
  { ad: '🛡️ Admin', renk: '#FF7300', hosit: true, admin: true },
  { ad: '👮 Moderatör', renk: '#00D4FF', hosit: true, mod: true },
  { ad: '🎫 Destek', renk: '#00E676', hosit: true },
  { ad: '★ Partner Sorumlusu', renk: '#EC4899', hosit: true },
  { ad: '🔰 Deneme Yetkilisi', renk: '#57F287', hosit: true },
  { ad: '🎙️ Ses Yetkilisi', renk: '#00D4FF', hosit: true },
  { ad: '💬 Chat Yetkilisi', renk: '#8B5CF6', hosit: true },
  { ad: '🎉 Etkinlik Yetkilisi', renk: '#FFC93C', hosit: true },
  { ad: '🎭 Üye', renk: '#8B5CF6', hosit: false },
  { ad: '🌟 VIP Üye', renk: '#FFD700', hosit: true },
  { ad: '💎 Booster', renk: '#FF73FA', hosit: true },
  { ad: '18+', renk: '#2b2d31', hosit: false },
  { ad: '15-18', renk: '#2b2d31', hosit: false },
  { ad: '13-15', renk: '#2b2d31', hosit: false },
  { ad: '♂️ Erkek', renk: '#00D4FF', hosit: false },
  { ad: '♀️ Kadın', renk: '#FF69B4', hosit: false },
  { ad: 'Anime', renk: '#EC4899', hosit: false },
  { ad: 'Manga', renk: '#FFC93C', hosit: false },
  { ad: 'Oyun', renk: '#00E676', hosit: false },
  { ad: 'Müzik', renk: '#8B5CF6', hosit: false },
  { ad: 'Film', renk: '#FF7300', hosit: false },
  { ad: 'Kitap', renk: '#00D4FF', hosit: false },
  { ad: 'Valorant', renk: '#FF4655', hosit: false },
  { ad: 'Minecraft', renk: '#5BBA6F', hosit: false },
  { ad: 'LoL', renk: '#0AC8B9', hosit: false },
  { ad: 'CS2', renk: '#F0A500', hosit: false },
  { ad: 'GTA V', renk: '#76B900', hosit: false },
  { ad: 'Fortnite', renk: '#9D4EDD', hosit: false },
  { ad: 'PUBG', renk: '#E09F3E', hosit: false },
  { ad: 'Apex', renk: '#CD3333', hosit: false },
  { ad: 'Roblox', renk: '#FF3B3B', hosit: false },
  { ad: 'Brawl Stars', renk: '#FFB800', hosit: false },
  { ad: 'Among Us', renk: '#6BD6E1', hosit: false },
  { ad: 'Rocket League', renk: '#0055FF', hosit: false },
  { ad: 'Overwatch', renk: '#F99E1A', hosit: false },
  { ad: 'Fall Guys', renk: '#FF6EC7', hosit: false },
  { ad: 'PUBG Mobile', renk: '#8B5CF6', hosit: false },
  { ad: 'Free Fire', renk: '#FF7300', hosit: false },
  { ad: 'Kırmızı', renk: '#FF0000', hosit: false },
  { ad: 'Mavi', renk: '#0000FF', hosit: false },
  { ad: 'Yeşil', renk: '#00FF00', hosit: false },
  { ad: 'Mor', renk: '#800080', hosit: false },
  { ad: 'Pembe', renk: '#FF69B4', hosit: false },
  { ad: 'Turuncu', renk: '#FFA500', hosit: false },
  { ad: 'Sarı', renk: '#FFFF00', hosit: false },
  { ad: 'Gri', renk: '#808080', hosit: false },
  { ad: 'Beyaz', renk: '#FFFFFF', hosit: false },
  { ad: '🚀 Sv.5', renk: '#57F287', hosit: true },
  { ad: '🔥 Sv.10', renk: '#FF7300', hosit: true },
  { ad: '👑 Sv.20', renk: '#FFD700', hosit: true },
  { ad: '🏅 25 İtibar', renk: '#C0C0C0', hosit: true },
  { ad: '🥇 50 İtibar', renk: '#FFD700', hosit: true },
  { ad: '💎 100 İtibar', renk: '#00FFFF', hosit: true },
  { ad: 'Susturulmuş', renk: '#2b2d31', hosit: false },
];

// ---------- KANALLAR ----------
// isaret: hangi bot ayarına bağlanacak
const KATEGORILER = [
  {
    ad: '▬▬ ● Yetkili ve Yönetim ● ▬▬', gizli: ['mod'], kanallar: [
      { ad: '★・duyuru-yönetim', tip: 'yazi' },
      { ad: 'yönetici-chat', tip: 'yazi', isaret: 'yonetimChat' },
      { ad: 'yetkili-sohbet', tip: 'yazi' },
      { ad: '✅・partner-onay', tip: 'yazi', isaret: 'partnerOnay' },
    ],
  },
  {
    ad: '▬▬ ● ᴏɴᴇᴍʟɪ ● ▬▬', kanallar: [
      { ad: '📃・kurallar', tip: 'yazi', isaret: 'kurallar', kilitli: true },
      { ad: '📃・duyuru', tip: 'yazi', isaret: 'duyuru', kilitli: true },
      { ad: '📮・öneri-şikayet', tip: 'yazi' },
      { ad: '💼・yetkili-alım', tip: 'yazi' },
      { ad: '🪽・rol-al', tip: 'yazi', kilitli: true },
    ],
  },
  {
    ad: '▬▬ ● ɢᴇɴᴇʟ ● ▬▬', kanallar: [
      { ad: '💭・genel-sohbet', tip: 'yazi', isaret: 'gununSorusu' },
      { ad: '🤖・komut', tip: 'yazi' },
      { ad: '📷・foto-sohbet', tip: 'yazi' },
      { ad: '📹・video-sohbet', tip: 'yazi' },
      { ad: '💬・partner-sohbet', tip: 'yazi', isaret: 'partnerChat' },
      { ad: '🔔・itibar-bildirim', tip: 'yazi', isaret: 'repBildirim' },
    ],
  },
  {
    ad: '▬▬ ● sɪᴢɪɴ ● ▬▬', kanallar: [
      { ad: '🌹・geceye-söz-bırak', tip: 'yazi' },
      { ad: '🤯・anı-anlatma', tip: 'yazi' },
      { ad: '😳・itiraflar', tip: 'yazi' },
      { ad: '📝・hobiler', tip: 'yazi' },
      { ad: '🎂・doğum-günleri', tip: 'yazi' },
    ],
  },
  { ad: '▬▬ ● ᴅᴇsᴛᴇᴋ ● ▬▬', kanallar: [{ ad: '🎫・destek', tip: 'yazi' }] },
  {
    ad: '▬▬ ● ʙᴏᴏsᴛ ● ▬▬', kanallar: [
      { ad: '🚀・boost', tip: 'yazi', isaret: 'boostSys', kilitli: true },
      { ad: '✨・booster-ayrıcalıkları', tip: 'yazi', isaret: 'boosterPerks', kilitli: true },
    ],
  },
  {
    ad: '▬▬ ● İlgi Alanları ● ▬▬', kanallar: [
      { ad: '📚・manga-kitap', tip: 'yazi' },
      { ad: '🎬・film-dizi', tip: 'yazi' },
      { ad: '🎮・oyunlar', tip: 'yazi' },
      { ad: '🎧・anime-müzik', tip: 'yazi' },
    ],
  },
  {
    ad: '▬▬ ● ᴇɢʟᴇɴᴄᴇ ● ▬▬', kanallar: [
      { ad: '💬・kelime-türetme', tip: 'yazi', isaret: 'oyunKelime' },
      { ad: '🤷・tuttu-tutmadı', tip: 'yazi', isaret: 'oyunTuttu' },
      { ad: '🔢・sayı-sayma', tip: 'yazi', isaret: 'oyunSayi' },
    ],
  },
  {
    ad: '▬▬ ● ᴘᴀʀᴛɴᴇʀ ● ▬▬', kanallar: [
      { ad: '📄・partner-şartlar', tip: 'yazi', isaret: 'partnerSart', kilitli: true },
      { ad: '💎・partner-text', tip: 'yazi', isaret: 'partnerText', kilitli: true },
      { ad: '🤝・partner', tip: 'yazi', isaret: 'partnerKanal', kilitli: true },
    ],
  },
  { ad: '▬▬ ● ᴄᴇᴋɪʟɪs ● ▬▬', kanallar: [{ ad: '🎉・çekiliş', tip: 'yazi', kilitli: true }] },
  {
    ad: '▬▬ ● ᴏɴᴇʀɪ ● ▬▬', kanallar: [
      { ad: '🎬・film-dizi-öneri', tip: 'yazi' },
      { ad: '🎧・şarkı-öneri', tip: 'yazi' },
      { ad: '🎮・oyun-öneri', tip: 'yazi' },
    ],
  },
  {
    ad: '▬▬ ● sᴇsʟɪ ● ▬▬', kanallar: [
      { ad: '🎤・Sohbet', tip: 'ses' },
      { ad: '🎮・Oyun', tip: 'ses' },
      { ad: '🎵・Müzik', tip: 'ses' },
      { ad: '😴・Afk', tip: 'ses', isaret: 'afk' },
    ],
  },
  {
    ad: '▬▬ ● ɪɴᴠɪᴛᴇ ● ▬▬', kanallar: [
      { ad: '📥・gelenler', tip: 'yazi', isaret: 'hosgeldin' },
      { ad: '📤・gidenler', tip: 'yazi', isaret: 'cikis' },
      { ad: '📈・sayaç', tip: 'yazi', isaret: 'sayac', kilitli: true },
      { ad: '📈・level', tip: 'yazi', isaret: 'levelKanal' },
    ],
  },
  { ad: '▬▬-●-LOG●-▬▬', gizli: ['mod'], kanallar: [{ ad: '📜・loglar', tip: 'yazi', isaret: 'log', kilitli: true }] },
];

const VARSAYILAN_PARTNER_TEXT = '🌙 **{sunucu}** ・ {üye} üyeli anime & oyun topluluğu!\n💬 Samimi sohbet • 🎮 Oyun geceleri • 🎉 Çekilişler\n🔗 Katıl: {davet}';

// Şık görünüm: kanal konu (açıklama) yazıları
const KONULAR = {
  '📃・kurallar': '📃 Kuralları oku, aileni koru! Uymayan cezasını çeker.',
  '📃・duyuru': '📢 Önemli haberler — sadece yönetim yazar.',
  '📮・öneri-şikayet': '💡 Fikrin ya da şikayetin mi var? Yaz, okuyoruz!',
  '💼・yetkili-alım': '📝 Ekibe katılmak mı istiyorsun? Başvurunu buraya yaz!',
  '🪽・rol-al': '🎭 Yakında tepki-rol sistemi burada olacak!',
  '💭・genel-sohbet': '💬 Geyik, muhabbet, kahkaha — hepsi burada!',
  '🤖・komut': '🤖 Bot komutlarını burada dene! Örn: /yardım',
  '📷・foto-sohbet': '📸 En iyi kareler burada! (Paylaşım: Booster özel)',
  '📹・video-sohbet': '🎬 Komik videolar burada! (Paylaşım: Booster özel)',
  '💬・partner-sohbet': '🤝 Partner olmak için "partner" yaz, formu doldur!',
  '🔔・itibar-bildirim': '⭐ İtibar hakkı yenilenenler burada etiketlenir.',
  '🌹・geceye-söz-bırak': '🌙 Geceye bir söz bırak...',
  '🤯・anı-anlatma': '📖 Unutamadığın anını anlat!',
  '😳・itiraflar': '🤫 Anonim itiraflar: !itiraf <yazın>',
  '📝・hobiler': '🎨 Hobilerini paylaş, ekibini bul!',
  '🎂・doğum-günleri': '🎂 Doğum günün mü? Kutlayalım!',
  '🎫・destek': '🎫 Destek için menüden konu seç, odan açılsın!',
  '🚀・boost': '💜 Sunucuya boost basan efsaneler burada görünür!',
  '✨・booster-ayrıcalıkları': '💎 Sadece boosterlara özel lounge.',
  '📚・manga-kitap': '📚 Manga & kitap muhabbeti!',
  '🎬・film-dizi': '🍿 Film/dizi öner, tartış!',
  '🎮・oyunlar': '🎮 Ekip ara, lobini kur!',
  '🎧・anime-müzik': '🎧 Anime müzikleri & openingler!',
  '💬・kelime-türetme': '🔤 Son harfle kelime türet!',
  '🤷・tuttu-tutmadı': '🎲 Tahmin et: tuttu mu tutmadı mı?',
  '🔢・sayı-sayma': '🔢 Sırayla say, bozan başa döndürür!',
  '📄・partner-şartlar': '📄 Partnerlik şartları — oku, sonra başvur!',
  '💎・partner-text': '💎 Sunucumuzun resmi tanıtım yazısı.',
  '🤝・partner': '🤝 Onaylı partner sunucular burada!',
  '🎉・çekiliş': '🎁 Çekilişler burada! Katılmayı unutma.',
  '🎬・film-dizi-öneri': '🍿 İzlemeye değer ne var?',
  '🎧・şarkı-öneri': '🎵 Günün şarkısını bırak!',
  '🎮・oyun-öneri': '🕹️ Hangi oyuna dalalım?',
  '📥・gelenler': '👋 Yeni üyeler burada karşılanır!',
  '📤・gidenler': '👋 Ayrılanlara elveda...',
  '📈・sayaç': '🎯 Üye hedefine sayaç!',
  '📜・loglar': '📋 Sunucu kayıtları — sadece yönetim.',
  '✅・partner-onay': '🔔 Partner başvuruları — sadece yetkililer.',
  '★・duyuru-yönetim': '📢 Yönetim duyuruları.',
  'yönetici-chat': '👑 Sadece üst yönetim.',
  'yetkili-sohbet': '👮 Ekip içi sohbet.',
};

const KURALLAR_YAZI = `# 📃・SUNUCU KURALLARI
**${'{sunucu}'}** ailesine hoş geldin! Burayı herkes için eğlenceli tutmak senin elinde. 👇

## 👉・GENEL KURALLAR
**1.** **Saygılı ol.** Küfür, hakaret, aşağılama, hedef gösterme **yasak.**
**2.** **Spam/flood yapma.** Aynı mesajı tekrar atma, gereksiz etiketleme.
**3.** **CAPS ile bağırma.** Sürekli büyük harf kullanımı uyarı sebebidir.
**4.** **Reklam yasak.** Sunucu/ürün tanıtımı sadece partner kanallarında.
**5.** **NSFW yok.** +18, rahatsız edici, korkutucu içerik kesinlikle yasak.
**6.** **Özel bilgileri paylaşma.** Adres, telefon, TC, şifre gibi veriler yasak.
**7.** **Yetkiliye karşı gelme.** Karara itirazın varsa 🎫・destek kanalından ticket aç.

## 👉・SOHBET & MEDYA
**8.** Kanalları amacına göre kullan. (foto → 📷・foto-sohbet gibi)
**9.** Başkasının yerine cevap verme, konuyu sabote etme.
**10.** Siyaset, din ve ağır tartışma konularını uzatma.

## 👉・SES KANALLARI
**11.** Yankı/cızırtı yapanlar uyarılır, devam ederse odadan çıkarılır.
**12.** Başkasının konuşmasını sürekli bölme, bağırma.

## 👉・CEZALAR
**13.** **1. ihlal →** uyarı • **2. ihlal →** susturma • **3. ihlal →** atılma/ban.
**14.** Reklam botları ve 3 günden yeni şüpheli hesaplar **direkt banlanır.**
**15.** Ban itirazı için yeni hesapla gelme, ticket açman yeterli.

**Kuralları okumuş sayılırsın. İyi eğlenceler!** ${'{parti}'}`;

const PERKS_YAZI = `# 💎・BOOSTER AYRICALIKLARI
Sunucuya boost basan efsanelere özel lounge! **Sadece boosterlar görür.** 👇

## 🌟・SANA ÖZEL İZİNLER
**»** 📷 **Foto/video kanallarında paylaşım** sadece sende var!
**»** 😎 **Özel + harici emojiler** sohbette serbest!
**»** 🎙️ **Ses odalarında öncelikli konuşmacı** + yayın kalitesi!
**»** 💎 Profilinde **parlayan Booster rolü** + ayrı renk!

## 🎁・EKSTRA KIYAKLAR
**»** 🎉 Çekilişlerde **çift katılım hakkı!**
**»** 🤝 Partner başvurunda **öncelikli inceleme!**
**»** 💬 İsmin **ayrıcalıklı listede** gösterilir!

## ❓・NASIL BOOSTER OLURUM?
**»** Sunucu isminin üstüne tıkla → **Sunucuyu Takviye Et** → 1 boost yeter!
**»** Boostu çekersen ayrıcalıklar **otomatik alınır**, üzülürüz. 🥺

**Desteklerin için teşekkürler, iyi ki varsın!** 💜`;

// ---- 🎓 ORYANTASYON (Discord Onboarding: yeni gelen soruları cevaplayıp rol kapar) ----
// Roller kur/sunucu rollerinden ada göre bulunur, sorular otomatik kurulur.
// Topluluk açılmamış sunucuda Discord reddeder → {ok:false} döner, kurulum devam eder.
async function oryantasyonKur(guild, rolMap, isaret) {
  const rolId = (ad) => {
    try {
      const r = rolMap[ad];
      if (!r) return null;
      const id = typeof r === 'string' ? r : r.id;
      return guild.roles.cache.get(id) ? id : null;
    } catch { return null; }
  };
  const secenek = (baslik, emoji, rid) => rid ? { title: baslik, emoji, roles: [rid] } : { title: baslik, emoji };
  const prompts = [];
  // 1) Yaş
  const yaslar = [['13-15', '🌱'], ['15-18', '🌿'], ['18+', '🌳']].filter(([a]) => rolId(a));
  if (yaslar.length >= 2) {
    prompts.push({
      title: 'Kaç yaşındasın?', singleSelect: true, required: false, inOnboarding: true,
      options: [...yaslar.map(([a, e]) => secenek(a, e, rolId(a))), secenek('Belirtmek istemiyorum', '🚫', null)],
    });
  }
  // 2) Oyunlar
  const oyunEmo = {
    Valorant: '🔴', Minecraft: '⛏️', LoL: '⚔️', CS2: '💣', 'GTA V': '🚗', Fortnite: '🔨',
    PUBG: '🪂', Apex: '🔺', Roblox: '🟥', 'Brawl Stars': '⭐', 'Among Us': '🚀',
    'Rocket League': '🏎️', Overwatch: '🟠', 'Fall Guys': '🫘', 'PUBG Mobile': '📱', 'Free Fire': '🔥',
  };
  const oyunlar = Object.keys(oyunEmo).filter((a) => rolId(a));
  if (oyunlar.length >= 2) {
    prompts.push({
      title: 'Hangi oyunları seversin?', singleSelect: false, required: false, inOnboarding: true,
      options: oyunlar.map((a) => secenek(a, oyunEmo[a], rolId(a))),
    });
  }
  // 3) Cinsiyet
  const cinsiyetler = [['♂️ Erkek', '♂️'], ['♀️ Kadın', '♀️']].filter(([a]) => rolId(a));
  if (cinsiyetler.length >= 1) {
    prompts.push({
      title: 'Cinsiyetin nedir?', singleSelect: true, required: false, inOnboarding: true,
      options: [...cinsiyetler.map(([a, e]) => secenek(a, e, rolId(a))), secenek('Belirtmek istemiyorum', '🚫', null)],
    });
  }
  // 4) İlgi alanları
  const hobiEmo = { Anime: '⛩️', Manga: '📚', Oyun: '🎮', Müzik: '🎧', Film: '🎬', Kitap: '📖' };
  const hobiler = Object.keys(hobiEmo).filter((a) => rolId(a));
  if (hobiler.length >= 2) {
    prompts.push({
      title: 'İlgi alanların nelerdir?', singleSelect: false, required: false, inOnboarding: true,
      options: hobiler.map((a) => secenek(a, hobiEmo[a], rolId(a))),
    });
  }
  if (!prompts.length) return { ok: false, hata: 'Eşleşen rol bulunamadı' };
  const varsayilan = [isaret.kurallar?.id, isaret.duyuru?.id, isaret.gununSorusu?.id].filter(Boolean).slice(0, 7);
  try {
    await guild.editOnboarding({
      prompts,
      ...(varsayilan.length ? { defaultChannels: varsayilan } : {}),
      enabled: true,
      reason: 'Sunucu kurulumu: oryantasyon',
    });
    return { ok: true, soru: prompts.length };
  } catch (e) {
    return { ok: false, hata: String((e && e.message) || e).slice(0, 120) };
  }
}

const SEHIR_SESLER = ['İstanbul','Ankara','İzmir','Bursa','Antalya','Adana','Konya','Gaziantep','Mersin','Diyarbakır','Kayseri','Eskişehir','Samsun','Trabzon','Şanlıurfa','Denizli','Kocaeli','Sakarya','Tekirdağ','Balıkesir','Manisa','Hatay','Van','Erzurum','Muğla','Kahramanmaraş'];
// Şehre uyumlu emoji + limit merdiveni: en üst limitsiz(0), sonra 90'dan inerek ... en alt 2, üstü 3/4/5
const SEHIR_EMOJI = {
  'İstanbul': '🌉', 'Ankara': '🏛️', 'İzmir': '🌊', 'Bursa': '🌳', 'Antalya': '🏖️',
  'Adana': '🌶️', 'Konya': '🕌', 'Gaziantep': '🍴', 'Mersin': '🍋', 'Diyarbakır': '🏰',
  'Kayseri': '🏔️', 'Eskişehir': '🚂', 'Samsun': '🚢', 'Trabzon': '⚽', 'Şanlıurfa': '🐟',
  'Denizli': '🐓', 'Kocaeli': '🏭', 'Sakarya': '🏞️', 'Tekirdağ': '🍇', 'Balıkesir': '🫒',
  'Manisa': '🌿', 'Hatay': '🏺', 'Van': '🐱', 'Erzurum': '❄️', 'Muğla': '🌅',
  'Kahramanmaraş': '🍦',
};
const SEHIR_LIMIT = [0, 90, 85, 80, 75, 70, 60, 50, 40, 35, 30, 25, 20, 18, 15, 12, 10, 9, 8, 7, 6, 6, 5, 4, 3, 2];
async function ilerle(interaction, yazi) {
  try { await interaction.editReply({ content: yazi, embeds: [], components: [] }); } catch {}
}

async function buildEt(guild, client, interaction, ekstra = {}) {
  const ben = guild.members.me;
  if (!ben.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('Önce bana **Yönetici** yetkisi ver! (Sunucu Ayarları → Roller → Emoç → Yönetici ✅)');
  }

  // ---- 1) ROLLERİ SİL ----
  await ilerle(interaction, '🧹 **1/6** Eski roller siliniyor...');
  const enUst = ben.roles.highest.position;
  const silinecekRoller = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id && !r.managed && !r.tags?.botId && r.position < enUst);
  for (const r of silinecekRoller) {
    await r.delete('Sunucu kurulumu').catch(() => {});
    await sleep(500);
  }

  // ---- 2) KANALLARI SİL (komut kanalı en son!) ----
  await ilerle(interaction, '🧹 **2/6** Eski kanallar siliniyor...');
  const tumKanallar = [...guild.channels.cache.values()];
  const suanki = interaction.channelId;
  for (const k of tumKanallar.filter((k) => k.id !== suanki)) {
    await k.delete('Sunucu kurulumu').catch(() => {});
    await sleep(400);
  }

  // ---- 3) ROLLERİ KUR ----
  await ilerle(interaction, '🎭 **3/6** Roller kuruluyor...');
  const rolMap = {};
  for (const r of ROLLER) {
    const perms = r.admin ? [PermissionFlagsBits.Administrator]
      : r.mod ? [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers]
      : [];
    const rol = await guild.roles.create({ name: r.ad, color: r.renk, hoist: r.hosit, mentionable: false, permissions: perms, reason: 'Sunucu kurulumu' }).catch(() => null);
    if (rol) rolMap[r.ad] = rol;
    await sleep(600);
  }

  // Owner rolü: TAÇLI kullanıcı (sunucu sahibi) + .env kurucuları
  const sahipler = new Set([guild.ownerId, process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean));
  const tacAlanlar = [];
  for (const id of sahipler) {
    const uye = await guild.members.fetch(id).catch(() => null);
    if (uye && rolMap['👑 Owner']) {
      await uye.roles.add(rolMap['👑 Owner']).catch(() => {});
      tacAlanlar.push(uye);
    }
  }

  const yonetimRolleri = ['👑 Owner', '🛡️ Admin', '👮 Moderatör', '🎫 Destek'].map((a) => rolMap[a]).filter(Boolean);

  // ---- 4) KATEGORİ + KANALLAR ----
  await ilerle(interaction, '📁 **4/6** Kanallar kuruluyor...');
  const isaret = {};
  for (const kat of KATEGORILER) {
    const kategori = await guild.channels.create({ name: kat.ad, type: ChannelType.GuildCategory, reason: 'Sunucu kurulumu' }).catch(() => null);
    if (!kategori) continue;
    // Gizli kategoriler: herkese kapat, yönetime aç
    if (kat.gizli) {
      await kategori.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});
      for (const r of yonetimRolleri) await kategori.permissionOverwrites.edit(r, { ViewChannel: true }).catch(() => {});
    }
    await sleep(400);
    for (const k of kat.kanallar) {
      const kanal = await guild.channels.create({
        name: k.ad.toLocaleLowerCase('tr'),
        type: k.tip === 'ses' ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: kategori.id,
        topic: k.tip !== 'ses' ? KONULAR[k.ad]?.slice(0, 1024) : undefined,
        reason: 'Sunucu kurulumu',
      }).catch(() => null);
      if (kanal) {
        if (k.isaret) isaret[k.isaret] = kanal;
        // Vitrin kanalları: üye yazamaz + alt başlık (thread) yok + harici uygulama yok
        if (k.kilitli && k.tip !== 'ses') {
          await kanal.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false, UseExternalApps: false }).catch(() => {});
        }
        await sleep(500);
      }
    }
  }

  // ---- 5) ŞEHİR SES KANALLARI (26 şehir, emojili + limit merdiveni) ----
  await ilerle(interaction, '🌍 **5/6** Şehir ses kanalları kuruluyor...');
  try {
    const ozelLimit = ekstra.sesLimit ?? null;
    const tekLimit = ozelLimit === null ? null : Math.max(0, Math.min(99, ozelLimit));
    const sehirKat = await guild.channels.create({ name: '🌍・ŞEHİRLER', type: ChannelType.GuildCategory, reason: 'Sunucu kurulumu' }).catch(() => null);
    if (sehirKat) {
      for (let i = 0; i < SEHIR_SESLER.length; i++) {
        const sehir = SEHIR_SESLER[i];
        const emoji = SEHIR_EMOJI[sehir] || '📍';
        const limit = tekLimit !== null ? tekLimit : (SEHIR_LIMIT[i] ?? 0);
        await guild.channels.create({
          name: `${emoji}・${sehir}`,
          type: ChannelType.GuildVoice,
          parent: sehirKat.id,
          userLimit: limit > 0 ? limit : undefined,
          reason: 'Sunucu kurulumu',
        }).catch(() => null);
        await sleep(400);
      }
    }
  } catch {}

  // ---- 6) BOT AYARLARI (HER ŞEY OTOMATİK) ----
  await ilerle(interaction, '⚙️ **5/6** Bot ayarları bağlanıyor...');
  const g = getGuild(guild.id);
  const oncekiSure = g.repSuresiDk;
  setGuild(guild.id, {
    otoRol: rolMap['🎭 Üye']?.id || null,
    logKanal: isaret.log?.id || null,
    hosgeldinKanal: isaret.hosgeldin?.id || null,
    cikisKanal: isaret.cikis?.id || null,
    hosgeldinMesaj: '👋 Hoşgeldin {kullanıcı}! **{sunucu}** ailesine katıldın, {üye}. üyesin! 📃・kurallar kanalına göz atmayı unutma! 🎉',
    sayacHedef: 1000,
    sayacKanal: isaret.sayac?.id || null,
    levelBildirimKanal: isaret.levelKanal?.id || null,
    repBildirimKanal: isaret.repBildirim?.id || null,
    repSuresiDk: oncekiSure ?? 30,
    altKoruma: true,
    antiLink: true, antiKufur: true, antiSpam: true, antiRaid: true,
    antiBot: true, capsEngel: true,
    partnerKanal: isaret.partnerKanal?.id || null,
    partnerChat: isaret.partnerChat?.id || null,
    partnerYetkiliKanal: isaret.partnerOnay?.id || null,
    partnerYetkiliRol: rolMap['★ Partner Sorumlusu']?.id || null,
    partnerText: VARSAYILAN_PARTNER_TEXT,
    gununSorusuKanal: isaret.gununSorusu?.id || null,
    gununSorusuSon: Date.now(),
    seviyeRoller: [
      ...(rolMap['🚀 Sv.5'] ? [{ seviye: 5, rolId: rolMap['🚀 Sv.5'].id }] : []),
      ...(rolMap['🔥 Sv.10'] ? [{ seviye: 10, rolId: rolMap['🔥 Sv.10'].id }] : []),
      ...(rolMap['👑 Sv.20'] ? [{ seviye: 20, rolId: rolMap['👑 Sv.20'].id }] : []),
    ],
    repRoller: [
      ...(rolMap['🏅 25 İtibar'] ? [{ puan: 25, rolId: rolMap['🏅 25 İtibar'].id }] : []),
      ...(rolMap['🥇 50 İtibar'] ? [{ puan: 50, rolId: rolMap['🥇 50 İtibar'].id }] : []),
      ...(rolMap['💎 100 İtibar'] ? [{ puan: 100, rolId: rolMap['💎 100 İtibar'].id }] : []),
    ],
  });

  // AFK kanalı
  if (isaret.afk) {
    await guild.setAFKChannel(isaret.afk).catch(() => {});
    await guild.setAFKTimeout(300).catch(() => {});
  }
  // Doğrulama + medya filtresi en üst düzey
  try { if (guild.verificationLevel < 2) await guild.setVerificationLevel(2, 'Sunucu kurulumu'); } catch {}
  try { if (guild.explicitContentFilter < 2) await guild.setExplicitContentFilter(2, 'Sunucu kurulumu'); } catch {}

  // ---- 💎 Booster ayrıcalıkları + Susturulmuş cezaları (rol izinleri otomatik) ----
  const boosterRol = rolMap['💎 Booster'] || null;
  const susturulmus = Object.values(rolMap).find((r) => r.name === 'Susturulmuş') || null;
  for (const [, k] of guild.channels.cache) {
    if (k.isVoiceBased()) {
      if (susturulmus) await k.permissionOverwrites.edit(susturulmus, { Connect: false, Speak: false }).catch(() => {});
      if (boosterRol && !(k.name || '').includes('afk')) await k.permissionOverwrites.edit(boosterRol, { PrioritySpeaker: true, Stream: true }).catch(() => {});
      continue;
    }
    if (!k.isTextBased() || k.isThread()) continue;
    if (susturulmus) await k.permissionOverwrites.edit(susturulmus, { SendMessages: false, AddReactions: false, CreatePublicThreads: false, SendMessagesInThreads: false }).catch(() => {});
    const ad = k.name || '';
    if ((ad.includes('foto-sohbet') || ad.includes('video-sohbet')) && boosterRol) {
      await k.permissionOverwrites.edit(guild.roles.everyone, { AttachFiles: false, EmbedLinks: false }).catch(() => {});
      await k.permissionOverwrites.edit(boosterRol, { AttachFiles: true, EmbedLinks: true, UseExternalEmojis: true }).catch(() => {});
    }
    if ((ad.includes('genel-sohbet') || ad.includes('medya')) && boosterRol) {
      await k.permissionOverwrites.edit(boosterRol, { UseExternalEmojis: true, UseExternalStickers: true }).catch(() => {});
    }
  }
  // Perks kanalı: SADECE booster + yönetim görür + avantaj yazısı
  if (isaret.boosterPerks) {
    await isaret.boosterPerks.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});
    if (boosterRol) await isaret.boosterPerks.permissionOverwrites.edit(boosterRol, { ViewChannel: true }).catch(() => {});
    for (const r of yonetimRolleri) await isaret.boosterPerks.permissionOverwrites.edit(r, { ViewChannel: true }).catch(() => {});
    await isaret.boosterPerks.send({ content: PERKS_YAZI }).catch(() => {});
  }

  // ---- Sistem mesajları → boost kanalı (boost bildirimleri oraya düşer) ----
  if (isaret.boostSys) {
    await guild.setSystemChannel(isaret.boostSys).catch(() => {});
    try {
      const { GuildSystemChannelFlags } = require('discord.js');
      await guild.setSystemChannelFlags([
        GuildSystemChannelFlags.SuppressJoinNotifications,
        GuildSystemChannelFlags.SuppressJoinNotificationReplies,
        GuildSystemChannelFlags.SuppressGuildReminderNotifications,
      ]).catch(() => {});
    } catch {}
  }

  // ---- 🎓 Oryantasyon (yeni gelen soruları cevaplayıp rol kapar) ----
  await ilerle(interaction, '🎓 **6/6** Oryantasyon kuruluyor...');
  let oryantasyon = { ok: false, hata: 'bilinmiyor' };
  try { oryantasyon = await oryantasyonKur(guild, rolMap, isaret); }
  catch (e) { oryantasyon = { ok: false, hata: String((e && e.message) || e).slice(0, 100) }; }
  // Topluluk kapalıysa yönetim sohbetine retry butonu bırak
  if (!oryantasyon.ok && isaret.yonetimChat) {
    try {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sunucu_oryantasyon_kur').setLabel('🎓 Oryantasyonu Kur').setStyle(ButtonStyle.Primary)
      );
      await isaret.yonetimChat.send({
        content: '🎓 **Oryantasyon kurulamadı** (sebep: ' + String(oryantasyon.hata || 'bilinmiyor').slice(0, 150) + ')\n' +
          '👉 Sunucu Ayarları → **Topluluğu Etkinleştir** açıp aşağıdaki butona bas, sorular otomatik kurulsun!',
        components: [row],
      }).catch(() => {});
    } catch {}
  }

  // ---- 🎫 Otomatik ticket paneli (destek kanalı) ----
  try {
    const destekKanal = guild.channels.cache.find((k) => (k.name || '').includes('destek') && k.isTextBased() && !k.isThread() && !k.isVoiceBased());
    if (destekKanal) {
      let kat = guild.channels.cache.find((c) => c.name === '🎫-DESTEK' && c.type === ChannelType.GuildCategory);
      if (!kat) kat = await guild.channels.create({ name: '🎫-DESTEK', type: ChannelType.GuildCategory, reason: 'Sunucu kurulumu' }).catch(() => null);
      const gg = getGuild(guild.id);
      gg.ticket = { kategori: kat?.id || null, logKanal: isaret.log?.id || null, destekRol: rolMap['🎫 Destek']?.id || null, sayac: 0, acik: {} };
      save();
      const panel = new EmbedBuilder().setColor(0x5865F2).setTitle('🎫 DESTEK TALEBİ OLUŞTUR')
        .setThumbnail(guild.iconURL({ size: 256 }) || null)
        .setDescription('Yardıma mı ihtiyacın var? Aşağıdan konusunu seç, özel odan **anında** açılsın!\n\n🛠️ **Genel Destek** — soru, yardım\n🚨 **Şikayet** — kullanıcı/olay bildir\n🤝 **Partner** — partner başvurusu\n💡 **Öneri** — fikirlerin\n🔒 **Özel** — gizli konu\n\n*Kötüye kullananlara ceza verilir.*')
        .setFooter({ text: `${guild.name} • 7/24 destek` }).setTimestamp();
      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('🎫 Konu seç, ticket aç...')
          .addOptions([
            { label: 'Genel Destek', value: 'genel', emoji: '🛠️', description: 'Soru ve yardım' },
            { label: 'Şikayet', value: 'sikayet', emoji: '🚨', description: 'Kullanıcı/olay bildir' },
            { label: 'Partner', value: 'partner', emoji: '🤝', description: 'Partner başvurusu' },
            { label: 'Öneri', value: 'oneri', emoji: '💡', description: 'Fikrini paylaş' },
            { label: 'Özel', value: 'ozel', emoji: '🔒', description: 'Gizli konu' },
          ])
      );
      await destekKanal.send({ embeds: [panel], components: [menu] }).catch(() => {});
    }
  } catch {}

  // ---- 🎮 Oyun kanallarını oto-başlat (sayı + kelime motoru anında devrede!) ----
  try {
    const { db: _db, save: _save } = require('../src/db');
    const _d = _db();
    if (!_d.oyunlar) _d.oyunlar = {};
    if (isaret.oyunSayi) {
      _d.oyunlar[`${guild.id}_${isaret.oyunSayi.id}`] = { son: 0, sonKullanici: null, kelimeler: [] };
      await isaret.oyunSayi.send('🔢 **SAYI SAYMA BAŞLADI!**\nSıranla **1** yazarak başla!\n⚠️ Sırayı bozanın mesajı silinir, sayaç sıfırlanır. Aynı kişi üst üste yazamaz! 🚀').catch(() => {});
    }
    if (isaret.oyunKelime) {
      _d.oyunlar[`${guild.id}_${isaret.oyunKelime.id}`] = { son: 0, sonKullanici: null, kelimeler: ['araba'] };
      await isaret.oyunKelime.send('🔤 **KELİME TÜRETME BAŞLADI!**\nSon harfle devam et, tekrar kelime yasak!\nÖrn: **araba** 👇 (son harf: A)').catch(() => {});
    }
    if (isaret.oyunTuttu) {
      await isaret.oyunTuttu.send('🤷 **TUTTU-TUTMADI NASIL OYNANIR?**\n1️⃣ Biri bir tahmin yazar (örn: "yarın yağmur yağacak tuttu mu?")\n2️⃣ Sonraki kişi **TUTTU** ✅ veya **TUTMADI** ❌ yazar + yeni tahmin bırakır!\nİyi eğlenceler! 🎲').catch(() => {});
    }
    _save();
  } catch {}

  // Açılış mesajları (düz yazı — embeds yok!)
  try {
    if (isaret.kurallar) {
      const kural = KURALLAR_YAZI.replaceAll('{sunucu}', guild.name).replaceAll('{parti}', E(client, 'parti', '🎉'));
      await isaret.kurallar.send({ content: kural.slice(0, 1900) }).catch(() => {});
    }
    // 💎・partner-text kanalı durur ama OTOMATİK MESAJ ATILMAZ (admin /partner ayarla ile yönetir)
  } catch {}

  // Komut kanalını en son sil
  const sonKanal = guild.channels.cache.get(suanki);
  if (sonKanal) await sonKanal.delete('Sunucu kurulumu').catch(() => {});

  return { rolMap, isaret, tacAlanlar, oryantasyon };
}

const sunucuSlash = {
  data: {
    name: 'sunucu',
    description: '🛠️ Sunucu kurulum sihirbazı (template + oto-ayar)',
    contexts: [0],
    options: [
      { type: 1, name: 'kur', description: '⚠️ HER ŞEYİ silip hazır topluluk sunucusu kurar (SADECE sahip)', options: [{ type: 4, name: 'ses-limit', description: 'Boşsa limit merdiveni (limitsiz>90>...>5>4>3>2), verirsen tüm şehirler aynı limit', required: false, min_value: 0, max_value: 99 }] },
      { type: 1, name: 'bilgi', description: 'Kurulumda neler olacağını önizle (silmez)' },
    ],
  },
  async execute(interaction, client) {
    const alt = interaction.options.getSubcommand();
    if (alt === 'bilgi') {
      const rolSayi = ROLLER.length;
      const kanalSayi = KATEGORILER.reduce((a, k) => a + k.kanallar.length, 0) + SEHIR_SESLER.length;
      return interaction.reply({
        embeds: [kart(client, {
          baslik: '🛠️ /sunucu kur — Önizleme',
          aciklama: `**${KATEGORILER.length + 1} kategori • ${kanalSayi} kanal • ${rolSayi} rol** kurulur.\nAnime/Manga topluluk template'i + bot bağlantılı + 🌍 emojili şehir ses kanalları (limitsiz>90>...>5>4>3>2 merdiveni) + 🎓 oryantasyon!`,
          alanlar: [
            { name: '🤖 Otomatik Bağlananlar', value: '🎭 Oto-rol → Üye\n📋 Log → loglar\n👋 HG/Çıkış → gelenler/gidenler\n🎯 Sayaç (1000) → sayaç\n🔔 İtibar bildirim → itibar-bildirim\n🤝 Partner (kanal+chat+onay+rol+yazı)\n🎫 Ticket paneli → destek\n🎓 Oryantasyon (yaş + oyun + cinsiyet + ilgi)\n🎮 Oyunlar oto-başlar (sayı + kelime motoru)\n💎 Booster rolü + özel izinler\n🥷 Alt hesap koruması (3g kick / 7g gözlem)\n💬 Günün sorusu → genel-sohbet\n🚀 Sv.5/10/20 + 🏅 25/50/100 İtibar rolleri\n👑 Owner rolü → sahip + kurucular', inline: false },
            { name: '⚠️ Dikkat', value: 'Mevcut **TÜM kanallar ve roller silinir!** (bot rolleri hariç)\nSadece **sunucu sahibi** kurabilir.\n🎓 Oryantasyon için sunucuda **Topluluk** açık olmalı, değilse kurulum sonunda uyarı verir.', inline: false },
          ],
          altbilgi: 'Kurmak için: /sunucu kur',
        })],
        ephemeral: true,
      });
    }

    // KUR — sadece sahip + PREMIUM
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Bu komutu sadece **sunucu sahibi** kullanabilir! (Her şey silineceği için)', ephemeral: true });
    }
    if (!require('../src/premium').premiumMu(interaction.guild.id)) {
      return interaction.reply({ content: '👑 `/sunucu kur` **PREMIUM** özelliğidir!\nKodun varsa `/premium aktiflestir` yaz, avantajlar için `/premium bilgi` bak! 💎', ephemeral: true });
    }
    const ben = interaction.guild.members.me;
    if (!ben.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Önce bana **Yönetici** yetkisi ver! (Sunucu Ayarları → Roller → Emoç)', ephemeral: true });
    }

    bekleyen.set(interaction.guild.id, { userId: interaction.user.id, bitis: Date.now() + 60000, sesLimit: interaction.options.getInteger('ses-limit') ?? null });
    setTimeout(() => bekleyen.delete(interaction.guild.id), 65000);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sunucu_kur_onay').setLabel('✅ EVET, HER ŞEYİ SİL VE KUR').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('sunucu_kur_iptal').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary),
    );
    return interaction.reply({
      embeds: [kart(client, {
        renk: RENK.hata,
        baslik: '☢️ SON UYARI!',
        aciklama: `**TÜM kanallar ve TÜM roller kalıcı olarak silinecek!**\nGeri dönüş YOK!\n\nKurulacak: **15 kategori • 65+ kanal (26 emojili şehir ses kanalı, limit merdivenli) • ${ROLLER.length} rol** + tüm bot ayarları otomatik.`,
        altbilgi: '60 saniyen var — iyi düşün!',
      })],
      components: [row],
      ephemeral: true,
    });
  },
};

async function handleSunucuButton(interaction, client) {
  if (interaction.customId === 'sunucu_kur_iptal') {
    bekleyen.delete(interaction.guild.id);
    return interaction.update({ content: '😮‍💨 Vazgeçildi, hiçbir şey silinmedi.', embeds: [], components: [] }).catch(() => {});
  }
  // 🎓 Oryantasyon retry butonu (yönetim sohbeti)
  if (interaction.customId === 'sunucu_oryantasyon_kur') {
    if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true }).catch(() => {});
    }
    await interaction.deferUpdate().catch(() => {});
    try {
      const rolMap = {};
      for (const [, r] of interaction.guild.roles.cache) rolMap[r.name] = r;
      const bul = (parca) => interaction.guild.channels.cache.find((k) => (k.name || '').includes(parca) && k.isTextBased() && !k.isThread() && !k.isVoiceBased()) || null;
      const sonuc = await oryantasyonKur(interaction.guild, rolMap, {
        kurallar: bul('kurallar'), duyuru: bul('duyuru'), gununSorusu: bul('genel-sohbet'),
      });
      if (sonuc.ok) {
        await interaction.editReply({ content: `🎓 Oryantasyon kuruldu! **${sonuc.soru} soru** aktif (yaş + oyun + cinsiyet + ilgi)! 🎉`, components: [] }).catch(() => {});
      } else {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('sunucu_oryantasyon_kur').setLabel('🔁 Tekrar Dene').setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({ content: `⚠️ Hâlâ kurulamadı: ${sonuc.hata}\nTopluluğu açtığından emin olup tekrar bas!`, components: [row] }).catch(() => {});
      }
    } catch (e) {
      await interaction.editReply({ content: `❌ Hata: ${String((e && e.message) || e).slice(0, 200)}` }).catch(() => {});
    }
    return;
  }
  // ONAY
  const kayit = bekleyen.get(interaction.guild.id);
  if (!kayit) return interaction.reply({ content: '❌ Süre dolmuş! Yeniden `/sunucu kur` yaz.', ephemeral: true });
  if (interaction.user.id !== kayit.userId) return interaction.reply({ content: '❌ Bu karar sana ait değil!', ephemeral: true });
  if (interaction.guild.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Artık sahip değilsin!', ephemeral: true });
  bekleyen.delete(interaction.guild.id);

  await interaction.deferUpdate().catch(() => {});
  const t0 = Date.now();
  try {
    const { rolMap, tacAlanlar, oryantasyon } = await buildEt(interaction.guild, client, interaction, { sesLimit: kayit.sesLimit });
    const sure = Math.round((Date.now() - t0) / 1000);
    const ozet = kart(client, {
      renk: RENK.basari,
      baslik: '🎉 SUNUCUN HAZIR!',
      aciklama: `**${sure} saniyede** her şey kuruldu! ${E(client, 'parti', '🎉')}\n👑 **Taçlı sahip + kurucular:** ${(tacAlanlar || []).map((u) => `${u}`).join(' ') || '*sunucuda bulunamadı*'}`,
      alanlar: [
            { name: '✅ Otomatik Ayarlananlar', value: '🎭 Oto-rol • 📋 Log • 👋 HG/Çıkış • 🎯 Sayaç\n🔔 İtibar bildirim • 🤝 Partner full-set • 🎫 Ticket paneli\n💬 Günün sorusu • 🚀 Seviye rolleri • 🏅 İtibar rolleri\n💎 Booster rolü+izinleri • 🥷 Alt hesap koruması\n👑 Owner rolleri dağıtıldı\n🌍 26 emojili şehir ses kanalı (limitsiz>90>...>5>4>3>2)\n🎮 Oyun kanalları oto-başlatıldı (sayı + kelime)', inline: false },
        { name: '🎓 Oryantasyon', value: oryantasyon?.ok ? `✅ Kuruldu (${oryantasyon.soru} soru: yaş + oyun + cinsiyet + ilgi)! Yeni gelenler soruları cevaplayıp rol kapar.` : `⚠️ Atlandı (${oryantasyon?.hata || 'bilinmiyor'}) — yönetim sohbetine retry butonu bıraktım!`, inline: false },
        { name: '🚀 Sonraki Adımlar', value: '`/ticket-kur #destek @Destek` → destek paneli\n`/vitrin-ekle ...` → sunucunu tanıt\n`/partner ayarla` → yazını özelleştir', inline: false },
      ],
    });
    // Komut kanalı silindiği için duyuru kanalına + edit denemesi
    await interaction.editReply({ content: '', embeds: [ozet], components: [] }).catch(() => {});
    const duyuru = interaction.guild.channels.cache.find((k) => k.name.includes('duyuru') && k.isTextBased());
    if (duyuru) await duyuru.send({ embeds: [ozet] }).catch(() => {});
  } catch (e) {
    console.error('Sunucu kur hatası:', e.message);
    await interaction.editReply({ content: `❌ Kurulum yarıda kaldı: ${e.message}\nEksikleri elle tamamla veya tekrar dene.`, embeds: [], components: [] }).catch(() => {});
  }
}

module.exports = [];
module.exports.sunucuSlash = sunucuSlash;
module.exports.handleSunucuButton = handleSunucuButton;
module.exports.oryantasyonKur = oryantasyonKur;
