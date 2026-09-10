# 🚀 Katabump Kurulum (5 dakika)

## 1. Server aç
- https://dashboard.katabump.com/servers/create → giriş yap
- Tip: **Node.js** (sürüm **20** varsa onu seç)
- Plan: **0 credit / ücretsiz** olan
- İsim: `Emoc` (veya istediğin)

## 2. Dosyaları yükle
- `emoc-bot-deploy.zip` içini servera çıkar+yükle (File Manager veya SFTP bilgileriyle FileZilla).
- `node_modules` YÜKLEME (panel otomatik `npm install` yapar; yapmazsa konsoldan sen çalıştır).

## 3. Ortam değişkenlerini gir (Environment / Variables)
| Key | Değer |
|---|---|
| `TOKEN` | Bot tokenin (Developer Portal → Bot) |
| `PREFIX` | `!` |
| `CLIENT_ID` | `1547703829384921190` |
| `OWNER_ID` | Sahip ID |
| `OWNER_ID2` | 2. sahip ID (yoksa boş) |
| `BRIDGE_SECRET` | Uzun rastgele yazı (paneldek ile aynı olacaksa) |
| `ENABLE_WEB` | `0` (ücretsiz planda port yoksa) veya `1` |

## 4. Başlat
- Startup Command: `npm start` (veya Start butonu)
- Logda `🤖 Giriş yapıldı: Emoç#...` görünce tamamdır ✅

## Sorun olursa
- `npm install` hatası → Node sürümünü 20 yap.
- Bot çevrimdışı → TOKEN doğru mu, konsolda hata var mı bak.
- `data/` klasörü otomatik oluşur, elle açmana gerek yok.
