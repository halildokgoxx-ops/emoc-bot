const { ok, err } = require('../src/embeds');
const { premiumMu } = require('../src/premium');
const { kalanHak, hakTuket, aiCevapla, FREE_LIMIT, PREM_LIMIT } = require('../src/ai');

async function aiKos(message, soru, client) {
  const prem = premiumMu(message.guild.id);
  const kalan = kalanHak(message.guild.id, message.author.id, prem);
  if (kalan <= 0) {
    return message.reply({ embeds: [err(`⏳ Günlük AI hakkın bitti! (Free: ${FREE_LIMIT}/gün)\n👑 Premium ile **${PREM_LIMIT}/gün** + komutsuz sohbet kanalı! Bilgi: \`/premium bilgi\``)] });
  }
  const m = await message.reply('✦ EmocAI düşünüyor... 🤔');
  try {
    const cevap = await aiCevapla({
      guildAd: message.guild.name, kullaniciAd: message.author.username,
      soru, kanalId: message.channel.id, premium: prem,
    });
    hakTuket(message.guild.id, message.author.id);
    return m.edit({ content: `✦ ${cevap.slice(0, 1900)}` }).catch(() => {});
  } catch {
    return m.edit({ content: '❌ Şu an cevap veremiyorum, biraz sonra tekrar dene!' }).catch(() => {});
  }
}

module.exports = [
  {
    name: 'ai', aliases: ['yapayzeka', 'emocai', 'sor'], category: 'Eğlence',
    description: 'EmocAI ile sohbet et! (Free: 15/gün, Premium: 100/gün)',
    usage: '!ai <soru>',
    async run(message, args, client) {
      const soru = args.join(' ').slice(0, 500);
      if (!soru) return message.reply({ embeds: [err('Bir şey sor! `!ai en sevdiğin yemek ne?`')] });
      return aiKos(message, soru, client);
    },
  },
];
module.exports.aiKos = aiKos;
