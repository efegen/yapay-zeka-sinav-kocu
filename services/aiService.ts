// AI servis katmanı — uygulama ile Cloudflare AI proxy arasındaki köprü.
// OpenAI'ı DOĞRUDAN çağırmaz; anahtar güvenliği için worker'a (EXPO_PUBLIC_AI_PROXY_URL) gider.

import type { Profil } from '../hooks/useProfile';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL;

export interface SohbetMesaji {
  rol: 'kullanici' | 'asistan';
  metin: string;
}

export interface OgrenciBaglam {
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

/** Profilden AI'a gönderilecek bağlamı derler. (Tam kişisel bağlam — isim dahil.) */
export function baglamKur(profil: Profil | null): OgrenciBaglam {
  if (!profil) return {};
  return {
    isim: profil.isim,
    sinif: profil.sinif,
    puanTuru: profil.puanTuru,
    hedefTuru: profil.hedefTuru,
    hedefUniversite: profil.hedefUniversite,
    hedefBolum: profil.hedefBolum,
    hedefSiralama: profil.hedefSiralama,
    hedefNetler: profil.hedefNetBilgisi,
    gunlukSoruHedefi: profil.gunlukSoruHedefi,
  };
}

/** UI'ın yakalayıp "Tekrar Dene" gösterebilmesi için tipli hata. */
export class AiHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'AiHatasi';
  }
}

/**
 * AI Koç'a mesaj gönderir, asistan yanıtını döner.
 * @param mesajlar  Tüm sohbet geçmişi (worker son N mesajı alır).
 * @param baglam    Öğrenci profili bağlamı.
 */
export async function kocaSor(
  mesajlar: SohbetMesaji[],
  baglam: OgrenciBaglam
): Promise<string> {
  if (!PROXY_URL) {
    throw new AiHatasi('AI servisi yapılandırılmamış (EXPO_PUBLIC_AI_PROXY_URL eksik).');
  }

  const denetleyici = new AbortController();
  const zamanAsimi = setTimeout(() => denetleyici.abort(), 20000);

  let yanit: Response;
  try {
    yanit = await fetch(`${PROXY_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ogrenciBaglam: baglam, mesajlar }),
      signal: denetleyici.signal,
    });
  } catch (e: any) {
    clearTimeout(zamanAsimi);
    if (e?.name === 'AbortError') {
      throw new AiHatasi('Yanıt zaman aşımına uğradı. Lütfen tekrar deneyin.');
    }
    throw new AiHatasi('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.');
  }
  clearTimeout(zamanAsimi);

  let veri: { yanit?: string; hata?: string };
  try {
    veri = await yanit.json();
  } catch {
    throw new AiHatasi('Sunucudan beklenmeyen yanıt geldi.');
  }

  if (!yanit.ok || veri.hata || !veri.yanit) {
    throw new AiHatasi(veri.hata || 'AI şu an yanıt veremedi. Lütfen tekrar deneyin.');
  }

  return veri.yanit;
}
