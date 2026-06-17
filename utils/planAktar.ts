// Haftalık plan kartını takvim görevlerine çeviren saf yardımcılar.
// UI/Firestore yan etkisi yok — yalnızca veri dönüşümü (kolay test/yeniden kullanım).
import type { Adim } from '../services/firestoreService';
import { DERSLER } from '../constants/dersler';

export interface GunTaslak {
  gunAdi: string;        // plandaki ham gün adı ("Pazartesi")
  tarih: Date | null;    // eşlenen tarih (null = gün adı çözülemedi)
  baslik: string;        // görev başlığı (odak)
  ders: string;          // türetilen ders
  tur: 'plan' | 'deneme';
  dakika: number;        // günlük çalışma dakikası
  adimlar?: Adim[];      // işlerden türetilen adımlar (varsa)
}

// Türkçe karakterleri sadeleştir + küçült (eşleştirme için).
// Model alanları bazen sayı/null döndürebildiğinden önce string'e zorla.
function sadelestir(s: unknown): string {
  return String(s ?? '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .trim();
}

// Gün adı → JS haftanın günü (0=Pazar .. 6=Cumartesi). Çözülemezse null.
// Sıra önemli: "pazartesi" / "cumartesi" daha kısa eşlerden ÖNCE denenmeli.
export function gunIndeksi(gunAdi: string): number | null {
  const n = sadelestir(gunAdi);
  if (!n) return null;
  const tam: [string, number][] = [
    ['pazartesi', 1],
    ['cumartesi', 6],
    ['carsamba', 3],
    ['persembe', 4],
    ['pazar', 0],
    ['sali', 2],
    ['cuma', 5],
  ];
  for (const [ad, idx] of tam) {
    if (n.startsWith(ad)) return idx;
  }
  const kisa: Record<string, number> = {
    pzt: 1, sal: 2, car: 3, per: 4, cum: 5, cmt: 6, paz: 0,
  };
  const ilk3 = n.slice(0, 3);
  return ilk3 in kisa ? kisa[ilk3] : null;
}

// Plan günlerini BUGÜNDEN ileri MONOTON tarihlere eşler: her gün, bir önceki
// günün tarihinden SONRAKİ ilk gelişine düşer. Böylece 7 günü aşan planlarda
// tekrar eden gün adı ("Çarşamba" ×2) sonraki haftaya taşar; aynı tarihe binmez.
// Gün adı çözülemeyen satır imlecin gösterdiği güne düşer (sıralı yedek) —
// her satır mutlaka bir tarih alır.
export function planGunTarihleri(gunler: { gun?: unknown }[], bugun: Date): Date[] {
  const imlec = new Date(bugun);
  imlec.setHours(0, 0, 0, 0);
  return (gunler || []).map((g) => {
    const idx = gunIndeksi(String(g?.gun ?? ''));
    const t = new Date(imlec);
    if (idx !== null) t.setDate(t.getDate() + ((idx - t.getDay() + 7) % 7));
    imlec.setTime(t.getTime());
    imlec.setDate(imlec.getDate() + 1);
    return t;
  });
}

// "120" → 120, "2 saat" → 120, "1.5 saat" → 90, "90 dk" → 90,
// "2 saat 30 dk" → 150. Çözülemezse 0. Sonuç [5, 600] aralığına kıstırılır.
export function dakikaCoz(sure: string | number | undefined): number {
  if (typeof sure === 'number') return kistir(sure);
  const s = sadelestir(String(sure ?? ''));
  if (!s) return 0;

  let dk = 0;
  let eslesti = false;

  const saatM = s.match(/(\d+(?:[.,]\d+)?)\s*saat/);
  if (saatM) {
    dk += Math.round(parseFloat(saatM[1].replace(',', '.')) * 60);
    eslesti = true;
  }
  const dkM = s.match(/(\d+)\s*(?:dk|dakika|dakka|min)/);
  if (dkM) {
    dk += parseInt(dkM[1], 10);
    eslesti = true;
  }
  if (!eslesti) {
    // Birimsiz çıplak sayı → dakika varsay.
    const sayi = s.match(/(\d+)/);
    if (sayi) dk = parseInt(sayi[1], 10);
  }
  return kistir(dk);
}

function kistir(dk: number): number {
  if (!dk || dk <= 0) return 0;
  return Math.max(5, Math.min(600, Math.round(dk)));
}

// Odak metninden ders türet (renk/etiket için). Eşleşme yoksa "Genel".
export function dersBul(odak: string): string {
  const n = sadelestir(odak);
  // DERSLER: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Genel
  for (const d of DERSLER) {
    if (d === 'Genel') continue;
    if (n.includes(sadelestir(d))) return d;
  }
  if (/(paragraf|dil bilgisi|sozcuk|edebiyat)/.test(n)) return 'Türkçe';
  return 'Genel';
}

// Ders bazlı çözüm temposu (dk/soru) — çalışma hızıdır (çöz + kontrol), sınav hızından yavaştır.
const SORU_TEMPO: Record<string, number> = {
  Matematik: 2.4, Fizik: 2.2, Kimya: 1.9, Biyoloji: 1.7, Türkçe: 1.3, Genel: 1.8,
};
// Soru sayısı yazılmamış çözüm adımına atanan ders bazlı makul varsayılan (≈30-40 dk'lık blok).
const VARSAYILAN_SORU: Record<string, number> = {
  Matematik: 14, Fizik: 15, Kimya: 18, Biyoloji: 20, Türkçe: 25, Genel: 18,
};

// İş metnindeki AÇIK süreyi çek ("30 dk", "1.5 saat"). Birimsiz çıplak sayıyı YOK SAYAR
// (örn. "Ünite 3 tekrar"daki 3'ü süre sanmaz). Bulamazsa null.
function metindenDk(ad: string): number | null {
  const m = ad.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(saat|dk|dakika|dakka|min)/);
  if (!m) return null;
  const val = parseFloat(m[1].replace(',', '.'));
  return /saat/.test(m[2]) ? Math.round(val * 60) : Math.round(val);
}

// İş satırlarını adımlara çevir. Süre, naif eşit-bölme yerine GERÇEKÇİ hesaplanır:
// soru adımı = soru sayısı × ders temposu; konu tekrarı/okuma = açık süre ya da ~40 dk; mola ~10 dk.
// Soru adımında sayı yazılmamışsa ders bazlı varsayılan atanır → asla "0 soru" görünmez.
function islerdenAdimlar(isler: string[], ders: string): Adim[] | undefined {
  const temiz = (isler || []).map((x) => String(x ?? '').trim()).filter(Boolean);
  if (!temiz.length) return undefined;
  const tempo = SORU_TEMPO[ders] ?? SORU_TEMPO.Genel;

  return temiz.map((ad) => {
    if (/(mola|dinlen|nefes)/i.test(ad)) {
      const dk = Math.max(5, Math.min(20, metindenDk(ad) ?? 10));
      return { tip: 'mola', ad, dk, done: false } as Adim;
    }
    if (/(soru|çöz|coz|test)/i.test(ad)) {
      const m = ad.match(/(\d+)\s*(?:soru|test)/i);
      const sayi = m
        ? Math.max(3, Math.min(80, parseInt(m[1], 10)))
        : VARSAYILAN_SORU[ders] ?? VARSAYILAN_SORU.Genel;
      const dk = Math.max(10, Math.min(180, Math.round(sayi * tempo)));
      return { tip: 'soru', ad, dk, soru: sayi, done: false } as Adim;
    }
    // konu tekrarı / okuma
    const dk = Math.max(15, Math.min(90, metindenDk(ad) ?? 40));
    return { tip: 'oku', ad, dk, done: false } as Adim;
  });
}

interface PlanGun {
  gun: string;
  odak: string;
  sure: string;
  isler?: string[];
}

// Plan günlerini takvim taslaklarına çevir. Boş/odaksız günler atlanır.
// Tarihler planGunTarihleri ile atanır — her gün mutlaka bir tarihe düşer,
// "ekle" pasif kalmaz; kart üzerindeki gün kutucuklarıyla da birebir aynıdır.
export function planiTaslaklaraCevir(gunler: PlanGun[], bugun: Date): GunTaslak[] {
  const gecerli = (gunler || []).filter((g) => g && String(g.odak ?? '').trim());
  const tarihler = planGunTarihleri(gecerli, bugun);
  return gecerli.map((g, i) => {
    const odak = String(g.odak ?? '').trim();
    const ders = dersBul(odak);
    const adimlar = islerdenAdimlar(g.isler ?? [], ders);
    // Süre adımlardan TÜRETİLİR (gerçekçi tempo); işsiz günde model süresine düş.
    const dakika = adimlar ? adimlar.reduce((t, a) => t + a.dk, 0) : dakikaCoz(g.sure) || 60;
    return {
      gunAdi: String(g.gun ?? `${i + 1}. gün`),
      tarih: tarihler[i],
      baslik: odak,
      ders,
      tur: /deneme/i.test(odak) ? 'deneme' : 'plan',
      dakika,
      adimlar,
    };
  });
}

// Görünür süre etiketi: birimsiz çıplak sayıya "dk" ekle (model unutursa).
// Model `sure`'yi bazen sayı olarak döndürür → güvenle string'e çevir.
export function sureEtiketi(sure: string | number | undefined | null): string {
  const s = String(sure ?? '').trim();
  if (!s) return '';
  return /^\d+([.,]\d+)?$/.test(s) ? `${s} dk` : s;
}

// "12 Haziran 2026" gibi tek bir Türkçe tarihi parçalar. Yıl opsiyonel.
function tarihParcala(s: string): { gun: string; ay: string; yil?: string } | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)(?:\s+(\d{4}))?$/);
  return m ? { gun: m[1], ay: m[2], yil: m[3] } : null;
}

// Modelin ürettiği tarih aralığını görüntü için kısaltır: tekrar eden ay/yıl atılır.
// "10 Haziran 2026 - 19 Haziran 2026" → "10–19 Haziran 2026"
// "28 Haziran 2026 - 5 Temmuz 2026"   → "28 Haziran – 5 Temmuz 2026"
// Tanınmayan biçim olduğu gibi döner (yalnızca ayraç normalize edilir).
export function tarihAraligiKisalt(aralik: string | undefined | null): string {
  const s = String(aralik ?? '').trim();
  if (!s) return '';
  const parcalar = s.split(/\s*[-–—]\s*/);
  if (parcalar.length !== 2) return s;
  const a = tarihParcala(parcalar[0]);
  const b = tarihParcala(parcalar[1]);
  // "10–19 Haziran" gibi zaten kısa biçim: sol taraf çıplak gün sayısı.
  if (!a && b && /^\d{1,2}$/.test(parcalar[0])) return `${parcalar[0]}–${b.gun} ${b.ay}${b.yil ? ` ${b.yil}` : ''}`;
  if (!a || !b) return `${parcalar[0]} – ${parcalar[1]}`;
  const ayniAy = a.ay.toLocaleLowerCase('tr') === b.ay.toLocaleLowerCase('tr');
  const ayniYil = !a.yil || !b.yil || a.yil === b.yil;
  const yil = b.yil ?? a.yil;
  const yilEk = yil ? ` ${yil}` : '';
  if (ayniAy && ayniYil) return `${a.gun}–${b.gun} ${b.ay}${yilEk}`;
  if (ayniYil) return `${a.gun} ${a.ay} – ${b.gun} ${b.ay}${yilEk}`;
  return `${parcalar[0]} – ${parcalar[1]}`;
}
