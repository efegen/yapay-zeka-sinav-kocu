// YKS sınav takvimi sabitleri.
// Tarihler ÖSYM takvimine göre güncellenebilir.

// YKS 2026 — TYT oturumu (20 Haziran 2026, Cumartesi).
export const YKS_TARIHI = new Date(2026, 5, 20);

// YKS 2026 — AYT oturumu (TYT'nin ertesi günü, 21 Haziran 2026, Pazar).
export const YKS_AYT_TARIHI = new Date(
  YKS_TARIHI.getFullYear(),
  YKS_TARIHI.getMonth(),
  YKS_TARIHI.getDate() + 1
);

/** Verilen tarih bir YKS sınav günü mü (TYT ya da AYT oturumu)? Saat dikkate alınmaz. */
export function yksSinavGunuMu(d: Date): boolean {
  const ayniGun = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  return ayniGun(d, YKS_TARIHI) || ayniGun(d, YKS_AYT_TARIHI);
}

// Hazırlık sezonunun başlangıcı (1 Eylül 2025) — sezon ilerleme çubuğu için.
export const YKS_SEZON_BASLANGIC = new Date(2025, 8, 1);

// Geri sayımda gösterilecek sınav yılı.
export const YKS_YIL = 2026;

/** Sınıfa göre hedeflenen YKS yılı — 11. sınıf bir SONRAKİ YKS'ye girer (12/mezun bu yıl). */
export function hedefYksYili(sinif?: string): number {
  return sinif === '11' ? YKS_YIL + 1 : YKS_YIL;
}

/**
 * Sınıfa göre hedeflenen YKS (TYT) tarihi. Sonraki yıl için aynı ay/gün baz alınır
 * (kesin tarih her sezon ÖSYM takvimiyle güncellenir).
 */
export function hedefYksTarihi(sinif?: string): Date {
  return new Date(hedefYksYili(sinif), YKS_TARIHI.getMonth(), YKS_TARIHI.getDate());
}
