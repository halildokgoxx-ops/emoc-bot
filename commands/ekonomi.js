const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getUser, topPara, save } = require('../src/db');
const { ok, err, kisiBulAsync } = require('../src/embeds');
const { rastgele } = require('../src/utils');
const config = require('../config');

function paraYaz(n) { return `${(n || 0).toLocaleString('tr-TR')} 🪙`; }

module.exports = [
  {
    name: 'gunluk', aliases: ['günlük', 'daily'], category: 'Ekonomi',
    description: 'Günlük ödül + giriş SERİSİ (streak)! Her gün üst üste gel, bonus katlansın 🔥', usage: '!günlük',
    async run(message) {
      const d = getUser(message.guild.id, message.author.id);
      const simdi = Date.now();
      if (simdi - (d.gunluk || 0) < 20 * 3600 * 1000) {
        const kalan = (20 * 3600 * 1000 - (simdi - d.gunluk)) / 3600000;
        return message.reply({ embeds: [err(`Yarın gel! ⏳ **${kalan.toFixed(1)} saat** kaldı.\n🔥 Serin: **${d.gunlukSeri || 0} gün** — bozma sakın!`)] });
      }
      const bugun = new Date().toISOString().slice(0, 10);
      const dun = new Date(simdi - 86400000).toISOString().slice(0, 10);
      let seri = 1;
      if (d.gunlukSonGun === dun) seri = (d.gunlukSeri || 0) + 1;
      else if (d.gunlukSonGun && d.gunlukSonGun !== bugun) seri = 1;
      else seri = d.gunlukSeri || 1;
      const bonus = Math.min((seri - 1) * 100, 1000);
      const premGun = require('../src/premium').premiumMu(message.guild.id);
      const odul = (500 + rastgele(0, 200) + bonus) * (premGun ? 2 : 1);
      d.para = (d.para || 0) + odul; d.gunluk = simdi;
      d.gunlukSeri = seri; d.gunlukSonGun = bugun;
      d.enIyiSeri = Math.max(d.enIyiSeri || 0, seri);
      save();
      const ates = seri >= 7 ? '🔥🔥🔥' : seri >= 3 ? '🔥🔥' : '🔥';
      return message.reply({ embeds: [ok(`${ates} Günlük ödül${premGun ? ' 👑x2' : ''}: **${paraYaz(odul)}**!\n📅 Giriş serisi: **${seri} gün** (+${bonus} bonus) • En iyi: **${d.enIyiSeri}**\n💰 Bakiyen: **${paraYaz(d.para)}**${seri < 3 ? '\n💡 3 gün üst üste gel, alevler büyüsün!' : ''}`)] });
    },
  },
  {
    name: 'calis', aliases: ['çalış', 'work'], category: 'Ekonomi',
    description: 'Çalışıp para kazanırsın (1dk bekleme).', usage: '!çalış',
    async run(message) {
      const d = getUser(message.guild.id, message.author.id);
      if (Date.now() - (d.calis || 0) < 60_000) return message.reply({ embeds: [err('Yorgunsun! 1dk dinlen 😮‍💨')] });
      const isler = ['kuryelik yaptın 🛵', 'kod yazdın 💻', 'kafede çalıştın ☕', ' streamerlik yaptın 🎥', 'madende kazdın ⛏️'];
      const kazanc = rastgele(100, 400);
      d.para += kazanc; d.calis = Date.now(); save();
      return message.reply({ embeds: [ok(`💼 ${isler[Math.floor(Math.random() * isler.length)]} ve **${paraYaz(kazanc)}** kazandın!`)] });
    },
  },
  {
    name: 'bakiye', aliases: ['para', 'cüzdan', 'balance'], category: 'Ekonomi',
    description: 'Bakiyeni gösterir.', usage: '!bakiye [@kullanıcı]',
    async run(message, args) {
      const h = (await kisiBulAsync(message, args, 0)) || message.member;
      const d = getUser(message.guild.id, h.id);
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.gold).setTitle(`💰 ${h.user.username} — Cüzdan`).setDescription(`**${paraYaz(d.para)}**`).setThumbnail(h.user.displayAvatarURL()).setTimestamp()] });
    },
  },
  {
    name: 'gonder', aliases: ['gönder', 'pay', 'transfer'], category: 'Ekonomi',
    description: 'Başkasına para gönderirsin.', usage: '!gönder @kullanıcı <miktar>',
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      const miktar = parseInt(args[1], 10);
      if (!h || !miktar || miktar <= 0) return message.reply({ embeds: [err('`!gönder @kullanıcı 100`')] });
      const g = getUser(message.guild.id, message.author.id);
      if ((g.para || 0) < miktar) return message.reply({ embeds: [err('Yetersiz bakiye!')] });
      const a = getUser(message.guild.id, h.id);
      g.para -= miktar; a.para += miktar; save();
      return message.reply({ embeds: [ok(`💸 ${h} kullanıcısına **${paraYaz(miktar)}** gönderdin!`)] });
    },
  },
  {
    name: 'kumar', aliases: ['bet', 'bahis'], category: 'Ekonomi',
    description: 'Paranı ikiye katla ya da kaybet! (%45 kazanma)', usage: '!kumar <miktar>',
    async run(message, args) {
      const miktar = parseInt(args[0], 10);
      if (!miktar || miktar <= 0) return message.reply({ embeds: [err('`!kumar 100`')] });
      const d = getUser(message.guild.id, message.author.id);
      if ((d.para || 0) < miktar) return message.reply({ embeds: [err('Yetersiz bakiye!')] });
      if (Math.random() < 0.45) { d.para += miktar; save(); return message.reply({ embeds: [ok(`🎰 KAZANDIN! **+${paraYaz(miktar)}** (Bakiye: ${paraYaz(d.para)})`)] }); }
      d.para -= miktar; save();
      return message.reply({ embeds: [err(`🎰 KAYBETTİN! **-${paraYaz(miktar)}** (Bakiye: ${paraYaz(d.para)})`)] });
    },
  },
  {
    name: 'slot', aliases: [], category: 'Ekonomi',
    description: 'Slot makinesi (3 aynı = 5x).', usage: '!slot <miktar>',
    async run(message, args) {
      const miktar = parseInt(args[0], 10);
      if (!miktar || miktar <= 0) return message.reply({ embeds: [err('`!slot 50`')] });
      const d = getUser(message.guild.id, message.author.id);
      if ((d.para || 0) < miktar) return message.reply({ embeds: [err('Yetersiz bakiye!')] });
      const s = ['🍒', '🍋', '⭐', '💎', '7️⃣'];
      const a = s[rastgele(0, 4)], b = s[rastgele(0, 4)], c = s[rastgele(0, 4)];
      if (a === b && b === c) { d.para += miktar * 5; save(); return message.reply(`🎰 | ${a} ${b} ${c} |\n💎 **JACKPOT! +${paraYaz(miktar * 5)}**`); }
      if (a === b || b === c || a === c) { d.para += miktar; save(); return message.reply(`🎰 | ${a} ${b} ${c} |\n✨ İkili! **+${paraYaz(miktar)}**`); }
      d.para -= miktar; save();
      return message.reply(`🎰 | ${a} ${b} ${c} |\n💸 Kaybettin **-${paraYaz(miktar)}**`);
    },
  },
  {
    name: 'cal', aliases: ['çal', 'hırsızlık'], category: 'Ekonomi',
    description: 'Başkasından para çal! Yakalanırsan ceza ödersin. (Riskli 😈)', usage: '!çal @kullanıcı',
    async run(message, args) {
      const h = await kisiBulAsync(message, args, 0);
      if (!h || h.id === message.author.id) return message.reply({ embeds: [err('`!çal @kullanıcı`')] });
      const fail = getUser(message.guild.id, message.author.id);
      const hedef = getUser(message.guild.id, h.id);
      if ((hedef.para || 0) < 100) return message.reply({ embeds: [err('Fakirden çalınmaz be... (en az 100 coin olmalı)')] });
      if (Math.random() < 0.5) {
        const calinan = Math.min(hedef.para, rastgele(50, 300));
        hedef.para -= calinan; fail.para += calinan; save();
        return message.reply(`😈 ${h} kullanıcısından **${paraYaz(calinan)}** çaldın! Kaç kaç!`);
      }
      const ceza = rastgele(50, 150);
      fail.para = Math.max(0, fail.para - ceza); save();
      return message.reply(`🚨 Yakalandın! ${h} seni dövdü ve **${paraYaz(ceza)}** kaybettin!`);
    },
  },
  {
    name: 'zenginler', aliases: ['zengin', 'paralider'], category: 'Ekonomi',
    description: 'En zenginleri gösterir.', usage: '!zenginler',
    async run(message) {
      const top = topPara(message.guild.id, 10);
      if (!top.length) return message.reply({ embeds: [err('Herkes fakir! `!günlük` ile başla.')] });
      let desc = '';
      for (let i = 0; i < top.length; i++) {
        let isim = top[i].uid;
        try { const u = await message.client.users.fetch(top[i].uid); isim = u.username; } catch {}
        desc += `\`${i + 1}.\` **${isim}** — ${paraYaz(top[i].para)}\n`;
      }
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.gold).setTitle('💰 Zenginler').setDescription(desc).setTimestamp()] });
    },
  },
  // ---- SEVİYE ----
  {
    name: 'seviye', aliases: ['level', 'rank', 'xp'], category: 'Seviye',
    description: 'Seviyeni gösterir (mesaj attıkça XP kazanırsın).', usage: '!seviye [@kullanıcı]',
    async run(message, args) {
      const h = (await kisiBulAsync(message, args, 0)) || message.member;
      const d = getUser(message.guild.id, h.id);
      const ihtiyac = (d.level || 0) * 100 + 100;
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle(`📈 ${h.user.username} — Sv.${d.level || 0}`).setDescription(`XP: **${d.xp || 0}/${ihtiyac}**\n${'▰'.repeat(Math.round(((d.xp || 0) / ihtiyac) * 10))}${'▱'.repeat(10 - Math.round(((d.xp || 0) / ihtiyac) * 10))}\n💬 ${d.mesaj || 0} mesaj`).setThumbnail(h.user.displayAvatarURL()).setTimestamp()] });
    },
  },
  {
    name: 'liderlik', aliases: ['leaderboard', 'sıralama'], category: 'Seviye',
    description: 'Seviye sıralaması.', usage: '!liderlik',
    async run(message) {
      const { topLevel } = require('../src/db');
      const top = topLevel(message.guild.id, 10);
      if (!top.length) return message.reply({ embeds: [err('Kimse konuşmamış!')] });
      let desc = '';
      for (let i = 0; i < top.length; i++) {
        let isim = top[i].uid;
        try { const u = await message.client.users.fetch(top[i].uid); isim = u.username; } catch {}
        desc += `\`${i + 1}.\` **${isim}** — Sv.${top[i].level} (${top[i].xp} XP)\n`;
      }
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.main).setTitle('📈 Seviye Sıralaması').setDescription(desc).setTimestamp()] });
    },
  },
];
