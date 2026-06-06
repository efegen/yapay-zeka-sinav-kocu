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
}

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
// SİSTEM PROMPTU (v1 — GEÇİCİ)
// Koçun kişiliği, sınırları ve veriyi nasıl yorumlayacağı burada tanımlanır.
// Bu blok bilerek tek yerde toplandı; sonraki adanmış turda SADECE bu fonksiyon
// özenle yeniden yazılacak (gerisine dokunmadan).
// ════════════════════════════════════════════════════════════════════
function sistemPromptu(b: OgrenciBaglam): string {
  const satirlar: string[] = [];
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
  const baglam = satirlar.length ? satirlar.join('\n') : '- (Profil bilgisi henüz yok.)';

  return [
    'Sen "YZDSK" uygulamasının yapay zeka sınav koçusun. Türkiye\'deki YKS (TYT/AYT) sınavına',
    'hazırlanan bir öğrenciye birebir koçluk yapıyorsun. Görevin; motivasyon vermek, çalışma',
    'stratejisi önermek, konu/soru çözümünde yol göstermek ve öğrenciyi planlı tutmaktır.',
    '',
    'Öğrenci profili:',
    baglam,
    '',
    'Kurallar:',
    '- Türkçe, sıcak, samimi ve motive edici bir dille konuş. Öğrenciye ismiyle hitap edebilirsin.',
    '- Yanıtların kısa ve net olsun (mobil ekran). Gerektiğinde madde madde yaz.',
    '- Somut ol: "çok çalış" deme; hangi konu, kaç soru, kaç dakika Pomodoro gibi uygulanabilir öneriler ver.',
    '- ELİNDE OLMAYAN veriyi UYDURMA. Üniversite taban puanı/sıralaması veya öğrencinin geçmiş deneme',
    '  sonuçları gibi sana verilmemiş bilgileri varmış gibi söyleme; gerekirse öğrenciden bilgi iste.',
    '- Ciddi psikolojik/sağlık durumlarında profesyonel destek almasını da öner.',
    '- Sınav dışı, alakasız veya uygunsuz taleplerde nazikçe sınav hazırlığına geri yönlendir.',
  ].join('\n');
}
// ════════════════════════════════════════════════════════════════════

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/chat') {
      return json({ hata: 'Geçersiz istek.' }, 404);
    }
    if (!env.OPENAI_API_KEY) {
      return json({ hata: 'Sunucu yapılandırması eksik (OPENAI_API_KEY).' }, 500);
    }

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
      { role: 'system', content: sistemPromptu(govde.ogrenciBaglam ?? {}) },
      ...mesajlar.slice(-12).map((m) => ({
        role: m.rol === 'asistan' ? 'assistant' : 'user',
        content: String(m.metin ?? '').slice(0, 2000),
      })),
    ];

    let oaYanit: Response;
    try {
      oaYanit = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: oaMesajlar,
          max_tokens: 700,
          temperature: 0.6,
        }),
      });
    } catch {
      return json({ hata: 'AI servisine ulaşılamadı.' }, 502);
    }

    if (!oaYanit.ok) {
      const detay = await oaYanit.text();
      return json({ hata: 'AI servisi hata döndürdü.', detay: detay.slice(0, 300) }, 502);
    }

    const veri = (await oaYanit.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const yanit = veri.choices?.[0]?.message?.content?.trim();
    if (!yanit) {
      return json({ hata: 'AI boş yanıt verdi.' }, 502);
    }

    return json({ yanit });
  },
};
