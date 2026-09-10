require('dotenv').config();

module.exports = {
  token: process.env.TOKEN || '',
  prefix: process.env.PREFIX || '!',
  ownerId: process.env.OWNER_ID || '',
  colors: {
    main: 0x5865F2,   // blurple
    success: 0x57F287, // yeşil
    error: 0xED4245,   // kırmızı
    warn: 0xFEE75C,    // sarı
    gold: 0xF5A623,
    pink: 0xEB459E,
  },
  // Davet linki şablonun (bot davet komutu için). CLIENT_ID'yi .env'e eklersen otomatik doldurur.
  clientId: process.env.CLIENT_ID || '',
};
