import universitelerData from '../assets/data/universiteler.json';
import { yerlestirmePuani } from '../utils/puanHesapla';

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
 * Taban puandan geriye dönük net tahmini hesaplar.
 * OBP katkısı varsayılan 80 diploma notu (OBP=400) üzerinden çıkarılır.
 *
 * TYT puanı  = 100 + toplamTYTNet × 3.85 + OBP × 0.12
 * AYT puanı  = TYT × 0.4 + toplamAYTNet × 3.5 + OBP × 0.06
 *
 * Toplam net, soru sayısı oranlarına göre derslere dağıtılır.
 */
/** Geçerli (pozitif sayı) taban puanı döndürür; "Dolmadı"/boş/0 → null. */
const gecerliPuan = (v: string | null | undefined): number | null => {
  if (v == null) return null;
  const n = parseFloat(v);
  return isNaN(n) || n <= 0 ? null : n;
};

/**
 * Bir program için kullanılabilir taban puanı çözer:
 *   1) programın kendi 2025'i  → 2) kendi 2024'ü →
 *   3) aynı üniversite+bölüm+puan türündeki (kontenjanı dolmuş) kardeş programın 2025'i → 4) 2024'ü.
 * Hiçbiri yoksa null. "Dolmadı" gibi geçersiz değerler atlanır.
 */
const tabanPuanCoz = (
  program: YokatlasProgram
): { tabanPuan: number; kaynakYil: number } | null => {
  const oz25 = gecerliPuan(program.tabanPuan_2025);
  if (oz25) return { tabanPuan: oz25, kaynakYil: 2025 };
  const oz24 = gecerliPuan(program.tabanPuan_2024);
  if (oz24) return { tabanPuan: oz24, kaynakYil: 2024 };

  const kardesler = programlar.filter(
    (k) =>
      k.programId !== program.programId &&
      k.universiteAdi === program.universiteAdi &&
      k.bolumAdi === program.bolumAdi &&
      k.puanTuru === program.puanTuru
  );
  for (const k of kardesler) {
    const v = gecerliPuan(k.tabanPuan_2025);
    if (v) return { tabanPuan: v, kaynakYil: 2025 };
  }
  for (const k of kardesler) {
    const v = gecerliPuan(k.tabanPuan_2024);
    if (v) return { tabanPuan: v, kaynakYil: 2024 };
  }
  return null;
};

export const hedefNetHesapla = (
  programId: string,
): HedefNetBilgisi | null => {
  const program = programBul(programId);
  if (!program) return null;

  const cozulen = tabanPuanCoz(program);
  if (!cozulen) return null;
  const { tabanPuan, kaynakYil } = cozulen;

  const puanTuru = program.puanTuru;
  const OBP = 400; // 80 diploma notu varsayımı

  // — TYT toplam net tahmini —
  // tabanPuan ≈ 100 + toplamTYT × 3.85 + OBP × 0.12
  // Ancak AYT puanı = TYT × 0.4 + AYT × 3.5 + OBP × 0.06
  // tabanPuan AYT puanı olduğundan, TYT'yi tahmin için:
  //   tabanPuan'ın ~%40'ı TYT'den, ~%60'ı AYT'den gelir şeklinde böl

  // TYT puanını tahmin et: tabanPuanın yaklaşık değerinden
  // Tipik üst düzey öğrenci: TYT ~95/120, AYT ~65/80
  // TYT puan ≈ 100 + 95 × 3.85 + 48 ≈ 514
  // AYT puan ≈ 514 × 0.4 + 65 × 3.5 + 24 ≈ 457

  // Gerçekçi tahmin: tabanPuan = TYT*0.4 + aytNet*3.5 + OBP*0.06
  // TYT puan = 100 + tytNet*3.85 + OBP*0.12

  // TYT puanını tabanPuandan çıkar:
  // tabanPuan = tytPuan * 0.4 + aytNet * 3.5 + OBP * 0.06
  // tytPuan = 100 + tytNet * 3.85 + OBP * 0.12

  // TYT soru dağılımı: Türkçe 40, Mat 40, Fen 20, Sosyal 20 = 120
  const TYT_TOPLAM_SORU = 120;
  // AYT soru dağılımı puan türüne göre değişir, hepsi toplam 80
  const AYT_TOPLAM_SORU = 80;

  // Net oran: Puan yükseldikçe net oranı da yükselir
  // Minimum puan ~180 (ham), Maksimum ~560
  // tabanPuan-180 → 0% doğruluk, 560 → ~95% doğruluk
  const tytNetOran = Math.min(Math.max((tabanPuan - 180) / (560 - 180), 0.1), 0.95);
  const aytNetOran = Math.min(Math.max((tabanPuan - 200) / (560 - 200), 0.05), 0.95);

  const tytToplamNet = Math.round(tytNetOran * TYT_TOPLAM_SORU * 10) / 10;
  const aytToplamNet = Math.round(aytNetOran * AYT_TOPLAM_SORU * 10) / 10;

  // Doğrulama: hesaplanan AYT puanını kontrol et
  const tytPuan = 100 + tytToplamNet * 3.85 + OBP * 0.12;
  const aytPuanHesap = tytPuan * 0.4 + aytToplamNet * 3.5 + OBP * 0.06;

  // Fark varsa AYT net'i ayarla
  let duzeltilmisAytNet = aytToplamNet;
  if (aytPuanHesap > 0) {
    const fark = tabanPuan - aytPuanHesap;
    duzeltilmisAytNet = Math.max(0, Math.round((aytToplamNet + fark / 3.5) * 10) / 10);
    duzeltilmisAytNet = Math.min(duzeltilmisAytNet, AYT_TOPLAM_SORU);
  }

  // TYT netleri dağıt (soru sayısı oranında)
  const r = (net: number) => Math.round(net * 10) / 10;
  const tyt_turkce    = r(tytToplamNet * (40 / TYT_TOPLAM_SORU));
  const tyt_matematik = r(tytToplamNet * (40 / TYT_TOPLAM_SORU));
  const tyt_fen       = r(tytToplamNet * (20 / TYT_TOPLAM_SORU));
  const tyt_sosyal    = r(tytToplamNet * (20 / TYT_TOPLAM_SORU));

  const result: HedefNetBilgisi = {
    tyt_turkce,
    tyt_matematik,
    tyt_fen,
    tyt_sosyal,
    kaynak_yil: kaynakYil,
  };

  // AYT netleri puan türüne göre dağıt
  if (puanTuru === 'SAY') {
    result.ayt_matematik = r(duzeltilmisAytNet * (40 / AYT_TOPLAM_SORU));
    result.ayt_fizik     = r(duzeltilmisAytNet * (14 / AYT_TOPLAM_SORU));
    result.ayt_kimya     = r(duzeltilmisAytNet * (13 / AYT_TOPLAM_SORU));
    result.ayt_biyoloji  = r(duzeltilmisAytNet * (13 / AYT_TOPLAM_SORU));
  } else if (puanTuru === 'EA') {
    result.ayt_matematik = r(duzeltilmisAytNet * (40 / AYT_TOPLAM_SORU));
    result.ayt_edebiyat  = r(duzeltilmisAytNet * (24 / AYT_TOPLAM_SORU));
    result.ayt_cografya1 = r(duzeltilmisAytNet * (6 / AYT_TOPLAM_SORU));
    result.ayt_tarih1    = r(duzeltilmisAytNet * (10 / AYT_TOPLAM_SORU));
  } else if (puanTuru === 'SOZ') {
    result.ayt_edebiyat  = r(duzeltilmisAytNet * (24 / AYT_TOPLAM_SORU));
    result.ayt_tarih1    = r(duzeltilmisAytNet * (10 / AYT_TOPLAM_SORU));
    result.ayt_cografya1 = r(duzeltilmisAytNet * (6 / AYT_TOPLAM_SORU));
    result.ayt_tarih2    = r(duzeltilmisAytNet * (11 / AYT_TOPLAM_SORU));
    result.ayt_cografya2 = r(duzeltilmisAytNet * (11 / AYT_TOPLAM_SORU));
    result.ayt_felsefe   = r(duzeltilmisAytNet * (12 / AYT_TOPLAM_SORU));
    result.ayt_din       = r(duzeltilmisAytNet * (6 / AYT_TOPLAM_SORU));
  } else if (puanTuru === 'DIL') {
    result.ayt_yabancidil = r(duzeltilmisAytNet);
  }

  return result;
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

// ─────────────────────────────────────────────
// Puan / net → tahmini sıralama (gerçek 2025 taban verisinden)
// ─────────────────────────────────────────────

type PuanTuru = 'SAY' | 'EA' | 'SOZ' | 'DIL';
type SiraNok = { puan: number; sira: number };

/** Taban sıralamayı sayıya çevirir; ayıraç/boş/"Dolmadı" → null. */
const siraParse = (v: string | null | undefined): number | null => {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return isNaN(n) || n <= 0 ? null : n;
};

const _siraEgrisi: Partial<Record<PuanTuru, SiraNok[]>> = {};

/**
 * Bir puan türü için "taban puan → taban sıralama" eğrisi. 2025 verisinden kurulur;
 * 1 puanlık kovalarda ortalama sıra alınarak gürültü düşürülür ve puana göre sıralanır.
 * Modül ömrü boyunca önbelleğe alınır (her render'da yeniden kurulmaz).
 */
const siraEgrisi = (puanTuru: PuanTuru): SiraNok[] => {
  const cache = _siraEgrisi[puanTuru];
  if (cache) return cache;
  const kova = new Map<number, { top: number; adet: number }>();
  for (const p of programlar) {
    if (p.puanTuru !== puanTuru) continue;
    const puan = gecerliPuan(p.tabanPuan_2025);
    const sira = siraParse(p.tabanSiralama_2025);
    if (puan == null || sira == null) continue;
    const k = Math.round(puan);
    const g = kova.get(k) ?? { top: 0, adet: 0 };
    g.top += sira;
    g.adet += 1;
    kova.set(k, g);
  }
  const egri = [...kova.entries()]
    .map(([puan, g]) => ({ puan, sira: g.top / g.adet }))
    .sort((a, b) => a.puan - b.puan);
  _siraEgrisi[puanTuru] = egri;
  return egri;
};

/**
 * Yerleştirme puanından tahmini YKS başarı sıralaması. Eğri üzerinde log-uzayında
 * doğrusal ara/dış değerleme yapar (sıralama, puana göre yaklaşık üsteldir). Yeterli
 * veri yoksa null döner. Sonuç gerçek taban-sıralama ölçeğindedir.
 */
export const puandanSiralama = (puan: number, puanTuru: PuanTuru): number | null => {
  const egri = siraEgrisi(puanTuru);
  if (egri.length < 2) return null;

  const logInterp = (a: SiraNok, b: SiraNok, x: number): number => {
    if (a.puan === b.puan) return (a.sira + b.sira) / 2;
    const t = (x - a.puan) / (b.puan - a.puan);
    return Math.exp(Math.log(a.sira) + t * (Math.log(b.sira) - Math.log(a.sira)));
  };

  let sonuc: number;
  if (puan <= egri[0].puan) {
    sonuc = logInterp(egri[0], egri[1], puan); // alt uçtan dış değerle
  } else if (puan >= egri[egri.length - 1].puan) {
    sonuc = logInterp(egri[egri.length - 2], egri[egri.length - 1], puan); // üst uçtan
  } else {
    let lo = 0;
    let hi = egri.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (egri[mid].puan <= puan) lo = mid;
      else hi = mid;
    }
    sonuc = logInterp(egri[lo], egri[hi], puan);
  }
  return Math.max(1, Math.min(2_400_000, Math.round(sonuc)));
};

/**
 * Toplam TYT/AYT netinden (puan türü + diploma notu ile) tahmini sıralama.
 * Önce yerleştirme puanını hesaplar, sonra gerçek taban-puan eğrisine oturtur.
 * Veri yoksa null.
 */
export const netlerdenSiralama = (
  tytNet: number,
  aytNet: number,
  puanTuru: PuanTuru,
  diplomaNotu: number,
  gecenYilYerlesti = false,
): number | null => {
  const puan = yerlestirmePuani(tytNet, aytNet, diplomaNotu, gecenYilYerlesti);
  return puandanSiralama(puan, puanTuru);
};
