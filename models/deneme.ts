// Deneme sınavı sonucu modeli.
// İlke: öğrenci yalnızca DOĞRU + YANLIŞ girer; BOŞ ve NET otomatik hesaplanır.
// Net (ÖSYM standardı): net = D − Y / 4.

import { Timestamp } from 'firebase/firestore';
import { COLORS } from '../constants/colors';

export type Kapsam = 'tyt' | 'ayt' | 'ikisi';
export type Alan = 'SAY' | 'EA' | 'SOZ' | 'DIL';

export interface Test {
  ad: string;
  soru: number;
}

// ── Sınav yapısı (ÖSYM soru dağılımı) ──
export const TYT_TESTLER: Test[] = [
  { ad: 'Türkçe', soru: 40 },
  { ad: 'Sosyal Bilimler', soru: 20 },
  { ad: 'Temel Matematik', soru: 40 },
  { ad: 'Fen Bilimleri', soru: 20 },
];

export const AYT_ALANLAR: Record<Alan, { ad: string; testler: Test[] }> = {
  SAY: {
    ad: 'Sayısal',
    testler: [
      { ad: 'Matematik', soru: 40 },
      { ad: 'Fizik', soru: 14 },
      { ad: 'Kimya', soru: 13 },
      { ad: 'Biyoloji', soru: 13 },
    ],
  },
  EA: {
    ad: 'Eşit Ağırlık',
    testler: [
      { ad: 'Matematik', soru: 40 },
      { ad: 'Türk Dili ve Edebiyatı', soru: 24 },
      { ad: 'Tarih-1', soru: 10 },
      { ad: 'Coğrafya-1', soru: 6 },
    ],
  },
  SOZ: {
    ad: 'Sözel',
    testler: [
      { ad: 'Türk Dili ve Edebiyatı', soru: 24 },
      { ad: 'Tarih-1', soru: 10 },
      { ad: 'Coğrafya-1', soru: 6 },
      { ad: 'Tarih-2', soru: 11 },
      { ad: 'Coğrafya-2', soru: 11 },
      { ad: 'Felsefe Grubu', soru: 12 },
      { ad: 'Din Kültürü', soru: 6 },
    ],
  },
  DIL: {
    ad: 'Dil',
    testler: [{ ad: 'Yabancı Dil', soru: 80 }],
  },
};

// ── Ders renk paleti (constants/dersler.ts ile uyumlu, ek tonlarla) ──
export const DENEME_RENK: Record<string, string> = {
  // TYT
  Türkçe: '#0EA5E9',
  'Sosyal Bilimler': '#6366F1',
  'Temel Matematik': '#7C3AED',
  'Fen Bilimleri': '#14B8A6',
  // AYT — sayısal
  Matematik: '#7C3AED',
  Fizik: '#EC4899',
  Kimya: '#F59E0B',
  Biyoloji: '#10B981',
  // AYT — eşit ağırlık / sözel
  'Türk Dili ve Edebiyatı': '#0EA5E9',
  'Tarih-1': '#F43F5E',
  'Coğrafya-1': '#84CC16',
  'Tarih-2': '#F43F5E',
  'Coğrafya-2': '#84CC16',
  'Felsefe Grubu': '#6366F1',
  'Din Kültürü': '#64748B',
  // AYT — dil
  'Yabancı Dil': '#0EA5E9',
};

export function dRenk(ad: string): string {
  return DENEME_RENK[ad] || COLORS.primary;
}

// puanTuru'nu (büyük/küçük harf, Türkçe diakritik) normalize eder. Kod tabanı
// SOZ/DIL kullanır; eski kayıtlarda SÖZ/DİL gelebilir.
export function alanNormalize(puanTuru?: string | null): Alan {
  const t = (puanTuru ?? '').toLocaleUpperCase('tr-TR').replace('Ö', 'O').replace('İ', 'I');
  if (t === 'EA') return 'EA';
  if (t === 'SOZ') return 'SOZ';
  if (t === 'DIL') return 'DIL';
  return 'SAY';
}

// ── Cevap state'i (D/Y string olarak tutulur; doğal yazım) ──
export interface DersCevap {
  d: string;
  y: string;
}
export type Cevaplar = Record<string, DersCevap>;

// ── Firestore kaydı (net'ler türetilmiş; listeleme/kıyas için saklanır) ──
export interface DenemeSonuc {
  id: string;
  ad: string;
  denemeNo: number;
  kapsam: Kapsam;
  alan: Alan; // AYT alanı (profilden türetilir)
  sure?: number; // dakika (opsiyonel)
  cevaplar: Cevaplar; // ders adı → { d, y }
  tytNet: number;
  aytNet: number;
  toplamNet: number;
  tarih: Timestamp; // denemenin tarihi
  olusturmaTarihi: Timestamp;
}

// ── Hesaplama yardımcıları ──
export function netOf(dy?: DersCevap): number {
  const d = parseInt(dy?.d ?? '', 10) || 0;
  const y = parseInt(dy?.y ?? '', 10) || 0;
  return d - y / 4;
}

export function bosOf(dy: DersCevap | undefined, soru: number): number {
  const d = parseInt(dy?.d ?? '', 10) || 0;
  const y = parseInt(dy?.y ?? '', 10) || 0;
  return Math.max(0, soru - d - y);
}

export function toplamNet(testler: Test[], cevaplar: Cevaplar): number {
  return testler.reduce((t, k) => t + netOf(cevaplar[k.ad]), 0);
}

// En az bir ders için giriş yapıldı mı?
export function toplamGirildi(testler: Test[], cevaplar: Cevaplar): boolean {
  return testler.some((k) => {
    const c = cevaplar[k.ad];
    return !!c && (c.d !== '' || c.y !== '');
  });
}

// Türkçe ondalık: 36.25 → "36,25" · 32 → "32"
export function fmtNet(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '–';
  const s = Number.isInteger(n)
    ? String(n)
    : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}

export function fmtDelta(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return sign + fmtNet(Math.abs(n));
}

// Binlik ayıraçlı sıralama: 92200 → "92.200".
export function fmtSira(n: number): string {
  if (n == null || !isFinite(n)) return '–';
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// raw girişi temizler + (soru − diğer alan) ile sınırlar; yeni cevap haritası döndürür.
export function setDY(
  cevaplar: Cevaplar,
  ad: string,
  key: 'd' | 'y',
  raw: string,
  soru: number,
  otherRaw: string
): Cevaplar {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  const other = parseInt(otherRaw, 10) || 0;
  const limit = Math.max(0, soru - other);
  let val = digits;
  if (digits !== '') val = String(Math.min(parseInt(digits, 10), limit));
  return { ...cevaplar, [ad]: { ...(cevaplar[ad] ?? { d: '', y: '' }), [key]: val } };
}

// "7 Haz 2026" biçimi.
const KISA_AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export function tarihKisa(d: Date): string {
  return `${d.getDate()} ${KISA_AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * AI koçuna gönderilecek tek satırlık deneme özeti: tarih + kapsam toplamları + ders netleri.
 * Yalnızca girişi yapılmış dersler listelenir; koç bu GERÇEK netlerle kıyas/projeksiyon kurar.
 */
export function denemeAiOzeti(d: DenemeSonuc): string {
  // "Türkçe 31/40" biçimi: bölü sonrası dersin SORU sayısıdır — koç kart grafiklerinde
  // max alanını doğru doldurabilsin (verilmezse null koyup barı bozabiliyor).
  const dersOzet = (testler: Test[]) =>
    testler
      .filter((t) => {
        const c = d.cevaplar?.[t.ad];
        return !!c && (c.d !== '' || c.y !== '');
      })
      .map((t) => `${t.ad} ${fmtNet(netOf(d.cevaplar[t.ad]))}/${t.soru}`)
      .join(', ');
  const parcalar: string[] = [];
  if (d.kapsam !== 'ayt') parcalar.push(`TYT ${fmtNet(d.tytNet)} net (${dersOzet(TYT_TESTLER)})`);
  if (d.kapsam !== 'tyt') {
    const alan = AYT_ALANLAR[d.alan] ?? AYT_ALANLAR.SAY;
    parcalar.push(`AYT ${fmtNet(d.aytNet)} net (${dersOzet(alan.testler)})`);
  }
  const tarih = typeof d.tarih?.toDate === 'function' ? tarihKisa(d.tarih.toDate()) : '';
  return `${tarih ? `${tarih} · ` : ''}${d.ad}: ${parcalar.join(' · ')}`;
}
