/* Panel */
let SID=null,SNAME='',SICON=null,KANALLAR=[],ROLLER=[],FORM={},ME=null,GUILDS=[];
let AKTIF='home',GREET='karsilama';

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

function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('goster');clearTimeout(t._z);t._z=setTimeout(()=>t.classList.remove('goster'),2400)}
async function api(y,init){const r=await fetch(y,init);if(r.status===401){location.href='/login';throw new Error('giris')}return r.json()}
function avatarURL(u){return u&&u.avatar?`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`:'https://cdn.discordapp.com/embed/avatars/0.png'}
function esc(s){return String(s==null?'':s).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function kanalAd(id){const k=KANALLAR.find(x=>String(x.id)===String(id));return k?('#'+k.ad):'—'}
function rolAd(id){const r=ROLLER.find(x=>String(x.id)===String(id));return r?('@'+r.ad):'—'}

async function baslat(){
  try{
    const me=await api('/api/me');ME=me.user;
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
  document.getElementById('sidebar').innerHTML='<div class="side-logo"><div class="mark">◈</div><span>Kontrol Paneli</span></div>'
    +'<div class="side-sec">Sunucularım</div>'
    +GUILDS.map(g=>'<button class="side-item" onclick="sunucuAc(\''+g.id+'\')"><span class="ic">◍</span><span>'+esc(g.ad).slice(0,24)+'</span>'+(g.prem?'<span class="tac">👑</span>':'')+'</button>').join('');
  document.getElementById('topbar').innerHTML='<div class="crumb"><b>Ana Sayfa</b><span class="sep">›</span><b>Sunucularım</b></div>'
    +'<div class="top-right"><div class="search">⌕ Özellik ara<kbd>Ctrl K</kbd></div><div class="userbox"><img src="'+avatarURL(ME)+'">'+esc(ME?ME.username:'')+'</div><a class="btn sm" href="/logout">Çıkış</a></div>';
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
    SID=id;SNAME=j.ad;KANALLAR=j.kanallar||[];ROLLER=j.roller||[];FORM=Object.assign({},j.ayarlar||{});
    const ic=j.ad?j.ad[0].toUpperCase():'?';
    SICON=null;
    const gg=GUILDS.find(x=>x.id===id);
    if(gg&&gg.ikon)SICON='https://cdn.discordapp.com/icons/'+id+'/'+gg.ikon+'.png?size=64';
    AKTIF='home';GREET='karsilama';
    renderAll();
  }catch{ document.getElementById('content').innerHTML='<div class="hata-kutu">Yüklenemedi.</div>'; }
}

const NAV=[
  {sec:null,items:[['home','▦','Kontrol Paneli']]},
  {sec:null,items:[['ayarlar','⚙','Ayarlar'],['premium','☆','Premium'],['gomulu','▤','Gömülü Mesajlar']]},
  {sec:'Sunucu Yönetimi',items:[['seviye','▅','Seviye Sistemi'],['karsilama','◍','Karşılama & Veda'],['otomod','◈','Otomatik Moderasyon','YENİ'],['denetimMasasi','◉','Denetim Masası'],['denetim','▣','Denetim Kaydı'],['otocevap','⌁','Otomatik Cevap'],['emojirol','☺','Emoji Rol'],['etiket','◌','Sunucu Etiketi']]},
  {sec:'Güvenlik',items:[['govDavet','🔗','Davet Koruması','👑'],['govHesap','🛡','Hesap Filtresi','👑'],['govRol','◎','Rol Limitlemeleri'],['govBot','⚙','Bot Filtresi'],['govYasak','⊘','Yasaklama Limiti'],['govAtma','↩','Atma Limiti'],['govKanal','#','Kanal Limitlemeleri'],['govWebhook','🔗','Anti-Webhook','YENİ'],['govEmoji','☺','Emoji Limitleri','YENİ']]},
];
const NAV_AD={home:'Kontrol Paneli',ayarlar:'Ayarlar',premium:'Premium',gomulu:'Gömülü Mesajlar',seviye:'Seviye Sistemi',karsilama:'Karşılama & Veda',otomod:'Otomatik Moderasyon',denetimMasasi:'Denetim Masası',denetim:'Denetim Kaydı',otocevap:'Otomatik Cevap',emojirol:'Emoji Rol',etiket:'Sunucu Etiketi',govDavet:'Davet Koruması',govHesap:'Hesap Filtresi',govRol:'Rol Limitlemeleri',govBot:'Bot Filtresi',govYasak:'Yasaklama Limiti',govAtma:'Atma Limiti',govKanal:'Kanal Limitlemeleri',govWebhook:'Anti-Webhook',govEmoji:'Emoji Limitleri'};

function renderAll(){renderSide();renderTop();renderContent()}
function renderSide(){
  let h='<div class="side-logo"><div class="mark">◈</div><span>Kontrol Paneli</span></div>';
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
  document.getElementById('sidebar').innerHTML=h;
}
function renderTop(){
  document.getElementById('topbar').innerHTML='<div class="crumb"><span style="cursor:pointer" onclick="serverList();renderMisafir()">Ana Sayfa</span><span class="sep">›</span><span style="cursor:pointer" onclick="serverList();renderMisafir()">Sunucularım</span><span class="sep">›</span>'
    +'<button class="srv-pick" onclick="serverList();renderMisafir()">'+(SICON?'<img src="'+SICON+'">':'<span class="harf">'+esc((SNAME||'?')[0])+'</span>')+'<b>'+esc(SNAME)+'</b><span style="color:var(--mut)">▾</span></button></div>'
    +'<div class="top-right"><div class="search">⌕ <input id="ara" placeholder="Özellik ara" style="background:none;border:0;outline:0;color:var(--txt);width:120px" onkeydown="if(event.key===\'Enter\')araGit(this.value)"><kbd>Ctrl K</kbd></div><div class="userbox"><img src="'+avatarURL(ME)+'">'+esc(ME?ME.username:'')+'<span style="color:var(--mut)">▾</span></div><a class="btn sm" href="/logout">Çıkış</a></div>';
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
    toast(mesaj||('Kaydedildi'+(j.sayi?' ('+j.sayi+' ayar)':'')));
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
  if(AKTIF==='home')return cizHome(c);
  if(AKTIF==='ayarlar')return cizAyarlar(c);
  if(AKTIF==='seviye')return cizSeviye(c);
  if(AKTIF==='karsilama')return cizKarsilama(c);
  if(AKTIF==='otomod')return cizOtomod(c);
  if(AKTIF==='denetim')return cizDenetim(c);
  if(AKTIF==='gomulu')return cizGomulu(c);
  if(AKTIF==='otocevap')return cizOtoCevap(c);
  if(AKTIF==='emojirol')return cizEmojiRol(c);
  if(AKTIF==='etiket')return cizEtiket(c);
  if(AKTIF==='premium')return cizPremium(c);
  if(AKTIF==='denetimMasasi')return cizDenetimMasasi(c);
  if(AKTIF.startsWith('gov'))return cizGov(c,AKTIF);
  c.innerHTML='<div class="bos">Hazırlanıyor.</div>';
}

function cizHome(c){
  const kart=(id,icon,ad,ac,yeni)=>{
    return '<button class="mod-card" onclick="git(\''+id+'\')"><span class="mi">'+icon+'</span><span><b>'+ad+(yeni?' <span class="yeni-tag">YENİ</span>':'')+'</b><p>'+ac+'</p></span></button>';
  };
  c.innerHTML='<div class="page-h">Kontrol Paneli</div><div class="page-s">Kontrol paneline hoş geldiniz</div>'
    +'<div class="sec-h">Sunucu Yönetimi</div><div class="kart-grid">'
    +kart('seviye','▅','Seviye Sistemi','Mesaj ve ses etkinliğini seviyeler, sıralamalar ve rollerle ödüllendirin.')
    +kart('karsilama','◍','Karşılama & Veda','Bir üye katıldığında veya ayrıldığında olacakları yönetin')
    +kart('otomod','◈','Otomatik Moderasyon','Sunucu moderasyonunu otomatikleştirir',true)
    +kart('denetimMasasi','◉','Denetim Masası','Topluluk moderasyonunu güvenilir üyelerle yönetin')
    +kart('denetim','▣','Denetim Kaydı','Sunucunuzda olanların kaydını tutar')
    +kart('otocevap','⌁','Otomatik Cevap','Mesaj tetiklemelerini yönetin')
    +kart('emojirol','☺','Emoji Rol','Üyelerin mesajlara tepki vererek rol almasını sağlar')
    +kart('etiket','◌','Sunucu Etiketi','Üyeler sunucu etiketinizi aldığında roller ekleyin ve bildirimler gönderin')
    +'</div><div class="sec-h">Güvenlik</div><div class="kart-grid">'
    +kart('govDavet','🔗','Davet Koruması','Sunucuya izinsiz davet paylaşımlarını engelleyin.')
    +kart('govHesap','🛡','Hesap Filtresi','Yeni ve şüpheli hesapları otomatik filtreleyin.')
    +kart('govRol','◎','Rol Limitlemeleri','Rol verme ve alma işlemlerini sınırlayın.')
    +kart('govBot','⚙','Bot Filtresi','İzinsiz bot girişlerini engelleyin.')
    +kart('govYasak','⊘','Yasaklama Limiti','Toplu yasaklamaları sınırlayın.')
    +kart('govAtma','↩','Atma Limiti','Toplu atmaları sınırlayın.')
    +kart('govKanal','#','Kanal Limitlemeleri','Kanal açma ve silme işlemlerini sınırlayın.')
    +kart('govWebhook','🔗','Anti-Webhook','İzinsiz webhookları otomatik silin',true)
    +kart('govEmoji','☺','Emoji Limitleri','Emoji spamını ve izinsiz emoji eklemeyi sınırlayın',true)
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
    +saveBar();
}
function tektenCokluya(sel,key){
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
  +'<div class="field" style="margin-top:16px"><div class="row3"><div><label>Dakika başına XP</label><input type="number" data-k="sesXPDakika" value="'+(f.sesXPDakika??5)+'"></div><div><label>Minimum katılımcı</label><input type="number" data-k="sesXPMin" value="'+(f.sesXPMin??2)+'"></div><div><label>AFK koruması</label><select data-k="sesXPAfk"><option value="1"'+(f.sesXPAfk!==false?' selected':'')+'>Açık</option><option value=""'+(f.sesXPAfk===false?' selected':'')+'>Kapalı</option></select></div></div>'
  +'<div class="hint">✔ AFK koruması etkinleştirildiğinde AFK, sessiz veya odada tek duran üyeler XP kazanamaz.</div></div></div></div>'
  +'<div class="panel" style="margin-top:16px"><div class="panel-top"><div><h3>🔔 Seviye atlama duyurusu</h3><p>Üyeleriniz seviye atladığında kişiselleştirilmiş bir mesaj gönderin.</p></div></div>'
  +'<div class="field"><label>Hedef</label><select data-k="seviyeKanal"><option value="">Kapalı</option>'+KANALLAR.filter(k=>k.tip==='yazi').map(k=>'<option value="'+k.id+'"'+(String(f.seviyeKanal)===String(k.id)?' selected':'')+'># '+esc(k.ad)+'</option>').join('')+'</select></div>'
  +'<div class="field" style="display:flex;align-items:center;gap:12px"><label class="tgl"><input type="checkbox" data-k="seviyeOzel"'+(f.seviyeOzel?' checked':'')+'><span class="ray"></span></label><span style="font-size:13px">Özel mesaj olarak gönder</span></div>'
  +'<div class="field"><label>Mesaj şablonu</label><textarea data-k="seviyeMesaj" rows="2">🎉 '+(esc(f.seviyeMesaj)||'Tebrikler {user}, **{level}**. seviyeye ulaştın! /rank ile seviyeni kontrol et.')+'</textarea>'
  +'<div style="margin-top:8px"><button class="link-btn" onclick="toast(\'Değişkenler: {user} {level} {xp}\')">⚙ Gelişmiş Mesaj Ayarla</button></div></div></div>'
  +saveBar();
}

/* karşılama */
function cizKarsilama(c){
  const tabs=[
    {id:'karsilama',icon:'💬',ad:'Karşılama ve veda',alt:'0/5 etkin'},
    {id:'davet',icon:'🔗',ad:'Davet takibi',alt:'0/3 etkin'},
    {id:'takma',icon:'▤',ad:'Takma ad araçları',alt:'0/3 etkin'},
  ];
  let sag='';
  if(GREET==='karsilama')sag=karsilamaSag();
  else if(GREET==='davet')sag=davetSag();
  else sag=takmaSag();
  c.innerHTML='<div class="page-h">Karşılama & Veda</div><div class="page-s">Yeni üyeleri karşılayın, ayrılanları takip edin</div>'
    +'<div class="greet-wrap"><div class="greet-side"><h3>◈ Karşılama özellikleri</h3><p>Ayarlarını açmak için aşağıdan bir özellik grubu seçin.</p>'
    +'<div class="g-count"><span>3 özellik grubu</span><b>0/11 etkin</b></div>'
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
    +'<div class="panel"><div class="panel-top"><div><h3>Üye katılınca özel mesaj at</h3><p>Sunucuya üye katıldığında kullanıcıya özel mesaj atar</p></div><label class="tgl"><input type="checkbox" data-k="girisDMAt"'+(f.girisDMAt?' checked':'')+'><span class="ray"></span></label></div>'
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
  if(!sel.value)return;
  if(!Array.isArray(FORM[key]))FORM[key]=[];
  if(!FORM[key].includes(sel.value))FORM[key].push(sel.value);
  renderContent();
}
function isimKelimeEkle(w){
  w=(w||'').trim();if(!w)return;
  if(!Array.isArray(FORM.isimKelimeler))FORM.isimKelimeler=[];
  FORM.isimKelimeler.push(w);renderContent();
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
  document.getElementById('modal-root').innerHTML='<div class="modal-bg" onclick="if(event.target===this)modalKapat()"><div class="modal"><div class="modal-h"><span>'+a.ad+'</span><button onclick="modalKapat()">✕</button></div><div class="modal-b">'
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
function mEkle(k,alan,id){
  if(!id)return;const v=Object.assign({},amGet(k));if(!Array.isArray(v[alan]))v[alan]=[];
  if(!v[alan].includes(id))v[alan].push(id);FORM[k]=v;amModal(k);
}
function amKaydet(k){
  const v=Object.assign({},amGet(k));
  v.mesajSil=document.getElementById('m-sil').checked;
  v.zamanAsimi=document.getElementById('m-timeout').checked;
  v.sunucudanAt=document.getElementById('m-kick').checked;
  v.yasakla=document.getElementById('m-ban').checked;
  const uy=document.getElementById('m-uyari');if(uy)v.uyari=parseInt(uy.value,10)||3;
  const lim=document.getElementById('m-limit');if(lim)v.limit=parseInt(lim.value,10)||'';
  const sur=document.getElementById('m-sure');if(sur)v.sure=parseInt(sur.value,10)||10;
  const kel=document.getElementById('m-kelimeler');if(kel)v.kelimeler=kel.value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,50);
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
  c.innerHTML='<div class="page-h">Gömülü Mesajlar</div><div class="page-s">Sunucunuzdaki gömülü mesajları yönetin</div>'
    +'<div class="panel"><div class="field"><button class="btn" style="width:100%;justify-content:space-between" onclick="gomuluYeni()">Yeni gömülü mesaj <span style="font-size:18px">+</span></button></div>'
    +(liste.length?'<div class="kv-list" style="margin-top:14px">'+liste.map((g,i)=>'<div class="liste-satir"><span><b>'+esc(g.baslik||('Mesaj '+(i+1)))+'</b> <span style="color:var(--mut)">'+esc(kanalAd(g.kanal))+'</span></span><button class="btn sm" onclick="gomuluSil('+i+')">Sil</button></div>').join('')+'</div>':'<div class="bos">Henüz gömülü mesaj yok.</div>')
    +'</div>'+saveBar();
}
function gomuluYeni(){
  if(!Array.isArray(FORM.gomuluMesajlar))FORM.gomuluMesajlar=[];
  document.getElementById('modal-root').innerHTML='<div class="modal-bg" onclick="if(event.target===this)modalKapat()"><div class="modal"><div class="modal-h"><span>Yeni gömülü mesaj</span><button onclick="modalKapat()">✕</button></div><div class="modal-b">'
    +'<div class="field"><label>Başlık</label><input type="text" id="g-baslik" placeholder="Duyuru"></div>'
    +'<div class="field"><label>Açıklama</label><textarea id="g-acik" placeholder="Mesaj içeriği"></textarea></div>'
    +'<div class="field"><label>Kanal</label><select id="g-kanal">'+secenek('yazi','','Bir kanal seçin')+'</select></div>'
    +'<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button class="btn" onclick="modalKapat()">İptal</button><button class="btn pri" onclick="gomuluEkle()">Ekle</button></div></div></div></div>';
}
function gomuluEkle(){
  const b=document.getElementById('g-baslik').value.trim(),a=document.getElementById('g-acik').value.trim(),k=document.getElementById('g-kanal').value;
  if(!a){toast('Açıklama yaz');return}
  FORM.gomuluMesajlar.push({baslik:b.slice(0,100),aciklama:a.slice(0,1500),kanal:k||null});
  modalKapat();renderContent();
}
function gomuluSil(i){FORM.gomuluMesajlar.splice(i,1);renderContent()}

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
function cizEmojiRol(c){
  const liste=Array.isArray(FORM.emojiRoller)?FORM.emojiRoller:[];
  c.innerHTML='<div class="page-h">Emoji Rol</div><div class="page-s">Üyelerin mesajlara tepki vererek rol almasını sağlar</div>'
    +'<div class="panel"><div class="row3"><div><label>Kanal</label><select id="er-kanal">'+secenek('yazi','','Seçin')+'</select></div><div><label>Emoji</label><input type="text" id="er-emoji" placeholder="😀"></div><div><label>Rol</label><select id="er-rol">'+secenek('rol','','Seçin')+'</select></div></div>'
    +'<div style="margin-top:12px"><button class="btn pri sm" onclick="erEkle()">+ Ekle</button></div>'
    +'<div style="margin-top:14px">'+(liste.length?liste.map((x,i)=>'<div class="liste-satir"><span>'+esc(x.emoji)+' → '+esc(rolAd(x.rol))+' <span style="color:var(--mut)">'+esc(kanalAd(x.kanal))+'</span></span><button class="btn sm" onclick="erSil('+i+')">Sil</button></div>').join(''):'<div class="bos">Kayıt yok.</div>')+'</div></div>'+saveBar();
}
function erEkle(){
  const k=document.getElementById('er-kanal').value,e=document.getElementById('er-emoji').value.trim(),r=document.getElementById('er-rol').value;
  if(!e||!r){toast('Emoji ve rol gerekli');return}
  if(!Array.isArray(FORM.emojiRoller))FORM.emojiRoller=[];
  FORM.emojiRoller.push({kanal:k||null,emoji:e.slice(0,10),rol:r});renderContent();
}
function erSil(i){FORM.emojiRoller.splice(i,1);renderContent()}

/* etiket */
async function cizEtiket(c){
  c.innerHTML='<div class="page-h">Sunucu Etiketi</div><div class="page-s">Üyeler sunucu etiketinizi aldığında roller ekleyin ve bildirimler gönderin</div>'
    +'<div class="panel"><div class="row3"><div><label>Etiket</label><input type="text" id="et-tag" maxlength="20" placeholder="örn: ★"></div><div><label>Rol</label><select id="et-rol">'+secenek('rol','','Seçin')+'</select></div><div><label>&nbsp;</label><button class="btn pri" onclick="etKaydet()">Kaydet</button></div></div><div id="et-durum" style="margin-top:12px;color:var(--mut);font-size:13px">Yükleniyor...</div></div>'+saveBar();
  try{
    const j=await api('/api/liste/'+SID);
    document.getElementById('et-durum').innerHTML=j.tagSistemi?('Aktif: <b>'+esc(j.tagSistemi.tag)+'</b> → '+esc(rolAd(j.tagSistemi.rolId))+' <button class="btn sm" onclick="etKapat()">Kapat</button>'):'Kapalı.';
    if(j.tagSistemi){document.getElementById('et-tag').value=j.tagSistemi.tag||''}
  }catch{}
}
async function etKaydet(){
  const t=document.getElementById('et-tag').value,r=document.getElementById('et-rol').value;
  if(!t.trim()||!r){toast('Etiket ve rol gerekli');return}
  await api('/api/liste',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID,liste:'tagSistemi',tag:t,rolId:r})});
  toast('Kaydedildi');renderContent();
}
async function etKapat(){
  await api('/api/liste',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId:SID,liste:'tagSistemi',islem:'kapat'})});
  toast('Kapatıldı');renderContent();
}

function cizPremium(c){
  c.innerHTML='<div class="page-h">Premium</div><div class="page-s">Premium özellikler ve durum</div><div class="panel"><h3 style="font-size:14px">👑 Premium</h3><p style="color:var(--mut);font-size:13px;margin-top:6px">Premium kodun varsa bota <code>/premium aktifleştir</code> yazarak açabilirsin. Ses XP, davet rolleri ve gelişmiş karşılama gibi özellikler premium sunucularda çalışır.</p></div>';
}
function cizDenetimMasasi(c){
  c.innerHTML='<div class="page-h">Denetim Masası</div><div class="page-s">Topluluk moderasyonunu güvenilir üyelerle yönetin</div>'
    +'<div class="panel"><div class="warn yel">⚠ Buraya eklediğiniz roller denetim kaydı ve hızlı işlem menüsüne erişir.</div><div class="field"><label>Güvenilir roller</label>'+rolChips('moderatorRol')+'</div>'
    +'<div class="field"><label>Bildirim kanalı</label><select data-k="logKanal">'+secenek('yazi',FORM.logKanal,'Bir kanal seçin')+'</select></div>'
    +'<div class="field"><label>Not</label><input type="text" data-k="denetimNot" value="'+esc(FORM.denetimNot||'')+'" placeholder="örn: 3 uyarıda sustur"></div></div>'+saveBar();
}
function cizGov(c,id){
  const ad=NAV_AD[id]||'Güvenlik';
  const acik={
    govDavet:'İzinsiz davet paylaşımlarını engeller.',
    govHesap:'Yeni açılmış ve şüpheli hesapları filtreler.',
    govRol:'Kısa sürede çok fazla rol işlemini engeller.',
    govBot:'İzinsiz botları sunucudan uzak tutar.',
    govYasak:'Kısa sürede çok fazla yasaklamayı engeller.',
    govAtma:'Kısa sürede çok fazla atmayı engeller.',
    govKanal:'Kısa sürede çok fazla kanal açma/silmeyi engeller.',
    govWebhook:'İzinsiz webhookları otomatik siler.',
    govEmoji:'Emoji spamını ve izinsiz emoji işlemlerini sınırlar.'
  }[id]||'';
  c.innerHTML='<div class="page-h">'+ad+'</div><div class="page-s">'+acik+'</div>'
    +'<div class="panel"><div class="panel-top"><div><h3>'+ad+'</h3><p>'+acik+'</p></div><label class="tgl"><input type="checkbox" data-k="'+id+'"'+(FORM[id]?' checked':'')+'><span class="ray"></span></label></div>'
    +'<div class="warn yel">⚠ Bu koruma tetiklendiğinde olay güvenlik kanalına kaydedilir.</div>'
    +'<div class="field"><label>Güvenlik kanalı</label><select data-k="guvenlikKanal">'+secenek('yazi',FORM.guvenlikKanal,'Bir kanal seçin')+'</select></div></div>'+saveBar();
}

document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLocaleLowerCase('tr')==='k'){e.preventDefault();document.getElementById('ara')?.focus()}});
baslat();
