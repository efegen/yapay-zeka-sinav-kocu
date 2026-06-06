// AI Koç — yapılandırılmış kart sözleşmesi (tipler)
// Kaynak: design_handoff_ai_koc/KART_PROTOKOLU.md. Worker bu yapıyı üretir, UI bunu çizer.
// Alan adları ve tipler BAĞLAYICIDIR — worker şeması ve renderer bu dosyaya dayanır.

/** Kart CTA / buton aksiyonu — uygulama içi derin bağlantı veya sohbet niyeti. */
export type KocAksiyon =
  | 'pomodoro'
  | 'plan'
  | 'konu'
  | 'deneme'
  | 'takvim'
  | 'foto'
  | 'moral'
  | 'zayif';

export interface KartCTA {
  etiket: string;
  aksiyon?: KocAksiyon | string;
}

/** Paletten renk (serbest hex; KART_PROTOKOLU §2). */
export type Renk = string;

// ── Kart veri şemaları (her tip için) ──────────────────────────────────

export interface GunlukBrifingVeri {
  selam: string;
  tarih: string;
  isim: string;
  mesaj: string;
  ilkHamle?: { baslik: string; altMetin: string; aksiyon?: KocAksiyon | string };
}

export interface BaglamSeridiVeri {
  ogeler: {
    tip: 'geriSayim' | 'seri' | 'soru';
    deger: number;
    etiket: string;
    hedef?: number; // 'soru' tipinde halka için
  }[];
}

export interface NiyetIzgarasiVeri {
  varyant: 'izgara' | 'hap';
  niyetler: { id: string; baslik: string; altMetin?: string; icon: string; renk: Renk }[];
}

export interface PomodoroPlaniVeri {
  baslik: string;
  ozet: string;
  bloklar: { sure: string; ders: string; tip: 'odak' | 'mola'; renk?: Renk }[];
  cta?: KartCTA;
}

export interface KonuAdimlariVeri {
  konu: string;
  adimlar: string[];
  tamamlanan?: number[]; // işaretli index'ler (kalıcı state)
  aksiyonlar?: { etiket: string; birincil?: boolean }[];
}

export interface MiniDenemeAnaliziVeri {
  baslik: string;
  dersler: { ad: string; net: number; max: number; renk: Renk }[];
  icgoru: string;
}

export interface CozumAdimlariVeri {
  soru: string;
  adimlar: { ad: string; detay: string; sekil?: string }[];
  sonuc: string;
  acikAdim?: number; // açık akordeon index (kalıcı state)
  sekil?: string; // geometri sorusu için SVG diyagram (opsiyonel)
}

export interface IpucuVeri {
  baslik: string;
  metin: string;
  acik?: boolean; // kalıcı state
}

export interface MomentumVeri {
  baslik: string;
  altBaslik?: string;
  metrikler: { deger: string; etiket: string; icon: string; renk: Renk }[];
  not?: string;
}

export interface MolaRecetesiVeri {
  baslik: string;
  altBaslik?: string;
  ogeler: { icon: string; metin: string }[];
  cta?: KartCTA;
}

export interface DenemeKiyasiVeri {
  baslik: string;
  altBaslik?: string;
  dersler: { ad: string; net: number; max: number; onceki: number; renk: Renk }[];
  toplamNet: { deger: number; fark: number };
  tahminiSira?: { deger: string; yon: 'yukari' | 'asagi' | 'sabit' };
}

export interface EnBuyukKazancVeri {
  ders: string;
  yuzde: number;
  renk: Renk;
  metin: string;
  cta?: KartCTA;
}

export interface HaftalikPlanVeri {
  baslik: string;
  ozet: string;
  tarihAraligi?: string;
  gunler: {
    gun: string;
    odak: string;
    sure: string;
    renk: Renk;
    bugun?: boolean;
    isler: string[];
  }[];
  cta?: KartCTA;
  acikGun?: number; // açık akordeon index (kalıcı state)
}

export interface FormulKartiVeri {
  ders: string;
  konu: string;
  formuller: { sol: string; sag: string; not?: string }[];
  altinKural?: string;
  kaydedilebilir?: boolean;
  kaydedildi?: boolean; // kalıcı state
}

export interface OturumZamanPlaniVeri {
  baslik: string;
  altBaslik?: string;
  dagilim: { ad: string; dk: number; renk: Renk }[];
  altinKural?: string;
}

export interface SinavCantasiVeri {
  baslik: string;
  altBaslik?: string;
  maddeler: string[];
  tamamlanan?: number[]; // işaretli index'ler (kalıcı state)
}

export interface HedefOzetiVeri {
  hedef: string;
  yuzde: number;
  hedefSira?: string;
  guncelSira?: string;
  netler: { ad: string; simdi: number; hedef: number; renk: Renk }[];
  not?: string;
}

export interface ProjeksiyonVeri {
  baslik: string;
  altBaslik?: string;
  barlar: { etiket: string; deger: string; yukseklik: number; tip: 'notr' | 'ara' | 'hedef' }[];
  sonuc?: { durum: 'yetisir' | 'riskli' | 'yetismez'; metin: string };
}

/** tip → veri eşlemesi. Worker enum'u ile birebir (MASTER_PROMPT_REVIZYON §2). */
export interface KartTipleri {
  gunlukBrifing: GunlukBrifingVeri;
  baglamSeridi: BaglamSeridiVeri;
  niyetIzgarasi: NiyetIzgarasiVeri;
  pomodoroPlani: PomodoroPlaniVeri;
  konuAdimlari: KonuAdimlariVeri;
  miniDenemeAnalizi: MiniDenemeAnaliziVeri;
  cozumAdimlari: CozumAdimlariVeri;
  ipucu: IpucuVeri;
  momentum: MomentumVeri;
  molaRecetesi: MolaRecetesiVeri;
  denemeKiyasi: DenemeKiyasiVeri;
  enBuyukKazanc: EnBuyukKazancVeri;
  haftalikPlan: HaftalikPlanVeri;
  formulKarti: FormulKartiVeri;
  oturumZamanPlani: OturumZamanPlaniVeri;
  sinavCantasi: SinavCantasiVeri;
  hedefOzeti: HedefOzetiVeri;
  projeksiyon: ProjeksiyonVeri;
}

export type KartTipi = keyof KartTipleri;

/** Discriminated union: tip'e göre veri daraltılır. */
export type Kart = { [K in KartTipi]: { tip: K; veri: KartTipleri[K] } }[KartTipi];

/** Worker yanıt zarfı. */
export interface KocYanit {
  yanit: string;
  kartlar: Kart[];
  /** Opsiyonel hafıza işareti — öğrenci açıkça zorlandı/anladı dediyse. */
  hafiza?: { konu: string; ders?: string; sinyal: KonuSinyali };
}

// ── Koç hafızası (öğrenci profili) ─────────────────────────────────────
export interface KonuKaydi {
  ad: string; // "Limit"
  ders?: string; // "AYT Matematik"
  durum: 'zayif' | 'iyi';
  skor: number; // negatif = zorlanıyor, pozitif = iyi
  sayac: number; // toplam sinyal sayısı
  sonGorulme: string; // ISO tarih
}

export interface KocHafiza {
  konular?: Record<string, KonuKaydi>;
  guncelleme?: number;
}

/** Konu için tek bir sinyal: öğrenci zorlandı mı, anladı mı. */
export type KonuSinyali = 'zorlaniyor' | 'anladi';

export const KART_TIPLERI: KartTipi[] = [
  'gunlukBrifing',
  'baglamSeridi',
  'niyetIzgarasi',
  'pomodoroPlani',
  'konuAdimlari',
  'miniDenemeAnalizi',
  'cozumAdimlari',
  'ipucu',
  'momentum',
  'molaRecetesi',
  'denemeKiyasi',
  'enBuyukKazanc',
  'haftalikPlan',
  'formulKarti',
  'oturumZamanPlani',
  'sinavCantasi',
  'hedefOzeti',
  'projeksiyon',
];
