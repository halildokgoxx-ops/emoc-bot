const { EmbedBuilder } = require('discord.js');
const { db, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { sahipMi } = require('../src/premium');

// SAHİP KOMUTLARI — sadece 2 kurucu ID (OWNER_ID/OWNER_ID2) kullanabilir.
// Slash'a çıkmazlar (PREFIX_ONLY), bilmeyen göremez. Sessiz reddederler.
function kapı(message) {
  if (!sahipMi(message.author.id)) return false;
  return true;
}

function kapaliListe() {
  const d = db();
  if (!Array.isArray(d.kapaliKomutlar)) d.kapaliKomutlar = [];
  return d.kapaliKomutlar;
}

module.exports = [
  {
    name: 'komut-kapat', aliases: ['komutkapat', 'cmd-kapat'], category: 'Sistem',
    description: 'Komutu kapatır (SADECE kurucular).', usage: '!komut-kapat <komut>',
    async run(message, args) {
      if (!kapı(message)) return;
      const ad = String(args[0] || '').toLowerCase().replace(/^!/, '');
      if (!ad) return message.reply({ embeds: [err('Kullanım: `!komut-kapat <komut>`\nListe: `!komut-liste`')] });
      const cmd = message.client.commands.get(ad) || message.client.commands.get(message.client.aliases.get(ad));
      if (!cmd) return message.reply({ embeds: [err(`\`${ad}\` diye komut yok!`)] });
      if (['komut-ac', 'komut-kapat', 'komut-liste', 'restart'].includes(cmd.name)) {
        return message.reply({ embeds: [err('⛔ Sahip komutları kapatılamaz!')] });
      }
      const liste = kapaliListe();
      if (liste.includes(cmd.name)) return message.reply({ embeds: [err(`\`${cmd.name}\` zaten kapalı!`)] });
      liste.push(cmd.name);
      save();
      return message.reply({ embeds: [ok(`🔒 \`${cmd.name}\` kapatıldı! (prefix + slash ikisi de durur)\nAçmak: \`!komut-ac ${cmd.name}\``)] });
    },
  },
  {
    name: 'komut-ac', aliases: ['komutac', 'cmd-ac'], category: 'Sistem',
    description: 'Kapalı komutu açar (SADECE kurucular).', usage: '!komut-ac <komut>',
    async run(message, args) {
      if (!kapı(message)) return;
      const ad = String(args[0] || '').toLowerCase().replace(/^!/, '');
      if (!ad) return message.reply({ embeds: [err('Kullanım: `!komut-ac <komut>`')] });
      const d = db();
      const once = (d.kapaliKomutlar || []).length;
      d.kapaliKomutlar = (d.kapaliKomutlar || []).filter((x) => x !== ad);
      if (d.kapaliKomutlar.length === once) return message.reply({ embeds: [err(`\`${ad}\` zaten açık (veya listede yok)!`)] });
      save();
      return message.reply({ embeds: [ok(`🔓 \`${ad}\` açıldı!`)] });
    },
  },
  {
    name: 'komut-liste', aliases: ['komutliste', 'cmd-liste'], category: 'Sistem',
    description: 'Kapalı komutları listeler (SADECE kurucular).', usage: '!komut-liste',
    async run(message) {
      if (!kapı(message)) return;
      const liste = kapaliListe();
      const e = new EmbedBuilder().setColor(0x5865F2).setTitle('🔒 Kapalı Komutlar')
        .setDescription(liste.length ? liste.map((x) => `\`${x}\``).join(' ') : '*Hepsi açık!*')
        .setFooter({ text: `Toplam: ${message.client.commands.size} komut • ${liste.length} kapalı` }).setTimestamp();
      return message.reply({ embeds: [e] });
    },
  },
  {
    name: 'restart', aliases: ['yeniden-baslat', 'reboot', 'yb'], category: 'Sistem',
    description: 'Botu yeniden başlatır (SADECE kurucular).', usage: '!restart',
    async run(message) {
      if (!kapı(message)) return;
      await message.reply('🔄 Yeniden başlatılıyor... (10-20sn sonra dönerim)').catch(() => {});
      setTimeout(() => process.exit(0), 1500);
    },
  },
];
