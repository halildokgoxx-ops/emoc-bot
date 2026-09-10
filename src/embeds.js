const { EmbedBuilder } = require('discord.js');
const config = require('../config');

function base(color = config.colors.main) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}
function ok(desc, title = '✅ Başarılı') {
  return base(config.colors.success).setTitle(title).setDescription(desc);
}
function err(desc, title = '❌ Hata') {
  return base(config.colors.error).setTitle(title).setDescription(desc);
}
function info(desc, title = null) {
  const e = base().setDescription(desc);
  if (title) e.setTitle(title);
  return e;
}

// İtibar rozeti — diğer botlarda yok, seviyeli unvan
function repRozet(rep) {
  if (rep >= 250) return '👑 EFSANE';
  if (rep >= 100) return '💎 ELMAS';
  if (rep >= 50) return '🥇 ALTIN';
  if (rep >= 25) return '🥈 GÜMÜŞ';
  if (rep >= 10) return '🥉 BRONZ';
  if (rep >= 1) return '✨ TANINAN';
  if (rep <= -10) return '☠️ KARA LİSTE';
  if (rep < 0) return '👎 SEVİMSİZ';
  return '🌱 YENİ';
}

function repBar(rep) {
  const v = Math.max(0, Math.min(100, rep));
  const dolu = Math.round(v / 10);
  return '▰'.repeat(dolu) + '▱'.repeat(10 - dolu);
}

function kisiBul(message, args, index = 0) {
  const m = message.mentions.members.first()
    || message.guild.members.cache.get(args[index])
    || (args[index] ? message.guild.members.cache.find(x =>
      x.user.username.toLowerCase().includes(args[index].toLowerCase()) ||
      (x.nickname && x.nickname.toLowerCase().includes(args[index].toLowerCase()))) : null);
  return m || null;
}

async function kisiBulAsync(message, args, index = 0) {
  let m = kisiBul(message, args, index);
  if (m) return m;
  const id = (args[index] || '').replace(/[<@!>]/g, '');
  if (/^\d{15,22}$/.test(id)) {
    try { m = await message.guild.members.fetch(id); } catch {}
  }
  return m || null;
}

module.exports = { base, ok, err, info, repRozet, repBar, kisiBul, kisiBulAsync };
