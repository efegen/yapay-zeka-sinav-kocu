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
