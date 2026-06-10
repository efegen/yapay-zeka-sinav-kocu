// YZDSK AI Proxy — Cloudflare Worker
// ----------------------------------
// Amaç: OpenAI API anahtarını istemciden gizlemek. Uygulama bu worker'ı çağırır;
// worker, anahtarı Cloudflare secret'ından (env.OPENAI_API_KEY) okuyup OpenAI'a iletir.
// Böylece anahtar uygulama paketine (APK / web bundle) HİÇ girmez.
//
// Endpoint:  POST /chat   body: { ogrenciBaglam, mesajlar: [{ rol, metin }] }
// Yanıt:     { yanit: string }  veya  { hata: string }

export interface Env {
  OPENAI_API_KEY: string;
  /** Sohbet (kart JSON) modeli — wrangler.toml [vars] / .dev.vars'tan gelir. */
  CHAT_MODEL?: string;
  /** Soru fotoğrafı: zorluk/okunabilirlik triyaj modeli (ucuz, hızlı). */
  VISION_MODEL_TRIAGE?: string;
  /** Soru fotoğrafı çözücüleri — zorluğa göre seçilir. */
  VISION_MODEL_KOLAY?: string;
  VISION_MODEL_ORTA?: string;
  VISION_MODEL_ZOR?: string;
  /** YKS (TYT) tarihi, "YYYY-AA-GG" — geri sayım bağlamı için (yılda bir güncellenir). */
  YKS_TARIH?: string;
}

// Env tanımlı değilse kullanılacak makul varsayılanlar.
// Model seçimi günlük ÜCRETSİZ kota havuzlarına göre yapılır (paylaşımlı trafik programı):
//   · büyük havuz (gpt-5.x / gpt-4.1 / o-serisi): 250k token/gün → KIT, yalnızca ZOR sorulara
//   · mini havuz (gpt-5-mini / gpt-4.1-mini / nano'lar): 2.5M token/gün → bol, geri kalan her şeye
// Bu yüzden "kolay" çözücü gpt-4.1 DEĞİL gpt-5-mini'dir (gpt-4.1 büyük havuzu yer; üstelik
// token başına da pahalıdır). gpt-5-mini'ye reasoning_effort='minimal' verilir: düşünme tokenı
// bütçeyi yemez, tavan öngörülebilir kalır. Sohbet reasoning gerektirmez → gpt-4.1-mini.
// Zor sorular gpt-5.1'e gider (büyük havuzda; adaptif reasoning ile gpt-5'ten daha verimli).
const VARSAYILAN_CHAT_MODEL = 'gpt-4.1-mini';
const VARSAYILAN_TRIAGE = 'gpt-4.1-mini';
const VARSAYILAN_KOLAY = 'gpt-5-mini';
const VARSAYILAN_ORTA = 'gpt-5-mini';
const VARSAYILAN_ZOR = 'gpt-5.1';

interface OgrenciBaglam {
  isim?: string;
  sinif?: string;
  puanTuru?: string;
  hedefTuru?: string;
  hedefUniversite?: string;
  hedefBolum?: string;
  hedefSiralama?: number;
  hedefNetler?: Record<string, number>;
  gunlukSoruHedefi?: number;
  zorlananKonular?: string[]; // koç hafızasından (öğrencinin zorlandığı konular)
  iyiKonular?: string[]; // koç hafızasından (öğrencinin iyi olduğu konular)
  denemeler?: string[]; // son deneme sonuçlarının tek satırlık özetleri (yeni → eski)
}

interface SohbetMesaji {
  rol: 'kullanici' | 'asistan';
  metin: string;
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ════════════════════════════════════════════════════════════════════
// KART PROTOKOLÜ (bkz. design_handoff_ai_koc/KART_PROTOKOLU.md)
// Model { yanit, kartlar:[{tip,veri}] } üretir. UI tipli kartları çizer.
// ════════════════════════════════════════════════════════════════════
const GECERLI_TIPLER = new Set([
  'gunlukBrifing', 'baglamSeridi', 'niyetIzgarasi', 'pomodoroPlani', 'konuAdimlari',
  'miniDenemeAnalizi', 'cozumAdimlari', 'ipucu', 'momentum', 'molaRecetesi',
  'denemeKiyasi', 'enBuyukKazanc', 'haftalikPlan', 'formulKarti',
  'oturumZamanPlani', 'sinavCantasi', 'hedefOzeti', 'projeksiyon',
]);

/** Sık kartların ZORUNLU alanları dolu mu (yalın prompt'ın olası şema-sadakat kaybını telafi eder). */
function gecerliKart(tip: string, veri: Record<string, unknown>): boolean {
  const dolu = (a: unknown) => Array.isArray(a) && a.length > 0;
  switch (tip) {
    case 'cozumAdimlari':
      return dolu(veri.adimlar) && typeof veri.sonuc === 'string';
    case 'konuAdimlari':
      return typeof veri.konu === 'string' && dolu(veri.adimlar);
    case 'formulKarti':
      return typeof veri.konu === 'string' && dolu(veri.formuller);
    case 'haftalikPlan':
      return dolu(veri.gunler);
    default:
      return true; // diğer kartlar için tip+veri kontrolü yeterli
  }
}

/**
 * Kontrol karakterine dönüşmüş LaTeX komutlarını geri kurtarır. Model "\frac" gibi TEK ters bölülü
 * LaTeX yazınca "\f" geçerli bir JSON kaçışı (form feed) olduğundan JSON.parse onu kontrol
 * karakterine çevirir → istemcide "rac" kalır. \b,\v,\t,\r de aynı (\beta,\vec,\times,\rho).
 * Bu beşi içerikte asla meşru görünmez → komuta geri çevirmek güvenli. (\n GERÇEK satır sonu
 * olabildiğinden DOKUNULMAZ; formül kartı sol/sağ için istemci ayrıca \n'i de kurtarır.)
 */
function latexKurtar(s: string): string {
  return s
    .replace(/\f/g, '\\f')
    .replace(/\x08/g, '\\b')
    .replace(/\v/g, '\\v')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

/** Nesnedeki tüm string alanlarda LaTeX kurtarma uygular (yalnızca kart verisi; "yanit" düz metnine değil). */
function derinKurtar(v: unknown): unknown {
  if (typeof v === 'string') return latexKurtar(v);
  if (Array.isArray(v)) return v.map(derinKurtar);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object)) o[k] = derinKurtar((v as any)[k]);
    return o;
  }
  return v;
}

/** Modelin ürettiği kartları doğrular: bilinmeyen tipi/eksik veriyi düşürür, max 2 kart. */
function temizleKartlar(ham: unknown): { tip: string; veri: Record<string, unknown> }[] {
  if (!Array.isArray(ham)) return [];
  const temiz: { tip: string; veri: Record<string, unknown> }[] = [];
  for (const k of ham) {
    if (!k || typeof k !== 'object') continue;
    const tip = (k as any).tip;
    const veri = (k as any).veri;
    if (typeof tip !== 'string' || !GECERLI_TIPLER.has(tip)) continue;
    if (!veri || typeof veri !== 'object' || Array.isArray(veri)) continue;
    if (!gecerliKart(tip, veri)) continue; // zorunlu alanı eksik kartı düşür
    temiz.push({ tip, veri: derinKurtar(veri) as Record<string, unknown> }); // LaTeX kontrol-karakteri kurtar
    if (temiz.length >= 2) break; // yanıt başına en fazla 2 kart
  }
  return temiz;
}

// ════════════════════════════════════════════════════════════════════
// SİSTEM PROMPTU
// Koçun kişiliği, sınırları ve veriyi nasıl yorumlayacağı burada tanımlanır.
// Yapı: önce SABİT çekirdek (görev + kurallar + kart rehberi — her istekte birebir aynı,
// böylece OpenAI prompt cache prefiksi tüm kullanıcılarda paylaşılır), EN SONDA değişken
// öğrenci bağlamı (tarih, profil, hafıza, denemeler). Sabit kısmı genişletirken sırayı koru.
// ════════════════════════════════════════════════════════════════════
function sistemPromptu(b: OgrenciBaglam, env: Env): string {
  return [
    'Sen "YZDSK" uygulamasının yapay zeka sınav koçusun. Türkiye\'deki YKS (TYT/AYT) sınavına',
    'hazırlanan bir öğrenciye birebir koçluk yapıyorsun. Görevin; motivasyon vermek, çalışma',
    'stratejisi önermek, konu/soru çözümünde yol göstermek ve öğrenciyi planlı tutmaktır.',
    'Öğrencinin profili ve bugünün tarihi bu talimatların EN SONUNDA verilir.',
    '',
    'Kurallar:',
    '- Türkçe, sıcak, samimi ve motive edici bir dille konuş. Öğrenciye ismiyle hitap edebilirsin.',
    '- Somut ol: "çok çalış" deme; hangi konu, kaç soru, kaç dakika Pomodoro gibi uygulanabilir öneriler ver.',
    '- ELİNDE OLMAYAN veriyi UYDURMA. Üniversite taban puanı/sıralaması veya öğrencinin geçmiş deneme',
    '  sonuçları gibi sana verilmemiş bilgileri varmış gibi söyleme; gerekirse öğrenciden bilgi iste.',
    '- Ciddi psikolojik/sağlık durumlarında profesyonel destek almasını da öner.',
    '- Sınav dışı, alakasız veya uygunsuz taleplerde nazikçe sınav hazırlığına geri yönlendir.',
    '- Plan/program/öneri üretirken öğrencinin "zorlandığı konular"ı (hafıza) öncele ve NEDEN eklediğini',
    '  kısaca söyle (örn. "Limit\'te zorlanmıştın, çarşambaya koydum"). Bu liste sana verilmediyse uydurma.',
    '- "İyi olduğu konular"ı (hafıza) gereksiz yere baştan anlatma, kısa geç; "zorlandığı konular"da ise',
    '  daha temkinli, temelden ve sabırlı açıkla. Bu listeler sana verilmediyse uydurma.',
    '- Öğrenci bir çözümü/konuyu anlamadığını söylerse tüm çözümü baştan DÖKME. Hangi ADIMI/kavramı anlamadığını',
    '  AÇIKÇA belirtmişse (örn. "X adımını anlamadım") tekrar "hangi adım?" diye SORMA; doğrudan YALNIZCA o adımı',
    '  sade, kısa ve NEDEN-li (neden bu işlem yapıldı) açıkla. Belirtmemişse önce kısaca nerede takıldığını sor.',
    '- Tarih/gün gerektiren işlerde (haftalık plan, geri sayım, "bugün/yarın") EN SONDAKİ "Bugün" satırını',
    '  esas al; günleri ona göre hesapla, tahmin etme.',
    '',
    KART_REHBERI,
    '',
    'Öğrenci bağlamı:',
    ogrenciBaglamMetni(b, env),
  ].join('\n');
}

const TR_AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const TR_GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** Değişken (kullanıcıya/güne özgü) bağlam — sabit çekirdeğin SONUNA eklenir ki cache bozulmasın. */
function ogrenciBaglamMetni(b: OgrenciBaglam, env: Env): string {
  const satirlar: string[] = [];

  // Türkiye saati (UTC+3, yıl boyu sabit): plan "bugün"ü ve YKS geri sayımı buna dayanır.
  const ist = new Date(Date.now() + 3 * 3600 * 1000);
  satirlar.push(
    `- Bugün: ${ist.getUTCDate()} ${TR_AYLAR[ist.getUTCMonth()]} ${ist.getUTCFullYear()} ${TR_GUNLER[ist.getUTCDay()]}`
  );
  if (env.YKS_TARIH) {
    const yks = Date.parse(`${env.YKS_TARIH}T09:00:00+03:00`);
    if (Number.isFinite(yks)) {
      const kalan = Math.ceil((yks - ist.getTime() + 3 * 3600 * 1000) / 86_400_000);
      if (kalan > 0 && kalan <= 400) satirlar.push(`- YKS'ye yaklaşık ${kalan} gün var.`);
      else if (kalan <= 0 && kalan > -40) satirlar.push('- Bu yılın YKS sınavı geçti (sonuç/tercih dönemi olabilir).');
    }
  }

  if (b.isim) satirlar.push(`- İsim: ${b.isim}`);
  if (b.sinif) satirlar.push(`- Sınıf: ${b.sinif}`);
  if (b.puanTuru) satirlar.push(`- Puan türü: ${b.puanTuru}`);
  if (b.hedefTuru === 'siralama' && b.hedefSiralama) {
    satirlar.push(`- Hedef: ${b.hedefSiralama}. sıralama`);
  } else if (b.hedefUniversite) {
    satirlar.push(`- Hedef: ${b.hedefUniversite}${b.hedefBolum ? ' / ' + b.hedefBolum : ''}`);
  }
  if (b.gunlukSoruHedefi) satirlar.push(`- Günlük soru hedefi: ${b.gunlukSoruHedefi}`);
  if (b.hedefNetler && Object.keys(b.hedefNetler).length) {
    const ozet = Object.entries(b.hedefNetler)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    satirlar.push(`- Hedef netler: ${ozet}`);
  }
  if (b.zorlananKonular && b.zorlananKonular.length) {
    satirlar.push(`- Zorlandığı konular (hafıza): ${b.zorlananKonular.join(', ')}`);
  }
  if (b.iyiKonular && b.iyiKonular.length) {
    satirlar.push(`- İyi olduğu konular (hafıza): ${b.iyiKonular.join(', ')}`);
  }
  if (b.denemeler && b.denemeler.length) {
    const liste = b.denemeler.slice(0, 3).map((s) => `  · ${String(s).slice(0, 220)}`);
    satirlar.push(`- Son denemeleri (yeni → eski):\n${liste.join('\n')}`);
  }
  return satirlar.join('\n');
}

// ── Yapılandırılmış çıktı yönergesi ──
const KART_REHBERI = [
  'ÇIKTI FORMATI:',
  '- Yanıtı GEÇERLİ JSON ver: { "yanit": "...", "kartlar": [ { "tip": "...", "veri": {...} } ] }',
  '- "yanit" hep dolu: kartı tanıtan sıcak, kısa cümle — kart içeriğini TEKRARLAMA. Vurgu için **kalın** (tek * yok).',
  '- En fazla 2 kart, en değerlisini seç. Genel/duygusal/belirsiz sohbette kart üretme ("kartlar": []).',
  '',
  'HAFIZA (opsiyonel, ÇOK TEMKİNLİ):',
  '- YALNIZCA öğrenci açıkça zorlandığını ("X\'i anlamıyorum") ya da artık anladığını söylerse ekle:',
  '  "hafiza": { "konu": "Limit", "ders": "AYT Matematik", "sinyal": "zorlaniyor"|"anladi" }. Şüphedeysen KOYMA.',
  '',
  'KART SEÇİMİ (niyet → tip):',
  '- Konu ÖĞRETME ("anlat"/"anlamıyorum"/"sıfırdan"): açıklama "yanit"a (+ "formulKarti"/"ipucu") — konuAdimlari DEĞİL.',
  '- Konu ÇALIŞMA PLANI ("nasıl çalışırım"): "konuAdimlari". · Çözülecek/ürettiğin örnek soru: "cozumAdimlari" (+ "ipucu").',
  '- Plan: "pomodoroPlani" (oturum) / "haftalikPlan" (hafta). · Formül/özet: "formulKarti". · Moral: "momentum" + "molaRecetesi".',
  '- Deneme sonucu: "denemeKiyasi" + "enBuyukKazanc". · Sınav günü: "oturumZamanPlani" + "sinavCantasi". · "Yetişir mi": "hedefOzeti" + "projeksiyon".',
  '',
  'ÖĞRETME & ALIŞTIRMA (en önemli iş):',
  '- Bir konuyu öğretirken "yanit"ta sıcak, sade, günlük örnekli, paragraf paragraf AÇIKLA — checklist\'e BÖLME',
  '  (konuAdimlari öğretmez). "konuAdimlari" yalnızca yol haritası: adimlar = KISA eylemler (~6 kelime, "Kavramı',
  '  videodan izle", "Temel 10 soru çöz") — tanım/açıklama/LaTeX KOYMA; en çok 1 aksiyon (alıştırma CTA\'sı).',
  '- "yanit" LaTeX RENDER ETMEZ: formülü "formulKarti"na (LaTeX) koy ya da sözel söyle ("x karenin türevi 2x");',
  '  "yanit" içine $...$ / \\frac yazma.',
  '- Örnek/alıştırma sorusu istenirse o konudan YENİ soru ÜRET, "cozumAdimlari" ile çöz: soru ekranda görünmez →',
  '  "giris"e açıkça yaz (LaTeX). Öğrenci önce denesin diye adımları kapalı başlat ("acikAdim": -1).',
  '- Ürettiğin ya da sorulan bir matematik çözümünde sonucu EMIT ETMEDEN ÖNCE kendin DOĞRULA (yerine koy/mantık',
  '  kontrolü), hatalıysa düzelt. YALNIZCA soru çok karmaşık/çok adımlıysa fotoğrafla göndermesini öner (daha',
  '  güçlü çözüm hattı); sıradan soruları kaçma, çöz.',
  '',
  'VERİ DÜRÜSTLÜĞÜ (en kritik):',
  '- "momentum", "denemeKiyasi", "hedefOzeti", "projeksiyon", "baglamSeridi", "miniDenemeAnalizi" GEÇMİŞ VERİ ister:',
  '  bağlamda verildiyse kullan; verilmediyse UYDURMA, "yanit"ta öğrenciden iste (örn. son deneme netleri).',
  '  Öğrenci bağlamında "Son denemeleri" satırı varsa deneme kartlarını O gerçek netlerle doldur.',
  '- Net/sıra/süre sayılarını asla tahmin edip karta yazma; yalnızca bağlamdaki değerleri kullan.',
  '',
  'KART ŞEMALARI (alan adlarını TAM kullan):',
  '- pomodoroPlani: { baslik, ozet, bloklar:[{sure,ders,tip:"odak"|"mola",renk?}], cta?:{etiket,aksiyon:"pomodoro"} }',
  '- konuAdimlari: { konu, adimlar:[KISA eylem — tanım/LaTeX YOK], tamamlanan?:[index], aksiyonlar?:[{etiket,birincil?}] (en çok 1, alıştırma CTA\'sı) }',
  '- miniDenemeAnalizi: { baslik, dersler:[{ad,net,max,renk}], icgoru }',
  '- cozumAdimlari: { giris, adimlar:[{ad,detay}], sonuc, acikAdim? } (giris: öğrenci soruyu verdiyse tekrarlama; SEN ürettiysen soruyu giris\'e yaz)',
  '    · sonuc: net nihai cevap. Soru ŞIKLIYSA doğru şıkkın HARFİNİ MUTLAKA yaz (örn. "Cevap: C ($24$ birim)").',
  '- ipucu: { baslik, metin }',
  '- momentum: { baslik, altBaslik?, metrikler:[{deger,etiket,icon,renk}], not? }',
  '- molaRecetesi: { baslik, altBaslik?, ogeler:[{icon,metin}], cta?:{etiket,aksiyon:"pomodoro"} }',
  '- denemeKiyasi: { baslik, altBaslik?, dersler:[{ad,net,max,onceki,renk}], toplamNet:{deger,fark}, tahminiSira?:{deger,yon:"yukari"|"asagi"|"sabit"} }',
  '- enBuyukKazanc: { ders, yuzde(0-100), renk, metin, cta?:{etiket,aksiyon:"plan"} }',
  '- haftalikPlan: { baslik, ozet, tarihAraligi?, gunler:[{gun,odak,sure,renk,bugun?,isler:[metin]}], cta?:{etiket,aksiyon:"takvim"} }',
  '    · gun: TAM Türkçe gün adı ("Pazartesi".."Pazar"). Günler bağlamdaki "Bugün"den başlayıp ARDIŞIK ilerler;',
  '      N günlük istekte N ardışık gün (7\'yi aşınca gün adları tekrar eder — normaldir). bugun:true yalnız ilk güne.',
  '    · sure: günün TOPLAM süresi BİRİMLİ ("120 dk"/"2 saat", çıplak sayı yok). odak: ana ders/konu (kısa).',
  '    · isler: 2-3 KISA alt görev (takvime adım olur). cta.etiket "Takvime ekle".',
  '    · baslik ≤30 karakter, ozet tek kısa cümle. tarihAraligi KISA: "10–19 Haziran" gibi (ay/yıl tekrarı yok).',
  '- formulKarti: { ders, konu, formuller:[{sol,sag,not?}], altinKural?, kaydedilebilir? }',
  '    · formuller: eşitliği "=" yerinden İKİYE BÖL — sol = eşitliğin SOL yanı, sag = SAĞ yanı/sonucu;',
  '      İKİSİ de KISA LaTeX (örn. sol "(x^n)\'", sag "n \\\\cdot x^{n-1}"). not = KISA Türkçe açıklama ("Güç kuralı").',
  '    · sol/sag içine Türkçe açıklama ya da eşitliğin TAMAMINI yazma; açıklama HER ZAMAN "not" alanına.',
  '- oturumZamanPlani: { baslik, altBaslik?, dagilim:[{ad,dk,renk}], altinKural? }',
  '- sinavCantasi: { baslik, altBaslik?, maddeler:[metin], tamamlanan?:[index] }',
  '- hedefOzeti: { hedef, yuzde(0-100), hedefSira?, guncelSira?, netler:[{ad,simdi,hedef,renk}], not? }',
  '- projeksiyon: { baslik, altBaslik?, barlar:[{etiket,deger,yukseklik(0-100),tip:"notr"|"ara"|"hedef"}], sonuc:{durum:"yetisir"|"riskli"|"yetismez",metin} }',
  '',
  'RENKLER: yalnızca #7C3AED (mor), #EC4899 (pembe), #10B981 (yeşil), #F59E0B (turuncu), #94A3B8 (nötr).',
  'ICON: timer, book, trendUp, calendar, clock, shield, target, moon, bolt, flame, pencil.',
  'MATEMATİK: cozumAdimlari ("detay","sonuc") ve formulKarti matematiğini LaTeX yaz ($...$ satır içi, $$...$$ blok;',
  'kesir \\frac{pay}{payda}, üs x^2, kök \\sqrt{}; düz "a/b" yok). Çok satır: $$\\begin{aligned} a &= b \\\\ &= c \\end{aligned}$$',
  '(\\begin{aligned} MUTLAKA $$...$$ içinde).',
  'JSON string içinde her LaTeX ters bölüsünü ÇİFT yaz ("\\\\frac" gibi); tek ters bölü JSON kaçışında bozulur.',
  '"Eşit değildir" için \\\\neq YERİNE ≠ sembolünü kullan (\\n ile başlayan komutlar satır sonuna dönüşebilir).',
].join('\n');
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// SORU ÇÖZ — görsel (vision) sistem promptu
// ════════════════════════════════════════════════════════════════════
const SORU_PROMPT = [
  'Sen YZDSK uygulamasının YKS (TYT/AYT) soru çözüm asistanısın. Sana bir soru FOTOĞRAFI verilir.',
  'Görseldeki soruyu OKU, Türkçe ve adım adım çöz. Çıktıyı YALNIZCA geçerli JSON olarak ver:',
  '',
  '{',
  '  "durum": "cozuldu" | "bulanik" | "alakasiz",',
  '  "yanit": "kısa, sıcak bir giriş cümlesi (çözümü tekrarlama)",',
  '  "ders": "AYT Matematik" gibi,',
  '  "konu": "Limit" gibi,',
  '  "kartlar": [',
  '    { "tip": "cozumAdimlari", "veri": { "giris": "çözüme 1 cümlelik giriş/yaklaşım", "adimlar": [{ "ad": "Adım başlığı", "detay": "açıklama/işlem" }], "sonuc": "kısa nihai cevap (şıklı soruda şık harfiyle)", "acikAdim": 0 } },',
  '    { "tip": "ipucu", "veri": { "baslik": "Ezber ipucu", "metin": "kısa püf nokta" } }',
  '  ]',
  '}',
  '',
  'KURALLAR:',
  '- Soruyu ve ŞIKLARI çözümde TEKRARLAMA (öğrenci zaten fotoğrafı sağladı). "giris" alanında soruyu',
  '  yeniden yazma; bunun yerine çözüme kısa bir giriş/yaklaşım cümlesi yaz (örn. "Zincir kuralıyla çözelim").',
  '  (Nihai cevapta doğru şıkkın harfini söylemek tekrar DEĞİLDİR — o zorunludur, aşağıya bak.)',
  '- Görseldeki soruyu net OKUYAMIYORSAN (bulanık, karanlık, kesik): durum="bulanik", kartlar=[], yanit kısa açıklama.',
  '- Görselde bir SORU YOKSA (alakasız fotoğraf): durum="alakasiz", kartlar=[], yanit kısa açıklama.',
  '- Soru okunuyorsa: durum="cozuldu". Adım sayısını soruya göre AYARLA — basit soruda 1-2 kısa adım yeter,',
  '  her şeyi gereksiz yere bölme; yalnızca çok adımlı/zor soruda 3-5 adım kullan.',
  '- ŞIKLI SORUDA "sonuc" MUTLAKA doğru şıkkın HARFİNİ içersin: önce değer, sonra şık —',
  '  örn. "Altıgenin çevresi $24$ birim → Cevap: C". Bulduğun değeri görseldeki şıklarla EŞLEŞTİR;',
  '  hiçbir şıkla eşleşmiyorsa çözümünü gözden geçir. Şıklar görselde yoksa/okunamıyorsa yalnız değeri yaz.',
  '- "adimlar[].ad" KISA, düz Türkçe başlık olsun (LaTeX/$ KOYMA). Matematik yalnızca "detay" ve "sonuc"ta.',
  '- Metinde GERÇEK satır sonu kullan; "\\n" gibi kaçış dizilerini düz metin olarak YAZMA.',
  '- Çözmeden önce verilenleri dikkatle oku. Çözümü bitirince nihai cevabı DOĞRULA: bulduğun sonucu',
  '  soruda yerine koy ya da mertebe/birim/mantık kontrolü yap. Tutmuyorsa adımları gözden geçirip DÜZELT.',
  '- VARSAYILAN = ÇÖZ. Görsel okunuyorsa MUTLAKA bir çözüm üret; "net değil/belirsiz" deyip çözmeyi BIRAKMA.',
  '  Şekil/katlama/grafik sorularında en makul standart yorumu KABUL ET (gerekirse "Şu varsayımla:" diye TEK',
  '  cümleyle belirt) ve çöz. durum="bulanik" YALNIZCA görsel gerçekten okunamıyorsa (bulanık/karanlık/kesik).',
  '- UYDURMA = yalnızca GÖREMEDİĞİN sayısal bir değeri tahmin etmek. Görüneni makul yorumlayıp çözmek uydurmak değildir.',
  '- İstek metninde öğrencinin zorlandığı konular verilebilir; soru o konulardansa "ipucu"yu buna bağlayabilirsin',
  '  (örn. kalıcı bir püf nokta) — zorunlu değil, doğallığı bozma.',
  '',
  'MATEMATİK BİÇİMİ (çok önemli — öğrenci için okunaklı olmalı):',
  '- Tüm matematiksel ifadeleri LaTeX ile yaz. Satır içi: $...$, ayrı satır/blok: $$...$$.',
  '- Kesirleri \\frac{pay}{payda} ile yaz: düz "a/b" YAZMA. Örn: $$\\frac{x^2+y^3}{x-y}$$.',
  '- Üs $x^2$, kök $\\sqrt{x}$, türev $\\frac{d}{dx}x^2 = 2x$, limit $\\lim_{x\\to 2}$, integral $\\int$.',
  '- "giris", "adimlar[].detay", "ipucu.metin" ve "sonuc" alanlarında bu kurala uy. Açıklama metnini ($ dışında) Türkçe düz yaz.',
  '- HER LaTeX komutu (\\frac, \\sqrt, ^, _, \\pi ...) MUTLAKA $...$ içinde olsun; ASLA $ dışında çıplak bırakma.',
  '- ŞIKLARI da sar: her şıktaki matematik ayrı ayrı $...$ içinde. Örn: (A) $1$ (B) $2$ (C) $3$ (D) $\\frac{1}{3}$ (E) $\\frac{2}{3}$.',
  '- Örnek detay: "Değerleri yerine koyalım: $$\\frac{2^2+(-1)^3}{2-(-1)} = \\frac{4-1}{3} = 1$$".',
  '- Çok uzun eşitlik zincirini TEK satıra sıkıştırma (taşar). Uzunsa parçala: ayrı $$...$$ satırları',
  '  ya da $$\\begin{aligned} a &= b \\\\ &= c \\end{aligned}$$ kullan. ÖNEMLİ: \\begin{aligned} MUTLAKA',
  '  $$...$$ İÇİNDE olsun (çıplak bırakma); her satır \\\\ ile ayrılır.',
  '- JSON string içinde her LaTeX ters bölüsünü ÇİFT yaz ("\\\\frac" gibi); tek ters bölü JSON kaçışında bozulur.',
  '- "Eşit değildir" için \\\\neq YERİNE ≠ sembolünü kullan (\\n ile başlayan komutlar satır sonuna dönüşebilir).',
  '- Vurgu için metin içinde **kalın** (markdown) kullanabilirsin. Matematiği $ içine, vurguyu ** içine koy.',
  '',
  'GEOMETRİ / ŞEKİL (fark yaratan kısım):',
  '- Soru geometri/şekil içeriyorsa (üçgen, çember, açı, dik üçgen, koordinat düzlemi ...)',
  '  "cozumAdimlari.veri.sekil" alanına bir SVG diyagram koy. Gerekirse bir adımın "adimlar[].sekil"ine',
  '  ek küçük şekil ekleyebilirsin (adım adım inşa).',
  '- SVG kuralları: kök <svg viewBox="0 0 300 200"> (oranı içeriğe göre ayarla, yükseklik 160-220).',
  '  SADECE <line>, <polygon>, <circle>, <path>, <text>, <rect> kullan. <script>/<image>/<foreignObject> KULLANMA.',
  '- Renkler: ana çizgi stroke="#1E1B4B", vurgulanan kenar/açı stroke="#7C3AED", verilen değer etiketi fill="#EC4899".',
  '  Dolgu genelde fill="none", stroke-width="2". Köşe/uzunluk/açıları <text font-size="13"> ile etiketle.',
  '- Şekil temiz, okunaklı ve doğru ölçekli olsun (defter çizimi gibi). Şekil gerekmiyorsa "sekil" KOYMA.',
  '- En fazla 2 kart. İpucu opsiyonel.',
].join('\n');

// Triyaj: soruyu ÇÖZMEDEN sınıflandır (hangi modele yönlendireceğimizi belirler).
const TRIAGE_PROMPT = [
  'Sana bir soru FOTOĞRAFI verilir. SORUYU ÇÖZME. Sadece sınıflandır ve YALNIZCA şu JSON\'u döndür:',
  '{ "soruVar": true/false, "okunabilir": true/false, "zorluk": "kolay"|"orta"|"zor", "emin": true/false, "konu": "Ders · Konu" }',
  '- soruVar: görselde gerçek bir akademik soru var mı.',
  '- okunabilir: soru metni net okunuyor mu (bulanık/karanlık/kesik değilse true).',
  '- zorluk ölçütü: tek işlem/tek adım → "kolay"; 2-3 kavram/adım → "orta";',
  '  çok adımlı, bileşik fonksiyon, türev/integral zinciri, ispat, karmaşık geometri → "zor".',
  '- emin: zorluğu güvenle kestirebiliyorsan true; en ufak tereddütte false. (false isek daha güçlü',
  '  modele yükseltiriz — yanlış cevaptansa biraz fazla güçlü model tercih edilir.)',
  '- konu: kısa tahmin (örn. "AYT Matematik · Limit"). Emin değilsen boş bırak.',
  'Kısa ve hızlı ol; çözüm/aciklama üretme.',
].join('\n');

async function handleChat(request: Request, env: Env): Promise<Response> {
  let govde: { ogrenciBaglam?: OgrenciBaglam; mesajlar?: SohbetMesaji[] };
  try {
    govde = (await request.json()) as typeof govde;
  } catch {
    return json({ hata: 'Geçersiz JSON.' }, 400);
  }

  const mesajlar = Array.isArray(govde.mesajlar) ? govde.mesajlar : [];
  if (!mesajlar.length) {
    return json({ hata: 'Mesaj yok.' }, 400);
  }

  // Son 12 mesaj + mesaj başına 2000 karakter sınırı (token tasarrufu).
  const oaMesajlar = [
    { role: 'system', content: sistemPromptu(govde.ogrenciBaglam ?? {}, env) },
    ...mesajlar.slice(-12).map((m) => ({
      role: m.rol === 'asistan' ? 'assistant' : 'user',
      content: String(m.metin ?? '').slice(0, 2000),
    })),
  ];

  // Model env'den gelir (wrangler.toml [vars] / .dev.vars). Kod değişmeden değiştirilebilir.
  const model = env.CHAT_MODEL || VARSAYILAN_CHAT_MODEL;

  // Tavan 2600: 10+ günlük haftalikPlan + yanit rahat sığsın (kesilen JSON ayrıştırılamaz).
  let oa = await openAiTamamla(env, { model, messages: oaMesajlar, max_completion_tokens: 2600 }, 'chat');
  if (oa.hata) return json({ hata: dostcaHata(oa), detay: oa.detay }, 502);

  let cikti = jsonAyristir(oa.ham!);
  let kartlar = temizleKartlar(cikti.kartlar);
  let yanit = typeof cikti.yanit === 'string' ? cikti.yanit.trim() : '';

  // JSON bozuk/kesikse HAM metni kullanıcıya ASLA gösterme: bir kez daha geniş tavanla dene,
  // o da olmazsa dürüst bir hata dön (UI zaten "Tekrar Dene" balonu gösteriyor).
  if (!yanit && !kartlar.length) {
    oa = await openAiTamamla(env, { model, messages: oaMesajlar, max_completion_tokens: 3200 }, 'chat-retry');
    if (oa.hata) return json({ hata: dostcaHata(oa), detay: oa.detay }, 502);
    cikti = jsonAyristir(oa.ham!);
    kartlar = temizleKartlar(cikti.kartlar);
    yanit = typeof cikti.yanit === 'string' ? cikti.yanit.trim() : '';
    if (!yanit && !kartlar.length) {
      return json({ hata: 'Koç yanıtını hazırlarken bir sorun oluştu. Lütfen tekrar dener misin?' }, 502);
    }
  }

  return json({
    yanit: yanit || 'Hazırladım 👇',
    kartlar,
    hafiza: temizleHafiza(cikti.hafiza),
  });
}

/** OpenAI hata yanıtını kullanıcı diline çevirir (429 = kota/yoğunluk). */
function dostcaHata(oa: { hata?: string; kod?: number }): string {
  if (oa.kod === 429) {
    return 'AI şu an çok yoğun ya da günlük kullanım sınırına ulaşıldı. Birazdan tekrar dener misin? 💜';
  }
  return oa.hata || 'AI şu an yanıt veremedi.';
}

/**
 * Görsel içeren OpenAI kullanıcı mesajı oluşturur.
 * detail: triyaj sadece sınıflandırdığı için 'low' (çok daha az vision tokenı); çözüm 'auto' (tam).
 */
function gorselMesaji(dataUrl: string, metin: string, detail: 'low' | 'high' | 'auto' = 'auto') {
  return {
    role: 'user',
    content: [
      { type: 'text', text: metin },
      { type: 'image_url', image_url: { url: dataUrl, detail } },
    ],
  };
}

type ReasoningSeviye = 'minimal' | 'low' | 'medium' | 'high';

/**
 * Zorluğa göre çözücü model + token tavanı + reasoning seviyesi (env'den, varsayılanlarla).
 * Reasoning modellerinde (gpt-5*) tavan, reasoning + görünür çıktının İKİSİNİ birden barındırmalı;
 * aksi halde bütçe reasoning'e gidip içerik boş döner. Zor soruda reasoning'i koru (doğruluk),
 * tavanı yüksek tut; kolay soruda 'minimal' ile hız koru. Triyaj TEREDDÜTLÜYSE (belirsiz)
 * modeli büyütmek yerine reasoning'i yükselt: günlük büyük-model kotası gerçekten zor
 * sorulara saklanır, sınırdaki soru yine güçlü (medium) çözülür.
 */
function cozucuSec(
  env: Env,
  zorluk?: string,
  belirsiz?: boolean
): { model: string; tavan: number; reasoning?: ReasoningSeviye } {
  if (zorluk === 'zor')
    return { model: env.VISION_MODEL_ZOR || VARSAYILAN_ZOR, tavan: 12000, reasoning: 'medium' };
  if (zorluk === 'kolay')
    return { model: env.VISION_MODEL_KOLAY || VARSAYILAN_KOLAY, tavan: 3500, reasoning: 'minimal' };
  // orta / bilinmiyor
  if (belirsiz)
    return { model: env.VISION_MODEL_ORTA || VARSAYILAN_ORTA, tavan: 8000, reasoning: 'medium' };
  return { model: env.VISION_MODEL_ORTA || VARSAYILAN_ORTA, tavan: 6000, reasoning: 'low' };
}

/**
 * Triyaj: ucuz/hızlı modelle soruyu ÇÖZMEDEN sınıflandırır (okunabilirlik + zorluk).
 * Bulanık/soru-yok ise pahalı çözüme hiç gitmeden döner.
 */
async function triajla(
  env: Env,
  dataUrl: string
): Promise<{
  zorluk?: string;
  belirsiz?: boolean;
  konu?: string;
  durum?: 'bulanik' | 'alakasiz';
  yanit?: string;
}> {
  const model = env.VISION_MODEL_TRIAGE || VARSAYILAN_TRIAGE;
  const oa = await openAiTamamla(env, {
    model,
    messages: [{ role: 'system', content: TRIAGE_PROMPT }, gorselMesaji(dataUrl, 'Bu soruyu sınıflandır (ÇÖZME).', 'low')],
    max_completion_tokens: 400,
  }, 'triyaj');
  if (oa.hata) return {}; // triyaj başarısız → orta seviye varsayımıyla devam et
  const c = jsonAyristir(oa.ham!);
  if (c.soruVar === false) {
    return { durum: 'alakasiz', yanit: 'Bu fotoğrafta bir soru göremedim. Soruyu net çeker misin?' };
  }
  if (c.okunabilir === false) {
    return { durum: 'bulanik', yanit: 'Fotoğraf net değil — daha aydınlık ve yakından tekrar çeker misin?' };
  }
  const hamZorluk = c.zorluk === 'kolay' || c.zorluk === 'zor' ? c.zorluk : 'orta';
  // "Kolay"a YALNIZCA emin=true ise güven — zor bir soru reasoning'i kısılmış hatta düşmesin.
  // Tereddüt (emin=false) modeli BÜYÜTMEZ; cozucuSec'te reasoning'i yükseltir (kota dostu,
  // doğruluk korunur). Yanlış cevaptansa biraz fazla düşünme tercih edilir.
  const zorluk = hamZorluk === 'kolay' && c.emin !== true ? 'orta' : hamZorluk;
  return { zorluk, belirsiz: c.emin === false, konu: typeof c.konu === 'string' ? c.konu : '' };
}

async function handleSoru(request: Request, env: Env): Promise<Response> {
  let govde: { gorsel?: string; ogrenciBaglam?: OgrenciBaglam; not?: string };
  try {
    govde = (await request.json()) as typeof govde;
  } catch {
    return json({ hata: 'Geçersiz JSON.' }, 400);
  }

  const gorsel = typeof govde.gorsel === 'string' ? govde.gorsel.trim() : '';
  if (!gorsel) return json({ hata: 'Görsel yok.' }, 400);
  const not = typeof govde.not === 'string' ? govde.not.trim().slice(0, 300) : '';

  // Base64 verilmişse data URL'e çevir (varsayılan jpeg).
  const dataUrl = gorsel.startsWith('data:') ? gorsel : `data:image/jpeg;base64,${gorsel}`;

  // 1) Triyaj — okunabilirlik + zorluk. Bulanık/soru-yok ise pahalı modele gitme.
  const triaj = await triajla(env, dataUrl);
  if (triaj.durum) {
    return json({ durum: triaj.durum, yanit: triaj.yanit ?? '', ders: '', konu: '', kartlar: [] });
  }

  // 2) Zorluğa göre çözücü seç (kolay/orta→gpt-5-mini, zor→gpt-5.1; belirsizde reasoning artar).
  const { model, tavan, reasoning } = cozucuSec(env, triaj.zorluk, triaj.belirsiz);
  // Talimatı modelin gücüyle hizala: zorda tüm adımları + doğrulamayı zorla, kolayda kısa tut.
  const zorlukNotu =
    triaj.zorluk === 'zor'
      ? ' Bu soru ZOR sınıflandırıldı: tüm ara adımları göster, acele etme, sonucu MUTLAKA doğrula.'
      : triaj.zorluk === 'kolay'
      ? ' Kısa ve net tut; yine de nihai sonucu bir kez kontrol et.'
      : ' Adımları net göster ve nihai sonucu kontrol et.';
  // Koç hafızası: zorlanılan konular ipucunu kişiselleştirebilsin (sistem promptu sabit kalır).
  const zorlanan = (govde.ogrenciBaglam?.zorlananKonular ?? [])
    .filter((k): k is string => typeof k === 'string' && !!k.trim())
    .slice(0, 5);
  const hafizaNotu = zorlanan.length
    ? ` Öğrencinin zorlandığı konular: ${zorlanan.join(', ')}.`
    : '';
  const istek =
    (not
      ? `Bu fotoğraftaki YKS sorusunu çöz. Öğrencinin notu/isteği: "${not}" — buna da dikkat et.`
      : 'Bu fotoğraftaki YKS sorusunu çöz.') + zorlukNotu + hafizaNotu;
  const mesajlar = [{ role: 'system', content: SORU_PROMPT }, gorselMesaji(dataUrl, istek)];

  let oa = await openAiTamamla(env, {
    model,
    messages: mesajlar,
    max_completion_tokens: tavan,
    reasoning_effort: reasoning,
  }, `soru-${triaj.zorluk ?? 'orta'}`);

  let cikti = oa.ham ? jsonAyristir(oa.ham) : {};
  let kartlar = temizleKartlar(cikti.kartlar);
  const bosMu = () =>
    !kartlar.length &&
    !(typeof cikti.yanit === 'string' && cikti.yanit.trim()) &&
    cikti.durum !== 'bulanik' &&
    cikti.durum !== 'alakasiz';

  // Çözücü düşerse (kota dolumu, model erişimi, kesik/boş yanıt) mini havuzdaki modelle
  // bir kez daha dene — öğrenci cevapsız kalmasın. Aynı modelse tekrar denemenin anlamı yok.
  const yedekModel = env.VISION_MODEL_ORTA || VARSAYILAN_ORTA;
  if ((oa.hata || bosMu()) && yedekModel !== model) {
    oa = await openAiTamamla(env, {
      model: yedekModel,
      messages: mesajlar,
      max_completion_tokens: 8000,
      reasoning_effort: 'medium',
    }, 'soru-yedek');
    cikti = oa.ham ? jsonAyristir(oa.ham) : {};
    kartlar = temizleKartlar(cikti.kartlar);
  }
  if (oa.hata) return json({ hata: dostcaHata(oa), detay: oa.detay }, 502);
  if (bosMu()) {
    return json({ hata: 'Bu soruyu şu an çözemedim. Lütfen tekrar dener misin?' }, 502);
  }

  const durum =
    cikti.durum === 'bulanik' || cikti.durum === 'alakasiz' ? cikti.durum : 'cozuldu';
  return json({
    durum,
    yanit: typeof cikti.yanit === 'string' ? cikti.yanit : '',
    ders: typeof cikti.ders === 'string' ? cikti.ders : triaj.konu?.split('·')[0]?.trim() ?? '',
    konu: typeof cikti.konu === 'string' ? cikti.konu : triaj.konu ?? '',
    kartlar: durum === 'cozuldu' ? kartlar : [],
  });
}

/** gpt-5* ve o-serisi reasoning modelidir; bunlar özel temperature kabul etmez (default 1 zorunlu). */
function reasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/.test(model);
}

/**
 * OpenAI chat/completions çağrısı (JSON çıktı). Ortak hata yönetimi + kullanım logu.
 * `etiket` yalnızca log içindir (hangi akış: chat / triyaj / soru-zor ...).
 */
async function openAiTamamla(
  env: Env,
  payload: {
    model: string;
    messages: unknown[];
    max_completion_tokens: number;
    /** Yalnızca reasoning modellerine (gpt-5* ve o-serisi) gönderilir; diğerleri 400 ile reddeder. */
    reasoning_effort?: ReasoningSeviye;
  },
  etiket: string
): Promise<{ ham?: string; hata?: string; detay?: string; kod?: number }> {
  // Parametreleri modele göre ayıkla: env üzerinden model değiştirilse bile istek geçerli kalsın.
  // Reasoning'siz modellerde (gpt-4.1*) düşük temperature → aritmetik kararlılık; gpt-5*/o*
  // özel temperature kabul etmediğinden onlara gönderilmez, reasoning_effort yalnız onlara gider.
  const akilYurutur = reasoningModel(payload.model);
  let oaYanit: Response;
  try {
    oaYanit = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: payload.model,
        messages: payload.messages,
        // Yeni model uyumu: max_tokens yerine max_completion_tokens.
        max_completion_tokens: payload.max_completion_tokens,
        ...(akilYurutur
          ? payload.reasoning_effort
            ? { reasoning_effort: payload.reasoning_effort }
            : {}
          : { temperature: 0.2 }),
        response_format: { type: 'json_object' },
      }),
    });
  } catch {
    return { hata: 'AI servisine ulaşılamadı.' };
  }

  if (!oaYanit.ok) {
    const detay = await oaYanit.text();
    console.log(
      JSON.stringify({ olay: 'openai-hata', etiket, model: payload.model, kod: oaYanit.status, detay: detay.slice(0, 200) })
    );
    return { hata: 'AI servisi hata döndürdü.', detay: detay.slice(0, 300), kod: oaYanit.status };
  }

  const veri = (await oaYanit.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };
  const secim = veri.choices?.[0];
  const ham = secim?.message?.content?.trim();
  // Günlük ücretsiz kota takibi için kullanım kaydı (mesaj İÇERİĞİ loglanmaz — gizlilik).
  console.log(
    JSON.stringify({
      olay: 'openai',
      etiket,
      model: payload.model,
      girdi: veri.usage?.prompt_tokens,
      cikti: veri.usage?.completion_tokens,
      cacheli: veri.usage?.prompt_tokens_details?.cached_tokens,
      bitis: secim?.finish_reason,
    })
  );
  if (!ham) {
    // Reasoning modelinde içerik boşsa genelde token sınırına takılmıştır (finish_reason='length').
    return {
      hata:
        secim?.finish_reason === 'length'
          ? 'Çözüm fazla uzun geldi (token sınırı). Soruyu daha net/yakın çekip tekrar dener misin?'
          : 'AI boş yanıt verdi.',
    };
  }
  return { ham };
}

/** Model'in opsiyonel hafıza işaretini doğrular (geçersizse undefined). */
function temizleHafiza(h: unknown): { konu: string; ders?: string; sinyal: string } | undefined {
  if (!h || typeof h !== 'object') return undefined;
  const konu = (h as any).konu;
  const sinyal = (h as any).sinyal;
  if (typeof konu !== 'string' || !konu.trim()) return undefined;
  if (sinyal !== 'zorlaniyor' && sinyal !== 'anladi') return undefined;
  const ders = typeof (h as any).ders === 'string' ? (h as any).ders : undefined;
  return { konu: konu.trim().slice(0, 60), ders, sinyal };
}

/** Güvenli JSON ayrıştırma; bozuksa boş nesne döner. */
function jsonAyristir(ham: string): Record<string, unknown> {
  try {
    const o = JSON.parse(ham);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST') {
      return json({ hata: 'Geçersiz istek.' }, 404);
    }
    if (!env.OPENAI_API_KEY) {
      return json({ hata: 'Sunucu yapılandırması eksik (OPENAI_API_KEY).' }, 500);
    }

    if (url.pathname === '/chat') return handleChat(request, env);
    if (url.pathname === '/soru') return handleSoru(request, env);
    return json({ hata: 'Geçersiz istek.' }, 404);
  },
};
