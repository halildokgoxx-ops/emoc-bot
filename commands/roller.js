// 🎭 Butonlu rol alma menüsü: /rol-al ekle / gonder / liste / sil
// Üyeler butona basar, rol anında takılır/çıkar. (Yaş/renk/oyun rolleri için birebir!)
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getGuild, save } = require('../src/db');
const { ok, err } = require('../src/embeds');
const { kart, RENK } = require('../src/tasarim');

function rolMenuler(gid) {
  const g = getGuild(gid);
  if (!Array.isArray(g.rolMenuler)) g.rolMenuler = [];
  return g.rolMenuler;
}

function menuRow(menu) {
  const rows = [];
  const ogeler = (menu.ogeler || []).slice(0, 20);
  for (let i = 0; i < ogeler.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const o of ogeler.slice(i, i + 5)) {
      const b = new ButtonBuilder()
        .setCustomId(`rolal_${menu.id}_${o.rolId}`)
        .setLabel(String(o.etiket || 'Rol').slice(0, 80))
        .setStyle(ButtonStyle.Secondary);
      if (o.emoji) { try { b.setEmoji(o.emoji); } catch {} }
      row.addComponents(b);
    }
    rows.push(row);
  }
  return rows;
}

function menuEmbed(client, guild, menu) {
  const satir = (menu.ogeler || []).map((o) => `${o.emoji || '🔹'} **${o.etiket}** → <@&${o.rolId}>`).join('\n');
  return kart(client, {
    baslik: `🎭 ${menu.baslik || 'Rol Al!'}`,
    aciklama: `İstediğin rollere bas, **anında** takılsın/çıkarılsın! ✨\n\n${satir}`.slice(0, 3900),
    kucukResim: guild.iconURL({ size: 256 }) || undefined,
    altbilgi: `${menu.ogeler.length}/20 buton • EMOÇ Rol Sistemi`,
  });
}

const rolAlSlash = {
  data: {
    name: 'rol-al',
    description: '🎭 Butonlu rol alma menüsü kur',
    contexts: [0],
    options: [
      {
        type: 1, name: 'ekle', description: 'Menüye rol butonu ekle',
        options: [
          { type: 8, name: 'rol', description: 'Verilecek rol', required: true },
          { type: 3, name: 'etiket', description: 'Buton yazısı (boş = rol adı)', required: false },
          { type: 3, name: 'emoji', description: 'Buton emojisi (unicode veya :özel:)', required: false },
        ],
      },
      {
        type: 1, name: 'gonder', description: 'Menüyü kanala gönder/güncelle',
        options: [
          { type: 7, name: 'kanal', description: 'Hedef kanal (boş = burası)', required: false },
          { type: 3, name: 'baslik', description: 'Menü başlığı', required: false },
        ],
      },
      { type: 1, name: 'liste', description: 'Eklenen butonları listele' },
      {
        type: 1, name: 'sil', description: 'Butonu kaldır',
        options: [{ type: 8, name: 'rol', description: 'Hangi rolün butonu?', required: true }],
      },
    ],
  },
  async execute(interaction, client) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '❌ Rolleri Yönet yetkisi gerek!', ephemeral: true });
    }
    const alt = interaction.options.getSubcommand();
    const menuler = rolMenuler(interaction.guild.id);
    let menu = menuler.find((m) => !m.mesajId);
    if (!menu && alt === 'ekle') {
      menu = { id: Math.random().toString(36).slice(2, 9), ogeler: [], baslik: null, kanalId: null, mesajId: null };
      menuler.push(menu);
    }
    if (alt === 'ekle') {
      const rol = interaction.options.getRole('rol');
      if (rol.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({ content: '❌ Bu rol benden üstte! Rolümü yükselt.', ephemeral: true });
      }
      if (rol.managed) return interaction.reply({ content: '❌ Bot rollerine buton olmaz!', ephemeral: true });
      if (menu.ogeler.length >= 20) return interaction.reply({ content: '❌ Menü dolu (20/20)! Önce `/rol-al sil` ile çıkar.', ephemeral: true });
      if (menu.ogeler.some((o) => o.rolId === rol.id)) return interaction.reply({ content: '❌ Bu rol zaten menüde!', ephemeral: true });
      const etiket = (interaction.options.getString('etiket') || rol.name).slice(0, 80);
      const emoji = (interaction.options.getString('emoji') || '').slice(0, 100) || null;
      menu.ogeler.push({ rolId: rol.id, etiket, emoji });
      save();
      return interaction.reply({ content: `✅ Eklendi: ${emoji || '🔹'} **${etiket}** → ${rol} (${menu.ogeler.length}/20)\nGöndermek için: \`/rol-al gonder\``, ephemeral: true });
    }
    if (alt === 'gonder') {
      if (!menu || !menu.ogeler.length) {
        return interaction.reply({ content: '❌ Önce buton ekle! `/rol-al ekle rol:@Üye`', ephemeral: true });
      }
      const kanal = interaction.options.getChannel('kanal') || interaction.channel;
      if (!kanal.isTextBased() || kanal.isVoiceBased()) return interaction.reply({ content: '❌ Yazı kanalı seç!', ephemeral: true });
      const baslik = interaction.options.getString('baslik') || menu.baslik || 'Rol Al!';
      menu.baslik = baslik;
      // Eski mesaj duruyorsa güncelle, yoksa yeni gönder
      if (menu.mesajId) {
        const eskiKanal = interaction.guild.channels.cache.get(menu.kanalId);
        const eski = await eskiKanal?.messages.fetch(menu.mesajId).catch(() => null);
        if (eski) {
          await eski.edit({ embeds: [menuEmbed(client, interaction.guild, menu)], components: menuRow(menu) }).catch(() => {});
          save();
          return interaction.reply({ content: `🔄 Menü güncellendi: ${eskiKanal}`, ephemeral: true });
        }
      }
      const msg = await kanal.send({ embeds: [menuEmbed(client, interaction.guild, menu)], components: menuRow(menu) }).catch(() => null);
      if (!msg) return interaction.reply({ content: '❌ Gönderemedim! Yetkilerimi kontrol et.', ephemeral: true });
      menu.mesajId = msg.id;
      menu.kanalId = kanal.id;
      save();
      return interaction.reply({ content: `📨 Menü gönderildi: ${kanal}`, ephemeral: true });
    }
    if (alt === 'liste') {
      if (!menu || !menu.ogeler.length) return interaction.reply({ content: 'Menü boş! `/rol-al ekle rol:@Üye` ile başla.', ephemeral: true });
      const desc = menu.ogeler.map((o, i) => `\`${i + 1}.\` ${o.emoji || '🔹'} **${o.etiket}** → <@&${o.rolId}>`).join('\n');
      return interaction.reply({ embeds: [kart(client, { baslik: '🎭 Rol Menüsü Taslağı', aciklama: desc })], ephemeral: true });
    }
    if (alt === 'sil') {
      if (!menu) return interaction.reply({ content: 'Silinecek buton yok!', ephemeral: true });
      const rol = interaction.options.getRole('rol');
      const i = menu.ogeler.findIndex((o) => o.rolId === rol.id);
      if (i < 0) return interaction.reply({ content: '❌ Bu rol menüde yok!', ephemeral: true });
      menu.ogeler.splice(i, 1);
      save();
      return interaction.reply({ content: `🗑️ Kaldırıldı: **${rol.name}**\n💡 Gönderilmiş menüyü güncellemek için tekrar \`/rol-al gonder\` yaz.`, ephemeral: true });
    }
  },
};

async function handleRolAlButton(interaction, client) {
  // rolal_<menuId>_<rolId>
  const parca = interaction.customId.split('_');
  const rolId = parca[parca.length - 1];
  const menuId = parca.slice(1, -1).join('_');
  const menu = rolMenuler(interaction.guild.id).find((m) => m.id === menuId);
  const rol = interaction.guild.roles.cache.get(rolId);
  if (!menu || !rol) return interaction.reply({ content: '❌ Bu menü artık geçerli değil!', ephemeral: true });
  const uye = interaction.member;
  try {
    if (uye.roles.cache.has(rol.id)) {
      await uye.roles.remove(rol);
      return interaction.reply({ content: `➖ **${rol.name}** alındı!`, ephemeral: true });
    }
    await uye.roles.add(rol);
    return interaction.reply({ content: `➕ **${rol.name}** verildi! Yakıştı 😎`, ephemeral: true });
  } catch {
    return interaction.reply({ content: '❌ Yetkim yetmiyor! (Rolüm altta kalmış olabilir)', ephemeral: true });
  }
}

module.exports = [
  {
    name: 'rol-al', aliases: ['rolmenusu', 'rolmenu'], category: 'Genel',
    description: 'Butonlu rol menüsü slash ile kurulur: /rol-al ekle + /rol-al gonder',
    usage: '/rol-al ekle | /rol-al gonder | /rol-al liste | /rol-al sil',
    async run(message) {
      return message.reply({ embeds: [ok('🎭 Rol menüsü **slash** ile kurulur:\n`/rol-al ekle rol:@Üye` → `/rol-al gonder #kanal`\nÜyeler butona basar, rol anında takılır!')] });
    },
  },
];
module.exports.rolAlSlash = rolAlSlash;
module.exports.handleRolAlButton = handleRolAlButton;
