const { EmbedBuilder } = require('discord.js');
const { ok, err } = require('../src/embeds');
const config = require('../config');

async function kisaGet(url, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'EmocBot/2.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

function havaDurumu(kod) {
  if (kod === 0) return '☀️ Açık';
  if (kod <= 3) return '⛅ Parçalı Bulutlu';
  if (kod <= 48) return '🌫️ Sisli';
  if (kod <= 57) return '🌦️ Çisenti';
  if (kod <= 67) return '🌧️ Yağmurlu';
  if (kod <= 77) return '🌨️ Karlı';
  if (kod <= 82) return '🌧️ Sağanak';
  if (kod <= 99) return '⛈️ Fırtınalı';
  return '🌡️ Bilinmiyor';
}

const DILLER = { auto: 'Otomatik', tr: 'Türkçe', en: 'İngilizce', de: 'Almanca', fr: 'Fransızca', es: 'İspanyolca', it: 'İtalyanca', ru: 'Rusça', ar: 'Arapça', ja: 'Japonca', ko: 'Korece', zh: 'Çince', pt: 'Portekizce', nl: 'Hollandaca', uk: 'Ukraynaca', el: 'Yunanca' };

module.exports = [
  {
    name: 'hava', aliases: ['havadurumu', 'weather'], category: 'İşlevsel',
    description: 'Şehrin anlık hava durumunu gösterir! (Gerçek veri 🌤️)',
    usage: '!hava <şehir>',
    async run(message, args) {
      const sehir = args.join(' ');
      if (!sehir) return message.reply({ embeds: [err('Şehir yaz! `!hava ankara`')] });
      const m = await message.reply('🛰️ Uydulara bağlanılıyor...');
      try {
        const geo = await kisaGet(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(sehir)}&count=1&language=tr&format=json`);
        const yer = geo.results && geo.results[0];
        if (!yer) return m.edit({ content: '', embeds: [err(`"${sehir}" bulunamadı! Başka yaz.`)] });
        const h = await kisaGet(`https://api.open-meteo.com/v1/forecast?latitude=${yer.latitude}&longitude=${yer.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
        const c = h.current;
        const e = new EmbedBuilder().setColor(config.colors.main)
          .setTitle(`🌤️ ${yer.name}${yer.admin1 ? `, ${yer.admin1}` : ''} ${yer.country ? `(${yer.country})` : ''}`)
          .addFields(
            { name: '🌡️ Sıcaklık', value: `**${c.temperature_2m}°C** (hissedilen ${c.apparent_temperature}°C)`, inline: true },
            { name: '🌈 Durum', value: havaDurumu(c.weather_code), inline: true },
            { name: '💧 Nem', value: `%${c.relative_humidity_2m}`, inline: true },
            { name: '💨 Rüzgar', value: `${c.wind_speed_10m} km/h`, inline: true },
            { name: '📈 Bugün Max', value: `${h.daily.temperature_2m_max[0]}°C`, inline: true },
            { name: '📉 Bugün Min', value: `${h.daily.temperature_2m_min[0]}°C`, inline: true },
          ).setFooter({ text: 'open-meteo.com • anlık veri' }).setTimestamp();
        return m.edit({ content: '', embeds: [e] });
      } catch { return m.edit({ content: '', embeds: [err('Hava servisine ulaşamadım! Biraz sonra dene.')] }); }
    },
  },
  {
    name: 'deprem', aliases: ['depremler', 'sondeprem'], category: 'İşlevsel',
    description: 'Türkiye\'deki son depremleri gösterir! (Gerçek veri 🌍)',
    usage: '!deprem [min-büyüklük]',
    async run(message, args) {
      let min = parseFloat((args[0] || '').replace(',', '.')) || 3.5;
      min = Math.max(2, Math.min(8, min));
      const m = await message.reply('🌍 Sismik veriler çekiliyor...');
      try {
        const j = await kisaGet(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=35&maxlatitude=43&minlongitude=25&maxlongitude=46&minmagnitude=${min}&limit=5&orderby=time`);
        const liste = (j.features || []).slice(0, 5);
        if (!liste.length) return m.edit({ content: '', embeds: [ok(`🎉 M${min}+ deprem yok! Türkiye sakin... şimdilik. 😌`)] });
        const enBuyuk = Math.max(...liste.map(f => f.properties.mag));
        const renk = enBuyuk >= 5 ? config.colors.error : enBuyuk >= 4 ? config.colors.warn : config.colors.success;
        const desc = liste.map(f => {
          const p = f.properties;
          const derinlik = f.geometry.coordinates[2];
          return `**M${p.mag.toFixed(1)}** — ${p.place}\n> 📅 <t:${Math.floor(p.time / 1000)}:R> • 📏 ${derinlik.toFixed(0)} km derinlik`;
        }).join('\n\n');
        return m.edit({ content: '', embeds: [new EmbedBuilder().setColor(renk).setTitle(`🌍 Son Depremler (M${min}+)`).setDescription(desc).setFooter({ text: 'USGS • Geçmiş olsun Türkiye ❤️' }).setTimestamp()] });
      } catch { return m.edit({ content: '', embeds: [err('Deprem servisine ulaşamadım!')] }); }
    },
  },
  {
    name: 'doviz', aliases: ['kur', 'dolar', 'euro', 'exchange'], category: 'İşlevsel',
    description: 'Güncel döviz kurlarını gösterir! (Gerçek veri 💹)',
    usage: '!doviz',
    async run(message) {
      const m = await message.reply('💹 Kurlar çekiliyor...');
      try {
        const j = await kisaGet('https://open.er-api.com/v6/latest/USD');
        const r = j.rates;
        const usd = r.TRY, eur = r.TRY / r.EUR, gbp = r.TRY / r.GBP;
        return m.edit({
          content: '', embeds: [new EmbedBuilder().setColor(config.colors.gold).setTitle('💹 Güncel Kurlar (₺)')
            .addFields(
              { name: '💵 Dolar (USD)', value: `**${usd.toFixed(4)} ₺**`, inline: true },
              { name: '💶 Euro (EUR)', value: `**${eur.toFixed(4)} ₺**`, inline: true },
              { name: '💷 Sterlin (GBP)', value: `**${gbp.toFixed(4)} ₺**`, inline: true },
            ).setFooter({ text: `Güncelleme: ${(j.time_last_update_utc || '').slice(0, 25)}` }).setTimestamp()],
        });
      } catch { return m.edit({ content: '', embeds: [err('Kur servisine ulaşamadım!')] }); }
    },
  },
  {
    name: 'cevir', aliases: ['çevir', 'translate', 'tr'], category: 'İşlevsel',
    description: 'Metni dile çevirir! Örn: !cevir en tr hello',
    usage: '!cevir <kaynak> <hedef> <metin>',
    slashOptions: [
      { type: 'string', name: 'kaynak', description: 'Kaynak dil', required: true, choices: Object.entries(DILLER).map(([v, n]) => ({ name: n, value: v })) },
      { type: 'string', name: 'hedef', description: 'Hedef dil', required: true, choices: Object.entries(DILLER).filter(([v]) => v !== 'auto').map(([v, n]) => ({ name: n, value: v })) },
      { type: 'string', name: 'metin', description: 'Çevrilecek metin', required: true },
    ],
    async run(message, args) {
      const kaynak = (args[0] || '').toLowerCase();
      const hedef = (args[1] || '').toLowerCase();
      const metin = args.slice(2).join(' ').slice(0, 450);
      if (!DILLER[kaynak] || !DILLER[hedef] || hedef === 'auto' || !metin) {
        return message.reply({ embeds: [err(`Kullanım: \`!cevir en tr hello world\`\nDiller: ${Object.keys(DILLER).filter(k => k !== 'auto').join(', ')} (kaynak: +auto)`)] });
      }
      try {
        const j = await kisaGet(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(metin)}&langpair=${kaynak}|${hedef}`);
        const cevrilmis = j.responseData && j.responseData.translatedText;
        if (!cevrilmis) throw new Error();
        return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`🌐 Çeviri (${DILLER[kaynak]} → ${DILLER[hedef]})`).addFields({ name: '📝 Orijinal', value: metin.slice(0, 1000), inline: false }, { name: '✅ Çeviri', value: cevrilmis.slice(0, 1000), inline: false }).setTimestamp()] });
      } catch { return message.reply({ embeds: [err('Çeviri servisine ulaşamadım!')] }); }
    },
  },
];
