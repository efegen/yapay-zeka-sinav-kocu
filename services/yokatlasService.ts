import universitelerData from '../assets/data/universiteler.json';

export interface YokatlasProgram {
  programId: string;
  universiteAdi: string;
  fakulteAdi: string;
  bolumAdi: string;
  programDetay: string;       // ör. "(İngilizce)", "(UOLP-Purdue)"
  puanTuru: 'SAY' | 'EA' | 'SOZ' | 'DIL';
  sehir: string;
  universiteTuru: string;
  ucretBurs: string;          // "Burslu", "%50 İndirimli", "Ücretli" vb.
  ogretimTuru: string;        // "Örgün", "İkinci" vb.

  // 2025 — birincil hedef metrikleri
  tabanPuan_2025: string | null;
  tabanSiralama_2025: string | null;
  kontenjan_2025: string | null;
  yerlesen_2025: string | null;

  // 2024 — trend & yedek referans
  tabanPuan_2024: string | null;
  tabanSiralama_2024: string | null;
  kontenjan_2024: string | null;
  yerlesen_2024: string | null;
}

const programlar: YokatlasProgram[] = universitelerData as YokatlasProgram[];

// Tüm benzersiz üniversite adları (alfabetik, önbellek)
let _tumUniversiteler: string[] | null = null;
export const tumUniversiteleriGetir = (): string[] => {
  if (!_tumUniversiteler) {
    const tekil = [...new Set(programlar.map(p => p.universiteAdi))];
    _tumUniversiteler = tekil.sort((a, b) => a.localeCompare(b, 'tr'));
  }
  return _tumUniversiteler;
};

export const universiteAramaYap = (aramaMetni: string): string[] => {
  if (!aramaMetni || aramaMetni.length < 2) return tumUniversiteleriGetir();
  const kucuk = aramaMetni.toLocaleLowerCase('tr');
  return tumUniversiteleriGetir().filter(u =>
    u.toLocaleLowerCase('tr').includes(kucuk)
  );
};

export const bolumListesiGetir = (
  universiteAdi: string,
  puanTuru: string
): YokatlasProgram[] => {
  return programlar.filter(
    p => p.universiteAdi === universiteAdi && p.puanTuru === puanTuru
  );
};

export const programBul = (programId: string): YokatlasProgram | undefined => {
  return programlar.find(p => p.programId === programId);
};
