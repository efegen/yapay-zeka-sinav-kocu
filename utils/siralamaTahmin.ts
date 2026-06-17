import type { DenemeSonuc } from '../models/deneme';
import { netlerdenSiralama } from '../services/yokatlasService';

/** Son tam denemelerden türetilen "güncel form" sıralama tahmini. */
export interface FormTahmini {
  /** Ağırlıklı güncel formdan tahmini YKS sıralaması (veri yoksa null). */
  guncelSira: number | null;
  /** Ortalamaya giren tam (TYT+AYT) deneme sayısı. */
  kullanilanDeneme: number;
  /** Eğilim: pozitif = iyileşme (sıralama küçülüyor), negatif = geriye gidiş. Tek denemede null. */
  trend: number | null;
  /** Diploma notu (OBP) girilmiş mi — girilmemişse tahmin olduğundan kötü sapar. */
  diplomaGirildi: boolean;
}

const BOS: FormTahmini = { guncelSira: null, kullanilanDeneme: 0, trend: null, diplomaGirildi: false };

// Recency ağırlığı: en yeni deneme 1, her bir öncekine ×0.6. Son 5 denemeyle sınırlanır —
// daha eskinin ağırlığı zaten ihmal edilebilir (0.6^5 ≈ 0.08) ve güncel seviyeyi yansıtmaz.
// Tek deneme varsa sonuç o denemeye eşittir (geriye dönük uyumlu).
const PENCERE = 5;
const SONUMLEME = 0.6;

const ort = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Son tam (TYT+AYT) denemelerin recency-ağırlıklı ortalamasından tahmini sıralama üretir.
 * Tek-deneme gürültüsünü azaltmak için net uzayında ortalama alıp tek seferde sıralamaya
 * çevirir (sıra↔puan ilişkisi üstel olduğundan ham sıraları ortalamak yanıltıcı olurdu).
 * OBP, `netlerdenSiralama` içinde diploma notundan zaten hesaba katılır.
 *
 * @param tamDenemeler kapsam === 'ikisi' olan denemeler, YENİ → ESKİ sırada.
 * @param diplomaNotu  OBP için diploma notu (0 → OBP katkısı yok, tahmin saparak düşer).
 */
export function formTahminiHesapla(
  tamDenemeler: DenemeSonuc[],
  diplomaNotu: number,
): FormTahmini {
  if (!tamDenemeler.length) return BOS;

  const secilen = tamDenemeler.slice(0, PENCERE);
  const alan = secilen[0].alan;

  // Ağırlıklı ortalama TYT/AYT net (net uzayında) → tek tahmin.
  let wTop = 0;
  let tytTop = 0;
  let aytTop = 0;
  secilen.forEach((d, i) => {
    const w = Math.pow(SONUMLEME, i);
    wTop += w;
    tytTop += d.tytNet * w;
    aytTop += d.aytNet * w;
  });
  const guncelSira = netlerdenSiralama(tytTop / wTop, aytTop / wTop, alan, diplomaNotu);

  // Eğilim: yeni yarı vs eski yarı ortalama sıralama farkı (pozitif = iyileşme).
  // Tek tek denemelerin ham sıralamaları üzerinden — 2 denemede klasik "önceki − güncel"e iner.
  const siralar = secilen
    .map((d) => netlerdenSiralama(d.tytNet, d.aytNet, alan, diplomaNotu))
    .filter((s): s is number => s != null);
  let trend: number | null = null;
  if (siralar.length >= 2) {
    const yari = Math.max(1, Math.floor(siralar.length / 2));
    const yeniYari = siralar.slice(0, yari);
    const eskiYari = siralar.slice(siralar.length - yari);
    trend = Math.round(ort(eskiYari) - ort(yeniYari));
  }

  return {
    guncelSira,
    kullanilanDeneme: secilen.length,
    trend,
    diplomaGirildi: diplomaNotu > 0,
  };
}
