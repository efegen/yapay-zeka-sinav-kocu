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

let _programMap: Map<string, YokatlasProgram> | null = null;
const getProgramMap = (): Map<string, YokatlasProgram> => {
  if (!_programMap) {
    _programMap = new Map(programlar.map(p => [p.programId, p]));
  }
  return _programMap;
};

export const programBul = (programId: string): YokatlasProgram | undefined => {
  return getProgramMap().get(programId);
};

export interface HedefNetBilgisi {
  tyt_turkce: number;
  tyt_matematik: number;
  tyt_fen: number;
  tyt_sosyal: number;
  // SAY
  ayt_matematik?: number;
  ayt_fizik?: number;
  ayt_kimya?: number;
  ayt_biyoloji?: number;
  // EA
  ayt_edebiyat?: number;
  ayt_tarih1?: number;
  ayt_cografya1?: number;
  // SOZ (+ edebiyat, tarih1, cografya1 yukarıda)
  ayt_tarih2?: number;
  ayt_cografya2?: number;
  ayt_felsefe?: number;
  ayt_din?: number;
  // DIL
  ayt_yabancidil?: number;
  kaynak_yil: number;
}

/**
 * YÖK Atlas'tan belirtilen programa yerleşen öğrencilerin net ortalamalarını çeker.
 * Hata durumunda null döndürür, asla throw etmez.
 */
export const fetchHedefNetBilgisi = async (
  programId: string,
  year: number = 2025
): Promise<HedefNetBilgisi | null> => {
  try {
    const url = `https://yokatlas.yok.gov.tr/content/lisans-dynamic/1210a.php?y=${programId}`;
    const response = await fetch(url);
    if (!response.ok) {
      const hint = response.status === 429 ? ' — rate limit aşıldı' : ' — ağ veya sunucu hatası';
      console.warn(`[yokatlasService] programId=${programId}: HTTP ${response.status}${hint}`);
      return null;
    }
    const html = await response.text();

    const parseNet = (label: string): number | undefined => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rowRegex = new RegExp(
        `${escaped}[^<]*<\\/td>[\\s\\S]*?<td[^>]*>\\s*([\\d]+[,.]?[\\d]*)\\s*<\\/td>`,
        'i'
      );
      const match = html.match(rowRegex);
      if (!match) return undefined;
      const val = parseFloat(match[1].replace(',', '.'));
      return isNaN(val) ? undefined : val;
    };

    const tyt_turkce    = parseNet('TYT Türkçe');
    const tyt_matematik = parseNet('TYT Temel Matematik');
    const tyt_fen       = parseNet('TYT Fen Bilimleri');
    const tyt_sosyal    = parseNet('TYT Sosyal Bilimler');

    if (
      tyt_turkce === undefined ||
      tyt_matematik === undefined ||
      tyt_fen === undefined ||
      tyt_sosyal === undefined
    ) {
      console.warn(`[yokatlasService] programId=${programId}: TYT net verileri parse edilemedi — YÖK Atlas HTML yapısı değişmiş olabilir.`);
      return null;
    }

    const result: HedefNetBilgisi = {
      tyt_turkce,
      tyt_matematik,
      tyt_fen,
      tyt_sosyal,
      kaynak_yil: year,
    };

    // SAY
    const ayt_matematik = parseNet('AYT Matematik');
    if (ayt_matematik !== undefined) result.ayt_matematik = ayt_matematik;
    const ayt_fizik = parseNet('AYT Fizik');
    if (ayt_fizik !== undefined) result.ayt_fizik = ayt_fizik;
    const ayt_kimya = parseNet('AYT Kimya');
    if (ayt_kimya !== undefined) result.ayt_kimya = ayt_kimya;
    const ayt_biyoloji = parseNet('AYT Biyoloji');
    if (ayt_biyoloji !== undefined) result.ayt_biyoloji = ayt_biyoloji;

    // EA / SOZ
    const ayt_edebiyat = parseNet('AYT Türk Dili ve Edebiyatı');
    if (ayt_edebiyat !== undefined) result.ayt_edebiyat = ayt_edebiyat;
    const ayt_tarih1 = parseNet('AYT Tarih-1');
    if (ayt_tarih1 !== undefined) result.ayt_tarih1 = ayt_tarih1;
    const ayt_cografya1 = parseNet('AYT Coğrafya-1');
    if (ayt_cografya1 !== undefined) result.ayt_cografya1 = ayt_cografya1;
    const ayt_tarih2 = parseNet('AYT Tarih-2');
    if (ayt_tarih2 !== undefined) result.ayt_tarih2 = ayt_tarih2;
    const ayt_cografya2 = parseNet('AYT Coğrafya-2');
    if (ayt_cografya2 !== undefined) result.ayt_cografya2 = ayt_cografya2;
    const ayt_felsefe = parseNet('AYT Felsefe Grubu');
    if (ayt_felsefe !== undefined) result.ayt_felsefe = ayt_felsefe;
    const ayt_din = parseNet('AYT Din Kültürü');
    if (ayt_din !== undefined) result.ayt_din = ayt_din;

    // DIL — YDT Yabancı Dil (İngilizce, Almanca, vb.)
    const ayt_yabancidil = parseNet('YDT Yabancı Dil');
    if (ayt_yabancidil !== undefined) result.ayt_yabancidil = ayt_yabancidil;

    return result;
  } catch {
    return null;
  }
};

export interface ReferenceProgram {
  programId: string;
  universiteAdi: string;
  bolumAdi: string;
  tabanSiralama: number;
}

/**
 * Hedef sıralamaya en yakın referans programları döndürür.
 * null/0/"0" tabanSiralama_2025 kayıtları filtrelenir.
 */
export const findReferencePrograms = (
  hedefSiralama: number,
  puanTuru: 'SAY' | 'EA' | 'SOZ' | 'DIL',
  tolerans: number = 2000
): ReferenceProgram[] => {
  const adaylar = programlar
    .filter(p => {
      if (p.puanTuru !== puanTuru) return false;
      const s = p.tabanSiralama_2025;
      if (s === null || s === undefined || s === '0' || s === '') return false;
      const n = Number(s);
      if (isNaN(n) || n === 0) return false;
      return Math.abs(n - hedefSiralama) <= tolerans;
    })
    .map(p => ({
      programId: p.programId,
      universiteAdi: p.universiteAdi,
      bolumAdi: p.bolumAdi,
      tabanSiralama: Number(p.tabanSiralama_2025),
    }));

  adaylar.sort((a, b) =>
    Math.abs(a.tabanSiralama - hedefSiralama) - Math.abs(b.tabanSiralama - hedefSiralama)
  );

  return adaylar.slice(0, 5);
};
