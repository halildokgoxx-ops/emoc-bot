const BOLUM = [
  { baslik: '🛡️ Koruma Kalkanları', alanlar: [
    { k: 'antiLink', ad: 'Anti-Link', ac: 'Link atanların mesajını sil' },
    { k: 'antiKufur', ad: 'Anti-Küfür', ac: 'Küfürleri otomatik temizle' },
    { k: 'antiSpam', ad: 'Anti-Spam', ac: 'Flood ve tekrar mesajları engelle' },
    { k: 'antiRaid', ad: 'Anti-Raid', ac: 'Baskında sunucuyu kilitle' },
    { k: 'antiBot', ad: 'Anti-Bot', ac: 'İzinsiz botları at' },
    { k: 'capsEngel', ad: 'Caps Engeli', ac: 'BÜYÜK HARF spamını kes' },
    { k: 'altKoruma', ad: 'Alt Hesap Koruması', ac: '3 günden yeniyi at, 7 günden yeniyi izle' },
  ]},
  { baslik: '📋 Kanallar', kanal: true, alanlar: [
    { k: 'logKanal', ad: 'Log kanalı' }, { k: 'hosgeldinKanal', ad: 'Hoşgeldin kanalı' },
    { k: 'cikisKanal', ad: 'Çıkış kanalı' }, { k: 'sayacKanal', ad: 'Sayaç kanalı' },
    { k: 'repBildirimKanal', ad: 'İtibar bildirim kanalı' }, { k: 'partnerKanal', ad: 'Partner paylaşım' },
    { k: 'partnerChat', ad: 'Partner başvuru chat' }, { k: 'partnerYetkiliKanal', ad: 'Partner yetkili kanal' },
    { k: 'itirafKanal', ad: 'İtiraf kanalı' }, { k: 'gununSorusuKanal', ad: 'Günün sorusu kanalı' },
  ]},
  { baslik: '🎭 Roller & Sayılar', alanlar: [
    { k: 'otoRol', ad: 'Oto-rol', t: 'rol' }, { k: 'partnerYetkiliRol', ad: 'Partner yetkilisi', t: 'rol' },
    { k: 'sayacHedef', ad: 'Sayaç hedefi (0 = kapalı)', t: 'sayi' },
    { k: 'repSuresiDk', ad: 'İtibar bekleme (dakika)', t: 'sayi' },
  ]},
  { baslik: '✏️ Otomatik Yazılar', alanlar: [
    { k: 'hosgeldinMesaj', ad: 'Hoşgeldin mesajı {kullanıcı} {sunucu} {üye}', t: 'alan' },
    { k: 'partnerText', ad: 'Partner tanıtım yazısı', t: 'alan' },
  ]},
];

let SID = null, KANALLAR = [], ROLLER = [], FORM = {};

function toast(mesaj) {
  const t = document.getElementById('toast');
  t.textContent = mesaj;
  t.classList.add('goster');
  clearTimeout(t._z);
  t._z = setTimeout(() => t.classList.remove('goster'), 2600);
}
async function api(yol, init) {
  const r = await fetch(yol, init);
  if (r.status === 401) { location.href = '/login'; throw new Error('giris'); }
  return r.json();
}
function avatarURL(u) {
  return u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png';
}
function ikonURL(g) {
  return g.ikon ? `https://cdn.discordapp.com/icons/${g.id}/${g.ikon}.png?size=64` : null;
}

async function baslat() {
  try {
    const { user } = await api('/api/me');
    document.getElementById('kullanici').innerHTML =
      `<img src="${avatarURL(user)}"><b>${user.username}</b>`;
    const { guilds } = await api('/api/guilds');
    const kutu = document.getElementById('sunucular');
    if (!guilds.length) {
      kutu.innerHTML = `<div class="hata-kutu">Botun olduğu yönetilebilir sunucun yok!<br><br><a class="btn btn-kucuk" href="/davet">➕ Botu Ekle</a></div>`;
      return;
    }
    kutu.innerHTML = '';
    guilds.forEach((g, i) => {
      const d = document.createElement('div');
      d.className = 'sunucu' + (i === 0 ? ' aktif' : '');
      const ikon = ikonURL(g);
      d.innerHTML = `${ikon ? `<img src="${ikon}">` : `<div class="harf">${g.ad[0]}</div>`}<div><b>${g.ad}</b><span>${g.sahip ? '👑 Sahip' : '🛡️ Yetkili'}</span></div>`;
      d.onclick = () => {
        document.querySelectorAll('.sunucu').forEach((x) => x.classList.remove('aktif'));
        d.classList.add('aktif');
        sunucuAc(g.id, g.ad);
      };
      kutu.appendChild(d);
    });
    sunucuAc(guilds[0].id, guilds[0].ad);
  } catch (e) { /* login'e yönlendi */ }
}

async function sunucuAc(id, ad) {
  SID = id;
  document.getElementById('editor').innerHTML = '<div class="yukleniyor">Ayarlar yükleniyor...</div>';
  try {
    const j = await api(`/api/guild/${id}`);
    KANALLAR = j.kanallar;
    ROLLER = j.roller;
    FORM = { ...j.ayarlar };
    ciz(ad);
  } catch {
    document.getElementById('editor').innerHTML = `<div class="hata-kutu">Yüklenemedi! Bot bu sunucuda mı?</div>`;
  }
}

function secenekler(liste, deger, bosAd) {
  return `<option value="">— ${bosAd} —</option>` +
    liste.map((x) => `<option value="${x.id}"${String(deger) === String(x.id) ? ' selected' : ''}>${x.tip === 'ses' ? '🔊' : x.tip === 'yazi' ? '💬' : ''} ${x.ad}</option>`).join('');
}

function ciz(ad) {
  let html = `<h2 style="margin-bottom:14px">⚙️ ${ad}</h2>`;
  BOLUM.forEach((b) => {
    html += `<div class="bolum"><h2>${b.baslik}</h2>`;
    b.alanlar.forEach((a) => {
      const v = FORM[a.k];
      const tip = a.t || (b.kanal ? 'kanal' : 'toggle');
      html += `<div class="satir"><label>${a.ad}${a.ac ? `<small>${a.ac}</small>` : ''}</label>`;
      if (tip === 'toggle') {
        html += `<label class="toggle"><input type="checkbox" data-k="${a.k}"${v ? ' checked' : ''}><span class="ray"></span></label>`;
      } else if (tip === 'rol') {
        html += `<select data-k="${a.k}">${secenekler(ROLLER, v, 'Yok')}</select>`;
      } else if (tip === 'kanal') {
        html += `<select data-k="${a.k}">${secenekler(KANALLAR.filter((k) => k.tip === 'yazi'), v, 'Kapalı')}</select>`;
      } else if (tip === 'sayi') {
        html += `<input type="number" data-k="${a.k}" value="${v ?? 0}" min="0">`;
      } else if (tip === 'alan') {
        html += `<textarea data-k="${a.k}" rows="2">${(v || '').replace(/</g, '&lt;')}</textarea>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  });
  html += `<div class="kaydet-cubugu"><button class="btn" id="kaydet" onclick="kaydet()">💾 Kaydet</button></div>`;
  document.getElementById('editor').innerHTML = html;
}

async function kaydet() {
  const btn = document.getElementById('kaydet');
  btn.disabled = true;
  btn.textContent = '⏳ Kaydediliyor...';
  const govde = {};
  document.querySelectorAll('#editor [data-k]').forEach((el) => {
    const k = el.dataset.k;
    if (el.type === 'checkbox') govde[k] = el.checked;
    else if (el.type === 'number') govde[k] = parseInt(el.value, 10) || 0;
    else govde[k] = el.value || null;
  });
  try {
    const j = await api(`/api/guild/${SID}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });
    if (j.ok) toast(`✅ Kaydedildi! (${j.sayi} ayar)`);
    else toast('❌ Kaydedilemedi!');
  } catch { toast('❌ Bağlantı hatası!'); }
  btn.disabled = false;
  btn.textContent = '💾 Kaydet';
}

baslat();
