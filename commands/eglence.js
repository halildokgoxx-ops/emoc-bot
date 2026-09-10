const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ok, err, kisiBulAsync } = require('../src/embeds');
const { rastgele, gunlukSeed, seedRandom } = require('../src/utils');
const { animeGif, tenorLink } = require('../src/gif');
const config = require('../config');

async function tepki(message, hedefId, baslik, kategori) {
  const h = message.mentions.users.first();
  if (!h) return message.reply(`Kime? \`${hedefId}\``);
  const gif = await animeGif(kategori).catch(() => null);
  const e = new EmbedBuilder().setColor(config.colors.pink).setTitle(baslik.replace('{a}', message.author.username).replace('{h}', h.username)).setImage(gif || null).setFooter({ text: 'Anime GIF' }).setTimestamp();
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('🌐 Tenor\'da Daha Fazla').setStyle(ButtonStyle.Link).setURL(tenorLink(`anime ${kategori}`)));
  return message.reply({ embeds: [e], components: gif ? [row] : [] });
}

module.exports = [
  {
    name: '8ball', aliases: ['8top'], category: 'Eğlence', description: 'Sihirli 8 top sorularını cevaplar.', usage: '!8ball <soru>',
    async run(message, args) {
      if (!args.length) return message.reply({ embeds: [err('Soru sor! `!8ball yarın sınav var mı?`')] });
      const cevaplar = ['Kesinlikle evet! ✅', 'Asla ❌', 'Belki... 🤔', 'Kesinlikle HAYIR 🙅', 'Evet, %100! 💯', 'Bence evet 😎', 'Rüyanda görürsün 😴', 'Soruyu bile sorma 🤐', 'Yıldızlar evet diyor ✨', 'Büyük ihtimalle hayır 📉'];
      return message.reply(`🎱 **Soru:** ${args.join(' ')}\n**Cevap:** ${cevaplar[rastgele(0, cevaplar.length - 1)]}`);
    },
  },
  {
    name: 'yazitura', aliases: ['yazı-tura', 'coinflip'], category: 'Eğlence', description: 'Yazı tura atar.', usage: '!yazıtura',
    async run(message) { return message.reply(Math.random() < 0.5 ? '🪙 **YAZI!**' : '🪙 **TURA!**'); },
  },
  {
    name: 'zar', aliases: ['dice', 'roll'], category: 'Eğlence', description: 'Zar atar. (!zar 2d6 gibi)', usage: '!zar [adet]d[yüz]',
    async run(message, args) {
      const m = (args[0] || '1d6').match(/^(\d+)d(\d+)$/);
      const adet = m ? Math.min(10, parseInt(m[1])) : 1;
      const yuz = m ? Math.min(100, parseInt(m[2])) : 6;
      const atis = Array.from({ length: adet }, () => rastgele(1, yuz));
      return message.reply(`🎲 ${atis.map(a => `**${a}**`).join(' ')} (toplam: **${atis.reduce((a, b) => a + b, 0)}**)`);
    },
  },
  {
    name: 'askolcer', aliases: ['aşkölçer', 'ask'], category: 'Eğlence', description: 'İki kişi arası aşk ölçer 💘', usage: '!aşkölçer @k1 @k2',
    async run(message) {
      const k = [...message.mentions.users.values()];
      if (k.length < 1) return message.reply({ embeds: [err('`!aşkölçer @kullanıcı` (tek etiketlersen seninle ölçer)')] });
      const a = message.author.username, b = (k[1] || k[0]).username;
      const oran = gunlukSeed(a + b) % 101;
      const kalp = oran > 80 ? '💖💖💖 EVLENİN!' : oran > 50 ? '💕 İyi gidiyor!' : oran > 25 ? '💔 Zor...' : '🖤 İmkansız!';
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.pink).setTitle(`💘 ${a} + ${b} = %${oran}`).setDescription(`${'█'.repeat(Math.round(oran / 10))}${'░'.repeat(10 - Math.round(oran / 10))}\n${kalp}`).setTimestamp()] });
    },
  },
  {
    name: 'tokat', aliases: [], category: 'Eğlence', description: 'Birine anime tokadı atarsın 👋', usage: '!tokat @kullanıcı',
    async run(message) { return tepki(message, '`!tokat @kullanıcı`', '👋 {a} → {h} **TOKAAAT!**', 'slap'); },
  },
  {
    name: 'saril', aliases: ['sarıl'], category: 'Eğlence', description: 'Anime sarılması 🤗', usage: '!sarıl @kullanıcı',
    async run(message) { return tepki(message, '`!sarıl @kullanıcı`', '🤗 {a} → {h} sımsıkı sarıldı!', 'hug'); },
  },
  {
    name: 'op', aliases: ['öp'], category: 'Eğlence', description: 'Anime öpücüğü 😘', usage: '!öp @kullanıcı',
    async run(message) { return tepki(message, '`!öp @kullanıcı`', '😘 {a} → {h} öptü!', 'kiss'); },
  },
  {
    name: 'yumruk', aliases: [], category: 'Eğlence', description: 'Anime yumruğu 🥊', usage: '!yumruk @kullanıcı',
    async run(message) { return tepki(message, '`!yumruk @kullanıcı`', '🥊 {a} → {h} **BAM!**', 'bonk'); },
  },
  {
    name: 'espri', aliases: ['şaka'], category: 'Eğlence', description: 'Rastgele espri yapar 😂', usage: '!espri',
    async run(message) {
      const s = ['Adamın biri gülmüş, bahçeye dikmişler 🌹', 'Küçük su birikintisine ne denir? Sucuk! 🌊', 'En hızlı sayı hangisi? 10. Çünkü 10\'un arabası var 🚗', 'Balıklar neden konuşmaz? Çünkü ağızları su dolu 🐟', 'Kediler neden bilgisayar sevmez? Fare var diye 🐭', 'Örümcekler ne içmez? Ağsulu içecekler 🕷️', 'Temel askerde... şaka uzun, sonra anlatırım 😅'];
      return message.reply(`😂 ${s[rastgele(0, s.length - 1)]}`);
    },
  },
  {
    name: 'tersyazi', aliases: ['tersyazı', 'ters'], category: 'Eğlence', description: 'Yazıyı ters çevirir.', usage: '!tersyazı <yazı>',
    async run(message, args) { if (!args.length) return message.reply('Yazı yaz!'); return message.reply(args.join(' ').split('').reverse().join('')); },
  },
  {
    name: 'tkm', aliases: ['taşkağıtmakas', 'rps'], category: 'Eğlence', description: 'Taş-kağıt-makas oynarsın.', usage: '!tkm <taş|kağıt|makas>',
    async run(message, args) {
      const sec = { 'taş': '🪨', 'tas': '🪨', 'kağıt': '📄', 'kagit': '📄', 'makas': '✂️' };
      const s = sec[(args[0] || '').toLocaleLowerCase('tr')];
      if (!s) return message.reply('`!tkm taş` / `!tkm kağıt` / `!tkm makas`');
      const bot = ['🪨', '📄', '✂️'][rastgele(0, 2)];
      let sonuc = 'Berabere! 🤝';
      if ((s === '🪨' && bot === '✂️') || (s === '📄' && bot === '🪨') || (s === '✂️' && bot === '📄')) sonuc = 'Kazandın! 🎉';
      else if (s !== bot) sonuc = 'Kaybettin! 😢';
      return message.reply(`${s} vs ${bot} → **${sonuc}**`);
    },
  },
  {
    name: 'dogruluk', aliases: ['doğruluk'], category: 'Eğlence', description: 'Doğruluk sorusu verir.', usage: '!doğruluk',
    async run(message) {
      const s = ['En son kime yalan söyledin?', 'Telefonundaki en utanç verici fotoğraf ne?', 'Hiç kopya çektin mi?', 'Gizli yeteneğin ne?', 'En büyük korkun ne?', 'Hiç birine hayalet gibi ortadan kayboldun mu? (ghosting)'];
      return message.reply(`🤔 **Doğruluk:** ${s[rastgele(0, s.length - 1)]}`);
    },
  },
  {
    name: 'cesaret', aliases: [], category: 'Eğlence', description: 'Cesaret görevi verir.', usage: '!cesaret',
    async run(message) {
      const s = ['Son attığın fotoğrafı buraya at! 📸', 'Sevdiğin kişiye "seni seviyorum" yaz (ekran görüntüsü at!) 💘', '1 dakika boyunca sadece emoji ile konuş 😎', 'En son dinlediğin şarkıyı söyle 🎵', 'Profil fotoğrafını 1 saatliğine değiştir 🖼️'];
      return message.reply(`😈 **Cesaret:** ${s[rastgele(0, s.length - 1)]}`);
    },
  },
];
