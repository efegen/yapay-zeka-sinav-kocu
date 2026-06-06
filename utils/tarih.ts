export function tarihFormatla(d: Date): string {
  const gun = String(d.getDate()).padStart(2, '0');
  const ay = String(d.getMonth() + 1).padStart(2, '0');
  return `${gun}.${ay}.${d.getFullYear()}`;
}

export function simdi(): { tarih: string; saat: string } {
  const d = new Date();
  const saat = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { tarih: tarihFormatla(d), saat };
}

/** İki tarih arasındaki tam gün farkı (negatifse 0). */
export function gunFarki(hedef: Date, baz: Date = new Date()): number {
  const birGun = 1000 * 60 * 60 * 24;
  const a = new Date(hedef.getFullYear(), hedef.getMonth(), hedef.getDate());
  const b = new Date(baz.getFullYear(), baz.getMonth(), baz.getDate());
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / birGun));
}

/** "20 Haziran" gibi uzun ama yılsız tarih biçimi. */
export function tarihUzun(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

/** baslangic→bitis aralığında baz tarihinin geçtiği oran (0–1). */
export function aralikOrani(baslangic: Date, bitis: Date, baz: Date = new Date()): number {
  const toplam = bitis.getTime() - baslangic.getTime();
  if (toplam <= 0) return 1;
  const gecen = baz.getTime() - baslangic.getTime();
  return Math.max(0, Math.min(1, gecen / toplam));
}
