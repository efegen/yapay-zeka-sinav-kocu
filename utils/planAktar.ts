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

// Bir haftanın gününün BUGÜNDEN itibaren ilk gelişi (bugün dahil, 0–6 gün ileri).
// "1 haftalık plan" böylece geçmişe düşmeden önümüzdeki 7 güne yayılır.
export function sonrakiTarih(haftaninGunu: number, bugun: Date): Date {
  const d = new Date(bugun);
  d.setHours(0, 0, 0, 0);
  const fark = (haftaninGunu - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + fark);
  return d;
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

// İş satırlarını adımlara çevir; toplam dakikayı eşit (son adım kalanı alır) böl.
function islerdenAdimlar(isler: string[], toplamDk: number): Adim[] | undefined {
  const temiz = (isler || []).map((x) => String(x ?? '').trim()).filter(Boolean);
  const n = temiz.length;
  if (!n) return undefined;

  const taban = Math.max(5, Math.floor(toplamDk / n) || 5);
  let kalan = toplamDk;
  return temiz.map((ad, i) => {
    const sonMu = i === n - 1;
    const dk = sonMu ? Math.max(5, kalan) : taban;
    kalan -= dk;
    const soru = /(soru|çöz|coz|test)/i.test(ad);
    const adim: Adim = { tip: soru ? 'soru' : 'oku', ad, dk, done: false };
    if (soru) {
      const m = ad.match(/(\d+)\s*soru/i);
      if (m) adim.soru = parseInt(m[1], 10);
    }
    return adim;
  });
}

interface PlanGun {
  gun: string;
  odak: string;
  sure: string;
  isler?: string[];
}

// Bugünden i gün sonrası (gece yarısı). Gün adı çözülemezse sıralı yedek.
function tarihIndeksli(bugun: Date, i: number): Date {
  const d = new Date(bugun);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + i);
  return d;
}

// Plan günlerini takvim taslaklarına çevir. Boş/odaksız günler atlanır.
// Gün adı çözülemezse (model garip bir değer döndürdüyse) sıra numarasına göre
// tarih atanır — böylece her gün mutlaka bir tarihe düşer, "ekle" pasif kalmaz.
export function planiTaslaklaraCevir(gunler: PlanGun[], bugun: Date): GunTaslak[] {
  const gecerli = (gunler || []).filter((g) => g && String(g.odak ?? '').trim());
  return gecerli.map((g, i) => {
    const idx = gunIndeksi(g.gun);
    const dakika = dakikaCoz(g.sure) || 60; // çözülemezse makul varsayılan
    const odak = String(g.odak ?? '').trim();
    const adimlar = islerdenAdimlar(g.isler ?? [], dakika);
    // Adım varsa süre = adım toplamı (plan detayıyla tutarlı olsun).
    const toplam = adimlar ? adimlar.reduce((t, a) => t + a.dk, 0) : dakika;
    return {
      gunAdi: String(g.gun ?? `${i + 1}. gün`),
      tarih: idx === null ? tarihIndeksli(bugun, i) : sonrakiTarih(idx, bugun),
      baslik: odak,
      ders: dersBul(odak),
      tur: /deneme/i.test(odak) ? 'deneme' : 'plan',
      dakika: toplam,
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
