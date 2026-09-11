// ✦ EmocAI — Groq destekli yapay zekâ. Kimliği HER ZAMAN EmocAI'dır!
// Free: 15/gün • Premium: 100/gün + komutsuz sohbet kanalı.
const { db, save } = require('./db');

const MODEL = 'openai/gpt-oss-120b';
const MODEL_YEDEK = 'qwen/qwen3.8-27b';
const FREE_LIMIT = 15;
const PREM_LIMIT = 100;

const SYSTEM = `Sen EmocAI'sın — Emoç Discord botunun yerleşik yapay zekâsısın. Seni Emoç ekibi yaptı.
ASLA Groq, Meta, Llama, OpenAI, ChatGPT ya da başka bir isim veya model adı söyleme. Kim olduğunu soranlara esprili şekilde "Ben EmocAI'yım, Emoç'un ta kendisiyim! 😎" de.
Kişiliğin: sıcakkanlı, şakacı, zeki, biraz yaramaz ama asla kırıcı değil. Türkçe konuşuyorsun. İnsanları seviyorsun, onlara takılıyorsun, ortama neşe katıyorsun.
Kurallar:
- Cevapların NE destan NE tek kelime olsun: 2-5 cümle, en fazla ~70 kelime.
- Küfür, hakaret, argo YOK. Kaba istekleri kibarca ve esprili şekilde reddet.
- Tehlikeli veya yasadışı konularda yardım ETME, konuyu espriyle değiştir.
- Discord sohbetindesin: en fazla 2 emoji kullan.
- Bilmediğin şeyi uydurma; bilmiyorsan esprili şekilde söyle.`;

const konusmalar = new Map(); // kanalId -> [{role, content, zaman}]
const soguma = new Map(); // userId -> timestamp (kanal sohbeti spam koruması)

function limitFor(premium) {
  return premium ? PREM_LIMIT : FREE_LIMIT;
}
function gunAnahtari() {
  return new Date().toISOString().slice(0, 10);
}
function kalanHak(gid, uid, premium) {
  const d = db();
  const n = (d.aiKullanim && d.aiKullanim[`ai_${gid}_${uid}_${gunAnahtari()}`]) || 0;
  return Math.max(0, limitFor(premium) - n);
}
function hakTuket(gid, uid) {
  const d = db();
  if (!d.aiKullanim) d.aiKullanim = {};
  const k = `ai_${gid}_${uid}_${gunAnahtari()}`;
  d.aiKullanim[k] = (d.aiKullanim[k] || 0) + 1;
  if (Object.keys(d.aiKullanim).length > 3000) {
    const bugun = gunAnahtari();
    for (const anahtar of Object.keys(d.aiKullanim)) {
      if (!anahtar.endsWith('_' + bugun)) delete d.aiKullanim[anahtar];
    }
  }
  save();
}
function sogumaKontrol(uid, ms = 10000) {
  const simdi = Date.now();
  if (simdi - (soguma.get(uid) || 0) < ms) return false;
  soguma.set(uid, simdi);
  return true;
}
function gecmisAl(kanalId) {
  const simdi = Date.now();
  const arr = (konusmalar.get(kanalId) || []).filter((m) => simdi - m.zaman < 10 * 60_000);
  return arr.slice(-6).map(({ role, content }) => ({ role, content }));
}
function gecmisEkle(kanalId, role, content) {
  const arr = konusmalar.get(kanalId) || [];
  arr.push({ role, content: String(content).slice(0, 500), zaman: Date.now() });
  konusmalar.set(kanalId, arr.slice(-8));
}

async function groqSorgula(mesajlar, model) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY yok!');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: mesajlar, max_tokens: 300, temperature: 0.9 }),
  });
  if (!r.ok) throw new Error('groq ' + r.status);
  const j = await r.json();
  const cevap = j.choices?.[0]?.message?.content?.trim();
  if (!cevap) throw new Error('boş cevap');
  return cevap;
}

async function aiCevapla({ guildAd, kullaniciAd, soru, kanalId, premium }) {
  const sistem = SYSTEM + `\nBağlam: ${guildAd} sunucusundasın, konuştuğun kişi: ${kullaniciAd}.`;
  const gecmis = kanalId ? gecmisAl(kanalId) : [];
  const mesajlar = [
    { role: 'system', content: sistem },
    ...gecmis,
    { role: 'user', content: String(soru).slice(0, 500) },
  ];
  let cevap;
  try { cevap = await groqSorgula(mesajlar, MODEL); }
  catch { cevap = await groqSorgula(mesajlar, MODEL_YEDEK); }
  if (kanalId) {
    gecmisEkle(kanalId, 'user', soru);
    gecmisEkle(kanalId, 'assistant', cevap);
  }
  return cevap;
}

module.exports = {
  SYSTEM, MODEL, FREE_LIMIT, PREM_LIMIT,
  limitFor, kalanHak, hakTuket, sogumaKontrol, aiCevapla,
};
