// AI servis katmanı — uygulama ile Cloudflare AI proxy arasındaki köprü.
// OpenAI'ı DOĞRUDAN çağırmaz; anahtar güvenliği için worker'a (EXPO_PUBLIC_AI_PROXY_URL) gider.

import type { Profil } from '../hooks/useProfile';
import type { Kart, KocYanit } from '../types/koc';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL;

export interface SohbetMesaji {
  rol: 'kullanici' | 'asistan';
  metin: string;
}

export type { Kart, KocYanit };

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
  zorlananKonular?: string[];
  iyiKonular?: string[];
  denemeler?: string[];
  kisiselNotlar?: string[];
}

/**
 * Profilden AI'a gönderilecek bağlamı derler. (Tam kişisel bağlam — isim dahil.)
 * @param zorlananKonular  Koç hafızasından gelen zorlanılan konular (opsiyonel).
 * @param iyiKonular       Koç hafızasından gelen iyi olunan konular (opsiyonel).
 * @param denemeler        Son deneme sonuçlarının tek satırlık özetleri, yeni → eski (opsiyonel).
 * @param kisiselNotlar    Koçun öğrenci hakkında aldığı kalıcı kişisel notlar (opsiyonel).
 */
export function baglamKur(
  profil: Profil | null,
  zorlananKonular?: string[],
  iyiKonular?: string[],
  denemeler?: string[],
  kisiselNotlar?: string[]
): OgrenciBaglam {
  if (!profil) {
    const b: OgrenciBaglam = {};
    if (zorlananKonular?.length) b.zorlananKonular = zorlananKonular;
    if (iyiKonular?.length) b.iyiKonular = iyiKonular;
    if (denemeler?.length) b.denemeler = denemeler;
    if (kisiselNotlar?.length) b.kisiselNotlar = kisiselNotlar;
    return b;
  }
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
    zorlananKonular: zorlananKonular?.length ? zorlananKonular : undefined,
    iyiKonular: iyiKonular?.length ? iyiKonular : undefined,
    denemeler: denemeler?.length ? denemeler : undefined,
    kisiselNotlar: kisiselNotlar?.length ? kisiselNotlar : undefined,
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
 * AI Koç'a mesaj gönderir, asistan yanıtını ({ yanit, kartlar }) döner.
 * Worker henüz düz metin döndürüyorsa `kartlar` boş dizi olur (geriye uyumlu).
 * @param mesajlar  Tüm sohbet geçmişi (worker son N mesajı alır).
 * @param baglam    Öğrenci profili bağlamı.
 */
export async function kocaSor(
  mesajlar: SohbetMesaji[],
  baglam: OgrenciBaglam
): Promise<KocYanit> {
  if (!PROXY_URL) {
    throw new AiHatasi('AI servisi yapılandırılmamış (EXPO_PUBLIC_AI_PROXY_URL eksik).');
  }

  const denetleyici = new AbortController();
  // Worker bozuk yanıtta bir kez kendi içinde yeniden deniyor; iki tur için pay bırak.
  const zamanAsimi = setTimeout(() => denetleyici.abort(), 45000);

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

  let veri: KocYanit & { hata?: string };
  try {
    veri = await yanit.json();
  } catch {
    throw new AiHatasi('Sunucudan beklenmeyen yanıt geldi.');
  }

  if (!yanit.ok || veri.hata || !veri.yanit) {
    throw new AiHatasi(veri.hata || 'AI şu an yanıt veremedi. Lütfen tekrar deneyin.');
  }

  return {
    yanit: veri.yanit,
    kartlar: Array.isArray(veri.kartlar) ? veri.kartlar : [],
    hafiza: veri.hafiza,
    hafizaNot: veri.hafizaNot,
  };
}

export interface SoruYaniti {
  durum: 'cozuldu' | 'bulanik' | 'alakasiz';
  yanit: string;
  ders: string;
  konu: string;
  kartlar: Kart[];
}

/**
 * Soru fotoğrafını worker'ın /soru (vision) endpoint'ine gönderir, çözümü döner.
 * @param base64  Görsel base64 (data URL ya da ham base64).
 * @param baglam  Öğrenci profili bağlamı (opsiyonel kullanım).
 * @param not     Öğrencinin foto ile gönderdiği opsiyonel not/yorum.
 */
export async function soruyuCoz(base64: string, baglam: OgrenciBaglam, not?: string): Promise<SoruYaniti> {
  if (!PROXY_URL) {
    throw new AiHatasi('AI servisi yapılandırılmamış (EXPO_PUBLIC_AI_PROXY_URL eksik).');
  }

  const denetleyici = new AbortController();
  // Zor sorularda reasoning + olası yedek model turu 60 sn'yi aşabiliyor; worker parayı/kotayı
  // zaten harcamışken istemcinin erken pes etmesi cevabı çöpe atar — payı geniş tut.
  const zamanAsimi = setTimeout(() => denetleyici.abort(), 90000);

  let yanit: Response;
  try {
    yanit = await fetch(`${PROXY_URL}/soru`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gorsel: base64, ogrenciBaglam: baglam, not: not?.trim() || undefined }),
      signal: denetleyici.signal,
    });
  } catch (e: any) {
    clearTimeout(zamanAsimi);
    if (e?.name === 'AbortError') {
      throw new AiHatasi('Çözüm zaman aşımına uğradı. Lütfen tekrar deneyin.');
    }
    throw new AiHatasi('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.');
  }
  clearTimeout(zamanAsimi);

  let veri: Partial<SoruYaniti> & { hata?: string };
  try {
    veri = await yanit.json();
  } catch {
    throw new AiHatasi('Sunucudan beklenmeyen yanıt geldi.');
  }

  if (!yanit.ok || veri.hata) {
    throw new AiHatasi(veri.hata || 'Soru çözülemedi. Lütfen tekrar deneyin.');
  }

  return {
    durum: veri.durum === 'bulanik' || veri.durum === 'alakasiz' ? veri.durum : 'cozuldu',
    yanit: typeof veri.yanit === 'string' ? veri.yanit : '',
    ders: typeof veri.ders === 'string' ? veri.ders : '',
    konu: typeof veri.konu === 'string' ? veri.konu : '',
    kartlar: Array.isArray(veri.kartlar) ? veri.kartlar : [],
  };
}
