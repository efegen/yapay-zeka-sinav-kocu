export const obpHesapla = (diplomaNotu: number): number => {
  return diplomaNotu * 5;
};

// YÖK kuralı: önceki yıl bir programa yerleşmiş mezunlar için OBP katkısı %50 azaltılır.
export const obpKatsayilariGetir = (gecenYilYerlesti: boolean) => ({
  tyt: gecenYilYerlesti ? 0.06 : 0.12,
  ayt: gecenYilYerlesti ? 0.03 : 0.06,
});

export const tytPuanHesapla = (netler: {
  turkce: number; mat: number; geometri: number;
  tarih: number; cografya: number; felsefe: number;
  din: number; fizik: number; kimya: number; biyoloji: number;
}, diplomaNotu: number, gecenYilYerlesti = false): number => {
  const toplamNet = Object.values(netler).reduce((a, b) => a + b, 0);
  const obp = obpHesapla(diplomaNotu);
  const { tyt } = obpKatsayilariGetir(gecenYilYerlesti);
  const bazPuan = 100 + toplamNet * 3.85;
  return Math.round((bazPuan + obp * tyt) * 100) / 100;
};

export const aytPuanHesapla = (
  aytNetleri: number[],
  tytPuan: number,
  diplomaNotu: number,
  gecenYilYerlesti = false,
): number => {
  const aytNet = aytNetleri.reduce((a, b) => a + b, 0);
  const obp = obpHesapla(diplomaNotu);
  const { ayt } = obpKatsayilariGetir(gecenYilYerlesti);
  const bazPuan = tytPuan * 0.4 + aytNet * 3.5;
  return Math.round((bazPuan + obp * ayt) * 100) / 100;
};

export const diplomaEtkisiAcikla = (diplomaNotu: number, gecenYilYerlesti = false): string => {
  const obp = obpHesapla(diplomaNotu);
  const { tyt, ayt } = obpKatsayilariGetir(gecenYilYerlesti);
  const tytKatki = Math.round(obp * tyt * 100) / 100;
  const aytKatki = Math.round(obp * ayt * 100) / 100;
  const uyari = gecenYilYerlesti
    ? ' (geçen yıl yerleştiğin için OBP katkısı %50 azaltılmıştır)'
    : '';
  return `Bu diploma notu TYT puanına +${tytKatki}, AYT puanına +${aytKatki} katkı sağlar${uyari}.`;
};
