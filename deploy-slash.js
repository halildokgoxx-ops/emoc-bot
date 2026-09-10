// Elle slash kaydetmek için: npm run deploy
// (Bot açılışta da otomatik kaydeder, bu dosya manuel tetikleme içindir.)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config');
const { buildSlashPayload } = require('./src/slash');

async function main() {
  const commands = new Map();
  const cmdFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
  for (const f of cmdFiles) {
    const arr = require(`./commands/${f}`);
    const liste = Array.isArray(arr) ? arr : [arr];
    for (const c of liste) {
      if (!c.name || c.name.startsWith('__')) continue;
      commands.set(c.name.toLowerCase(), c);
    }
  }
  const { payload, eksikler } = buildSlashPayload(commands);
  console.log(`📦 ${payload.length} slash komut hazır (${eksikler.length} atlandı: ${eksikler.join(', ') || 'yok'})`);
  if (!config.token || !config.clientId) {
    console.error('❌ TOKEN veya CLIENT_ID eksik (.env)');
    process.exit(1);
  }
  const rest = new REST().setToken(config.token);
  console.log('🚀 Discord\'a yükleniyor...');
  await rest.put(Routes.applicationCommands(config.clientId), { body: payload });
  console.log(`✅ ${payload.length} slash komut global olarak kaydedildi! (Yayılması 1 saate kadar sürebilir)`);
}

main().catch(e => { console.error('❌ Deploy hatası:', e.message); if (e.rawError) console.error(JSON.stringify(e.rawError).slice(0, 1000)); process.exit(1); });
