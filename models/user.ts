export interface UserModel {
  uid: string;
  isim: string;
  email: string;
  sinif: '11' | '12' | 'mezun';
  okulTuru: 'Anadolu Lisesi' | 'Fen Lisesi' | 'Meslek Lisesi' | 'Diğer';
  diplomaNotu: number;
  puanTuru: 'SAY' | 'EA' | 'SOZ';
  hedefUniversite: string;
  hedefBolum: string;
  hedefProgramId: string;
  haftaCalismaSayisi: number;
  gunlukSoruHedefi: number;
  kvkkOnay: boolean;
  kvkkOnayTarihi: string;
  olusturmaTarihi: any;
  sonGirisTarihi: any;
}
