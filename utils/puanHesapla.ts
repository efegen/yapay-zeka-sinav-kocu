export const obpHesapla = (diplomaNotu: number): number => {
  return diplomaNotu * 5;
};

export const tytPuanHesapla = (netler: {
  turkce: number; mat: number; geometri: number;
  tarih: number; cografya: number; felsefe: number;
  din: number; fizik: number; kimya: number; biyoloji: number;
}, diplomaNotu: number): number => {
  const toplamNet = Object.values(netler).reduce((a, b) => a + b, 0);
  const obp = obpHesapla(diplomaNotu);
  const bazPuan = 100 + toplamNet * 3.85;
  return Math.round((bazPuan + obp * 0.12) * 100) / 100;
};

export const aytPuanHesapla = (
  aytNetleri: number[],
  tytPuan: number,
  diplomaNotu: number
): number => {
  const aytNet = aytNetleri.reduce((a, b) => a + b, 0);
  const obp = obpHesapla(diplomaNotu);
  const bazPuan = tytPuan * 0.4 + aytNet * 3.5;
  return Math.round((bazPuan + obp * 0.06) * 100) / 100;
};

export const diplomaEtkisiAcikla = (diplomaNotu: number): string => {
  const obp = obpHesapla(diplomaNotu);
  const tytKatki = Math.round(obp * 0.12 * 100) / 100;
  const aytKatki = Math.round(obp * 0.06 * 100) / 100;
  return `Bu diploma notu TYT puanına +${tytKatki}, AYT puanına +${aytKatki} katkı sağlar.`;
};
