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

// "Optik, Hareket" → ["Optik", "Hareket"] · en çok 4 konu (kaba/uzun girişleri sınırla).
export function konulariAyikla(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
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

// Dağılımdaki tek ders satırı — öğrencinin kendi açıklamasını (not) raporda geri gösterebilmek için taşır.
export interface DersKalemi {
  ad: string;
  not?: string;
}

export interface KategoriDagilim {
  kategori: NedenKategori;
  dersSayisi: number;
  kayipNet: number;
  dersler: DersKalemi[];
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
      { kategori: h.kategori, dersSayisi: 0, kayipNet: 0, dersler: [] as DersKalemi[] };
    d.dersSayisi += 1;
    d.kayipNet += h.kayipNet;
    d.dersler.push({ ad: h.ders, not: h.not });
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

// Türkçe ondalık (12.5 → "12,5"). fmtNet'i deneme.ts'ten almıyoruz: bu modülü oraya bağlamak
// döngüsel import yaratır (deneme.ts zaten buradan import ediyor) — bu yüzden yerelde tutuluyor.
function netMetni(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}

/**
 * Kaydedilmiş hata analizini AI koçu için tek satırlık bağlama çevirir: baskın kök neden +
 * kaçan net + kategori→ders dağılımı + öğrencinin yazdığı eksik konular. Koç "neyi neden
 * kaçırıyor" görüp planı kişiselleştirsin diye alır. Analiz yoksa boş string döner.
 */
export function hataAnaliziAiOzeti(kayit?: HataAnaliziKaydi): string {
  if (!kayit || !kayit.hatalar.length) return '';

  const grup = new Map<NedenKategori, string[]>();
  for (const h of kayit.hatalar) {
    const arr = grup.get(h.kategori) ?? [];
    arr.push(h.ders);
    grup.set(h.kategori, arr);
  }

  const parcalar: string[] = [`~${netMetni(kayit.toplamKayipNet)} net kayıp`];
  if (kayit.baskinKategori) parcalar.push(`en çok ${KATEGORILER[kayit.baskinKategori].ad}`);
  parcalar.push(
    Array.from(grup.entries())
      .map(([k, ders]) => `${KATEGORILER[k].ad}: ${ders.join(', ')}`)
      .join('; ')
  );

  // Öğrencinin GERÇEK yazdığı eksik konular (ders adı değil) — koç planı bunlara öncelik versin.
  const konular = kayit.hatalar
    .filter((h) => h.kategori === 'bilgi' && h.konu)
    .flatMap((h) => konulariAyikla(h.konu!))
    .slice(0, 6);
  if (konular.length) parcalar.push(`eksik konular: ${konular.join(', ')}`);

  return `Hata analizi — ${parcalar.join(' · ')}`;
}
