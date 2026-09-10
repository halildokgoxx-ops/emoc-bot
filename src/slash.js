// SLASH ALTYAPISI
// - Tüm prefix komutlarını otomatik slash'e çevirir (usage'dan seçenek çıkarımı)
// - Adapter: slash etkileşimini prefix run() fonksiyonlarına uyarlar
//   (mention + args doldurarak mevcut 90+ komut aynen çalışır)
// - Özel slash'ler: /partner (alt komutlu), /itibar (alt komutlu)
const { Collection, EmbedBuilder, PermissionFlagsBits, REST, Routes } = require('discord.js');
const config = require('../config');

const ISIM_RE = /^[-_\p{L}\p{N}]{1,32}$/u;
// Slash'e çevrilmeyecekler (isim uymaz / özel tanımlı)
const ATLANACAK = new Set(['1', '-1', '__partner_button__', '__ticket_internal__']);
// Discord limiti: en fazla 100 slash! Bunlar prefix-only kalır (hepsi ! ile çalışır)
const PREFIX_ONLY = new Set([
  'espri', 'tersyazi', 'tkm', 'dogruluk', 'cesaret', 'yazitura', 'zar', 'askolcer',
  'op', 'yumruk', 'gunluk-gorev', 'motivasyon', 'ticket-ekle', 'ticket-cikar',
  'hosgeldin-mesaj', 'emoji-cal', 'itiraf-ayarla', 'vitrin-ekle', 'kanal-bilgi',
]);

function asciiAd(s) {
  return (s || '').toLocaleLowerCase('tr')
    .replaceAll('ç', 'c').replaceAll('ğ', 'g').replaceAll('ı', 'i')
    .replaceAll('ö', 'o').replaceAll('ş', 's').replaceAll('ü', 'u')
    .replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
}

// usage metninden slash seçenekleri çıkar: @kullanıcı→user, #kanal→channel, @rol→role, <sayı>→integer...
function inferOptions(cmd) {
  if (cmd.slashOptions) return cmd.slashOptions;
  const usage = cmd.usage || '';
  const opts = [];
  const gorulen = new Set();
  const parcalar = usage.split(/[\s|]+/);
  for (let ham of parcalar) {
    let p = (ham || '').trim();
    if (!p || p === '...' || p.startsWith('!')) continue;
    p = p.replace(/^\[+|\]+$/g, '');
    let tip = null, ad = null, aciklama = '';
    if (p.startsWith('@')) {
      if (/rol/i.test(p)) { tip = 'role'; ad = 'rol'; aciklama = 'Rol seç'; }
      else { tip = 'user'; ad = 'kullanici'; aciklama = 'Kullanıcı seç'; }
    } else if (p.startsWith('#')) {
      tip = 'channel'; ad = asciiAd(p.slice(1)) || 'kanal'; aciklama = 'Kanal seç';
    } else if (/^<(.+)>$/.test(p)) {
      const ic = p.slice(1, -1);
      const a = asciiAd(ic);
      if (/sayi|miktar|hedef|kazanan|uzunluk|saniye|adet|bahis/.test(a)) { tip = 'integer'; ad = a; aciklama = ic.slice(0, 90); }
      else { tip = 'string'; ad = a || 'yazi'; aciklama = ic.slice(0, 90); }
    } else continue;
    if (!ad) continue;
    if (gorulen.has(ad)) { let i = 2; while (gorulen.has(`${ad}_${i}`)) i++; ad = `${ad}_${i}`; }
    gorulen.add(ad);
    // Stringler opsiyonel (boşken komutlar varsayılan kullanır), diğerleri usage'daki [] durumuna göre
    const opsiyonel = ham.trim().startsWith('[') || tip === 'string';
    opts.push({ type: tip, name: ad, description: (aciklama || ad).slice(0, 100) || 'Değer', required: !opsiyonel });
    if (opts.length >= 8) break;
  }
  return opts;
}

const TIP_NO = { string: 3, integer: 4, user: 6, channel: 7, role: 8 };

function slashTanimi(cmd, oncedenHesaplanan = null) {
  const isim = cmd.name.toLowerCase();
  if (ATLANACAK.has(isim)) return null;
  if (!ISIM_RE.test(isim)) return null;
  if (/[A-Z]/.test(isim)) return null;
  const desc = (cmd.description || isim).slice(0, 100);
  if (!desc.length) return null;
  // Discord kuralı: zorunlu seçenekler önce! (sabit sıralı required-first)
  const ham = (oncedenHesaplanan || inferOptions(cmd)).slice();
  ham.sort((a, b) => ((b.required ? 1 : 0) - (a.required ? 1 : 0)));
  const options = ham.map(o => ({
    type: TIP_NO[o.type] || 3,
    name: o.name, description: o.description,
    required: !!o.required,
    ...(o.choices ? { choices: o.choices } : {}),
  }));
  const def = { name: isim, description: desc, contexts: [0], options };
  if (cmd.perms && cmd.perms.length) {
    try { def.default_member_permissions = String(cmd.perms.reduce((a, b) => a | b, 0n)); } catch {}
  }
  def._siralOpts = ham;
  return def;
}

function buildSlashPayload(commands) {
  const payload = [];
  const harita = new Map(); // slash isim -> { cmd, optDefs }
  const eksikler = [];
  for (const cmd of commands.values()) {
    if (PREFIX_ONLY.has(cmd.name.toLowerCase())) { eksikler.push(cmd.name + ' (prefix-only)'); continue; }
    // Özel slash'i olanlar (partner / itibar gruplarında)
    if (cmd.name === 'partner-kur' || cmd.name === 'partner-bilgi' || cmd.name === 'partner-istek' ||
        cmd.name === 'partner-durum' || cmd.name === 'partner-liste' || cmd.name === 'partner-sifirla' ||
        cmd.name === 'partner-ayarla' || cmd.name === 'partner-text') {
      continue; // /partner alt komutları bunları kapsıyor
    }
    if (cmd.name === 'itibar' || cmd.name === 'itibar-top') {
      continue; // /itibar alt komutları bunları kapsıyor (bak/top)
    }
    const def = slashTanimi(cmd, inferOptions(cmd));
    if (!def) { eksikler.push(cmd.name); continue; }
    if (harita.has(def.name)) { eksikler.push(cmd.name + ' (çakışma)'); continue; }
    const temiz = { ...def };
    delete temiz._siralOpts;
    payload.push(temiz);
    harita.set(def.name, { cmd, optDefs: def._siralOpts });
  }
  // Not: !1 / !-1 oyları prefix + /itibar grubu üzerinden; ayrı itibar-ver/al slash'i yok.
  // Özel: /partner grubu
  try {
    const p = require('../commands/partner');
    if (p.partnerSlash) {
      payload.push(p.partnerSlash.data);
    }
  } catch {}
  // Özel: /itibar grubu
  try {
    const r = require('../commands/itibar');
    if (r.itibarSlash) {
      payload.push(r.itibarSlash.data);
    }
  } catch {}
  // Özel: /sunucu grubu
  try {
    const s = require('../commands/sunucu');
    if (s.sunucuSlash) {
      payload.push(s.sunucuSlash.data);
    }
  } catch {}
  return { payload, harita, eksikler };
}

// Sahte "message" nesnesi — prefix run() fonksiyonları değişmeden çalışsın.
// ÖNKOŞUL: interaction ÖNCEDEN defer edilmiş olmalı (handleSlash defer-first yapar).
// İlk reply → editReply, sonrakiler → followUp. Dönen değer gerçek Message'dır.
function sahteMesaj(interaction, client) {
  const cozulen = interaction.options.resolved || {};
  const bos = new Collection();
  const state = { replied: false };
  const fake = {
    author: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
    client,
    createdTimestamp: Date.now(),
    content: '',
    mentions: {
      users: cozulen.users || bos,
      members: cozulen.members || bos,
      channels: cozulen.channels || bos,
      roles: cozulen.roles || bos,
    },
    delete: async () => {},
    react: async () => {},
    reply: async (payload) => {
      if (typeof payload === 'string') payload = { content: payload };
      try {
        if (!state.replied) {
          state.replied = true;
          await interaction.editReply(payload);
        } else {
          await interaction.followUp(payload);
        }
      } catch (e) {
        console.error(`⚠️ Slash cevap hatası (/${interaction.commandName}):`, e.message);
      }
      try { return await interaction.fetchReply(); }
      catch { return null; }
    },
  };
  fake._slashState = state;
  return fake;
}

function varsayilanArgs(optDefs, interaction) {
  const args = [];
  for (const o of optDefs) {
    let v = null;
    try {
      if (o.type === 'user') v = interaction.options.getUser(o.name);
      else if (o.type === 'channel') v = interaction.options.getChannel(o.name);
      else if (o.type === 'role') v = interaction.options.getRole(o.name);
      else if (o.type === 'integer') v = interaction.options.getInteger(o.name);
      else v = interaction.options.getString(o.name);
    } catch { v = null; }
    if (v === null || v === undefined) continue;
    if (o.type === 'user') args.push(`<@${v.id}>`);
    else if (o.type === 'channel') args.push(`<#${v.id}>`);
    else if (o.type === 'role') args.push(`<@&${v.id}>`);
    else args.push(String(v));
  }
  return args;
}

async function handleSlash(interaction, client, harita) {
  // /partner grubu
  if (interaction.commandName === 'partner') {
    const p = require('../commands/partner');
    return p.partnerSlash.execute(interaction, client);
  }
  // /itibar grubu
  if (interaction.commandName === 'itibar') {
    const r = require('../commands/itibar');
    return r.itibarSlash.execute(interaction, client);
  }
  // /sunucu grubu
  if (interaction.commandName === 'sunucu') {
    const s = require('../commands/sunucu');
    return s.sunucuSlash.execute(interaction, client);
  }
  const kayit = harita.get(interaction.commandName);
  if (!kayit) return interaction.reply({ content: '❌ Bilinmeyen komut!', ephemeral: true });
  const { cmd, optDefs } = kayit;

  // Yetki kontrolü (anında, defer öncesi — hızlıdır)
  if (cmd.perms && cmd.perms.length) {
    const gerekir = cmd.perms[0];
    if (!interaction.memberPermissions || !interaction.memberPermissions.has(gerekir)) {
      try {
        return await interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.error).setTitle('❌ Yetkin yok!').setDescription('Bu komut için gerekli yetkin bulunmuyor.')], ephemeral: true });
      } catch { return; }
    }
  }
  // ⚡ DEFER-FIRST: önce "düşünüyor..." onayı → 3sn timeout tarihe karışır.
  // Komut API'ye takılsa (hava/anime/gif) bile asla "yanıt vermedi" olmaz.
  try {
    await interaction.deferReply();
  } catch {
    return; // etkileşim zaten ölmüş, sessizce çık
  }
  const t0 = Date.now();
  try {
    const args = cmd.slashArgs ? cmd.slashArgs(interaction) : varsayilanArgs(optDefs, interaction);
    const fake = sahteMesaj(interaction, client);
    await cmd.run(fake, args, client);
  } catch (e) {
    console.error(`Slash hatası (/${interaction.commandName}):`, e.message);
    const msg = '❌ Bir hata oldu! Sahibime söyle.';
    try { await interaction.followUp({ content: msg, ephemeral: true }); }
    catch { try { await interaction.editReply({ content: msg }); } catch {} }
  }
}

let slashHarita = new Map();

async function registerSlash(client) {
  try {
    const { payload, harita, eksikler } = buildSlashPayload(client.commands);
    slashHarita = harita;
    if (!config.token || !config.clientId) {
      console.log('⚠️ Slash atlandı (TOKEN/CLIENT_ID eksik). Prefix çalışıyor.');
      return;
    }
    const rest = new REST().setToken(config.token);
    await rest.put(Routes.applicationCommands(config.clientId), { body: payload });
    console.log(`✅ ${payload.length} slash komut kaydedildi! (prefix dahil ${client.commands.size} komut aktif)${eksikler.length ? ` | atlanan: ${eksikler.join(', ')}` : ''}`);
  } catch (e) {
    console.error('⚠️ Slash kaydı başarısız (prefix çalışmaya devam ediyor):', e.message);
    if (e.rawError) console.error(JSON.stringify(e.rawError).slice(0, 500));
  }
}

module.exports = { buildSlashPayload, handleSlash, registerSlash, getSlashHarita: () => slashHarita, inferOptions, isSlash: (ad) => slashHarita.has((ad || '').toLowerCase()) };
