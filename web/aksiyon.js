// Bot aksiyonları — hem direkt panel (server.js) hem köprü-botu (botapi.js) kullanır.
const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('../src/db');

function degiskenKoy(metin, guild) {
  return String(metin || '')
    .split('{sunucu}').join(guild.name)
    .split('{uye}').join(String(guild.memberCount || 0));
}

async function embedGonder(client, { guildId, channelId, baslik, aciklama, renk }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { hata: 'yok' };
  const kanal = guild.channels.cache.get(channelId);
  if (!kanal || !kanal.isTextBased()) return { hata: 'kanal-yok' };
  const acik = String(aciklama || '').slice(0, 4000);
  if (!acik.trim() && !baslik) return { hata: 'bos' };
  const emb = new EmbedBuilder()
    .setDescription(degiskenKoy(acik, guild) || '...')
    .setColor(/^#[0-9a-f]{6}$/i.test(String(renk || '')) ? String(renk) : '#8b7cf6')
    .setTimestamp();
  if (baslik) emb.setTitle(String(baslik).slice(0, 256));
  await kanal.send({ embeds: [emb] });
  return { ok: true };
}

async function medyaYukle(client, { guildId, tip, dosyalar }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { hata: 'yok' };
  if (!['emoji', 'sticker'].includes(tip)) return { hata: 'tip' };
  const liste = Array.isArray(dosyalar) ? dosyalar.slice(0, 10) : [];
  const sonuc = [];
  for (const d of liste) {
    const hamAd = String((d && d.ad) || 'yeni');
    try {
      const ad = hamAd.toLocaleLowerCase('tr').replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'medya';
      const buf = Buffer.from(String((d && d.data) || '').split(',').pop(), 'base64');
      const limit = tip === 'emoji' ? 262144 : 524288;
      if (!buf.length || buf.length > limit) { sonuc.push({ ad: hamAd.slice(0, 32), ok: false, hata: 'boyut' }); continue; }
      if (tip === 'emoji') await guild.emojis.create({ attachment: buf, name: ad });
      else await guild.stickers.create({ file: buf, name: ad.slice(0, 30) || 'sticker', tags: ad.slice(0, 30) || 'sticker' });
      sonuc.push({ ad, ok: true });
    } catch { sonuc.push({ ad: hamAd.slice(0, 32), ok: false, hata: 'olusturulamadi' }); }
  }
  return { ok: true, sonuc };
}

async function emojirolTepki(client, { guildId, index = -1 }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { hata: 'yok' };
  const liste = getGuild(guild.id).emojiRoller || [];
  const sonuc = [];
  for (let i = 0; i < liste.length; i++) {
    if (index >= 0 && i !== index) continue;
    const k = liste[i];
    try {
      const kanal = guild.channels.cache.get(String(k.kanal));
      if (!kanal || !kanal.isTextBased()) { sonuc.push({ i, ok: false, hata: 'kanal-yok' }); continue; }
      const mesaj = await kanal.messages.fetch(String(k.mesajId)).catch(() => null);
      if (!mesaj) { sonuc.push({ i, ok: false, hata: 'mesaj-yok' }); continue; }
      const em = String(k.emoji).trim();
      const idEsles = em.match(/(\d{15,25})/);
      const tepki = idEsles ? (guild.emojis.cache.get(idEsles[1]) || idEsles[1]) : em;
      await mesaj.react(tepki);
      sonuc.push({ i, ok: true });
    } catch { sonuc.push({ i, ok: false, hata: 'tepki-olmadi' }); }
  }
  return { ok: true, sonuc };
}

module.exports = { embedGonder, medyaYukle, emojirolTepki };
