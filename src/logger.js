// AŞIRI DETAYLI LOG SİSTEMİ
// - Silinen mesaj: kim, ne zaman, hangi kanal, içerik, FOTO/VIDEO/SES önizlemesi, KİM sildi (audit)
// - Düzenlenen mesaj (hayalet edit yakalayıcı), toplu silme, ban/kick/timeout/nick/rol,
//   kanal/rol oluşturma-silme, sunucu ayarları, davetler, ses giriş-çıkış
// - ANTI-NUKE KALKANI: kanal/rol/ban patlamasında otomatik kilit + sahibine DM (benzersiz!)
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuild } = require('./db');
const config = require('../config');

async function logKanalBul(guild) {
  try {
    const g = getGuild(guild.id);
    if (!g.logKanal) return null;
    const k = guild.channels.cache.get(g.logKanal);
    return k && k.isTextBased() ? k : null;
  } catch { return null; }
}

async function gonder(guild, embed) {
  const k = await logKanalBul(guild);
  if (k) await k.send({ embeds: [embed] }).catch(() => {});
}

async function executorBul(guild, tip, hedefId, ms = 8000) {
  try {
    const logs = await guild.fetchAuditLogs({ type: tip, limit: 6 });
    return logs.entries.find(e => e.target && e.target.id === hedefId && Date.now() - e.createdTimestamp < ms) || null;
  } catch { return null; }
}

function boyutYaz(b) {
  if (!b && b !== 0) return '?';
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1048576).toFixed(2)}MB`;
}

function zamanAlan(tarihMs) {
  return `<t:${Math.floor(tarihMs / 1000)}:F> (<t:${Math.floor(tarihMs / 1000)}:R>)`;
}

// ---- Silinen mesaj (medyalı) ----
async function logSilinen(message) {
  try {
    if (!message.guild || message.author.bot) return;
    const ekler = [...message.attachments.values()];
    const resimler = ekler.filter(a => (a.contentType || '').startsWith('image/'));
    const videolar = ekler.filter(a => (a.contentType || '').startsWith('video/'));
    const sesler = ekler.filter(a => (a.contentType || '').startsWith('audio/'));
    const diger = ekler.filter(a => !(a.contentType || '').match(/^(image|video|audio)\//));

    const satir = [];
    for (const a of resimler) satir.push(`🖼️ [${a.name}](${a.url}) (${boyutYaz(a.size)})`);
    for (const a of videolar) satir.push(`🎬 [${a.name}](${a.url}) (${boyutYaz(a.size)})`);
    for (const a of sesler) satir.push(`🎵 [${a.name}](${a.url}) (${boyutYaz(a.size)})`);
    for (const a of diger) satir.push(`📎 [${a.name}](${a.url}) (${boyutYaz(a.size)})`);

    // Kim sildi? (mod mu, kendisi mi?)
    const audit = await executorBul(message.guild, AuditLogEvent.MessageDelete, message.author.id);
    const silen = audit ? `${audit.executor} (\`${audit.executor.tag}\`)` : 'Kendi sildi veya bilinmiyor';

    const e = new EmbedBuilder().setColor(config.colors.error)
      .setTitle('🗑️ Mesaj Silindi')
      .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: '👤 Yazan', value: `${message.author} (\`${message.author.tag}\`)`, inline: true },
        { name: '📍 Kanal', value: `${message.channel}`, inline: true },
        { name: '🧨 Silen', value: silen, inline: false },
        { name: '📝 İçerik', value: (message.content || '*yazı yok (sadece medya/embed)*').slice(0, 1024), inline: false },
      );
    if (satir.length) e.addFields({ name: `📎 Ekler (${ekler.length}) — süresi dolmadan aç!`, value: satir.join('\n').slice(0, 1024), inline: false });
    if (message.embeds.length) e.addFields({ name: '📦 Embed', value: `${message.embeds.length} adet embed vardı`, inline: true });
    if (message.stickers.size) e.addFields({ name: '😀 Sticker', value: [...message.stickers.values()].map(s => s.name).join(', ').slice(0, 200), inline: true });
    if (resimler.length) e.setImage(resimler[0].url);
    e.addFields(
      { name: '📅 Yazılma', value: zamanAlan(message.createdTimestamp), inline: false },
      { name: '🆔 Mesaj ID', value: `\`${message.id}\``, inline: true },
    ).setTimestamp();
    await gonder(message.guild, e);
  } catch {}
}

// ---- Düzenlenen mesaj ----
async function logDuzenlenen(eski, yeni) {
  try {
    if (!yeni.guild || yeni.author.bot) return;
    if ((eski.content || '') === (yeni.content || '')) return; // sadece embed güncellendi
    const e = new EmbedBuilder().setColor(config.colors.warn)
      .setTitle('✏️ Mesaj Düzenlendi (Hayalet Edit?)')
      .setThumbnail(yeni.author.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: '👤 Yazan', value: `${yeni.author} (\`${yeni.author.tag}\`)`, inline: true },
        { name: '📍 Kanal', value: `${yeni.channel}`, inline: true },
        { name: '⬅️ Önce', value: (eski.content || '*boş*').slice(0, 1024), inline: false },
        { name: '➡️ Sonra', value: (yeni.content || '*boş*').slice(0, 1024), inline: false },
        { name: '🔗 Mesaj', value: `[Git](https://discord.com/channels/${yeni.guild.id}/${yeni.channel.id}/${yeni.id})`, inline: true },
      ).setTimestamp();
    await gonder(yeni.guild, e);
  } catch {}
}

// ---- ANTI-NUKE KALKANI ----
const patlama = new Map(); // `${gid}_${tur}` -> [zaman]
async function patlamaKontrol(guild, tur, limit = 4, pencere = 12000) {
  const key = `${guild.id}_${tur}`;
  const simdi = Date.now();
  const arr = (patlama.get(key) || []).filter(t => simdi - t < pencere);
  arr.push(simdi);
  patlama.set(key, arr);
  if (arr.length >= limit) {
    patlama.set(key, []);
    await antiNuke(guild, `toplu **${tur}** işlemi (${arr.length} adet / ${pencere / 1000}sn)`);
    return true;
  }
  return false;
}

async function antiNuke(guild, sebep) {
  try {
    let sayi = 0;
    for (const [, k] of guild.channels.cache) {
      if (k.isTextBased() && !k.isThread() && !k.isVoiceBased()) {
        try { await k.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }); sayi++; } catch {}
      }
    }
    const e = new EmbedBuilder().setColor(0xFF0000)
      .setTitle('🚨 ANTI-NUKE KALKANI DEVREDE!')
      .setDescription(`**${sebep}** tespit edildi!\n🛡️ **${sayi}** yazı kanalı otomatik kilitlendi.\n\nAçmak için: \`/sunucu-ac\` (Sunucuyu Yönet yetkisi)`)
      .setTimestamp();
    await gonder(guild, e);
    try {
      const sahip = await guild.fetchOwner();
      await sahip.send(`🚨 **${guild.name}** sunucunda saldırı şüphesi: ${sebep}\n🛡️ ${sayi} kanal kilitlendi. Kontrol et! Açmak için: \`/sunucu-ac\``).catch(() => {});
    } catch {}
  } catch {}
}

module.exports = { gonder, executorBul, logSilinen, logDuzenlenen, patlamaKontrol, antiNuke, boyutYaz };
