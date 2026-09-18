const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, setGuild, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { kart } = require('../src/tasarim');
const config = require('../config');

function seviyeRoller(gid) {
  const g = getGuild(gid);
  if (!Array.isArray(g.seviyeRoller)) g.seviyeRoller = [];
  return g.seviyeRoller;
}

module.exports = [
  {
    name: 'seviye-rol', aliases: ['seviyerol', 'levelrol', 'svrol'], category: 'Seviye',
    description: 'Seviye atlayınca OTOMATİK rol ver! (Paralı botların özelliği, burada bedava 😎)',
    usage: '!seviye-rol ekle <seviye> @rol | sil <seviye> | liste',
    perms: [PermissionFlagsBits.ManageRoles],
    slashOptions: [
      { type: 'string', name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ekle', value: 'ekle' }, { name: 'Sil', value: 'sil' }, { name: 'Liste', value: 'liste' }] },
      { type: 'integer', name: 'seviye', description: 'Seviye (1-100)', required: false, min_value: 1, max_value: 100 },
      { type: 'role', name: 'rol', description: 'Verilecek rol', required: false },
    ],
    slashArgs: (i) => {
      const t = i.options.getString('islem');
      if (t === 'liste') return ['liste'];
      if (t === 'sil') { const s = i.options.getInteger('seviye'); return ['sil', `${s ?? ''}`]; }
      const s = i.options.getInteger('seviye');
      const r = i.options.getRole('rol');
      return ['ekle', `${s ?? ''}`, ...(r ? [`<@&${r.id}>`] : [])];
    },
    async run(message, args) {
      const islem = (args[0] || '').toLowerCase();
      const liste = seviyeRoller(message.guild.id);
      if (islem === 'liste' || !islem) {
        if (!liste.length) return message.reply({ embeds: [err('Kayıtlı ödül yok!\n`!seviye-rol ekle 5 @Aktif-Uye` ile ilkini ekle.')] });
        const desc = [...liste].sort((a, b) => a.seviye - b.seviye).map(x => `🚀 **Sv.${x.seviye}** → <@&${x.rolId}>`).join('\n');
        return message.reply({ embeds: [kart(message.client, { baslik: '🎭 Seviye Rol Ödülleri', aciklama: desc, altbilgi: 'Seviye atlayan rolü otomatik kapar!' })] });
      }
      if (islem === 'sil') {
        const s = parseInt(args[1], 10);
        const i = liste.findIndex((x) => x.seviye === s);
        if (i < 0) return message.reply({ embeds: [err('Bu seviyede ödül yok!')] });
        liste.splice(i, 1); save();
        return message.reply({ embeds: [ok(`🗑️ Sv.${s} ödülü silindi.`)] });
      }
      if (islem === 'ekle') {
        const s = parseInt(args[1], 10);
        const rol = message.mentions.roles.first();
        if (!s || s < 1 || s > 100 || !rol) return message.reply({ embeds: [err('`!seviye-rol ekle 5 @Aktif`\nSeviye 1-100 arası, rol etiketle!')] });
        if (rol.position >= message.guild.members.me.roles.highest.position) return message.reply({ embeds: [err('Bu rol benden üstte!')] });
        if (rol.managed) return message.reply({ embeds: [err('Bot rollerine ödül verilemez!')] });
        const var1 = liste.find((x) => x.seviye === s);
        if (var1) var1.rolId = rol.id;
        else liste.push({ seviye: s, rolId: rol.id });
        save();
        return message.reply({ embeds: [ok(`🎭 **Sv.${s}** olan herkes artık otomatik **${rol}** alacak!\n💡 Test: birine \`!seviye\` baktır, seviyedekiler rolü kapar mı diye değil — YENİ atlayanlar alır. (Mevcutlara toplu vermek için \`!toplu-rol ver ${rol}\`)`)] });
      }
      return message.reply({ embeds: [err('`!seviye-rol ekle 5 @rol` • `!seviye-rol sil 5` • `!seviye-rol liste`')] });
    },
  },
  {
    name: 'level', aliases: ['lvl'], category: 'Seviye',
    description: 'Seviye sistemi slash ile: /level ayarla + /level rol',
    usage: '/level ayarla | /level rol',
    async run(message) {
      return message.reply({ embeds: [ok('📈 Seviye sistemi **slash** ile yönetilir:\n`/level ayarla` → bildirim kanalı\n`/level rol` → ödül rolleri (`/seviye-rol` ile ortak!)\nSeviyen için: `!seviye`')] });
    },
  },
];

function levelRolHavuz(gid) {
  const g = getGuild(gid);
  if (!Array.isArray(g.seviyeRoller)) g.seviyeRoller = [];
  return g.seviyeRoller;
}

const levelSlash = {
  data: {
    name: 'level',
    description: '📈 Seviye sistemi (ücretsiz): bildirim + rol ödülleri',
    contexts: [0],
    options: [
      {
        type: 1, name: 'ayarla', description: 'Seviye bildirim kanalı',
        options: [{ type: 7, name: 'kanal', description: 'Boş = kapat', required: false }],
      },
      {
        type: 1, name: 'rol', description: 'Kaç seviyede hangi rol? (seviye-rol ile ortak)',
        options: [
          { type: 3, name: 'islem', description: 'İşlem', required: true, choices: [{ name: 'Ekle', value: 'ekle' }, { name: 'Sil', value: 'sil' }, { name: 'Liste', value: 'liste' }] },
          { type: 4, name: 'seviye', description: 'Seviye (1-100)', required: false, min_value: 1, max_value: 100 },
          { type: 8, name: 'rol', description: 'Verilecek rol', required: false },
        ],
      },
    ],
  },
  async execute(interaction, client) {
    const alt = interaction.options.getSubcommand();
    if (alt === 'ayarla') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ Sunucuyu Yönet yetkisi gerek!', ephemeral: true });
      const k = interaction.options.getChannel('kanal');
      if (!k) {
        setGuild(interaction.guild.id, { levelBildirimKanal: null });
        return interaction.reply({ embeds: [ok('📈 Seviye bildirimi kapatıldı (normal kanala döner).')] });
      }
      if (!k.isTextBased()) return interaction.reply({ content: 'Yazı kanalı seç!', ephemeral: true });
      setGuild(interaction.guild.id, { levelBildirimKanal: k.id });
      return interaction.reply({ embeds: [ok(`📈 Seviye atlayanlar ${k} kanalında etiketlenecek!`)] });
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: '❌ Rolleri Yönet yetkisi gerek!', ephemeral: true });
    const islem = interaction.options.getString('islem');
    const liste = levelRolHavuz(interaction.guild.id);
    if (islem === 'liste' || !islem) {
      if (!liste.length) return interaction.reply({ content: 'Kayıtlı ödül yok! `/level rol islem:Ekle seviye:5 rol:@Aktif`', ephemeral: true });
      return interaction.reply({ embeds: [kart(client, { baslik: '🎭 Seviye Rol Ödülleri', aciklama: [...liste].sort((a, b) => a.seviye - b.seviye).map((x) => `🚀 **Sv.${x.seviye}** → <@&${x.rolId}>`).join('\n') })], ephemeral: true });
    }
    if (islem === 'sil') {
      const s = interaction.options.getInteger('seviye');
      const i = liste.findIndex((x) => x.seviye === s);
      if (i < 0) return interaction.reply({ content: 'Bu seviyede ödül yok!', ephemeral: true });
      liste.splice(i, 1);
      save();
      return interaction.reply({ embeds: [ok(`🗑️ Sv.${s} ödülü silindi.`)] });
    }
    const s = interaction.options.getInteger('seviye');
    const rol = interaction.options.getRole('rol');
    if (!s || !rol) return interaction.reply({ content: 'Seviye + rol şart!', ephemeral: true });
    if (rol.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: '❌ Bu rol benden üstte!', ephemeral: true });
    if (rol.managed) return interaction.reply({ content: '❌ Bot rolü olmaz!', ephemeral: true });
    const var1 = liste.find((x) => x.seviye === s);
    if (var1) var1.rolId = rol.id;
    else liste.push({ seviye: s, rolId: rol.id });
    save();
    return interaction.reply({ embeds: [ok(`🎭 **Sv.${s}** → ${rol} kaydedildi!`)] });
  },
};

module.exports.levelSlash = levelSlash;
