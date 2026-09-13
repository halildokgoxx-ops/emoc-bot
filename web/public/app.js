/* Panel v6 */
const PANEL_SURUM='v17';
let SID=null,SNAME='',SICON=null,KANALLAR=[],ROLLER=[],FORM={},ME=null,GUILDS=[];
let AKTIF='home',GREET='karsilama',ADMIN=false,PREMIUM_AKTIF=false,BAKIM=null;

const AM_LIST=[
  {k:'amReklam',ad:'Reklamları engelle',ac:'Reklam içeren mesajları siler'},
  {k:'amKufur',ad:'Küfürleri engelle',ac:'Küfür içeren mesajları siler'},
  {k:'amLink',ad:'Linkleri engelle',ac:'Link içeren mesajları siler'},
  {k:'amKelime',ad:'Engellenen kelime listesi',ac:'Belirlediğiniz kelimeleri içeren mesajları siler',kelime:true},
  {k:'amTekrar',ad:'Tekrarlanan metin',ac:'Bir dakika içinde gönderilen aynı üçüncü mesajı siler'},
  {k:'amFlood',ad:'Flood engel',ac:"Varsayılan olarak bir üye 10 saniyede 5'ten fazla mesaj gönderdiğinde mesajları siler",flood:true},
  {k:'amCaps',ad:'Aşırı büyük harf',ac:'Varsayılan olarak en az %70 büyük harfli mesajları siler',yuzde:true},
  {k:'amEmoji',ad:'Aşırı emoji',ac:"Varsayılan olarak 6'dan fazla emoji içeren mesajları siler",adet:true,varsayilan:6},
  {k:'amEtiket',ad:'Aşırı etiketleme',ac:"Varsayılan olarak 3'ten fazla etiket içeren mesajları siler",adet:true,varsayilan:3},
  {k:'amUzun',ad:'Uzun metin',ac:'Varsayılan olarak 6 satırdan uzun mesajları siler',adet:true,varsayilan:6},
  {k:'amKarakter',ad:'Karakter sınırı',ac:'Varsayılan olarak 500 karakterden uzun mesajları siler',adet:true,varsayilan:500},
  {k:'amFoto',ad:'Fotoğraf spamı',ac:'Varsayılan olarak bir dakika içinde 5 fotoğraf gönderildiğinde mesajı siler',adet:true,varsayilan:5},
];

window.addEventListener('error',function(e){try{toast('Hata: '+String((e&&e.message)||'bilinmiyor').slice(0,120))}catch(_){}});
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('goster');clearTimeout(t._z);t._z=setTimeout(()=>t.classList.remove('goster'),2400)}
function hataMesaj(j,varsayilan){
  const h=j&&j.hata;
  if(h==='kanal-yok')return 'Kanal bulunamadı! Bot kanalı görmüyor olabilir.';
  if(h==='mesaj-yok')return 'Mesaj bulunamadı! ID veya bağlantı doğru mu?';
  if(h==='tepki-olmadi')return 'Tepki konulamadı! Botun tepki izni ve emoji erişimi var mı?';
  if(h==='bos')return 'Boş mesaj gönderilemez!';
  if(h==='premium-gerek')return '👑 Bu limit Premium! Free 5 kayıt, Premium ile 20-25 kayıt.';
  if(h==='bot-hatasi')return 'Bota ulaşılamadı! Bot çalışıyor mu? Birazdan tekrar dene.';
  if(h==='yok')return 'Sunucu bulunamadı! Bot o sunucuda mı?';
  return varsayilan||'Olmadı! Bot izinlerini kontrol et.';
}
async function api(y,init){const r=await fetch(y,init);if(r.status===401){location.href='/login';throw new Error('giris')}return r.json()}
function avatarURL(u){return u&&u.avatar?`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`:'https://cdn.discordapp.com/embed/avatars/0.png'}
function esc(s){return String(s==null?'':s).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function kanalAd(id){const k=KANALLAR.find(x=>String(x.id)===String(id));return k?('#'+k.ad):'—'}
function rolAd(id){const r=ROLLER.find(x=>String(x.id)===String(id));return r?('@'+r.ad):'—'}

async function baslat(){
  try{
    const me=await api('/api/me');ME=me.user;ADMIN=!!me.admin;
    duyuruYukle();
    const j=await api('/api/guilds');GUILDS=j.guilds||[];
    if(!GUILDS.length){
      renderMisafir();document.getElementById('content').innerHTML='<div class="hata-kutu">Yönetebileceğin bir sunucu bulunamadı. Botun o sunucuda olduğundan emin ol.<br><br><a class="btn sm" href="/davet">Botu Ekle</a></div>';
      return;
    }
    renderMisafir();
    serverList();
  }catch(e){}
}
function renderMisafir(){
  document.getElementById('sidebar').innerHTML='<div class="side-logo"><div class="mark">✦</div><span>EMOÇ <small>PANEL</small></span></div>'
    +'<div class="side-sec">Sunucularım</div>'
    +GUILDS.map(g=>'<button class="side-item" onclick="sunucuAc(\''+g.id+'\')"><span class="ic">🌍</span><span>'+esc(g.ad).slice(0,24)+'</span>'+(g.prem?'<span class="tac">👑</span>':'')+'</button>').join('')+'<div class="side-ver">'+PANEL_SURUM+' • EMOÇ</div>';
  document.getElementById('topbar').innerHTML='<div class="crumb"><b>Sunucularım</b></div>'
    +'<div class="top-right"><div class="search">⌕ Özellik ara<kbd>Ctrl K</kbd></div><div class="userbox"><img src="'+avatarURL(ME)+'">'+esc(ME?ME.username:'')+'</div><a class="btn btn-ghost sm" href="/">🏠 Ana Sayfa</a><a class="btn sm" href="/logout">Çıkış</a></div>';
}
function serverList(){
  SID=null;
  document.getElementById('content').innerHTML='<div class="page-h">Sunucularım</div><div class="page-s">Yönetmek için bir sunucu seç</div>'
    +'<div class="server-grid">'+GUILDS.map(g=>'<button class="server-card" onclick="sunucuAc(\''+g.id+'\')">'
      +(g.ikon?'<img src="https://cdn.discordapp.com/icons/'+g.id+'/'+g.ikon+'.png?size=96">':'<div class="harf">'+esc((g.ad||'?')[0].toUpperCase())+'</div>')
      +'<div><b>'+esc(g.ad)+(g.prem?' 👑':'')+'</b><span>'+(g.sahip?'Sahip':'Yetkili')+'</span></div></button>').join('')+'</div>';
}

async function sunucuAc(id){
  const g=GUILDS.find(x=>x.id===id);if(!g)return;
  document.getElementById('content').innerHTML='<div class="yukleniyor">Ayarlar yükleniyor...</div>';
  try{
    const j=await api('/api/guild/'+id);
    SID=id;SNAME=j.ad;KANALLAR=j.kanallar||[];ROLLER=j.roller||[];FORM=Object.assign({},j.ayarlar||{});PREMIUM_AKTIF=!!j.prem;
    const ic=j.ad?j.ad[0].toUpperCase():'?';
    SICON=null;
    const gg=GUILDS.find(x=>x.id===id);
    if(gg&&gg.ikon)SICON='https://cdn.discordapp.com/icons/'+id+'/'+gg.ikon+'.png?size=64';
    AKTIF='home';GREET='karsilama';if(BAKIM)toast('🛠️ Bot bakımda: ayarlar şu an uygulanmayabilir!');
    renderAll();
  }catch{ document.getElementById('content').innerHTML='<div class="hata-kutu">Yüklenemedi.</div>'; }
}

const NAV=[
  {sec:null,items:[['home','🏠','Kontrol Paneli']]},
  {sec:null,items:[['ayarlar','⚙️','Ayarlar'],['premium','⭐','Premium'],['gomulu','📝','Gömülü Mesajlar']]},
  {sec:'Sunucu Yönetimi',items:[['seviye','📊','Seviye Sistemi'],['karsilama','👋','Karşılama & Veda'],['destek','🎫','Destek / Ticket','YENİ'],['otomod','🛡️','Otomatik Moderasyon','YENİ'],['denetimMasasi','🎛️','Denetim Masası'],['denetim','📋','Denetim Kaydı'],['otocevap','🤖','Otomatik Cevap'],['emojirol','😀','Emoji Rol'],['etiket','🏷️','Sunucu Etiketi','👑'],['medya','🎨','Medya Yükle']]},
  {sec:'Güvenlik',items:[['govDavet','🔗','Davet Koruması','👑'],['govHesap','🛡️','Hesap Filtresi','👑'],['govRol','🎭','Rol Limitlemeleri'],['govBot','🤖','Bot Filtresi'],['govYasak','⛔','Yasaklama Limiti'],['govAtma','🚪','Atma Limiti'],['govKanal','📁','Kanal Limitlemeleri'],['govWebhook','🪝','Anti-Webhook','👑'],['govEmoji','😎','Emoji Limitleri']]},
];
const NAV_AD={home:'Kontrol Paneli',ayarlar:'Ayarlar',premium:'Premium',gomulu:'Gömülü Mesajlar',seviye:'Seviye Sistemi',karsilama:'Karşılama & Veda',destek:'Destek / Ticket',otomod:'Otomatik Moderasyon',denetimMasasi:'Denetim Masası',denetim:'Denetim Kaydı',otocevap:'Otomatik Cevap',emojirol:'Emoji Rol',etiket:'Sunucu Etiketi',medya:'Medya Yükle',admin:'Admin Paneli',govDavet:'Davet Koruması',govHesap:'Hesap Filtresi',govRol:'Rol Limitlemeleri',govBot:'Bot Filtresi',govYasak:'Yasaklama Limiti',govAtma:'Atma Limiti',govKanal:'Kanal Limitlemeleri',govWebhook:'Anti-Webhook',govEmoji:'Emoji Limitleri'};

function renderAll(){renderSide();renderTop();renderContent()}
function renderSide(){
  let h=(ADMIN?'<button class="side-item'+(AKTIF==='admin'?' aktif':'')+'" onclick="git(\'admin\')"><span class="ic">👑</span><span>Admin Paneli</span></button>':'')+'<div class="side-logo"><div class="mark">✦</div><span>EMOÇ <small>PANEL</small></span></div>';
  NAV.forEach(gr=>{
    if(gr.sec)h+='<div class="side-sec">'+gr.sec+'</div>';
    gr.items.forEach(it=>{
      const id=it[0],ic=it[1],ad=it[2],roz=it[3];
      let rozH='';
      if(roz==='YENİ')rozH='<span class="yeni">YENİ</span>';
      else if(roz==='👑')rozH='<span class="tac">👑</span>';
      h+='<button class="side-item'+(AKTIF===id?' aktif':'')+'" onclick="git(\''+id+'\')"><span class="ic">'+ic+'</span><span>'+ad+'</span>'+rozH+'</button>';
    });
  });
  document.getElementById('sidebar').innerHTML=h+'<div class="side-ver">'+PANEL_SURUM+' • EMOÇ</div>';
}
function renderTop(){
  document.getElementById('topbar').innerHTML='<div class="crumb"><span style="cursor:pointer" onclick="serverList();renderMisafir()">Sunucularım</span><span class="sep">›</span>'
    +'<button class="srv-pick" onclick="serverList();renderMisafir()">'+(SICON?'<img src="'+SICON+'">':'<span class="harf">'+esc((SNAME||'?')[0])+'</span>')+'<b>'+esc(SNAME)+'</b><span style="color:var(--mut)">▾</span></button></div>'
    +'<div class="top-right"><div class="search">⌕ <input id="ara" placeholder="Özellik ara" style="background:none;border:0;outline:0;color:var(--txt);width:120px" onkeydown="if(event.key===\'Enter\')araGit(this.value)"><kbd>Ctrl K</kbd></div><div class="userbox"><img src="'+avatarURL(ME)+'">'+esc(ME?ME.username:'')+'<span style="color:var(--mut)">▾</span></div><a class="btn btn-ghost sm" href="/">🏠 Ana Sayfa</a><a class="btn sm" href="/logout">Çıkış</a></div>';
}
function araGit(v){
  v=(v||'').toLocaleLowerCase('tr');
  const bul=Object.keys(NAV_AD).find(k=>NAV_AD[k].toLocaleLowerCase('tr').includes(v));
  if(bul)git(bul);else toast('Sonuç yok');
}
function git(id){domKaydet();AKTIF=id;renderAll()}
function domKaydet(){
  document.querySelectorAll('#content [data-k]').forEach(el=>{
    const k=el.dataset.k;
    if(k==='yoneticiRolTek')return;
    if(el.type==='checkbox')FORM[k]=el.checked;
    else if(el.type==='number')FORM[k]=parseInt(el.value,10)||0;
    else FORM[k]=el.value||null;
  });
  document.querySelectorAll('#content [data-log]').forEach(el=>{
    if(!FORM.logOlaylar||typeof FORM.logOlaylar!=='object')FORM.logOlaylar={};
    FORM.logOlaylar[el.dataset.log]=el.checked;
  });
}
async function kaydet(mesaj){
  domKaydet();
  const b=document.getElementById('kaydetBtn');if(b){b.disabled=true;b.textContent='Kaydediliyor...'}
  try{
    const j=await api('/api/guild/'+SID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(FORM)});
    if(j.premEngel>0)toast('Kaydedildi ('+j.sayi+' ayar) + 👑 '+j.premEngel+' premium ayar atlandı (free)');
    else toast(mesaj||('Kaydedildi'+(j.sayi?' ('+j.sayi+' ayar)':'')));
  }catch{toast('Kaydedilemedi')}
  if(b){b.disabled=false;b.textContent='💾 Kaydet'}
}
function saveBar(){return '<div class="savebar"><button class="btn pri" id="kaydetBtn" onclick="kaydet()">💾 Kaydet</button></div>'}
function secenek(kanalTip,deger,bos){
  const liste=kanalTip==='rol'?ROLLER:KANALLAR.filter(k=>!kanalTip||k.tip===kanalTip);
  return '<option value="">— '+bos+' —</option>'+liste.map(x=>'<option value="'+x.id+'"'+(String(deger)===String(x.id)?' selected':'')+'>'+(x.tip==='ses'?'🔊 ':'')+esc(x.ad)+'</option>').join('');
}
function rolChips(key){
  const sec=FORM[key]||[];
  return '<div class="chip-row" style="margin-top:0">'+ROLLER.map(r=>'<button class="chip" style="'+(sec.includes(r.id)?'border-color:var(--acc);color:#fff;background:var(--acc-bg)':'')+'" onclick="chipRol(\''+key+'\',\''+r.id+'\',this)">'+esc(r.ad.slice(0,20))+'</button>').join('')+'</div>';
}
function chipRol(key,id,el){
  if(!Array.isArray(FORM[key]))FORM[key]=[];
  const i=FORM[key].indexOf(id);
  if(i>=0){FORM[key].splice(i,1);el.style.borderColor='';el.style.color='';el.style.background=''}
  else{if(FORM[key].length>=10){toast('En fazla 10 rol');return}FORM[key].push(id);el.style.borderColor='var(--acc)';el.style.color='#fff';el.style.background='var(--acc-bg)'}
}

/* ---------- içerik ---------- */
function renderContent(){
  const c=document.getElementById('content');
  try{ return renderContentIc(c); }
  catch(err){ c.innerHTML='<div class="hata-kutu">Sayfa acilamadi: '+esc(String((err&&err.message)||err)).slice(0,200)+'</div>'; }
}
function renderContentIc(){
  const c=document.getElementById('content');
  if(AKTIF==='home')return cizHome(c);
  if(AKTIF==='ayarlar')return cizAyarlar(c);
  if(AKTIF==='seviye')return cizSeviye(c);
  if(AKTIF==='karsilama')return cizKarsilama(c);
  if(AKTIF==='destek')return cizDestek(c);
  if(AKTIF==='otomod')return cizOtomod(c);
  if(AKTIF==='denetim')return cizDenetim(c);
  if(AKTIF==='gomulu')return cizGomulu(c);
  if(AKTIF==='otocevap')return cizOtoCevap(c);
  if(AKTIF==='emojirol')return cizEmojiRol(c);
  if(AKTIF==='etiket')return cizEtiket(c);
  if(AKTIF==='medya')return cizMedya(c);
  if(AKTIF==='premium')return cizPremium(c);
  if(AKTIF==='denetimMasasi')return cizDenetimMasasi(c);
  if(AKTIF==='admin'){if(!ADMIN){c.innerHTML='<div class="hata-kutu">Yetkin yok.</div>';return}return cizAdmin(c)}
  if(AKTIF.startsWith('gov'))return cizGov(c,AKTIF);
  c.innerHTML='<div class="bos">Hazırlanıyor.</div>';
}

function cizHome(c){
  const kart=(id,icon,ad,ac,yeni,tac)=>{
    return '<button class="mod-card" onclick="git(\''+id+'\')"><span class="mi">'+icon+'</span><span><b>'+ad+(yeni?' <span class="yeni-tag">YENİ</span>':'')+(tac?' <span class="tac">👑</span>':'')+'</b><p>'+ac+'</p></span></button>';
  };
  c.innerHTML='<div class="page-h">Kontrol Paneli</div><div class="page-s">Kontrol paneline hoş geldiniz</div>'
    +'<div class="sec-h">Sunucu Yönetimi</div><div class="kart-grid">'
    +kart('seviye','📊','Seviye Sistemi','Mesaj ve ses etkinliğini seviyeler, sıralamalar ve rollerle ödüllendirin.')
    +kart('karsilama','👋','Karşılama & Veda','Bir üye katıldığında veya ayrıldığında olacakları yönetin')
    +kart('destek','🎫','Destek / Ticket','Ticket destek rolünü ve kategorisini yönetin, paneli slash ile kurun.',true)
    +kart('otomod','🛡️','Otomatik Moderasyon','Sunucu moderasyonunu otomatikleştirir',true)
    +kart('denetimMasasi','🎛️','Denetim Masası','Güvenilir üye rollerini belirle: bu rollerdekiler denetim kaydını görür, hızlı işlem menüsünü kullanır')
    +kart('denetim','📋','Denetim Kaydı','Sunucunuzda olanların kaydını tutar')
    +kart('otocevap','🤖','Otomatik Cevap','Mesaj tetiklemelerini yönetin')
    +kart('emojirol','😀','Emoji Rol','Üyelerin mesajlara tepki vererek rol almasını sağlar')
    +kart('etiket','🏷️','Sunucu Etiketi','Üyeler sunucu etiketinizi aldığında otomatik rol verin',false,true)
    +kart('medya','🎨','Medya Yükle','Toplu emoji ve sticker yükleyin.')
    +'</div><div class="sec-h">Güvenlik</div><div class="kart-grid">'
    +kart('govDavet','🔗','Davet Koruması','Sunucuya izinsiz davet paylaşımlarını engelleyin.',false,true)
    +kart('govHesap','🛡️','Hesap Filtresi','Yeni ve şüpheli hesapları otomatik filtreleyin.',false,true)
    +kart('govRol','🎭','Rol Limitlemeleri','Rol verme ve alma işlemlerini sınırlayın.')
    +kart('govBot','🤖','Bot Filtresi','Onaylanmamış bot girişlerini engelleyin.')
    +kart('govYasak','⛔','Yasaklama Limiti','Toplu yasaklamaları sınırlayın.')
    +kart('govAtma','🚪','Atma Limiti','Toplu atmaları sınırlayın.')
    +kart('govKanal','📁','Kanal Limitlemeleri','Kanal açma ve silme işlemlerini sınırlayın.')
    +kart('govWebhook','🪝','Anti-Webhook','İzinsiz webhookları onaya düşürür veya siler',false,true)
    +kart('govEmoji','😎','Emoji Limitleri','Emoji spamını ve izinsiz emoji eklemeyi sınırlar',false)
    +'</div>';
}

function cizAyarlar(c){
  c.innerHTML='<div class="page-h">Ayarlar</div><div class="page-s">Sunucunuzun temel yönetim ayarları</div>'
    +'<div class="panel"><div class="warn red">⚠ Bu role sahip üyeler güvenlik sistemleri dahil tüm sistemlere erişim kazanır. Sunucu yönetiminiz başka biri tarafından yürütülmüyorsa bunu değiştirmeyin!</div>'
    +'<div class="field"><label>Yönetici rolleri</label><select data-k="yoneticiRolTek" onchange="tektenCokluya(this,\'yoneticiRol\')">'+secenek('rol',(FORM.yoneticiRol||[])[0],'Bir seçim yapın')+'</select>'
    +'<div style="margin-top:10px">'+rolChips('yoneticiRol')+'</div></div></div>'
    +'<div class="panel"><div class="page-h" style="font-size:16px">Moderatör rolleri</div><div class="warn yel">⚠ Moderatörler yasaklama, atma ve susturma gibi moderasyon komutlarını kullanabilir.</div>'
    +'<div class="field"><label>Moderatör rolleri</label><select onchange="tektenCokluya(this,\'moderatorRol\')">'+secenek('rol',(FORM.moderatorRol||[])[0],'Rol seçin')+'</select>'
    +'<div style="margin-top:10px">'+rolChips('moderatorRol')+'</div></div></div>'
    +'<div class="panel"><div class="page-h" style="font-size:16px">Güvenlik kanalı</div><div class="warn yel">⚠ Güvenlik sistemlerinin kaydı bu kanala gönderilir.</div>'
    +'<div class="field"><label>Güvenlik kanalı</label><select data-k="guvenlikKanal">'+secenek('yazi',FORM.guvenlikKanal,'Bir kanal seçin')+'</select></div></div>'
    +'<div class="panel"><div class="page-h" style="font-size:16px">Bot Ön Eki 👑</div><div class="warn yel">👑 Özel ön ek premium sunucularda çalışır. Boş bırakırsan varsayılan ön ek kullanılır.</div>'
    +'<div class="field"><label>Ön ek (en fazla 5 karakter, örn: ! veya r\')</label><input type="text" data-k="prefix" maxlength="5" placeholder="!" value="'+esc(FORM.prefix||'')+'" style="max-width:140px"></div></div>'
    +saveBar();
}
function tektenCokluya(sel,key){
  domKaydet();
  if(!sel.value)return;
  if(!Array.isArray(FORM[key]))FORM[key]=[];
  if(!FORM[key].includes(sel.value)&&FORM[key].length<10)FORM[key].push(sel.value);
  renderContent();
}

function cizSeviye(c){
  const f=FORM;
  c.innerHTML='<div class="page-h">Seviye Sistemi</div><div class="page-s">Mesaj ve ses aktivitesine göre seviye dağıtın</div>'
  +'<div class="grid2"><div class="panel"><div class="panel-top"><div><h3>💬 Mesaj XP</h3><p>Üyeler mesajları için rastgele XP kazanır.<br>Spam içerikler elenir.</p></div>'
  +'<label class="tgl"><input type="checkbox" data-k="mesajXP"'+(f.mesajXP!==false?' checked':'')+'><span class="ray"></span></label></div>'
  +'<div class="field" style="margin-top:16px"><div class="row3"><div><label>Minimum XP</label><input type="number" data-k="xpMin" value="'+(f.xpMin??15)+'"></div><div><label>Maksimum XP</label><input type="number" data-k="xpMax" value="'+(f.xpMax??25)+'"></div><div><label>Bekleme süresi</label><div style="display:flex;gap:8px;align-items:center"><input type="number" data-k="xpSoguma" value="'+(f.xpSoguma??60)+'"><span style="color:var(--mut)">s</span></div></div></div></div></div>'
  +'<div class="panel"><div class="panel-top"><div><h3>🎙 Ses XP 👑</h3><p>Premium sunucularda üyeler ses kanallarında geçirdikleri süreye göre XP kazanır.</p></div>'
  +'<label class="tgl"><input type="checkbox" data-k="sesXP"'+(f.sesXP?' checked':'')+'><span class="ray"></span></label></div>'
  +'<div class="field" style="margin-top:16px"><div class="row3"><div><label>Dakika başına XP</label><input type="number" data-k="sesXPDakika" value="'+(f.sesXPDakika??5)+'"></div><div><label>Minimum katılımcı</label><input type="number" data-k="sesXPMin" value="'+(f.sesXPMin??2)+'"></div><div><label>AFK koruması</label><div style="display:flex;align-items:center;gap:10px;height:42px"><label class="tgl"><input type="checkbox" data-k="sesXPAfk"'+(f.sesXPAfk!==false?' checked':'')+'><span class="ray"></span></label><span style="font-size:12.5px;color:var(--mut)">'+(f.sesXPAfk!==false?'Açık':'Kapalı')+'</span></div></div></div>'
  +'<div class="hint">✔ AFK koruması etkinleştirildiğinde AFK, sessiz veya odada tek duran üyeler XP kazanamaz.</div></div></div></div>'
  +'<div class="panel" style="margin-top:16px"><div class="panel-top"><div><h3>🔔 Seviye atlama duyurusu</h3><p>Üyeleriniz seviye atladığında kişiselleştirilmiş bir mesaj gönderin.</p></div></div>'
  +'<div class="field"><label>Hedef</label><select data-k="seviyeKanal"><option value="">Kapalı</option>'+KANALLAR.filter(k=>k.tip==='yazi').map(k=>'<option value="'+k.id+'"'+(String(f.seviyeKanal)===String(k.id)?' selected':'')+'># '+esc(k.ad)+'</option>').join('')+'</select></div>'
  +'<div class="field" style="display:flex;align-items:center;gap:12px"><label class="tgl"><input type="checkbox" data-k="seviyeOzel"'+(f.seviyeOzel?' checked':'')+'><span class="ray"></span></label><span style="font-size:13px">Özel mesaj olarak gönder</span></div>'
  +'<div class="field"><label>Mesaj şablonu</label><div class="chip-row" style="margin:0 0 8px"><button class="chip" onclick="chipEkle(\'seviyeMesaj\',\'{user}\')">{user}</button><button class="chip" onclick="chipEkle(\'seviyeMesaj\',\'{level}\')">{level}</button><button class="chip" onclick="chipEkle(\'seviyeMesaj\',\'{xp}\')">{xp}</button><button class="chip" onclick="chipEkle(\'seviyeMesaj\',\'{sunucu}\')">{sunucu}</button></div><textarea data-k="seviyeMesaj" rows="2">🎉 '+(esc(f.seviyeMesaj)||'Tebrikler {user}, **{level}**. seviyeye ulaştın! /rank ile seviyeni kontrol et.')+'</textarea>'
  +'<div style="margin-top:8px"><button class="link-btn" onclick="toast(\'Değişkenler: {user} {level} {xp}\')">⚙ Gelişmiş Mesaj Ayarla</button></div></div></div>'
  +saveBar();
}

/* karşılama */
function cizKarsilama(c){
  const say=(...ks)=>ks.filter((k)=>!!FORM[k]).length;
  const nKars=say('hosgeldinAt','girisDMAt','girisEtiket','cikisAt','otoRolAktif');
  const nDavet=say('davetGirisAt','davetCikisAt','davetRolu');
  const nTakma=say('takmaTemizle','yeniIsimAktif','isimFiltre');
  const tabs=[
    {id:'karsilama',icon:'💬',ad:'Karşılama ve veda',alt:nKars+'/5 etkin'},
    {id:'davet',icon:'🔗',ad:'Davet takibi',alt:nDavet+'/3 etkin'},
    {id:'takma',icon:'▤',ad:'Takma ad araçları',alt:nTakma+'/3 etkin'},
  ];
  let sag='';
  if(GREET==='karsilama')sag=karsilamaSag();
  else if(GREET==='davet')sag=davetSag();
  else sag=takmaSag();
  c.innerHTML='<div class="page-h">Karşılama & Veda</div><div class="page-s">Yeni üyeleri karşılayın, ayrılanları takip edin</div>'
    +'<div class="greet-wrap"><div class="greet-side"><h3>👋 Karşılama özellikleri</h3><p>Ayarlarını açmak için aşağıdan bir özellik grubu seçin.</p>'
    +'<div class="g-count"><span>3 özellik grubu</span><b>'+(nKars+nDavet+nTakma)+'/11 etkin</b></div>'
    +tabs.map(t=>'<button class="g-opt'+(GREET===t.id?' secil':'')+'" onclick="GREET=\''+t.id+'\';renderContent()"><div class="t"><span class="mi">'+t.icon+'</span>'+t.ad+'</div><div class="b"><span>'+t.alt+'</span><span>'+(GREET===t.id?'👁 Seçili':'⚙ Ayarları aç ›')+'</span></div></button>').join('')
    +'</div><div>'+sag+'</div></div>'+saveBar();
}
function karsilamaSag(){
  const f=FORM;
  return '<div class="panel"><div class="panel-top"><div><h3>Otomatik rol</h3><p>Sunucuya üye katıldığında belirlediğiniz roller verilir</p></div><label class="tgl"><input type="checkbox" data-k="otoRolAktif"'+(f.otoRolAktif?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Verilecek roller</label><select data-k="otoRol">'+secenek('rol',f.otoRol,'Rol seçin')+'</select></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Üye katılınca kanala mesaj at</h3><p>Sunucuya üye katıldığında belirlediğiniz kanala mesaj atar</p></div><label class="tgl"><input type="checkbox" data-k="hosgeldinAt"'+(f.hosgeldinAt?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Kanal</label><select data-k="hosgeldinKanal">'+secenek('yazi',f.hosgeldinKanal,'Bir kanal seçin')+'</select></div>'
    +'<div class="field"><label>Mesaj</label><textarea data-k="hosgeldinMesaj" placeholder="Mesaj">'+esc(f.hosgeldinMesaj||'')+'</textarea><div class="chip-row"><button class="chip" onclick="chipEkle(\'hosgeldinMesaj\',\'{kullanıcı}\')">Kullanıcıyı etiketle</button><button class="chip" onclick="chipEkle(\'hosgeldinMesaj\',\'{ad}\')">Kullanıcı adı</button><button class="chip" onclick="chipEkle(\'hosgeldinMesaj\',\'{üye}\')">Üye sayısı</button><button class="chip" onclick="chipEkle(\'hosgeldinMesaj\',\'{sunucu}\')">Sunucu adı</button></div></div>'
    +'<div class="field" style="display:flex;gap:10px;align-items:center"><label class="tgl sm"><input type="checkbox" data-k="hosgeldinResim"'+(f.hosgeldinResim?' checked':'')+'><span class="ray"></span></label><span style="font-size:13px;color:var(--mut)">Üye katılınca resim at</span></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Üye katılınca özel mesaj at 👑</h3><p>Sunucuya üye katıldığında kullanıcıya özel mesaj atar</p></div><label class="tgl"><input type="checkbox" data-k="girisDMAt"'+(f.girisDMAt?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Mesaj</label><textarea data-k="girisDM" placeholder="Mesaj">'+esc(f.girisDM||'')+'</textarea></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Giriş Etiketi</h3><p>Yeni üyeyi seçilen kanallarda etiketler ve mesajı hemen siler</p></div><label class="tgl"><input type="checkbox" data-k="girisEtiket"'+(f.girisEtiket?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Giriş etiketi kanalları</label><select onchange="kanalCokluEkle(\'girisEtiketKanal\',this)">'+secenek('yazi','','Kanal seçin')+'</select><div style="margin-top:8px;font-size:12.5px;color:var(--mut)">'+((f.girisEtiketKanal||[]).map(kanalAd).join(', ')||'Seçim yok')+'</div></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Üye ayrılınca kanala mesaj at</h3><p>Sunucudan üye ayrıldığında belirlediğiniz kanala mesaj atar</p></div><label class="tgl"><input type="checkbox" data-k="cikisAt"'+(f.cikisAt?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Kanal</label><select data-k="cikisKanal">'+secenek('yazi',f.cikisKanal,'Bir kanal seçin')+'</select></div>'
    +'<div class="field"><label>Mesaj</label><textarea data-k="cikisMesaj" placeholder="Mesaj">'+esc(f.cikisMesaj||'')+'</textarea></div></div>';
}
function davetSag(){
  const f=FORM;
  return '<div class="panel"><div class="panel-top"><div><h3>🔗 Davet takibi</h3><p>Davet hareketlerini, mesajları ve ödül rollerini takip edin.</p></div></div>'
    +'<div class="chip-row"><span class="chip">/davetler</span><span class="chip">/davettop</span><span class="chip">/davetyönet</span></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Davet katılma mesajı</h3><p>Yeni üye yalnızca bir davetle eşleştirildiğinde gönderilir.</p></div><label class="tgl"><input type="checkbox" data-k="davetGirisAt"'+(f.davetGirisAt?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Kanal</label><select data-k="davetKanal">'+secenek('yazi',f.davetKanal,'Bir kanal seçin')+'</select></div>'
    +'<div class="field"><label>Mesaj</label><textarea data-k="davetGirisMesaj">'+esc(f.davetGirisMesaj||'{davet eden} adlı üye {yeni üye} adlı üyeyi sunucuya davet etti.')+'</textarea><div class="chip-row"><span class="chip">Net davet</span><span class="chip">Toplam davet</span><span class="chip">Davet eden etiketi</span><span class="chip">Davet eden kullanıcı adı</span><span class="chip">Yeni üye etiketi</span><span class="chip">Yeni üye kullanıcı adı</span><span class="chip">Davet kodu</span></div></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Davet ayrılma mesajı</h3><p>Takip edilen davetli bir üye ayrıldığında gönderilir.</p></div><label class="tgl"><input type="checkbox" data-k="davetCikisAt"'+(f.davetCikisAt?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Kanal</label><select data-k="davetCikisKanal">'+secenek('yazi',f.davetCikisKanal,'Bir kanal seçin')+'</select></div>'
    +'<div class="field"><label>Mesaj</label><textarea data-k="davetCikisMesaj">'+esc(f.davetCikisMesaj||'{davet eden} tarafından davet edilen {ayrılan} sunucudan ayrıldı.')+'</textarea></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Davet Rolleri 👑</h3><p>Üyenin net davet sayısına göre rol verir.</p></div><label class="tgl"><input type="checkbox" data-k="davetRolu"'+(f.davetRolu?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="warn yel">👑 Premium ile belirli davete ulaşan üyelerinize roller ekletebilirsiniz.</div>'
    +'<div class="field"><label>Ödül davranışı</label><select><option>Kazanılan rolleri biriktir</option><option>En yüksek rolü ver</option></select></div></div>';
}
function takmaSag(){
  const f=FORM;
  return '<div class="panel"><div class="panel-top"><div><h3>Takma ad araçları</h3><p>Yeni üye adlarını standartlaştırın ve güvenli olmayan adları filtreleyin.</p></div></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Takma adları temizle</h3><p>Takma adlardan alfabe dışı karakterleri siler</p></div><label class="tgl"><input type="checkbox" data-k="takmaTemizle"'+(f.takmaTemizle?' checked':'')+'><span class="ray"></span></label></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Yeni üye ismi</h3><p>Kullanıcıların ismini belirttiğiniz şekilde değiştirir</p></div><label class="tgl"><input type="checkbox" data-k="yeniIsimAktif"'+(f.yeniIsimAktif?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>İsim</label><input type="text" data-k="yeniIsimSablon" placeholder="İsim" value="'+esc(f.yeniIsimSablon||'')+'"><div class="chip-row"><span class="chip">Kullanıcı adı</span></div></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>İsim filtresi</h3><p>Takma adı belirttiğiniz kelimeleri içeren üyeleri yasaklar</p></div><label class="tgl"><input type="checkbox" data-k="isimFiltre"'+(f.isimFiltre?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field" style="display:flex;gap:10px;align-items:center"><label class="tgl sm"><input type="checkbox" data-k="isimFiltreBaglanti"'+(f.isimFiltreBaglanti?' checked':'')+'><span class="ray"></span></label><span style="font-size:13px;color:var(--mut)">Bağlantıları filtrele</span></div>'
    +'<div class="field"><label>Kelime listesi</label><input type="text" id="isimKelime" placeholder="Bir kelime yazıp Enter tuşuna basın" onkeydown="if(event.key===\'Enter\'){isimKelimeEkle(this.value);this.value=\'\'}"><div class="chip-row">'+((f.isimKelimeler||[]).map(w=>'<span class="chip">'+esc(w)+'</span>').join(''))+'</div></div></div>';
}
function chipEkle(key,kod){
  const ta=document.querySelector('[data-k="'+key+'"]');
  if(!ta)return;ta.value=(ta.value?ta.value+' ':'')+kod;ta.focus();
}
function kanalCokluEkle(key,sel){
  domKaydet();
  if(!sel.value)return;
  if(!Array.isArray(FORM[key]))FORM[key]=[];
  if(!FORM[key].includes(sel.value))FORM[key].push(sel.value);
  renderContent();
}
function isimKelimeEkle(w){
  domKaydet();
  w=(w||'').trim();if(!w)return;
  if(!Array.isArray(FORM.isimKelimeler))FORM.isimKelimeler=[];
  FORM.isimKelimeler.push(w);renderContent();
}

/* destek / ticket */
function cizDestek(c){
  const f=FORM;
  c.innerHTML='<div class="page-h">Destek / Ticket</div><div class="page-s">Ticket destek rolünü ve kategoriyi yönetin, paneli buradan tek tıkla gönderin (Açık ticket: Free 1 • 👑 Premium 3)</div>'
  +'<div class="panel"><div class="panel-top"><div><h3>🎫 Destek ekibi rolü</h3><p>Ticketları devralabilecek, bekletebilecek rol. Boşsa sadece Yönetici/Moderatör yetkisi geçer.</p></div></div>'
  +'<div class="field"><label>Destek rolü</label><select data-k="ticketDestekRol">'+secenek('rol',f.ticketDestekRol,'Seçilmedi')+'</select></div></div>'
  +'<div class="panel"><div class="panel-top"><div><h3>📁 Ticket kategori ID</h3><p>Ticket kanallarının açılacağı kategori. Boşsa bot 🎫-DESTEK kategorisini kullanır. Kategori ID\'sini Discord\'da sağ tık → ID Kopyala ile alın.</p></div></div>'
  +'<div class="field"><label>Kategori ID</label><input type="text" data-k="ticketKategori" placeholder="örn: 123456789012345678" value="'+esc(f.ticketKategori||'')+'" style="max-width:280px"></div></div>'
  +'<div class="panel"><div class="panel-top"><div><h3>⏰ Oto-kapatma</h3><p>Belirttiğin gün yazılmayan ticket bot tarafından otomatik kapatılır (konuşma kaydı loga + puan DM\'i gider). 0 = kapalı.</p></div></div>'
  +'<div class="field"><label>Gün (0-30, 0=kapalı)</label><input type="number" data-k="ticketOtoKapat" value="'+(f.ticketOtoKapat??0)+'" style="max-width:140px"></div></div>'
  +'<div class="panel"><div class="panel-top"><div><h3>📢 Ticket panelini gönder</h3><p>Seçtiğin kanala menülü destek panelini anında gönderir (kategori + rol otomatik bağlanır).</p></div></div>'
  +'<div class="field"><label>Panel kanalı</label><select id="ticket-panel-kanal">'+secenek('yazi','','Seçin')+'</select></div>'
  +'<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri sm" onclick="ticketPanelKur()">📢 Paneli Gönder</button></div>'
  +'<div class="hint" style="margin-top:8px">Önce yukarıdan Destek rolünü seçip Kaydet yap, sonra panel kanalını seçip bu butona bas.</div></div>'
  +'<div class="panel"><div class="panel-top"><div><h3>⚙️ Komutlar</h3><p>Panel kurulumu ve ticket işlemleri — prefix ve slash ikisi de çalışır.</p></div></div>'
  +'<div class="field"><label>Kurulum</label><div class="hint">/ticket kur kanal:#destek rol:@Destek — veya — !ticket-kur #destek @Destek</div></div>'
  +'<div class="field"><label>İşlemler</label><div class="hint">/ticket kapat/devral/devret/beklet/ac/oncelik/istatistik/ekle👑/cikar — veya — !ticket-kapat !ticket-devral !ticket-devret !ticket-beklet !ticket-ac !ticket-oncelik !ticket-istatistik !ticket-ekle👑 !ticket-cikar<br>Ticket içindeki butonlar: Devral • Beklet/Geri Aç • Kapat • 🔄 Devret • ⚡ Öncelik • ➕ Ekle👑<br>Kapanınca kullanıcıya DM ile 1-5 yıldız puanı sorulur, sonuçlar !ticket-istatistik ile görülür.<br>Konular: Genel, Şikayet, Partner, Öneri, Yetkili Alım, Özel + Aciliyet: Normal/Acele/Acil. Kapatınca konuşma kaydı .txt olarak loga gider.<br>👑 Ticketa kullanıcı ekleme PREMIUM sunuculara özeldir.</div></div></div>'
  +saveBar();
}
async function ticketPanelKur(){
  domKaydet();
  const kanal=document.getElementById('ticket-panel-kanal')?.value;
  if(!kanal){toast('Panel kanalı seç!');return}
  try{
    const j=await api('/api/ticket-panel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID,kanalId:kanal,rolId:FORM.ticketDestekRol||null})});
    if(j.ok)toast('Panel gönderildi!');
    else toast(hataMesaj(j,'Panel gönderilemedi!'));
  }catch{toast('Bota ulaşılamadı! Bot çalışıyor mu?')}
}

/* medya yükle */
function cizMedya(c){
  c.innerHTML='<div class="page-h">Medya Yükle</div><div class="page-s">Sunucuya toplu emoji ve sticker yükleyin (butonla tek tık)</div>'
  +'<div class="panel"><div class="panel-top"><div><h3>🎨 Yüklenecek dosyalar</h3><p>Emoji en fazla 256KB, sticker en fazla 512KB. En fazla 10 dosya. PNG/JPG/GIF/WEBP.</p></div></div>'
  +'<div class="field"><label>Tür</label><select id="medya-tip"><option value="emoji">😀 Emoji</option><option value="sticker">🌟 Sticker</option></select></div>'
  +'<div class="field"><label>Dosya seç</label><input type="file" id="medya-dosya" multiple accept="image/png,image/jpeg,image/gif,image/webp"></div>'
  +'<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri sm" onclick="medyaYukle()">⬆️ Yükle</button></div>'
  +'<div class="hint" id="medya-durum" style="margin-top:8px"></div></div>'+saveBar();
}
function medyaDosyaOku(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res({ad:(file.name||'medya').split('.')[0],data:String(r.result||'')});
    r.onerror=()=>rej(new Error('okunamadi'));
    r.readAsDataURL(file);
  });
}
async function medyaYukle(){
  const tip=document.getElementById('medya-tip')?.value||'emoji';
  const input=document.getElementById('medya-dosya');
  const durum=document.getElementById('medya-durum');
  const files=[...(input?.files||[])].slice(0,10);
  if(!files.length){toast('Dosya seç!');return}
  if(durum)durum.textContent='Okunuyor...';
  try{
    const dosyalar=[];
    for(const f of files){dosyalar.push(await medyaDosyaOku(f));}
    if(durum)durum.textContent='Yükleniyor...';
    const j=await api('/api/medya-yukle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID,tip,dosyalar})});
    const ok=(j.sonuc||[]).filter(x=>x.ok).length;
    const toplam=(j.sonuc||[]).length;
    if(durum)durum.textContent=ok+'/'+toplam+' yüklendi!';
    toast(ok+'/'+toplam+' medya yüklendi!');
  }catch{toast('Bota ulaşılamadı! Bot çalışıyor mu?');if(durum)durum.textContent='Hata!'}
}

/* otomod */
function amGet(k){return FORM[k]||{}}
function cizOtomod(c){
  c.innerHTML='<div class="page-h">Otomatik Moderasyon</div><div class="page-s">Sunucu moderasyonunu otomatikleştirin</div>'
    +'<div class="grid3">'+AM_LIST.map(a=>{
      const v=amGet(a.k);const ac=v.enabled;
      return '<div class="am-card"><div style="display:flex;justify-content:space-between;align-items:center"><h3>'+a.ad+'</h3><label class="tgl sm"><input type="checkbox" '+(ac?'checked':'')+' onchange="amToggle(\''+a.k+'\',this.checked)"><span class="ray"></span></label></div><p>'+a.ac+'</p>'
      +'<div class="am-foot"><span class="am-stat">'+(ac?'Etkin':'Devre dışı')+'</span><button class="btn sm" onclick="amModal(\''+a.k+'\')">⚙ Ayarlar</button></div></div>';
    }).join('')+'</div>'+saveBar();
}
function amToggle(k,on){
  const v=amGet(k);v.enabled=on;FORM[k]=v;renderContent();
}
function amModal(k){
  const a=AM_LIST.find(x=>x.k===k);const v=Object.assign({mesajSil:true,zamanAsimi:false,sunucudanAt:false,yasakla:false,muafKanal:[],muafRol:[],uyari:3,limit:a.varsayilan||'',kelimeler:[]},amGet(k));
  let ekstra='';
  if(a.kelime)ekstra+='<div class="field"><label>Engellenen kelimeler (virgülle ayırın)</label><input type="text" id="m-kelimeler" value="'+esc((v.kelimeler||[]).join(', '))+'"></div>';
  if(a.adet)ekstra+='<div class="field"><label>Sınır (adet / satır / karakter)</label><input type="number" id="m-limit" value="'+esc(v.limit||a.varsayilan||'')+'"></div>';
  if(a.flood)ekstra+='<div class="field"><div class="row3"><div><label>Süre (sn)</label><input type="number" id="m-sure" value="'+esc(v.sure||10)+'"></div><div><label>Mesaj sayısı</label><input type="number" id="m-limit" value="'+esc(v.limit||5)+'"></div><div><label>Uyarı sınırı</label><input type="number" id="m-uyari" value="'+esc(v.uyari||3)+'"></div></div></div>';
  else ekstra+='<div class="field"><label>Uyarı sınırı (kaç ihlalde ceza uygulansın)</label><input type="number" id="m-uyari" value="'+esc(v.uyari||3)+'"></div>';
  if(a.yuzde)ekstra+='<div class="field"><label>Büyük harf oranı (%)</label><input type="number" id="m-limit" value="'+esc(v.limit||70)+'"></div>';
  document.getElementById('modal-root').innerHTML='<div class="pmodal-bg" onclick="if(event.target===this)modalKapat()"><div class="pmodal"><div class="modal-h"><span>'+a.ad+'</span><button onclick="modalKapat()">✕</button></div><div class="modal-b">'
    +'<div class="set-row"><span><b>Mesajı sil</b><p>Her AutoMod ihlalinde her zaman etkindir.</p></span><label class="tgl"><input type="checkbox" id="m-sil"'+(v.mesajSil!==false?' checked':'')+'><span class="ray green"></span></label></div>'
    +'<div class="set-row"><span><b>Zaman aşımı</b><p>Belirlenen uyarı sayısından sonra üyenin etkileşimini geçici olarak engeller.</p></span><label class="tgl"><input type="checkbox" id="m-timeout"'+(v.zamanAsimi?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="set-row"><span><b>Sunucudan at</b><p>Belirlenen uyarı sayısından sonra üyeyi sunucudan çıkarır.</p></span><label class="tgl"><input type="checkbox" id="m-kick"'+(v.sunucudanAt?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="set-row"><span><b>Yasakla</b><p>Belirlenen uyarı sayısından sonra üyeyi yasaklar.</p></span><label class="tgl"><input type="checkbox" id="m-ban"'+(v.yasakla?' checked':'')+'><span class="ray"></span></label></div>'
    +ekstra
    +'<div class="field"><label>Etkilenmeyen kanallar</label><select id="m-kanal" onchange="mEkle(\''+k+'\',\'muafKanal\',this.value);this.value=\'\'">'+secenek('yazi','','Kanal seçin')+'</select><div class="chip-row">'+(v.muafKanal||[]).map(id=>'<span class="chip">'+esc(kanalAd(id))+'</span>').join('')+'</div></div>'
    +'<div class="field"><label>Etkilenmeyen roller</label><select id="m-rol" onchange="mEkle(\''+k+'\',\'muafRol\',this.value);this.value=\'\'">'+secenek('rol','','Rol seçin')+'</select><div class="chip-row">'+(v.muafRol||[]).map(id=>'<span class="chip">'+esc(rolAd(id))+'</span>').join('')+'</div></div>'
    +'<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px"><button class="btn" onclick="modalKapat()">Kapat</button><button class="btn pri" onclick="amKaydet(\''+k+'\')">Kaydet</button></div>'
    +'</div></div></div>';
}
function modalOku(k){
  const v=Object.assign({},amGet(k));
  const al=(id)=>document.getElementById(id);
  if(al('m-sil'))v.mesajSil=al('m-sil').checked;
  if(al('m-timeout'))v.zamanAsimi=al('m-timeout').checked;
  if(al('m-kick'))v.sunucudanAt=al('m-kick').checked;
  if(al('m-ban'))v.yasakla=al('m-ban').checked;
  if(al('m-uyari'))v.uyari=parseInt(al('m-uyari').value,10)||3;
  if(al('m-limit'))v.limit=parseInt(al('m-limit').value,10)||'';
  if(al('m-sure'))v.sure=parseInt(al('m-sure').value,10)||10;
  if(al('m-kelimeler'))v.kelimeler=al('m-kelimeler').value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,50);
  FORM[k]=v;return v;
}
function mEkle(k,alan,id){
  if(!id)return;const v=modalOku(k);if(!Array.isArray(v[alan]))v[alan]=[];
  if(!v[alan].includes(id))v[alan].push(id);FORM[k]=v;amModal(k);
}
function amKaydet(k){
  const v=modalOku(k);
  v.enabled=true;FORM[k]=v;modalKapat();renderContent();toast('Ayarlandı — Kaydetmeyi unutma');
}
function modalKapat(){document.getElementById('modal-root').innerHTML=''}

/* denetim */
const LOG_GRUP=[
  {ad:'Üye',items:[['uyeKatildi','Üye katıldı'],['uyeAyrildi','Üye ayrıldı'],['uyeSes','Üye ses aktivitesi'],['uyeAd','Kullanıcı adı güncellendi'],['uyeRol','Üye rolleri güncellendi'],['uyeSus','Üye susturuldu'],['uyeYasak','Üye yasaklandı'],['uyeYasakKaldir','Üye yasağı kaldırıldı']]},
  {ad:'Moderatör',items:[['modSus','Üye susturuldu'],['modSusKaldir','Üye susturması kaldırıldı'],['modYasak','Üye yasaklandı'],['modYasakKaldir','Üye yasağı kaldırıldı'],['modAt','Üye atıldı'],['modAuto','Otomatik moderasyon']]},
  {ad:'Mesaj',items:[['mesajGuncelle','Mesaj güncellendi'],['mesajSil','Mesaj silindi']]},
];
const LOG_GRUP2=[
  {ad:'Sunucu',items:[['sunucuGuncelle','Sunucu güncellendi'],['emojiOlustur','Emoji oluşturuldu'],['emojiGuncelle','Emoji güncellendi'],['emojiSil','Emoji silindi']]},
  {ad:'Kanal',items:[['kanalOlustur','Kanal oluşturuldu'],['kanalGuncelle','Kanal güncellendi'],['kanalSil','Kanal silindi']]},
  {ad:'Rol',items:[['rolOlustur','Rol oluşturuldu'],['rolGuncelle','Rol güncellendi'],['rolSil','Rol silindi']]},
];
function cizDenetim(c){
  if(!FORM.logOlaylar||typeof FORM.logOlaylar!=='object')FORM.logOlaylar={};
  const t=(k,ad)=>'<div class="log-item"><label class="tgl sm"><input type="checkbox" data-log="'+k+'"'+(FORM.logOlaylar[k]?' checked':'')+'><span class="ray"></span></label>'+ad+'</div>';
  c.innerHTML='<div class="page-h">Denetim Kaydı</div><div class="page-s">Sunucunuzda olup bitenlerin kaydını tutar</div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Denetim Kaydı</h3><p>Sunucunuzda olup bitenlerin kaydını tutar</p></div><label class="tgl"><input type="checkbox" data-k="logAktif"'+(FORM.logAktif?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Ana log kanalı</label><select data-k="logKanal">'+secenek('yazi',FORM.logKanal||FORM.guvenlikKanal,'Bir kanal seçin')+'</select></div></div>'
    +'<div class="log-grid">'+LOG_GRUP.map(g=>'<div><div class="log-sec">'+g.ad+'</div>'+g.items.map(x=>t(x[0],x[1])).join('')+'</div>').join('')+'</div>'
    +'<div class="hr"></div><div class="log-grid">'+LOG_GRUP2.map(g=>'<div><div class="log-sec">'+g.ad+'</div>'+g.items.map(x=>t(x[0],x[1])).join('')+'</div>').join('')+'</div>'
    +saveBar();
  document.querySelectorAll('[data-log]').forEach(el=>{el.addEventListener('change',()=>{FORM.logOlaylar[el.dataset.log]=el.checked})});
}

/* gömülü */
function cizGomulu(c){
  const liste=Array.isArray(FORM.gomuluMesajlar)?FORM.gomuluMesajlar:[];
  c.innerHTML='<div class="page-h">Gömülü Mesajlar</div><div class="page-s">Sunucunuzdaki gömülü mesajları yönetin (Free 5 • 👑 Premium 25)</div>'
    +'<div class="panel">'
    +'<div class="kv-list">'+(liste.length?liste.map((g,i)=>'<div class="liste-satir"><span><b>'+esc(g.baslik||('Mesaj '+(i+1)))+'</b> <span style="color:var(--mut)">'+esc(kanalAd(g.kanal))+'</span></span><span style="display:flex;gap:6px"><button class="btn sm" onclick="gomuluGonder('+i+')">Gönder</button><button class="btn sm" onclick="gomuluDuzenle('+i+')">Düzenle</button><button class="btn sm" onclick="gomuluSil('+i+')">Sil</button></span></div>').join(''):'<div class="bos">Henüz gömülü mesaj yok — aşağıdan oluştur.</div>')+'</div>'
    +'<div class="field"><button class="btn pri" style="width:100%;justify-content:space-between" onclick="gomuluDuzenle(-1)">Yeni gömülü mesaj <span style="font-size:18px">+</span></button></div>'
    +'</div>'+saveBar();
}
const RENKLER=['#8b7cf6','#5865F2','#57F287','#FEE75C','#EB459E','#ED4245','#E67E22','#1ABC9C','#9B59B6','#2C2F33','#ffffff','#000000'];
let G_RENK='#8b7cf6';
function normRenk(r){r=String(r||'').trim();if(/^#[0-9a-f]{6}$/i.test(r))return r;if(/^[0-9a-f]{6}$/i.test(r))return '#'+r;return '#8b7cf6'}
function renkSec(r){
  G_RENK=normRenk(r);
  document.querySelectorAll('#g-renkler .renk').forEach(el=>el.classList.toggle('secil',el.title.toLowerCase()===G_RENK.toLowerCase()));
  const h=document.getElementById('g-hex');if(h&&h.value.toLowerCase()!==G_RENK.toLowerCase())h.value=G_RENK;
  const ta=document.getElementById('g-acik');if(ta)ta.dispatchEvent(new Event('input'));
}
let GOMULU_IDX=-1;
function gomuluDuzenle(i){
  if(!Array.isArray(FORM.gomuluMesajlar))FORM.gomuluMesajlar=[];
  GOMULU_IDX=i;G_RENK=normRenk((i>=0&&FORM.gomuluMesajlar[i]||{}).renk);
  const g=i>=0?FORM.gomuluMesajlar[i]:{baslik:'',aciklama:'',kanal:'',renk:'#8b7cf6'};
  document.getElementById('modal-root').innerHTML='<div class="pmodal-bg" onclick="if(event.target===this)modalKapat()"><div class="pmodal"><div class="modal-h"><span>'+(i>=0?'Gömülü mesajı düzenle':'Yeni gömülü mesaj')+'</span><button onclick="modalKapat()">✕</button></div><div class="modal-b">'
    +'<div class="field"><label>Kanal</label><select id="g-kanal">'+secenek('yazi',g.kanal,'Bir kanal seçin')+'</select></div>'
    +'<div class="field"><label>Başlık</label><input type="text" id="g-baslik" maxlength="100" placeholder="Duyuru" value="'+esc(g.baslik||'')+'"></div>'
    +'<div class="field"><label>Mesaj</label><div class="chip-row" style="margin:0 0 8px"><span class="chip" onclick="gDegisken(\'{kullanıcı}\')">{kullanıcı}</span><span class="chip" onclick="gDegisken(\'{sunucu}\')">{sunucu}</span><span class="chip" onclick="gDegisken(\'{üye}\')">{üye}</span></div><textarea id="g-acik" rows="4" placeholder="Mesaj içeriği — link de ekleyebilirsin">'+esc(g.aciklama||'')+'</textarea></div>'
    +'<div class="field"><label>Renk</label><div class="renk-row" id="g-renkler">'+RENKLER.map(r=>'<button class="renk'+(normRenk(g.renk)===r?' secil':'')+'" style="background:'+r+'" onclick="renkSec(\''+r+'\')" title="'+r+'"></button>').join('')+'<input type="text" id="g-hex" class="renk-hex" maxlength="7" value="'+normRenk(g.renk)+'" onkeydown="if(event.key===\'Enter\'){renkSec(this.value)}" title="#rrggbb"></div></div>'
    +'<div class="onizleme-kutu"><div class="onizleme-baslik">ÖNİZLEME</div><div class="onizleme-mesaj" id="g-oniz"></div></div>'
    +'<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn" onclick="modalKapat()">İptal</button><button class="btn" onclick="gomuluTaslak()">Taslak Kaydet</button><button class="btn pri" onclick="gomuluGonderModal()">Gönder</button></div></div></div></div>';
  const ta=document.getElementById('g-acik');
  const guncelle=()=>{
    const kutu=document.getElementById('g-oniz');if(!kutu)return;
    let m=ta.value||'...';
    m=m.replace(/</g,'&lt;').replace(/\n/g,'<br>');
    const mm=m.match(/(https?:\/\/\S+)/);
    kutu.innerHTML='<b>'+esc(document.getElementById('g-baslik').value||'Duyuru')+'</b><p>'+m+'</p>'+(mm?'<p><a href="'+mm[1]+'" target="_blank" style="color:var(--acc)">'+mm[1].slice(0,60)+'</a></p>':'');
    kutu.style.borderLeft='3px solid '+G_RENK;
  };
  ta.addEventListener('input',guncelle);
  document.getElementById('g-baslik').addEventListener('input',guncelle);
  guncelle();ta.focus();
}
function gDegisken(kod){
  const ta=document.getElementById('g-acik');if(!ta)return;
  ta.value+=(ta.value?' ':'')+kod;ta.focus();
  ta.dispatchEvent(new Event('input'));
}
function gOku(){
  return {
    baslik:document.getElementById('g-baslik').value.trim().slice(0,100),
    aciklama:document.getElementById('g-acik').value.trim().slice(0,1500),
    kanal:document.getElementById('g-kanal').value||null,
    renk:G_RENK,
  };
}
async function gomuluTaslak(){
  const v=gOku();
  if(!v.aciklama){toast('Açıklama yaz');return}
  if(GOMULU_IDX>=0)FORM.gomuluMesajlar[GOMULU_IDX]=v;
  else {
    if(!PREMIUM_AKTIF&&FORM.gomuluMesajlar.length>=5){toast('👑 Free en fazla 5 gömülü mesaj! Premium ile 25.');return}
    FORM.gomuluMesajlar.push(v);
  }
  await kaydet('Taslak kaydedildi!');
  modalKapat();renderContent();
}
async function gomuluGonderModal(){
  const v=gOku();
  if(!v.aciklama){toast('Açıklama yaz');return}
  if(!v.kanal){toast('Kanal seç');return}
  try{
    const j=await api('/api/embed-gonder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID,...v})});
    if(j.ok){toast('Gönderildi!');modalKapat()}
    else toast(hataMesaj(j,'Gönderilemedi!'));
  }catch{toast('Gönderilemedi!')}
}
async function gomuluGonder(i){
  const g=FORM.gomuluMesajlar[i];if(!g)return;
  if(!g.kanal){toast('Önce düzenleyip kanal seç');gomuluDuzenle(i);return}
  try{
    const j=await api('/api/embed-gonder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID,...g})});
    toast(j.ok?'Gönderildi!':hataMesaj(j,'Gönderilemedi!'));
  }catch{toast('Gönderilemedi!')}
}
function gomuluSil(i){domKaydet();FORM.gomuluMesajlar.splice(i,1);renderContent()}

/* oto cevap */
async function cizOtoCevap(c){
  c.innerHTML='<div class="page-h">Otomatik Cevap</div><div class="page-s">Mesaj tetiklemelerini yönetin</div><div class="panel"><div id="oc-liste"><div class="bos">Yükleniyor...</div></div>'
    +'<div class="hr"></div><div class="row3"><div><label>Tetik kelime</label><input type="text" id="oc-tetik" maxlength="50"></div><div><label>Bot cevabı</label><input type="text" id="oc-cevap" maxlength="200"></div><div><label>&nbsp;</label><button class="btn pri" onclick="ocEkle()">Ekle</button></div></div></div>'+saveBar();
  try{
    const j=await api('/api/liste/'+SID);
    const l=j.otoCevap||[];
    document.getElementById('oc-liste').innerHTML=l.length?l.map(x=>'<div class="liste-satir"><span><b>'+esc(x.tetik)+'</b> → '+esc(x.cevap.slice(0,80))+'</span><button class="btn sm" onclick="ocSil(\''+esc(x.tetik).replace(/'/g,"\\'")+'\')">Sil</button></div>').join(''):'<div class="bos">Kayıt yok.</div>';
  }catch{document.getElementById('oc-liste').innerHTML='<div class="bos">Yüklenemedi.</div>'}
}
async function ocEkle(){
  const t=document.getElementById('oc-tetik').value,cv=document.getElementById('oc-cevap').value;
  if(!t.trim()||!cv.trim()){toast('Eksik alan');return}
  await api('/api/liste',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID,liste:'otoCevap',tetik:t,cevap:cv})});
  toast('Eklendi');renderContent();
}
async function ocSil(t){
  await api('/api/liste',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID,liste:'otoCevap',islem:'sil',tetik:t})});
  toast('Silindi');renderContent();
}

/* emoji rol */
function erMesajId(url){
  const m=String(url||'').match(/(\d{17,22})\s*$/);
  return m?m[1]:String(url||'').trim();
}
function cizEmojiRol(c){
  const liste=Array.isArray(FORM.emojiRoller)?FORM.emojiRoller:[];
  c.innerHTML='<div class="page-h">Emoji Rol</div><div class="page-s">Üyelerin mesajlara tepki vererek rol almasını sağlar (Free 5 • 👑 Premium 20)</div>'
    +'<div class="panel"><div class="row3"><div><label>Kanal</label><select id="er-kanal">'+secenek('yazi','','Seçin')+'</select></div><div><label>Emoji</label><input type="text" id="er-emoji" placeholder="😀"></div><div><label>Rol</label><select id="er-rol">'+secenek('rol','','Seçin')+'</select></div></div>'
    +'<div class="field"><label>Mesaj (ID veya mesaj bağlantısı — bot tepkiyi bu mesajın altına koyar)</label><input type="text" id="er-mesaj" placeholder="örn: 123456789012345678"></div>'
    +'<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri sm" onclick="erEkle()">+ Ekle</button><button class="btn sm" onclick="erTepkiTumu()">Tümüne Tepki Koy</button></div>'
    +'<div style="margin-top:14px">'+(liste.length?liste.map((x,i)=>'<div class="liste-satir"><span>✅ '+esc(x.emoji)+' → '+esc(rolAd(x.rol))+' <span style="color:var(--mut)">'+esc(kanalAd(x.kanal))+(x.mesajId?' • '+esc(x.mesajId):'')+'</span></span><span style="display:flex;gap:6px"><button class="btn sm" onclick="erTepki('+i+')">Tepkiyi Koy</button><button class="btn sm" onclick="erSil('+i+')">Sil</button></span></div>').join(''):'<div class="bos">Kayıt yok.</div>')+'</div></div>'+saveBar();
}
async function erEkle(){
  domKaydet();
  const k=document.getElementById('er-kanal').value,e=document.getElementById('er-emoji').value.trim(),r=document.getElementById('er-rol').value;
  const m=erMesajId(document.getElementById('er-mesaj').value);
  if(!e||!r){toast('Emoji ve rol gerekli');return}
  if(!m){toast('Mesaj ID gerekli');return}
  if(!Array.isArray(FORM.emojiRoller))FORM.emojiRoller=[];
  if(!PREMIUM_AKTIF&&FORM.emojiRoller.length>=5){toast('👑 Free en fazla 5 emoji-rol! Premium ile 20.');return}
  FORM.emojiRoller.push({kanal:k||null,mesajId:m,emoji:e.slice(0,40),rol:r});
  await kaydet('Eklendi! Tepki konuluyor...');
  erTepki(FORM.emojiRoller.length-1,true);
}
function erSil(i){domKaydet();FORM.emojiRoller.splice(i,1);renderContent()}
async function erTepki(i,sessiz){
  try{
    const j=await api('/api/emojirol-tepki',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID,index:i})});
    const s=(j.sonuc||[])[0];
    if(s&&s.ok)toast('Tepki konuldu!');
    else if(!sessiz)toast(hataMesaj(j,'Tepki konulamadı!'));
  }catch{ if(!sessiz)toast('Bota ulaşılamadı! Bot çalışıyor mu?'); }
}
async function erTepkiTumu(){
  try{
    const j=await api('/api/emojirol-tepki',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID})});
    const ok=(j.sonuc||[]).filter(x=>x.ok).length;
    toast(ok+'/'+((j.sonuc||[]).length)+' mesaja tepki konuldu!');
  }catch{toast('Olmadı! Önce Kaydet yap.')}
}

/* etiket */
async function cizEtiket(c){
  if(!PREMIUM_AKTIF){ c.innerHTML='<div class="page-h">Sunucu Etiketi \u{1F451}</div><div class="page-s">Etiket alan \u00FCyelere otomatik rol</div><div class="panel prem-lock-wrap"><div class="prem-lock"><div class="prem-lock-ic">\u{1F451}</div><b>Premium \u0130\u00E7erikli \u00D6zellik</b><p>Etiket rol\u00FC premium sunuculara \u00F6zel. Bu sunucuda premium yok.</p><button class="btn pri sm" onclick="git(\'premium\')">\u{1F451} Premium Bilgi</button></div><div class="prem-blur"><div class="panel-top"><div><h3>Sunucu Etiketi</h3><p>A\u00E7, rol se\u00E7, gerisini bot halleder.</p></div></div></div></div>'; return; }
  c.innerHTML='<div class="page-h">Sunucu Etiketi</div><div class="page-s">\u00DCye bu sunucunun etiketini al\u0131nca otomatik rol verilir, \u00E7\u0131kar\u0131nca al\u0131n\u0131r. \u0130sim girmen gerekmez.</div>'
    +'<div class="panel"><div class="panel-top"><div><h3>Etiket Rol\u00FC</h3><p>Kapal\u0131yken hi\u00E7bir \u015Fey yap\u0131lmaz. A\u00E7\u0131kken tam otomatik \u00E7al\u0131\u015F\u0131r.</p></div><label class="tgl"><input type="checkbox" data-k="etiketAktif"'+(FORM.etiketAktif?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Verilecek rol</label><select data-k="etiketRol">'+secenek('rol',FORM.etiketRol,'Rol se\u00E7in')+'</select></div>'
    +'<div class="hint">\u2714 \u00DCye sunucu etiketini profiline ekleyince rol otomatik verilir, etiketi kald\u0131r\u0131nca geri al\u0131n\u0131r. Ekstra ayar yok.</div></div>'+saveBar();
}
function cizPremium(c){
  c.innerHTML='<div class="page-h">Premium</div><div class="page-s">Premium özellikler ve durum</div><div class="panel"><h3 style="font-size:14px">👑 Premium</h3><p style="color:var(--mut);font-size:13px;margin-top:6px">Premium kodun varsa bota <code>/premium aktifleştir</code> yazarak açabilirsin. Ses XP, davet rolleri ve gelişmiş karşılama gibi özellikler premium sunucularda çalışır.</p></div>';
}
function cizDenetimMasasi(c){
  c.innerHTML='<div class="page-h">Denetim Masası</div><div class="page-s">Güvenilir ekip rollerini seç: bu rollerdekiler denetim kaydını görür ve hızlı işlem menüsünü kullanır</div>'
    +'<div class="panel"><div class="warn yel">⚠ Buraya eklediğiniz roller denetim kaydı ve hızlı işlem menüsüne erişir.</div><div class="field"><label>Güvenilir roller</label>'+rolChips('moderatorRol')+'</div>'
    +'<div class="field"><label>Bildirim kanalı</label><select data-k="logKanal">'+secenek('yazi',FORM.logKanal,'Bir kanal seçin')+'</select></div>'
    +'<div class="field"><label>Not</label><input type="text" data-k="denetimNot" value="'+esc(FORM.denetimNot||'')+'" placeholder="örn: 3 uyarıda sustur"></div></div>'+saveBar();
}
const GOV_LIMIT={govRol:['govRolSayi','govRolDakika','rol işlemi'],govYasak:['govYasakSayi','govYasakDakika','yasaklama'],govAtma:['govAtmaSayi','govAtmaDakika','atma'],govKanal:['govKanalSayi','govKanalDakika','kanal işlemi']};
function cizGov(c,id){
  try{ return cizGovIc(c,id); }
  catch(err){ const c2=document.getElementById('content'); c2.innerHTML='<div class="hata-kutu">G\u00FCvenlik sayfas\u0131 a\u00E7\u0131lamad\u0131: '+esc(String((err&&err.message)||err)).slice(0,200)+'</div>'+saveBar(); }
}
function cizGovIc(c,id){
  const ad=NAV_AD[id]||'Güvenlik';
  const acik={
    govDavet:'İzinsiz davet paylaşımlarını engeller.',
    govHesap:'Yeni açılmış ve şüpheli hesapları filtreler.',
    govRol:'Kısa sürede çok fazla rol açma/silme işlemini engeller.',
    govBot:'Onaylanmamış (doğrulanmamış) botların sunucuya girmesini engeller.',
    govYasak:'Kısa sürede çok fazla yasaklamayı engeller.',
    govAtma:'Kısa sürede çok fazla üyeyi atmayı engeller.',
    govKanal:'Kısa sürede çok fazla kanal açma/silmeyi engeller.',
    govWebhook:'İzinsiz webhookları onaya düşürür veya siler. 👑',
    govEmoji:'Yetkisiz emoji ve sticker eklemelerini kaldırır.'
  }[id]||'';
  const premKilit=(id==='govDavet'||id==='govHesap'||id==='govWebhook')&&!PREMIUM_AKTIF;
  let limitHtml='';
  if(GOV_LIMIT[id]){
    const [sK,dK,birim]=GOV_LIMIT[id];
    limitHtml='<div class="field"><div class="row3"><div><label>En fazla ('+birim+')</label><input type="number" data-k="'+sK+'" value="'+(FORM[sK]??3)+'" min="1" max="50"></div>'
      +'<div><label>Süre (dakika)</label><input type="number" data-k="'+dK+'" value="'+(FORM[dK]??1)+'" min="1" max="60"></div>'
      +'<div><label>Ceza</label><select disabled><option>Rolleri al + 10dk sustur</option></select></div></div>'
      +'<div class="hint">Limit aşılınca işlemi yapanın rolleri alınır ve 10 dakika susturulur.</div></div>';
  }
  let ekstra='';
  if(id==='govDavet')ekstra='<div class="field"><label>Muaf roller (davet paylaşabilir)</label>'+rolChips('davetMuaf')+'<div class="hint">Seçili roller + yönetici/mesaj yönetimi olanlar etkilenmez.</div></div>';
  if(id==='govWebhook')ekstra='<div class="field"><label>Onay kanalı (premium)</label><select data-k="webhookOnayKanal">'+secenek('yazi',FORM.webhookOnayKanal,'Seçilmezse direkt silinir')+'</select><div class="hint">Biri izinsiz webhook açarsa webhook silinir, isteği onaya düşer: kim istedi etiketlenir, ID görünür, Onayla/Reddet butonu gelir.</div></div>';
  if(id==='govHesap')ekstra='<div class="field"><label>Minimum hesap yaşı (gün)</label><input type="number" data-k="govHesapGun" value="'+(FORM.govHesapGun??7)+'" min="1" max="30"'+(premKilit?' disabled':'')+'><div class="hint">Hesabı bundan yeni olan üyeler sunucuya alınmaz.</div></div>';
  const govde='<div class="panel-top"><div><h3>'+ad+'</h3><p>'+acik+'</p></div><label class="tgl"><input type="checkbox" data-k="'+id+'"'+(FORM[id]?' checked':'')+'><span class="ray"></span></label></div>'
    +limitHtml+ekstra
    +'<div class="warn yel">\u26A0 Bu koruma tetiklendi\u011Finde olay g\u00FCvenlik kanal\u0131na kaydedilir.</div>'
    +'<div class="field"><label>G\u00FCvenlik kanal\u0131</label><select data-k="guvenlikKanal">'+secenek('yazi',FORM.guvenlikKanal,'Bir kanal se\u00E7in')+'</select></div>';
  const kilitEkrani=premKilit?'<div class="prem-lock"><div class="prem-lock-ic">\u{1F451}</div><b>Premium \u0130\u00E7erikli \u00D6zellik</b><p>Bu \u00F6zellik premium sunuculara \u00F6zel. Bu sunucuda premium yok.</p><button class="btn pri sm" onclick="git(\'premium\')">\u{1F451} Premium Bilgi</button></div>':'';
  c.innerHTML='<div class="page-h">'+ad+(premKilit?' \u{1F451}':'')+'</div><div class="page-s">'+acik+'</div>'
    +(premKilit?'<div class="panel prem-lock-wrap">'+kilitEkrani+'<div class="prem-blur">'+govde+'</div></div>':'<div class="panel">'+govde+'</div>'+saveBar());
}

async function duyuruYukle(){
  try{
    const j=await api('/api/duyuru');
    const bar=document.getElementById('duyuru-bar');
    if(!bar)return;
    BAKIM=(j&&j.bakim&&j.bakim.aktif)?j.bakim:null;
    let html='';
    if(BAKIM)html+='<div class="duyuru-bar"><div class="duyuru-ic bakim"><span style="font-size:18px">🛠️</span><span><b>Bakımda</b><p>'+esc(BAKIM.mesaj||'Bot şu an bakımda, bazı işlevler çalışmayabilir.')+'</p></span></div></div>';
    if(j&&j.duyuru&&j.duyuru.metin)html+='<div class="duyuru-bar"><div class="duyuru-ic"><span style="font-size:18px">📢</span><span><b>'+esc(j.duyuru.baslik||'Duyuru')+'</b><p>'+esc(j.duyuru.metin)+'</p></span><button onclick="duyuruKapat()">✕</button></div></div>';
    bar.innerHTML=html;
  }catch{}
}
function duyuruKapat(){const bar=document.getElementById('duyuru-bar');if(bar)bar.innerHTML='';}
function tarihYaz(ms){
  if(!ms)return '—';
  const d=new Date(ms);
  return d.toLocaleDateString('tr-TR')+' '+d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
}
let ADMIN_SEKME='genel';
const ADMIN_SEKMELER=[['genel','\u{1F4CA}','Genel'],['sunucular','\u{1F30D}','Sunucular'],['uyeler','\u{1F464}','\u00DCyeler'],['komutlar','\u2328\uFE0F','Komutlar'],['analitik','\u{1F4C8}','Analitik'],['kodlar','\u{1F39F}\uFE0F','Kodlar'],['duyuru','\u{1F4E2}','Duyurular'],['sistem','\u{1F6E0}\uFE0F','Sistem']];
async function cizAdmin(c){
  c.innerHTML='<div class="page-h">\u{1F451} Admin Paneli</div><div class="page-s">Sadece bot sahipleri g\u00F6r\u00FCr</div>'
    +'<div class="greet-wrap"><div class="greet-side"><h3>\u{1F451} Y\u00F6netim</h3><p>Kategoriye g\u00F6re y\u00F6net.</p>'
    +ADMIN_SEKMELER.map(s=>'<button class="g-opt'+(ADMIN_SEKME===s[0]?' secil':'')+'" onclick="ADMIN_SEKME=\''+s[0]+'\';renderContent()"><div class="t"><span class="mi">'+s[1]+'</span>'+s[2]+'</div></button>').join('')
    +'<button class="g-opt" onclick="SID?git(\'home\'):(serverList(),renderMisafir())"><div class="t"><span class="mi">\u21A9</span>Panele D\u00F6n</div></button>'
    +'</div><div id="ad-icerik"><div class="panel"><div class="bos">Y\u00FCkleniyor...</div></div></div></div>';
  adSekmeYukle();
}
async function adSekmeYukle(){
  if(ADMIN_SEKME==='uyeler')return adUyelerTab();
  if(ADMIN_SEKME==='komutlar')return adKomutlarTab();
  if(ADMIN_SEKME==='analitik')return adAnalitikTab();
  if(ADMIN_SEKME==='sistem')return adSistemTab();
  if(ADMIN_SEKME==='sunucular')return adSunucular();
  if(ADMIN_SEKME==='kodlar')return adKodlarTab();
  if(ADMIN_SEKME==='duyuru')return adDuyuruTab();
  return adGenel();
}
function statMini(icon,deger,ad){
  return '<div class="stat-mini"><b>'+icon+' '+deger+'</b><span>'+ad+'</span></div>';
}
async function adGenel(){
  const kutu=document.getElementById('ad-icerik');if(!kutu)return;
  try{
    const j=await api('/api/admin/ozet');
    let saglik=null;
    try{ saglik=await api('/api/admin/saglik'); }catch{}
    const tum=[...(j.premium||[]),...(j.free||[])].sort((a,b)=>b.uye-a.uye);
    const top=tum.slice(0,8);
    const maxUye=top.length?Math.max(1,top[0].uye):1;
    const toplam=(j.premiumSayi||0)+(j.freeSayi||0);
    const C=(2*Math.PI*30).toFixed(1);
    const premFrac=toplam?(j.premiumSayi/toplam):0;
    let otHtml='<div class="bos">Y\u00FCklenemedi.</div>';
    try{
      const o=await api('/api/admin/oturumlar');
      const l=o.oturumlar||[];
      otHtml=l.length?l.map(s=>'<div class="liste-satir"><span>\u{1F464} <b>'+esc(s.username)+'</b> <span style="color:var(--mut2);font-size:11px">'+s.id+'</span></span><span style="font-size:12px;color:var(--mut)">biti\u015F: '+tarihYaz(s.bitis)+'</span></div>').join(''):'<div class="bos">Aktif web oturumu yok.</div>';
    }catch{}
    kutu.innerHTML='<div class="stat-grid">'
      +statMini('\u{1F30D}',j.sunucu,'Sunucu')
      +statMini('\u{1F465}',j.uye,'Toplam \u00DCye')
      +statMini('\u{1F451}',j.premiumSayi,'Premium')
      +statMini('\u{1F193}',j.freeSayi,'Free')
      +'</div>'
      +'<div class="grid2">'
      +'<div class="panel"><div class="panel-top"><div><h3>\u{1F451} Premium Da\u011F\u0131l\u0131m\u0131</h3></div></div><div class="donut-wrap">'
      +'<svg width="110" height="110" viewBox="0 0 110 110"><defs><linearGradient id="pgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a08ffb"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><circle cx="55" cy="55" r="30" fill="none" stroke="#2c2c44" stroke-width="14"/><circle cx="55" cy="55" r="30" fill="none" stroke="url(#pgrad)" stroke-width="14" stroke-linecap="round" stroke-dasharray="'+(2*Math.PI*30*premFrac).toFixed(1)+' '+C+'" transform="rotate(-90 55 55)"/><text x="55" y="61" text-anchor="middle" fill="#fff" font-size="16" font-weight="800">'+Math.round(premFrac*100)+'%</text></svg>'
      +'<div><div style="font-size:13px">\u{1F451} Premium: <b>'+j.premiumSayi+'</b></div><div style="font-size:13px;color:var(--mut)">\u{1F193} Free: <b>'+j.freeSayi+'</b></div></div>'
      +'</div></div>'
      +'<div class="panel"><div class="panel-top"><div><h3>\u2764\uFE0F Sa\u011Fl\u0131k</h3></div><button class="btn sm" onclick="adSekmeYukle()">Yenile</button></div>'
      +(saglik?'<div class="kv-list">'
        +'<div class="liste-satir"><span>\u23F1\uFE0F \u00C7al\u0131\u015Fma</span><b>'+Math.floor((saglik.uptime||0)/3600)+' sa</b></div>'
        +'<div class="liste-satir"><span>\u{1F9E0} Bellek</span><b>'+saglik.bellekMB+' MB</b></div>'
        +'<div class="liste-satir"><span>\u{1F464} Kay\u0131tl\u0131 kullan\u0131c\u0131</span><b>'+saglik.kullancilar+'</b></div>'
        +'<div class="liste-satir"><span>\u{1F4AC} Web oturumu</span><b>'+(saglik.oturum==null?'?':saglik.oturum)+'</b></div></div>'
       :'<div class="bos">Al\u0131namad\u0131.</div>')+'</div>'
      +'</div>'
      +'<div class="panel"><div class="panel-top"><div><h3>\u{1F4CA} \u00DCye Da\u011F\u0131l\u0131m\u0131 (en kalabal\u0131k 8)</h3></div></div>'
      +(top.length?top.map(s=>'<div class="bar-satir"><span style="width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(s.ad)+'</span><span class="bar-dis"><span class="bar-ic" style="display:block;width:'+Math.max(4,Math.round(s.uye/maxUye*100))+'%"></span></span><b>'+s.uye+'</b></div>').join(''):'<div class="bos">Yok.</div>')+'</div>'
      +'<div class="panel"><div class="panel-top"><div><h3>\u{1F464} Web Oturumlar\u0131</h3><p>Siteye giri\u015F yapm\u0131\u015F hesaplar (ID ile).</p></div></div>'+otHtml+'</div>';
  }catch{ kutu.innerHTML='<div class="hata-kutu">Y\u00FCklenemedi (yetki/bot ba\u011Flant\u0131s\u0131).</div>'; }
}
async function adSunucular(){
  const kutu=document.getElementById('ad-icerik');if(!kutu)return;
  try{
    const j=await api('/api/admin/sunucular-detay');
    const l=j.sunucular||[];
    kutu.innerHTML='<div class="panel"><div class="panel-top"><div><h3>\u{1F30D} Sunucular ('+l.length+')</h3><p>Eklenme, premium, ban ve ge\u00E7mi\u015F detaylar\u0131.</p></div><button class="btn sm" onclick="adSekmeYukle()">Yenile</button></div>'
    +l.map(s=>'<div class="liste-satir" style="align-items:flex-start"><span style="display:flex;gap:10px;align-items:center">'
      +(s.ikon?'<img src="'+s.ikon+'" style="width:36px;height:36px;border-radius:50%">':'<span style="width:36px;height:36px;font-size:14px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:#3a3a5c;font-weight:800">'+esc((s.ad||'?')[0])+'</span>')
      +'<span><b>'+esc(s.ad)+'</b> <span style="color:var(--mut2);font-size:11px">'+s.id+'</span><br>'
      +'<span style="font-size:12px;color:var(--mut)">\u{1F465} '+s.uye+(s.prem?' \u2022 \u{1F451} '+tarihYaz(s.bitis):' \u2022 free')+(s.yasak?' \u2022 \u26D4 BANLI ('+esc(s.yasak.sebep||'')+')':'')+'</span><br>'
      +'<span style="font-size:12px;color:var(--mut)">\u{1F4E5} '+s.eklenmeSayisi+'x eklendi'+(s.ilkEklenme?' \u2022 ilk: '+tarihYaz(s.ilkEklenme):'')+(s.sonCikarma?' \u2022 son \u00E7\u0131k\u0131\u015F: '+tarihYaz(s.sonCikarma):'')+'</span>'
      +((s.ekleyenler||[]).length?'<br><span style="font-size:12px;color:var(--mut)">\u{1F464} Ekleyen: '+s.ekleyenler.map(e=>esc(e.tag||e.id)).join(', ')+'</span>':'')
      +'</span></span><span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input type="number" id="gun-'+s.id+'" placeholder="g\u00FCn" min="1" max="36500" style="max-width:76px">'
      +'<button class="btn sm" onclick="adPremium(\''+s.id+'\',true)">Ver</button>'
      +'<button class="btn btn-ghost sm" onclick="adPremium(\''+s.id+'\',false)">\u0130ptal</button>'
      +(s.yasak?'<button class="btn btn-ghost sm" onclick="adSunucuBan(\''+s.id+'\',\'unban\')">Unban</button>':'<button class="btn btn-ghost sm" onclick="adSunucuBan(\''+s.id+'\',\'ban\')">Banla</button>')
      +'<button class="btn btn-ghost sm" onclick="adSunucudanCik(\''+s.id+'\')">\u00C7\u0131kar</button></span></div>').join('')+'</div>';
  }catch{ kutu.innerHTML='<div class="hata-kutu">Y\u00FCklenemedi.</div>'; }
}
async function adSunucuBan(gid,islem){
  let sebep='';
  if(islem==='ban'){ sebep=prompt('Ban sebebi?')||''; if(sebep===null)return; }
  try{
    await api('/api/admin/sunucu-ban',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:gid,islem,sebep})});
    toast(islem==='ban'?'⛔ Sunucu banlandı!':'Unban yapıldı!');adSekmeYukle();
  }catch{toast('Olmadı!')}
}
async function adSunucudanCik(gid){
  if(!confirm('Bot bu sunucudan çıkarılsın mı?'))return;
  try{
    await api('/api/admin/sunucudan-cik',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:gid})});
    toast('Çıkıldı!');adSekmeYukle();
  }catch{toast('Olmadı!')}
}
async function adKodlarTab(){
  const kutu=document.getElementById('ad-icerik');if(!kutu)return;
  kutu.innerHTML='<div class="panel"><div class="panel-top"><div><h3>\u{1F39F}\uFE0F Premium Kodlar\u0131</h3><p>\u00DCret, listele, sil.</p></div></div>'
    +'<div class="row3"><div><label>S\u00FCree (\u00F6rn: 30d, 1y)</label><input type="text" id="ad-kodsure" placeholder="30d"></div><div><label>&nbsp;</label><button class="btn pri sm" onclick="adKodUret()">\u00DCret</button></div></div><div id="ad-kodlar" style="margin-top:10px"></div></div>';
  adKodListe();
}
async function adDuyuruTab(){
  const kutu=document.getElementById('ad-icerik');if(!kutu)return;
  kutu.innerHTML='<div class="panel"><div class="panel-top"><div><h3>\u{1F4E2} Discord Duyuru</h3><p>Kanala mesaj g\u00F6nder.</p></div></div>'
    +'<div class="field"><label>Sunucu</label><select id="ad-dsunucu"></select></div><div class="field"><label>Kanal</label><select id="ad-dkanal"><option>\u00D6nce sunucu se\u00E7</option></select></div><div class="field"><label>Mesaj</label><textarea id="ad-dmesaj" rows="3" placeholder="Duyuru metni"></textarea></div><div class="field" style="display:flex;gap:10px;align-items:center"><label class="tgl sm"><input type="checkbox" id="ad-dhepsi"><span class="ray"></span></label><span style="font-size:13px">@everyone ile g\u00F6nder</span><button class="btn pri sm" style="margin-left:auto" onclick="adDuyuru()">G\u00F6nder</button></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>\u{1F4E3} Panel Duyurusu (sadece web i\u00E7i)</h3><p>Panelde banner olarak g\u00F6r\u00FCn\u00FCr.</p></div></div><div id="ad-pmevcut"></div><div class="field"><label>Ba\u015Fl\u0131k</label><input type="text" id="ad-pbaslik" maxlength="100" placeholder="Duyuru"></div><div class="field"><label>Metin</label><textarea id="ad-pmetin" rows="3" maxlength="1000"></textarea></div><div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri sm" onclick="adPanelDuyuru()">Yay\u0131nla</button><button class="btn sm" onclick="adPanelDuyuruKaldir()">Kald\u0131r</button></div></div>';
  try{
    const j=await api('/api/admin/ozet');
    const ds=document.getElementById('ad-dsunucu');
    if(ds){
      const tum=[...(j.premium||[]),...(j.free||[])];
      ds.innerHTML=tum.map(s=>'<option value="'+s.id+'">'+esc(s.ad)+'</option>').join('');
      ds.onchange=adKanalDoldur;adKanalDoldur();
    }
  }catch{}
  adPanelMevcut();
}
async function adPremium(gid,ac){
  const gun=parseInt((document.getElementById('gun-'+gid)||{}).value,10)||30;
  try{
    await api('/api/admin/premium',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:gid,islem:ac?'ac':'kapat',gun})});
    toast(ac?'👑 Premium verildi ('+gun+' gün)!':'Premium kapatıldı!');
    renderContent();
  }catch{toast('Olmadı!')}
}
async function adKanalDoldur(){
  const gid=document.getElementById('ad-dsunucu').value;
  const ks=document.getElementById('ad-dkanal');
  ks.innerHTML='<option>Yükleniyor...</option>';
  try{
    const j=await api('/api/admin/kanallar/'+gid);
    ks.innerHTML=(j.kanallar||[]).map(k=>'<option value="'+k.id+'">'+(k.tip==='ses'?'🔊':'💬')+' #'+esc(k.ad)+'</option>').join('');
  }catch{ks.innerHTML='<option>Yüklenemedi</option>'}
}
async function adDuyuru(){
  const gid=document.getElementById('ad-dsunucu').value;
  const kid=document.getElementById('ad-dkanal').value;
  const mesaj=document.getElementById('ad-dmesaj').value;
  const everyone=document.getElementById('ad-dhepsi').checked;
  if(!mesaj.trim()){toast('Mesaj yaz!');return}
  try{
    await api('/api/admin/duyuru',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:gid,channelId:kid,mesaj,everyone})});
    toast('Duyuru gönderildi!');document.getElementById('ad-dmesaj').value='';
  }catch{toast('Gönderilemedi!')}
}
async function adKodListe(){
  const kutu=document.getElementById('ad-kodlar');if(!kutu)return;
  try{
    const j=await api('/api/admin/kodlar');
    const l=j.kodlar||[];
    kutu.innerHTML=l.length?l.slice(0,20).map(k=>'<div class="liste-satir"><span><code>'+k.kod+'</code> <span style="color:var(--mut)">'+(k.gun>=36500?'SINIRSIZ':k.gun+' gün')+(k.kullanan?' • kullanıldı':' • boşta')+'</span></span><button class="btn btn-ghost sm" onclick="adKodSil(\''+k.kod+'\')">Sil</button></div>').join(''):'<div class="bos">Kod yok.</div>';
  }catch{kutu.innerHTML='<div class="bos">Yüklenemedi.</div>'}
}
async function adKodUret(){
  const sure=(document.getElementById('ad-kodsure')||{}).value||'30d';
  try{
    const j=await api('/api/admin/kod-uret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sure})});
    toast('Kod: '+j.kod);adKodListe();
  }catch{toast('Üretilemedi!')}
}
async function adKodSil(kod){
  try{
    await api('/api/admin/kod-sil',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kod})});
    toast('Silindi!');adKodListe();
  }catch{toast('Silinemedi!')}
}
async function adPanelMevcut(){
  const kutu=document.getElementById('ad-pmevcut');if(!kutu)return;
  try{
    const j=await api('/api/duyuru');
    kutu.innerHTML=j.duyuru?'<div class="warn yel">📢 Yayında: <b>'+esc(j.duyuru.baslik||'Duyuru')+'</b> — '+esc(String(j.duyuru.metin).slice(0,120))+'</div>':'<div class="hint">Şu an yayında duyuru yok.</div>';
  }catch{}
}
async function adPanelDuyuru(){
  const baslik=document.getElementById('ad-pbaslik').value;
  const metin=document.getElementById('ad-pmetin').value;
  if(!metin.trim()){toast('Metin yaz!');return}
  try{
    await api('/api/admin/duyuru-panel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baslik,metin})});
    toast('Yayınlandı!');adPanelMevcut();duyuruYukle();
  }catch{toast('Olmadı!')}
}
async function adPanelDuyuruKaldir(){
  try{
    await api('/api/admin/duyuru-panel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baslik:'',metin:''})});
    toast('Kaldırıldı!');adPanelMevcut();duyuruYukle();
  }catch{toast('Olmadı!')}
}

async function adUyeSunucuDoldur(selId){
  try{
    const j=await api('/api/admin/ozet');
    const tum=[...(j.premium||[]),...(j.free||[])];
    const sel=document.getElementById(selId);
    if(sel)sel.innerHTML=tum.map(s=>'<option value="'+s.id+'">'+esc(s.ad)+'</option>').join('');
  }catch{}
}
async function adUyelerTab(){
  const kutu=document.getElementById('ad-icerik');if(!kutu)return;
  kutu.innerHTML='<div class="panel"><div class="panel-top"><div><h3>👤 Üye Bul & İşlem</h3><p>ID ile üye bul, uyar/sustur/at/yasakla.</p></div></div>'
    +'<div class="row3"><div><label>Sunucu</label><select id="ad-u-sunucu"></select></div><div><label>Kullanıcı ID</label><input type="text" id="ad-u-id" placeholder="örn: 123..." maxlength="25"></div><div><label>&nbsp;</label><button class="btn pri sm" onclick="adUyeBul()">Bul</button></div></div>'
    +'<div id="ad-u-sonuc" style="margin-top:12px"></div></div>';
  adUyeSunucuDoldur('ad-u-sunucu');
}
async function adUyeBul(){
  const gid=document.getElementById('ad-u-sunucu').value;
  const uid=document.getElementById('ad-u-id').value.trim();
  const kutu=document.getElementById('ad-u-sonuc');
  if(!gid||!uid){toast('Sunucu + ID gerekli');return}
  kutu.innerHTML='<div class="bos">Aranıyor...</div>';
  try{
    const j=await api('/api/admin/uye',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:gid,userId:uid,islem:'bilgi'})});
    const u=j.uye;
    kutu.innerHTML='<div class="kv-list">'
      +'<div class="liste-satir"><span>👤 Üye</span><b>'+esc(u.tag)+(u.bot?' 🤖':'')+'</b></div>'
      +'<div class="liste-satir"><span>🆔 ID</span><span style="font-size:12px">'+u.id+'</span></div>'
      +'<div class="liste-satir"><span>📅 Katılma</span><b>'+tarihYaz(u.katilma)+'</b></div>'
      +'<div class="liste-satir"><span>🎭 Roller</span><span style="font-size:12px">'+esc((u.roller||[]).join(', ')||'—')+'</span></div>'
      +'<div class="liste-satir"><span>⚠️ Uyarı</span><b>'+(u.warns||[]).length+'</b></div>'
      +'<div class="liste-satir"><span>📈 Seviye/XP/Mesaj</span><b>Sv.'+u.level+' • '+u.xp+' XP • '+u.mesaj+' mesaj</b></div>'
      +'<div class="liste-satir"><span>⭐ İtibar/Para</span><b>'+u.rep+' rep • '+u.para+' coin</b></div></div>'
      +((u.warns||[]).length?'<div class="hint">Son uyarılar: '+u.warns.slice(-3).map(w=>esc(w.reason||'')).join(' • ')+'</div>':'')
      +'<div class="field"><label>Sebep / süre (dk, susturma için)</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input type="text" id="ad-u-sebep" placeholder="sebep" style="flex:2;min-width:140px"><input type="number" id="ad-u-sure" placeholder="dk" style="max-width:90px"></div></div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'
      +'<button class="btn sm" onclick="adUyeIslem(\''+gid+'\',\''+uid+'\',\'uyar\')">Uyar</button>'
      +'<button class="btn sm" onclick="adUyeIslem(\''+gid+'\',\''+uid+'\',\'sustur\')">Sustur</button>'
      +'<button class="btn sm" onclick="adUyeIslem(\''+gid+'\',\''+uid+'\',\'at\')">At</button>'
      +'<button class="btn sm" onclick="adUyeIslem(\''+gid+'\',\''+uid+'\',\'yasakla\')">Yasakla</button>'
      +'<button class="btn btn-ghost sm" onclick="adUyeIslem(\''+gid+'\',\''+uid+'\',\'yasakkaldir\')">Yasağı Kaldır</button>'
      +'<button class="btn btn-ghost sm" onclick="adUyeIslem(\''+gid+'\',\''+uid+'\',\'uyaritemizle\')">Uyarıları Temizle</button></div>';
  }catch{ kutu.innerHTML='<div class="hata-kutu">Bulunamadı (ID/bot yetkisi kontrol et).</div>'; }
}
async function adUyeIslem(gid,uid,islem){
  if((islem==='at'||islem==='yasakla')&&!confirm('Emin misin? ('+islem+')'))return;
  const sebep=(document.getElementById('ad-u-sebep')||{}).value||'';
  const sureDk=(document.getElementById('ad-u-sure')||{}).value||'10';
  try{
    const j=await api('/api/admin/uye',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:gid,userId:uid,islem,sebep,sureDk})});
    if(j.hata==='dokunulmaz'){toast('⛔ Dokunulmaz (sahip/admin/bot)!');return}
    toast('Tamam: '+islem+'!');
    if(islem==='bilgi')return;
    adUyeBul();
  }catch{toast('Olmadı!')}
}
async function adKomutlarTab(){
  const kutu=document.getElementById('ad-icerik');if(!kutu)return;
  kutu.innerHTML='<div class="panel"><div class="panel-top"><div><h3>⌨️ Komut Aç/Kapa</h3><p>Kapalı komutlar prefix + slash dahil çalışmaz.</p></div><button class="btn sm" onclick="adKomutlarTab()">Yenile</button></div><div class="field"><label>Ara</label><input type="text" id="ad-k-ara" placeholder="komut adı..." oninput="adKomutFiltre(this.value)"></div><div id="ad-k-liste"><div class="bos">Yükleniyor...</div></div></div>';
  try{
    const j=await api('/api/admin/komutlar');
    const l=j.komutlar||[];
    document.getElementById('ad-k-liste').innerHTML=l.map(k=>'<div class="liste-satir" data-kad="'+k.ad+'"><span> <b>/'+k.ad+'</b> <span style="color:var(--mut2);font-size:11px">'+esc(k.kategori)+'</span></span><label class="tgl sm"><input type="checkbox"'+(k.kapali?'':' checked')+' onchange="adKomutDegistir(\''+k.ad+'\',this.checked)"><span class="ray"></span></label></div>').join('');
  }catch{ document.getElementById('ad-k-liste').innerHTML='<div class="hata-kutu">Yüklenemedi.</div>'; }
}
function adKomutFiltre(v){
  v=(v||'').toLowerCase();
  document.querySelectorAll('[data-kad]').forEach(el=>{
    el.style.display=(!v||el.dataset.kad.includes(v))?'':'none';
  });
}
async function adKomutDegistir(ad,acik){
  try{
    await api('/api/admin/komut-durum',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({komut:ad,islem:acik?'ac':'kapat'})});
    toast(acik?'Açıldı: /'+ad:'Kapatıldı: /'+ad);
  }catch{toast('Olmadı!');adKomutlarTab()}
}
async function adAnalitikTab(){
  const kutu=document.getElementById('ad-icerik');if(!kutu)return;
  kutu.innerHTML='<div class="panel"><div class="bos">Yükleniyor...</div></div>';
  try{
    const j=await api('/api/admin/analitik');
    const bar=(liste,birim)=>liste.length?liste.map((x,i)=>{const mx=liste[0].d||1;return '<div class="bar-satir"><span style="width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">&lt;@'+x.uid+'&gt;</span><span class="bar-dis"><span class="bar-ic" style="display:block;width:'+Math.max(4,Math.round(x.d/mx*100))+'%"></span></span><b>'+x.d+' '+birim+'</b></div>'}).join(''):'<div class="bos">Veri yok.</div>';
    kutu.innerHTML='<div class="stat-grid">'
      +statMini('💬',j.toplamMesaj,'Toplam Mesaj')
      +statMini('🪙',j.toplamPara,'Toplam Coin')
      +statMini('⚠️',j.toplamUyari,'Toplam Uyarı')
      +'</div>'
      +'<div class="grid2"><div class="panel"><div class="panel-top"><div><h3>💬 En Aktifler</h3></div></div>'+bar(j.topMesaj,'mesaj')+'</div>'
      +'<div class="panel"><div class="panel-top"><div><h3>🪙 En Zenginler</h3></div></div>'+bar(j.topPara,'coin')+'</div></div>'
      +'<div class="grid2"><div class="panel"><div class="panel-top"><div><h3>📈 En Yüksek Seviye</h3></div></div>'+bar(j.topSeviye.map(x=>({uid:x.uid,d:Math.floor(x.d/100000)})),'sv')+'</div>'
      +'<div class="panel"><div class="panel-top"><div><h3>⭐ En İtibarlı</h3></div></div>'+bar(j.topRep,'rep')+'</div></div>'
      +'<div class="panel"><div class="panel-top"><div><h3>📚 Komut Kategorileri</h3></div></div>'+((j.kategoriler||[]).map(k=>{const mx=(j.kategoriler[0]||{sayi:1}).sayi;return '<div class="bar-satir"><span style="width:130px">'+esc(k.ad)+'</span><span class="bar-dis"><span class="bar-ic" style="display:block;width:'+Math.max(4,Math.round(k.sayi/mx*100))+'%"></span></span><b>'+k.sayi+'</b></div>'}).join('')||'<div class="bos">Yok.</div>')+'</div>';
  }catch{ kutu.innerHTML='<div class="hata-kutu">Yüklenemedi.</div>'; }
}
async function adSistemTab(){
  const kutu=document.getElementById('ad-icerik');if(!kutu)return;
  let bakim=null;
  try{ const s=await api('/api/admin/saglik'); bakim=s.bakim||null; }catch{}
  kutu.innerHTML='<div class="panel"><div class="panel-top"><div><h3>🛠️ Bakım Modu</h3><p>Açıkken kurucular hariç kimse komut kullanamaz.</p></div><label class="tgl"><input type="checkbox" id="ad-bakim"'+(bakim&&bakim.aktif?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="field"><label>Bakım mesajı</label><input type="text" id="ad-bakim-msj" maxlength="300" value="'+esc((bakim&&bakim.mesaj)||'')+'" placeholder="Birazdan dönüyoruz."></div>'
    +'<div style="margin-top:12px"><button class="btn pri sm" onclick="adBakimKaydet()">Kaydet</button></div></div>'
    +'<div class="panel"><div class="panel-top"><div><h3>💾 Veritabanı Yedeği</h3><p>Tüm ayarlar + kullanıcı verileri JSON olarak iner.</p></div><button class="btn sm" onclick="adYedekIndir()">İndir</button></div></div>';
}
async function adBakimKaydet(){
  const aktif=document.getElementById('ad-bakim').checked;
  const mesaj=document.getElementById('ad-bakim-msj').value;
  try{
    await api('/api/admin/bakim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({aktif,mesaj})});
    toast(aktif?'Bakım açıldı!':'Bakım kapatıldı!');
  }catch{toast('Olmadı!')}
}
function adYedekIndir(){ window.open('/api/admin/yedek','_blank'); }
async function adPremiumSure(gid,islem){
  const inp=document.getElementById('gun-'+gid);
  const gun=parseInt((inp||{}).value,10)||30;
  try{
    const j=await api('/api/admin/premium-sure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:gid,islem,gun})});
    toast((islem==='kisalt'?'Kısaltıldı':'Uzatıldı')+'! Yeni bitiş: '+tarihYaz(j.bitis));
    adSekmeYukle();
  }catch{toast('Olmadı! (premium yok?)')}
}
async function adSunucuDetay(gid){
  document.getElementById('modal-root').innerHTML='<div class="pmodal-bg" onclick="if(event.target===this)modalKapat()"><div class="pmodal"><div class="modal-h"><span>Sunucu Detay\u0131</span><button onclick="modalKapat()">\u2715</button></div><div class="modal-b"><div id="ad-detay-ic"><div class="bos">Y\u00FCkleniyor...</div></div></div></div></div>';
  try{
    const j=await api('/api/admin/sunucu-full/'+gid);
    document.getElementById('ad-detay-ic').innerHTML='<div class="kv-list">'
      +'<div class="liste-satir"><span>\u{1F30D} Sunucu</span><b>'+esc(j.ad)+'</b></div>'
      +'<div class="liste-satir"><span>\u{1F465} \u00DCye</span><b>'+j.uye+'</b></div>'
      +'<div class="liste-satir"><span>\u{1F4AC} Yaz\u0131 / \u{1F50A} Ses / \u{1F4C1} Kategori</span><b>'+j.yazi+' / '+j.ses+' / '+j.kategori+'</b></div>'
      +'<div class="liste-satir"><span>\u{1F600} Emoji / \u2728 Sticker / \u{1F680} Boost</span><b>'+j.emoji+' / '+j.sticker+' / '+j.boost+'</b></div>'
      +'<div class="liste-satir"><span>\u{1F4C5} Kurulu\u015F</span><b>'+tarihYaz(j.kurulus)+'</b></div></div>'
      +'<div class="hint">En kalabal\u0131k roller: '+(j.roller||[]).slice(0,10).map(r=>esc(r.ad)+' ('+r.uye+')').join(', ')+'</div>';
  }catch{ document.getElementById('ad-detay-ic').innerHTML='<div class="hata-kutu">Y\u00FCklenemedi.</div>'; }
}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLocaleLowerCase('tr')==='k'){e.preventDefault();document.getElementById('ara')?.focus()}});
baslat();
