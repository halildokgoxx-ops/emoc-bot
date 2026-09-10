const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULTS = {
  // guildId: { prefix? yok global, ...ayarlar }
  guilds: {},
  // `${guildId}_${userId}`: { rep, repLog: [], warns: [], eco: {para}, level: {xp, level}, afk: null, ... }
  users: {},
  // global sayaçlar
  partnerRequests: {}, // kod: { fromGuild, toGuild, fromInvite, date, status }
  vitrin: [], // { guildId, name, desc, invite, members, date, owner }
  gorevler: {}, // userId_gun: {...}
  ruh: {}, // guildId: { userId: {mood, date} }
};

let cache = null;

function load() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULTS, null, 2));
      cache = JSON.parse(JSON.stringify(DEFAULTS));
      return cache;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8') || '{}';
    cache = Object.assign({}, DEFAULTS, JSON.parse(raw));
    for (const k of Object.keys(DEFAULTS)) if (!cache[k]) cache[k] = DEFAULTS[k];
    return cache;
  } catch {
    cache = JSON.parse(JSON.stringify(DEFAULTS));
    return cache;
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2)); } catch {}
  }, 500);
}
function saveNow() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2)); } catch {}
}

function db() {
  if (!cache) load();
  return cache;
}

// ---- Guild ayarları ----
function getGuild(gid) {
  const d = db();
  if (!d.guilds[gid]) {
    d.guilds[gid] = {
      antiLink: false, antiKufur: false, antiSpam: false, antiRaid: false,
      antiBot: false, capsEngel: false, altKoruma: false, kufurCeza: 'sil', linkCeza: 'sil',
      logKanal: null, hosgeldinKanal: null, hosgeldinMesaj: null, cikisKanal: null,
      otoRol: null, sayacHedef: 0, sayacKanal: null,
      partnerKanal: null, partnerText: null, partnerLog: null, partnerYetkili: null,
      partnerSayi: 0, itirafKanal: null,
      yasakli: [],
    };
    save();
  }
  return d.guilds[gid];
}
function setGuild(gid, patch) {
  Object.assign(getGuild(gid), patch);
  save();
}

// ---- Kullanıcı ----
function getUser(gid, uid) {
  const d = db();
  const key = `${gid}_${uid}`;
  if (!d.users[key]) {
    d.users[key] = {
      rep: 0, repVerilen: 0, repLog: [], // {from, amount, reason, date}
      warns: [], // {mod, reason, date}
      para: 0, gunluk: 0, calis: 0,
      xp: 0, level: 0, mesaj: 0,
      afk: null, // {reason, date}
    };
    save();
  }
  return d.users[key];
}

// Global rep toplamı (tüm sunucular) — top için
function topRep(gid = null, limit = 10) {
  const d = db();
  const rows = [];
  for (const [key, v] of Object.entries(d.users)) {
    if (gid && !key.startsWith(gid + '_')) continue;
    if (!v.rep) continue;
    rows.push({ key, uid: key.split('_')[1], rep: v.rep, verilen: v.repVerilen || 0 });
  }
  return rows.sort((a, b) => b.rep - a.rep).slice(0, limit);
}

function topPara(gid, limit = 10) {
  const d = db();
  const rows = [];
  for (const [key, v] of Object.entries(d.users)) {
    if (!key.startsWith(gid + '_')) continue;
    if (!v.para) continue;
    rows.push({ uid: key.split('_')[1], para: v.para });
  }
  return rows.sort((a, b) => b.para - a.para).slice(0, limit);
}

function topLevel(gid, limit = 10) {
  const d = db();
  const rows = [];
  for (const [key, v] of Object.entries(d.users)) {
    if (!key.startsWith(gid + '_')) continue;
    if (!v.xp) continue;
    rows.push({ uid: key.split('_')[1], xp: v.xp, level: v.level || 0 });
  }
  return rows.sort((a, b) => b.xp - a.xp).slice(0, limit);
}

process.on('exit', saveNow);

module.exports = { db, load, save, saveNow, getGuild, setGuild, getUser, topRep, topPara, topLevel };
