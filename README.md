# 🤖 Public Discord Botu — Ultra Gelişmiş (Slash + Prefix)

**122 komut** — 96 `/slash` + tümü `!prefix` ile çalışır! İtibar + Yeni Nesil Partner + Güvenlik + Ticket + Ekonomi + Anime GIF + Detaylı Log + Gerçek Verili İşlevsel komutlar!

## ⚡ Kurulum (2 dakika)

1. Node.js 18+ kur: https://nodejs.org
2. `.env` dosyası hazır olmalı: `TOKEN`, `PREFIX`, `CLIENT_ID`
3. Kur + slash'ları kaydet + çalıştır:
```
npm install
npm run deploy
npm start
```
> Bot açılışta slash'ları otomatik de kaydeder. Global slash'ların görünmesi 1 saati bulabilir.

## 🔗 Davet
```
https://discord.com/oauth2/authorize?client_id=1547703829384921190&permissions=8&scope=bot%20applications.commands
```
Yönetici yetkisiyle ekle!

## ⭐ İtibar Sistemi
**Kullanıcı:** `!1 @kullanıcı <sebep>` → +1 • mesaja cevap verip `!1 <sebep>` → ona +1 • `!itibar top` → sunucu ligi • `!itibar` → kendi profilin
**Yönetici:** `/itibar ver` • `/itibar al` • `/itibar sure-ayarla dakika:60` (iki oy arası bekleme) • `/itibar bildirim-kanal kanal:#kanal` (hak yenilenince etiket + 🔔 Bildirim Aç/Kapat butonu!)
- Unvanlar: 🌱 → ✨ → 🥉 Bronz (10) → 🥈 Gümüş (25) → 🥇 Altın (50) → 💎 Elmas (100) → 👑 Efsane (250)

## ✨ Özel Uygulama Emojileri (17 adet yüklü!)
`npm run emoji` ile portala yüklenir, bot her sunucuda otomatik kullanır: yıldız, kupa, kalkan, çan, taç, elmas, ateş, parti, kalp, para, madalya, el sıkışma...

## 🤝 YENİ Partner Sistemi (istediğin akış!)
1. **Kurulum** (5 ayar birden):
```
/partner ayarla kanal:#partner yetkili_rol:@Partner-YT chat:#partner-chat yetkili_kanal:#partner-onay yazi:🌙 Sunucumuz... 
```
veya prefix: `!partner-kur #partner @Partner-YT #partner-chat #partner-onay 🌙 Sunucumuz...`
2. Biri `#partner-chat` kanalına **"partner"** yazınca bot otomatik **🤝 Partner Ol butonu** gönderir (anime gifli!).
3. Butona basan **form (modal)** doldurur: kendi partner texti + sunucu linki (link zorunlu!).
4. Başvuru **yetkili kanalına** düşer: sunucu linki ayrı satırda + detay embed + **✅ Onayla / ❌ Reddet** butonları (yetkili rolü pinglenir).
5. **Onay** → text şık embed + "Sunucuya Katıl" butonuyla partner kanalına düşer, başvurana **DM** gider ✅
6. **Ret** → sebep formu açılır, başvurana sebeple **DM** gider ❌
- `/partner bilgi | liste | durum | sifirla` + eski botlar-arası `/partner capraz-istek` de duruyor!

## 🔒 Güvenlik — `/guvenlik` `/güvenlik-ayarla` `/güvenlik-skor` `/log-ayarla` `/oto-rol` `/sayac`...

## 🎫 Ticket — `/ticket-kur #destek @Destek` (menülü panel, transcript loga gider)

## ✨ Benzersiz Özellikler (diğer botlarda yok!)
- ⚔️ `/duello @rakip [bahis]` — anime gif'li düello animasyonu + para bahsi
- 🧬 `/sunucu-dna` — sunucu karakter analizi kartı
- 📡 `/partner-radar` — vitrinle eşleşme yüzdesi taraması
- 💘 `/ruh-esi` — günlük ruh eşi bulma
- 🌸 `/anime` — 20+ anime GIF kategorisi + Tenor link butonu
- 🔳 `/qr`, 🔐 `/sifre-uret` (DM'ye), 🧮 `/hesapla`, 🔮 `/kader`, ⚡ `/vibe`, 🗺️ ruh haritası

## 📦 Kategoriler
Genel • Moderasyon (25+) • Güvenlik • İtibar • Ekonomi • Seviye • Eğlence • Partner • Özel • İşlevsel — `/yardım` menüsü gifli + örnekli!

## 🛡️ Moderasyon (tam set!)
`/purge 20 botlar` (filtreli, pin korumalı) • `/sicil @k` (risk puanlı!) • `/forceban ID` • `/tempban @k 1d` (oto-açılır) • `/banlist` • `/susturulanlar` • `/sunucu-kilit` + `/sunucu-ac` (panik butonu 🚨) • `/toplu-rol` • `/rol-olustur` `/rol-sil` `/rol-renk` `/rol-bilgi` • `/kanal-ac` `/kanal-sil` `/kanal-bilgi` • `/çek` `/kes` `/taşı` (ses!) • `/dehoist` • `/davet-olustur` • `/kilit 10m` (süreli!) • `/yavasmod` • `/nuke`

## 📋 Aşırı Detaylı Log (`/log-ayarla #log` + "Sunucu Ayarları → Denetim Kaydı" yetkisi ver!)
Silinen mesaj (içerik + **foto/video/ses önizlemesi** + **kimi sildiği**), hayalet edit, toplu silme, ban/kick/timeout/nick/rol değişimleri, kanal/rol açılma-silme-güncelleme (yönetici izni alarmı!), sunucu ayarları, davetler, ses giriş-çıkış + **ANTI-NUKE KALKANI** (toplu silmede otomatik kilit + sahibine DM) 🛡️

## 🧰 İşlevsel (gerçek veri, anahtarsız!)
`/hava ankara` 🌤️ • `/deprem` 🌍 • `/doviz` 💹 • `/cevir en tr hello` 🌐 • `/qr` • `/sifre-uret` • `/hesapla`

## 🏰 /sunucu kur — Tek Tıkla Dehşet Sunucu! (SADECE sahip)
Anime/Manga topluluk template'i: **14 kategori • 40+ kanal • 39 rol** (yaş/ilgi/oyun/renk rolleri + staff).
Kurunca OTOMATİK: 🎭 oto-rol → Üye • 📋 log • 👋 HG/çıkış • 🎯 sayaç • 🔔 itibar bildirim • 🤝 partner full-set • 💬 günün sorusu • 🚀 Sv.5/10/20 + 🏅 25/50/100 rolleri • 👑 Owner rolü (sahip + kuruculara).
⚠️ Mevcut kanallar/roller silinir — önce `/sunucu bilgi` ile önizle, butonla onayla!
🏅 İtibar rolleri: `/itibar rol ekle puan:50 rol:@Altın` • liste: `/itibar rol liste` • puana ulaşan rolü otomatik kapar!

## ⚠️ Önemli
- Tokeni kimseyle paylaşma! Sızarsa Developer Portal → Reset Token.
- Partner başvurusu için botun **DM izni** açık olmalı (ret/kabul bildirimi için).
