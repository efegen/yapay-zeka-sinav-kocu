// YKS sınav takvimi sabitleri.
// Tarihler ÖSYM takvimine göre güncellenebilir.

// YKS 2026 — TYT oturumu (20 Haziran 2026, Cumartesi). Sınıfa göre hedef yılın bazıdır.
export const YKS_TARIHI = new Date(2026, 5, 20);

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

/**
 * Verilen tarih bir YKS sınav günü mü — TYT ya da ertesi gün AYT oturumu? Saat dikkate
 * alınmaz. Hedef yıl sınıfa göredir (11. sınıf bir sonraki YKS'ye girer), bu yüzden çağıran
 * ekranlar öğrencinin sınıfını geçmelidir; verilmezse bu yılın YKS'si baz alınır.
 */
export function yksSinavGunuMu(d: Date, sinif?: string): boolean {
  const tyt = hedefYksTarihi(sinif);
  const ayt = new Date(tyt.getFullYear(), tyt.getMonth(), tyt.getDate() + 1);
  const ayniGun = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  return ayniGun(d, tyt) || ayniGun(d, ayt);
}
