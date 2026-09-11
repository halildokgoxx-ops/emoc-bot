const BOLUM = [
  { id: 'koruma', baslik: '🛡️ Koruma Kalkanları', alanlar: [
    { k: 'antiLink', ad: 'Anti-Link', ac: 'Link atanların mesajını sil' },
    { k: 'antiKufur', ad: 'Anti-Küfür', ac: 'Küfürleri otomatik temizle' },
    { k: 'antiSpam', ad: 'Anti-Spam', ac: 'Flood ve tekrar mesajları engelle' },
    { k: 'antiRaid', ad: 'Anti-Raid', ac: 'Baskında sunucuyu kilitle' },
    { k: 'antiBot', ad: 'Anti-Bot', ac: 'İzinsiz botları at' },
    { k: 'capsEngel', ad: 'Caps Engeli', ac: 'BÜYÜK HARF spamını kes' },
    { k: 'altKoruma', ad: 'Alt Hesap Koruması', ac: '3 günden yeniyi at, 7 günden yeniyi izle' },
  ]},
  { id: 'kanallar', baslik: '📋 Kanallar', kanal: true, alanlar: [
    { k: 'logKanal', ad: 'Log kanalı' }, { k: 'hosgeldinKanal', ad: 'Hoşgeldin kanalı' },
    { k: 'cikisKanal', ad: 'Çıkış kanalı' }, { k: 'sayacKanal', ad: 'Sayaç kanalı' },
    { k: 'repBildirimKanal', ad: 'İtibar bildirim kanalı' }, { k: 'partnerKanal', ad: 'Partner paylaşım' },
    { k: 'partnerChat', ad: 'Partner başvuru chat' }, { k: 'partnerYetkiliKanal', ad: 'Partner yetkili kanal' },
    { k: 'itirafKanal', ad: 'İtiraf kanalı' }, { k: 'gununSorusuKanal', ad: 'Günün sorusu kanalı' },
  ]},
  { id: 'roller', baslik: '🎭 Roller & Sayılar', alanlar: [
    { k: 'otoRol', ad: 'Oto-rol', t: 'rol' }, { k: 'partnerYetkiliRol', ad: 'Partner yetkilisi', t: 'rol' },
    { k: 'sayacHedef', ad: 'Sayaç hedefi (0 = kapalı)', t: 'sayi' },
    { k: 'repSuresiDk', ad: 'İtibar bekleme (dakika)', t: 'sayi' },
    { k: 'seviyeHiz', ad: 'Seviye XP hızı (1-5x)', t: 'sayi' },
  ]},
  { id: 'yazilar', baslik: '✏️ Otomatik Yazılar', yaziKarti: true, alanlar: [
    { k: 'hosgeldinMesaj', ad: 'Hoşgeldin mesajı', degiskenler: ['kullanıcı', 'sunucu', 'üye'] },
    { k: 'cikisMesaj', ad: 'Görüşürüz mesajı', degiskenler: ['kullanıcı', 'sunucu', 'üye'] },
    { k: 'sayacMesaj', ad: 'Sayaç mesajı', degiskenler: ['kullanıcı', 'sunucu', 'üye', 'hedef', 'kalan'] },
    { k: 'partnerText', ad: 'Partner tanıtım yazısı', degiskenler: ['sunucu', 'üye', 'davet'] },
    { k: 'girisDM', ad: 'Giriş DM (premium)', degiskenler: ['kullanıcı', 'sunucu', 'üye'] },
  ]},
  { id: 'yasakli', baslik: '🚫 Yasaklı Kelimeler', yasakli: true, alanlar: [] },
];

let AKTIF_SEKME = 'koruma';

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
    const me = await api('/api/me');
    const user = me.user;
    ADMIN = !!me.admin;
    document.getElementById('kullanici').innerHTML =
      `<img src="${avatarURL(user)}"><b>${user.username}</b>`;
    if (ADMIN) {
      const b = document.createElement('button');
      b.className = 'btn btn-kucuk';
      b.textContent = '👑 Admin';
      b.onclick = adminAc;
      const bar = document.querySelector('.panel-ust div:last-child');
      if (bar) bar.prepend(b);
    }
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
      d.innerHTML = `${ikon ? `<img src="${ikon}">` : `<div class="harf">${g.ad[0]}</div>`}<div><b>${g.ad} ${g.prem ? '👑' : ''}</b><span>${g.sahip ? '👑 Sahip' : '🛡️ Yetkili'}${g.prem ? ' • PREMIUM' : ''}</span></div>`;
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
  const b = BOLUM.find((x) => x.id === AKTIF_SEKME) || BOLUM[0];
  let html = `<h2 style="margin-bottom:14px">⚙️ ${ad}</h2><div class="panel-duzen">`;
  html += `<aside class="kenar">` + BOLUM.map((x) =>
    `<button class="kenar-btn${x.id === b.id ? ' aktif' : ''}" onclick="sekmeAc('${x.id}')">${x.baslik}</button>`
  ).join('') + `</aside><div class="icerik" id="icerik">`;
  if (b.yasakli) {
    html += `<div class="bolum"><h2>${b.baslik}</h2><div id="yasak-liste"><p class="bos">Yükleniyor...</p></div>
      <div class="satir"><label>Yeni kelime</label><div style="display:flex;gap:8px">
      <input type="text" id="yasak-yeni" placeholder="örn: reklam" maxlength="50">
      <button class="btn btn-kucuk" onclick="yasakEkle()">Ekle</button></div></div></div>`;
  } else if (b.yaziKarti) {
    html += `<div class="bolum"><h2>${b.baslik}</h2>` + b.alanlar.map((a) => {
      const v = FORM[a.k] || '';
      const ozet = v ? String(v).slice(0, 90) + (String(v).length > 90 ? '…' : '') : '<i style="color:var(--soluk)">ayarlı değil</i>';
      return `<div class="satir"><label>✏️ ${a.ad}<small>${ozet.replace(/</g, '&lt;')}</small></label>` +
        `<button class="btn btn-ghost btn-kucuk" onclick="yaziAc('${a.k}')">Düzenle</button></div>`;
    }).join('') + `</div>`;
  } else {
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
      }
      html += `</div>`;
    });
    html += `</div>`;
  }
  html += `</div></div><div class="kaydet-cubugu"><button class="btn" id="kaydet" onclick="kaydet()">💾 Kaydet</button></div>`;
  document.getElementById('editor').innerHTML = html;
  if (b.yasakli) yasakYukle();
}

function sekmeAc(id) {
  domKaydet();
  AKTIF_SEKME = id;
  const baslik = document.querySelector('#editor h2');
  ciz(baslik ? baslik.textContent.replace(/^⚙️ /, '') : '');
}

function domKaydet() {
  document.querySelectorAll('#editor [data-k]').forEach((el) => {
    const k = el.dataset.k;
    if (el.type === 'checkbox') FORM[k] = el.checked;
    else if (el.type === 'number') FORM[k] = parseInt(el.value, 10) || 0;
    else FORM[k] = el.value || null;
  });
}

async function kaydet() {
  const btn = document.getElementById('kaydet');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }
  domKaydet();
  await formKaydet();
  if (btn) { btn.disabled = false; btn.textContent = '💾 Kaydet'; }
}

async function formKaydet(mesaj) {
  try {
    const j = await api(`/api/guild/${SID}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(FORM),
    });
    if (j.ok) toast(mesaj || `✅ Kaydedildi! (${j.sayi} ayar)`);
    else toast('❌ Kaydedilemedi!');
  } catch { toast('❌ Bağlantı hatası!'); }
}

// ---- ✏️ Yazı editör modalı ----
let MODAL_KEY = null;
const ORNEK_DEGER = { 'kullanıcı': '@EmoçFan', sunucu: 'Sunucum', 'üye': '1.337', hedef: '1000', kalan: '42', davet: 'discord.gg/ornek' };

function yaziAc(key) {
  const alan = BOLUM.flatMap((b) => b.alanlar || []).find((a) => a.k === key);
  if (!alan) return;
  MODAL_KEY = key;
  const degiskenler = (alan.degiskenler || []).map((d) =>
    `<button class="cip" onclick="cipEkle('{${d}}')">{${d}}</button>`).join('');
  document.body.insertAdjacentHTML('beforeend',
    `<div class="modal-arka acik" id="yazi-modal"><div class="modal-kutu2">
      <h3>✏️ ${alan.ad}</h3>
      <div class="cip-row">${degiskenler}</div>
      <textarea id="yazi-alan" rows="5">${(FORM[key] || '').replace(/</g, '&lt;')}</textarea>
      <div class="gif-ipucu">💡 Resim/gif linki eklersen (https://...gif) mesajda otomatik gösterilir!</div>
      <div class="onizleme-kutu"><div class="onizleme-baslik">ÖNİZLEME</div><div class="onizleme-mesaj" id="yazi-oniz"></div></div>
      <div class="modal-alt"><button class="btn btn-ghost" onclick="yaziKapat()">İptal</button>
      <button class="btn" onclick="yaziKaydet()">💾 Kaydet</button></div>
    </div></div>`);
  const ta = document.getElementById('yazi-alan');
  ta.addEventListener('input', onizlemeGuncelle);
  onizlemeGuncelle();
  ta.focus();
}
function cipEkle(kod) {
  const ta = document.getElementById('yazi-alan');
  const bas = ta.selectionStart || ta.value.length;
  ta.value = ta.value.slice(0, bas) + kod + ta.value.slice(ta.selectionEnd || bas);
  ta.focus();
  onizlemeGuncelle();
}
function onizlemeGuncelle() {
  const ta = document.getElementById('yazi-alan');
  const kutu = document.getElementById('yazi-oniz');
  if (!ta || !kutu) return;
  let metin = ta.value;
  let resim = null;
  const m = metin.match(/(https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(\?\S*)?)/i);
  if (m) { resim = m[0]; metin = metin.replace(m[0], '').trim(); }
  for (const [k, v] of Object.entries(ORNEK_DEGER)) metin = metin.split(`{${k}}`).join(v);
  kutu.innerHTML = `<b>Emoç <span>BOT • bugün</span></b><p>${metin.replace(/</g, '&lt;').replace(/\n/g, '<br>') || '<i>...</i>'}</p>${resim ? `<img src="${resim}" onerror="this.remove()">` : ''}`;
}
function yaziKapat() {
  document.getElementById('yazi-modal')?.remove();
  MODAL_KEY = null;
}
async function yaziKaydet() {
  const ta = document.getElementById('yazi-alan');
  FORM[MODAL_KEY] = ta.value.slice(0, 1500) || null;
  yaziKapat();
  await formKaydet('✅ Yazı kaydedildi!');
  const baslik = document.querySelector('#editor h2');
  ciz(baslik ? baslik.textContent.replace(/^⚙️ /, '') : '');
}

// ---- 🚫 Yasaklı kelimeler ----
async function yasakYukle() {
  const kutu = document.getElementById('yasak-liste');
  if (!kutu) return;
  try {
    const j = await api(`/api/yasakli/${SID}`);
    const liste = j.kelimeler || [];
    kutu.innerHTML = liste.length
      ? `<div class="yasak-liste">` + liste.map((k) =>
        `<span class="yasak-cip">${String(k).replace(/</g, '&lt;')}<b onclick="yasakSil('${String(k).replace(/'/g, "\\'")}')">✕</b></span>`).join('') + `</div>`
      : '<p class="bos">Liste boş — ilk kelimeyi ekle! 👇</p>';
  } catch { kutu.innerHTML = '<p class="bos">Yüklenemedi.</p>'; }
}
async function yasakEkle() {
  const inp = document.getElementById('yasak-yeni');
  const kelime = (inp.value || '').trim();
  if (!kelime) return;
  try {
    const j = await api('/api/yasakli', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId: SID, islem: 'ekle', kelime }) });
    if (j.ok) {
      inp.value = '';
      yasakYukle();
      toast('🚫 Eklendi!');
    } else toast('❌ Olmadı!');
  } catch { toast('❌ Olmadı!'); }
}
async function yasakSil(kelime) {
  try {
    await api('/api/yasakli', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId: SID, islem: 'sil', kelime }) });
    yasakYukle();
    toast('🗑️ Silindi!');
  } catch { toast('❌ Olmadı!'); }
}

let ADMIN = false;
let ADMIN_VERI = null;

function tarihYaz(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

async function adminAc() {
  const ed = document.getElementById('editor');
  ed.innerHTML = '<div class="yukleniyor">Admin verileri yükleniyor... 👑</div>';
  try {
    const j = await api('/api/admin/ozet');
    ADMIN_VERI = j;
    const satir = (s) => {
      const prem = s.bitis && s.bitis > Date.now();
      return `<div class="satir"><label>🌍 <b>${s.ad}</b><small>👥 ${s.uye} üye ${prem ? `• 👑 <b>${tarihYaz(s.bitis)}</b>'e kadar` : '• free'}</small></label>` +
        `<div style="display:flex;gap:6px;align-items:center">` +
        `<input type="number" id="gun-${s.id}" placeholder="gün" min="1" max="36500" style="width:80px">` +
        `<button class="btn btn-kucuk" onclick="adminPremium('${s.id}',true)">Aç</button>` +
        `<button class="btn btn-ghost btn-kucuk" onclick="adminPremium('${s.id}',false)">Kapat</button></div></div>`;
    };
    ed.innerHTML = `<h2 style="margin-bottom:14px">👑 Admin Panel <small style="color:var(--soluk)">(gizli — sadece kurucular)</small></h2>
      <div class="bolum"><h2>📊 Genel</h2>
        <div class="satir"><label>🌍 Sunucu</label><b>${j.sunucu}</b></div>
        <div class="satir"><label>👥 Toplam üye</label><b>${j.uye}</b></div>
        <div class="satir"><label>👑 Premium sunucu</label><b>${j.premiumSayi}</b></div>
        <div class="satir"><label>🆓 Free sunucu</label><b>${j.freeSayi}</b></div>
        <div class="satir"><label>⏱️ Çalışma süresi</label><b>${Math.floor((j.uptime || 0) / 3600)} saat</b></div>
        <div class="satir"><label>🧑‍💻 Sitede çevrimiçi</label><b>${j.oturum ?? '?'}</b></div>
      </div>
      <div class="bolum"><h2>👑 Premium Sunucular</h2>${j.premium.length ? j.premium.map(satir).join('') : '<p class="bos">Yok</p>'}</div>
      <div class="bolum"><h2>🆓 Free Sunucular</h2>${j.free.length ? j.free.map(satir).join('') : '<p class="bos">Yok</p>'}</div>
      <div class="bolum"><h2>🎟️ Premium Kodları</h2>
        <div class="satir"><label>Yeni kod üret</label><div style="display:flex;gap:6px;align-items:center">
        <input type="text" id="kod-sure" placeholder="30d / 1y / sinirsiz" style="width:150px">
        <button class="btn btn-kucuk" onclick="kodUret()">Üret</button></div></div>
        <div id="kod-liste"><p class="bos">Yükleniyor...</p></div>
      </div>
      <div class="bolum"><h2>📢 Duyuru Gönder</h2>
        <div class="satir"><label>Sunucu</label><select id="d-sunucu"></select></div>
        <div class="satir"><label>Kanal</label><select id="d-kanal"><option>Önce sunucu seç</option></select></div>
        <div class="satir"><label>Mesaj</label><textarea id="d-mesaj" rows="3" placeholder="Duyuru... Örn: Haksız Premium Tespit Edildi! En kısa sürede iletişime geçin."></textarea></div>
        <div class="satir"><label><input type="checkbox" id="d-hepsi" style="width:auto"> @everyone ile gönder</label><button class="btn btn-kucuk" onclick="duyuruGonder()">📨 Gönder</button></div>
      </div>`;
    const ss = document.getElementById('d-sunucu');
    const tumu = [...(j.premium || []), ...(j.free || [])];
    ss.innerHTML = tumu.map((s) => `<option value="${s.id}">${s.ad}</option>`).join('');
    ss.onchange = adminKanalDoldur;
    adminKanalDoldur();
    kodListesi();
  } catch { ed.innerHTML = '<div class="hata-kutu">Yüklenemedi!</div>'; }
}

async function adminKanalDoldur() {
  const gid = document.getElementById('d-sunucu').value;
  const ks = document.getElementById('d-kanal');
  ks.innerHTML = '<option>Yükleniyor...</option>';
  try {
    const j = await api(`/api/admin/kanallar/${gid}`);
    ks.innerHTML = (j.kanallar || []).map((k) => `<option value="${k.id}">${k.tip === 'ses' ? '🔊' : '💬'} #${k.ad}</option>`).join('');
  } catch { ks.innerHTML = '<option>Yüklenemedi</option>'; }
}

async function adminPremium(gid, ac) {
  const gun = parseInt((document.getElementById(`gun-${gid}`) || {}).value, 10) || 30;
  try {
    await api('/api/admin/premium', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId: gid, islem: ac ? 'ac' : 'kapat', gun }) });
    toast(ac ? `👑 Premium açıldı (${gun} gün)!` : '👑 Premium kapatıldı!');
    adminAc();
  } catch { toast('❌ Olmadı!'); }
}

async function duyuruGonder() {
  const gid = document.getElementById('d-sunucu').value;
  const kid = document.getElementById('d-kanal').value;
  const mesaj = document.getElementById('d-mesaj').value;
  const everyone = document.getElementById('d-hepsi').checked;
  if (!mesaj.trim()) { toast('❌ Mesaj yaz!'); return; }
  try {
    await api('/api/admin/duyuru', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId: gid, channelId: kid, mesaj, everyone }) });
    toast('📨 Duyuru gönderildi!');
    document.getElementById('d-mesaj').value = '';
  } catch { toast('❌ Gönderilemedi!'); }
}

async function kodListesi() {
  const kutu = document.getElementById('kod-liste');
  if (!kutu) return;
  try {
    const j = await api('/api/admin/kodlar');
    const liste = j.kodlar || [];
    if (!liste.length) { kutu.innerHTML = '<p class="bos">Henüz kod yok.</p>'; return; }
    kutu.innerHTML = liste.slice(0, 20).map((k) =>
      `<div class="satir"><label><code>${k.kod}</code><small>📅 ${k.gun >= 36500 ? 'SINIRSIZ' : k.gun + ' gün'} ${k.kullanan ? '• ✅ kullanıldı' : '• ⏳ boşta'}</small></label><button class="btn btn-ghost btn-kucuk" onclick="kodSil('${k.kod}')">🗑️</button></div>`
    ).join('');
  } catch { kutu.innerHTML = '<p class="bos">Yüklenemedi.</p>'; }
}

async function kodUret() {
  const sure = (document.getElementById('kod-sure') || {}).value || '30d';
  try {
    const j = await api('/api/admin/kod-uret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sure }) });
    toast(`🎟️ Kod üretildi: ${j.kod}`);
    kodListesi();
  } catch { toast('❌ Üretilemedi!'); }
}

async function kodSil(kod) {
  if (!confirm(`Silinsin mi?\n${kod}`)) return;
  try {
    await api('/api/admin/kod-sil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kod }) });
    toast('🗑️ Kod silindi!');
    kodListesi();
  } catch { toast('❌ Silinemedi!'); }
}

baslat();
