// Akıllı Hata Analizi — kural-tabanlı kök neden kategorizasyonu.
// ----------------------------------------------------------------
// Öğrenci her ders için hatasının NEDENİNİ kısa bir metinle açıklar; bu motor metni
// üç kategoriden birine atar ve kişiselleştirilmiş bir rapor üretir. AI/proxy GEREKTİRMEZ:
// cihazda, deterministik ve ücretsiz çalışır → `kategorize` saf bir fonksiyondur ve
// girdi→çıktı olarak birim test edilebilir (rapor: "kök neden kategorizasyon algoritması").

import { COLORS } from '../constants/colors';

/** Bir hatanın kök nedeni — raporun üç kategorisi. */
export type NedenKategori = 'dikkatsizlik' | 'sure' | 'bilgi';

export interface KategoriBilgi {
  ad: string; // ekranda gösterilen ad
  kisa: string; // tek satır açıklama
  ikon: string; // Ionicons adı
  renk: string;
  oneri: string; // raporda gösterilen stratejik öneri
}

export const KATEGORILER: Record<NedenKategori, KategoriBilgi> = {
  dikkatsizlik: {
    ad: 'Dikkatsizlik',
    kisa: 'Bildiğin hâlde kaçan hatalar',
    ikon: 'eye-outline',
    renk: COLORS.amber,
    oneri:
      'Soruyu ve şıkları sonuna kadar oku; işlemi bitirince 5 saniye kontrol et. "Kesin doğru" demeden son bir kez göz gezdir — en ucuz net buradan gelir.',
  },
  sure: {
    ad: 'Süre Yönetimi',
    kisa: 'Zaman yetmediği için kaçan sorular',
    ikon: 'timer-outline',
    renk: COLORS.primary,
    oneri:
      'Zor soruyu işaretleyip geç, önce garantileri topla. Soru başına süre sınırı koy; takılınca bırak, sona sakla. Tempoyu denemeyle çalış.',
  },
  bilgi: {
    ad: 'Bilgi Eksikliği',
    kisa: 'Konu/kavram eksiğinden kaçan sorular',
    ikon: 'book-outline',
    renk: COLORS.accent,
    oneri:
      'Bu derslerde konu/kavram eksiğin var: önce kısa konu anlatımı, ardından hedefli soru pratiği yap. Hangi konuda eksik olduğunu yazarsan koç hafızana eklenir ve AI Koç planına alır.',
  },
};

// Anahtar kelime kümeleri. Türkçe küçük harfe indirgenmiş metinde aranır; diakritikli
// ve diakritiksiz (örn. "süre"/"sure") varyantlar birlikte tutulur ki klavye farkı eşleşmeyi bozmasın.
const ANAHTARLAR: Record<NedenKategori, string[]> = {
  dikkatsizlik: [
    'dikkat', 'saçma', 'sacma', 'aptal', 'salak', 'gözden kaç', 'gozden kac', 'gözümden',
    'gozumden', 'yanlış oku', 'yanlis oku', 'eksik oku', 'işlem hata', 'islem hata',
    'işaretleme', 'isaretleme', 'yanlış işaret', 'yanlis isaret', 'acele', 'heyecan',
    'panik', 'kontrol etmedim', 'basit hata', 'kolaydı', 'kolaydi', 'biliyordum ama',
  ],
  sure: [
    'süre', 'sure', 'zaman', 'yetişmed', 'yetismed', 'yetmed', 'yetişemed', 'yetisemed',
    'son sorular', 'sona kal', 'geç kal', 'gec kal', 'hızlı', 'hizli', 'yavaş', 'yavas',
    'vakit', 'bitiremed', 'tükendi', 'tukendi', 'sığmad', 'sigmad',
  ],
  bilgi: [
    'bilmiyor', 'bilmed', 'anlamad', 'anlamıyor', 'anlamiyor', 'öğrenmed', 'ogrenmed',
    'eksik', 'konuyu', 'konu eksik', 'formül', 'formul', 'kural', 'hatırlamad', 'hatirlamad',
    'çözemed', 'cozemed', 'bilgim yok', 'görmedim', 'gormedim', 'zayıf', 'zayif', 'kavram',
    'yetersiz', 'unuttum konu',
  ],
};

/**
 * Bir açıklama metnini kök neden kategorisine atar. En çok anahtar kelime eşleşen
 * kategori kazanır; hiç sinyal yoksa null döner (çağıran taraf öğrencinin seçtiği çipi
 * kullanır). SAF fonksiyon — yan etkisi yok, birim test edilebilir.
 */
export function kategorize(metin: string): NedenKategori | null {
  const t = (metin || '').toLocaleLowerCase('tr');
  if (!t.trim()) return null;

  const puan: Record<NedenKategori, number> = { dikkatsizlik: 0, sure: 0, bilgi: 0 };
  (Object.keys(ANAHTARLAR) as NedenKategori[]).forEach((kat) => {
    for (const kelime of ANAHTARLAR[kat]) {
      if (t.includes(kelime)) puan[kat] += 1;
    }
  });

  let enIyi: NedenKategori | null = null;
  let enYuksek = 0;
  (Object.keys(puan) as NedenKategori[]).forEach((kat) => {
    if (puan[kat] > enYuksek) {
      enYuksek = puan[kat];
      enIyi = kat;
    }
  });
  return enIyi; // hiç eşleşme yoksa null
}

// ── Toplulaştırma / rapor ──────────────────────────────────────────────

/** Ders bazında tek bir hata girdisi (ekrandan toplanır). */
export interface DersHata {
  ders: string;
  yanlis: number;
  bos: number;
  kayipNet: number; // yaklaşık kaçırılan net (yanlış 1.25 + boş 1 ağırlıklı)
  kategori: NedenKategori;
  not?: string;
}

export interface KategoriDagilim {
  kategori: NedenKategori;
  dersSayisi: number;
  kayipNet: number;
  dersler: string[];
}

export interface HataAnaliziRapor {
  dagilim: KategoriDagilim[]; // kayıpNet'e göre azalan
  baskinKategori: NedenKategori | null;
  eksikKonular: string[]; // 'bilgi' işaretli dersler
  toplamKayipNet: number;
}

/** Bir derste yanlış+boştan yaklaşık kaçırılan net. Yanlış götürüsü (net = D − Y/4) dahil. */
export function kayipNetHesapla(yanlis: number, bos: number): number {
  return Math.round((yanlis * 1.25 + bos) * 100) / 100;
}

/** Ders bazlı hataları kategoriye göre toplar, kişiselleştirilmiş rapor üretir. SAF fonksiyon. */
export function analizYap(hatalar: DersHata[]): HataAnaliziRapor {
  const harita = new Map<NedenKategori, KategoriDagilim>();
  let toplamKayipNet = 0;

  for (const h of hatalar) {
    toplamKayipNet += h.kayipNet;
    const d =
      harita.get(h.kategori) ??
      { kategori: h.kategori, dersSayisi: 0, kayipNet: 0, dersler: [] as string[] };
    d.dersSayisi += 1;
    d.kayipNet += h.kayipNet;
    d.dersler.push(h.ders);
    harita.set(h.kategori, d);
  }

  const dagilim = Array.from(harita.values())
    .map((d) => ({ ...d, kayipNet: Math.round(d.kayipNet * 100) / 100 }))
    .sort((a, b) => b.kayipNet - a.kayipNet || b.dersSayisi - a.dersSayisi);

  return {
    dagilim,
    baskinKategori: dagilim.length ? dagilim[0].kategori : null,
    eksikKonular: hatalar.filter((h) => h.kategori === 'bilgi').map((h) => h.ders),
    toplamKayipNet: Math.round(toplamKayipNet * 100) / 100,
  };
}

// ── Kalıcı kayıt (deneme dokümanına yazılır) ───────────────────────────
export interface DersHataKaydi {
  ders: string;
  kategori: NedenKategori;
  not?: string;
  konu?: string; // yalnızca 'bilgi': öğrencinin yazdığı gerçek konu(lar)
}

export interface HataAnaliziKaydi {
  hatalar: DersHataKaydi[];
  baskinKategori: NedenKategori | null;
  eksikKonular: string[];
  toplamKayipNet: number;
  tarih: string; // ISO — analizin yapıldığı an
}
