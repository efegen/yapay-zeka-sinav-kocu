// sohbetService — AI Koç çoklu sohbet modeli: tip tanımları + saf yardımcılar.
// Devir: design_handoff_ai_koc_tam_ekran (Çözüm A — Tam Ekran Sohbet). Geçmiş çekmecesi
// birden çok sohbeti gerektirir; eski tek-sohbet kaydı (aikoc_gecmis_*) buraya taşınır.
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import type { Kart, KonuSinyali } from '../types/koc';
import type { SohbetMesaji } from './aiService';

type IoniconAdi = React.ComponentProps<typeof Ionicons>['name'];

/** Tek bir sohbet baloncuğu (kullanıcı veya koç). */
export interface Balon extends SohbetMesaji {
  id: string;
  zaman?: number; // oluşturma zamanı (ms) — gün ayracı için. Eski kayıtlarda id'den türetilir.
  hatali?: boolean;
  kartlar?: Kart[];
  foto?: string; // kullanıcının gönderdiği soru fotoğrafının yerel uri'si
  konu?: string; // çözülen sorunun konusu (onay çipleri için)
  ders?: string;
  geriBildirim?: KonuSinyali; // öğrenci "anladım/karışık" dediyse
}

/** Geçmiş çekmecesinde listelenen, mesajlarını barındıran tek bir sohbet. */
export interface Sohbet {
  id: string;
  baslik: string | null; // null → ilk kullanıcı mesajından türetilir
  mesajlar: Balon[];
  olusturuldu: number;
  guncellendi: number;
}

const SOHBET_ONEKI = 'aikoc_sohbetler_';
const ESKI_ONEK = 'aikoc_gecmis_'; // tek-sohbet kaydı (migration kaynağı)
const SAKLANAN_AZAMI = 40; // kalıcıya yazılan en çok sohbet sayısı (kota güvenliği)

export function sohbetAnahtari(uid: string) {
  return `${SOHBET_ONEKI}${uid}`;
}
export function eskiSohbetAnahtari(uid: string) {
  return `${ESKI_ONEK}${uid}`;
}

/** Çakışmasız kısa kimlik. */
export function yeniSohbetId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Bir baloncuğun zamanı: açık alan, yoksa id önekinden (`<ms>-x`), yoksa şimdi. */
export function mesajZamani(b: Balon): number {
  if (typeof b.zaman === 'number') return b.zaman;
  const onek = Number(b.id?.split('-')[0]);
  return Number.isFinite(onek) ? onek : Date.now();
}

/** Boş sohbetleri ay; en yeni → en eski sırala. */
export function sirala(sohbetler: Sohbet[]): Sohbet[] {
  return sohbetler
    .filter((s) => s.mesajlar.length > 0)
    .sort((a, b) => b.guncellendi - a.guncellendi);
}

/**
 * Kalıcıya yazılacak hâli: boşları ele, en yeniden başlayıp {@link SAKLANAN_AZAMI} ile sınırla,
 * ve büyük foto data:/blob: uri'lerini çıkar (web'de localStorage kotasını taşırmasın; sayfa
 * yenilenince zaten geçersiz olurlar). Native file:// uri'leri küçük olduğu için korunur.
 */
export function kaliciSohbetler(sohbetler: Sohbet[]): Sohbet[] {
  return sirala(sohbetler)
    .slice(0, SAKLANAN_AZAMI)
    .map((s) => ({
      ...s,
      mesajlar: s.mesajlar.map((m) =>
        m.foto && !m.foto.startsWith('file:') ? { ...m, foto: undefined } : m
      ),
    }));
}

/** Depodaki ham veriyi güvenle Sohbet[]'e çevir (eski tek-sohbet biçimini de taşır). */
export function ayristir(ham: string | null, eskiHam: string | null): Sohbet[] {
  if (ham) {
    try {
      const liste = JSON.parse(ham);
      if (Array.isArray(liste)) return liste as Sohbet[];
    } catch {}
  }
  // Migration: eski tek-sohbet geçmişi (Balon[]) → tek bir Sohbet.
  if (eskiHam) {
    try {
      const mesajlar = JSON.parse(eskiHam) as Balon[];
      if (Array.isArray(mesajlar) && mesajlar.length) {
        return [
          {
            id: yeniSohbetId(),
            baslik: null,
            mesajlar,
            olusturuldu: mesajZamani(mesajlar[0]),
            guncellendi: mesajZamani(mesajlar[mesajlar.length - 1]),
          },
        ];
      }
    } catch {}
  }
  return [];
}

/** Markdown işaretlerini sadeleştir — çekmece özeti için tek satır düz metin. */
function duzMetin(s: string): string {
  return s
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function kisalt(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** Çekmece başlığı: kayıtlı başlık → ilk kullanıcı mesajı → "Yeni sohbet". */
export function sohbetBasligi(s: Sohbet): string {
  if (s.baslik) return s.baslik;
  const ilk = s.mesajlar.find((m) => m.rol === 'kullanici' && m.metin.trim());
  if (ilk) return kisalt(duzMetin(ilk.metin), 42);
  return 'Yeni sohbet';
}

/** Çekmece özeti: son anlamlı mesajın düz metni (yoksa kart etiketi). */
export function sohbetOzeti(s: Sohbet): string {
  for (let i = s.mesajlar.length - 1; i >= 0; i--) {
    const m = s.mesajlar[i];
    if (m.metin?.trim()) return kisalt(duzMetin(m.metin), 70);
    if (m.foto) return '📷 Soru fotoğrafı';
    if (m.kartlar?.length) return 'Koç bir kart hazırladı';
  }
  return 'Henüz mesaj yok';
}

/**
 * Bir kartın metinsel özeti — modelin GEÇMİŞTE ürettiği kart içeriğini görebilmesi için.
 * Sohbet /chat'e yalnızca { rol, metin } olarak gider; kartlar düşer. Öğrenci "şu adımı
 * anlamadım" dediğinde modelin çözümü/soruyu bilmesi şart; aksi halde adım başlığına bakıp
 * konuyla bağlantısız genel bir tanım verir. Bu yüzden çözüm/konu kartlarını metne gömeriz.
 * Plan kartları da gömülür: "çarşambayı hafiflet" dendiğinde model kendi planını görebilmeli
 * (yoksa baştan, tutarsız bir plan üretir). Salt-grafik kartları (momentum vb.) gömülmez.
 */
export function kartMetni(k: Kart): string {
  switch (k.tip) {
    case 'cozumAdimlari': {
      const v = k.veri;
      const adimlar = (v.adimlar ?? [])
        .map((a, i) => `${i + 1}) ${a.ad}: ${a.detay}`)
        .join('\n');
      return [
        'Bu çözümü ÜRETTİN (öğrenciye gösterildi):',
        v.giris ? `Giriş: ${v.giris}` : '',
        adimlar,
        v.sonuc ? `Sonuç: ${v.sonuc}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'konuAdimlari': {
      const v = k.veri;
      const adimlar = (v.adimlar ?? []).map((a, i) => `${i + 1}) ${a}`).join('\n');
      return `"${v.konu}" konusu için ÜRETTİĞİN adımlar:\n${adimlar}`;
    }
    case 'formulKarti': {
      const v = k.veri;
      const formuller = (v.formuller ?? [])
        .map((f) => `${f.sol} = ${f.sag}${f.not ? ` (${f.not})` : ''}`)
        .join('\n');
      return `"${v.konu}" için ÜRETTİĞİN formüller:\n${formuller}${
        v.altinKural ? `\nAltın kural: ${v.altinKural}` : ''
      }`;
    }
    case 'ipucu':
      return `İpucu — ${k.veri.baslik}: ${k.veri.metin}`;
    case 'haftalikPlan': {
      const v = k.veri;
      const gunler = (v.gunler ?? [])
        .map((g) => `${g.gun}: ${g.odak} · ${g.sure}${g.isler?.length ? ` (${g.isler.join(', ')})` : ''}`)
        .join('\n');
      return `"${v.baslik}" haftalık planını ÜRETTİN${v.tarihAraligi ? ` (${v.tarihAraligi})` : ''}:\n${gunler}`;
    }
    case 'takvimAksiyonu': {
      const v = k.veri;
      const kapsam =
        v.kapsam === 'bugun'
          ? 'bugünün planlarını'
          : v.kapsam === 'hafta'
          ? 'bu haftanın planlarını'
          : 'tüm planları';
      // Eylemi UYGULAMA yaptı (sen değil): yeniden "sildim/kaldırdım" deme.
      return v.sonuc === 'yapildi'
        ? `Takvim temizleme kartını sundun ve öğrenci ONAYLADI → ${kapsam} uygulama kaldırdı (${v.silinen ?? 0} plan). Bunu tekrar "ben sildim" diye söyleme.`
        : `Takvimi temizleme TEKLİFİ sundun (${kapsam} kaldırma); öğrenci karttaki butonla onaylarsa uygulama siler — sen silmiş gibi konuşma.`;
    }
    default:
      return '';
  }
}

/**
 * Sohbet geçmişini worker'a gönderilecek { rol, metin } dizisine çevirir; asistanın ürettiği
 * kart içeriklerini metne gömerek modele bağlam verir. Öğrenci bir çözüm/adım hakkında soru
 * sorduğunda model artık çözümün tamamını "geçmişte söylediğim" olarak görür ve yerinde açıklar.
 */
export function gecmisMetinleri(mesajlar: Balon[]): SohbetMesaji[] {
  return mesajlar.map((m) => {
    if (m.rol !== 'asistan' || !m.kartlar?.length) {
      return { rol: m.rol, metin: m.metin };
    }
    const kartlar = m.kartlar.map(kartMetni).filter(Boolean).join('\n\n');
    return { rol: m.rol, metin: [m.metin, kartlar].filter(Boolean).join('\n\n') };
  });
}

const TR_GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TR_AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** Çekmece için kısa göreli zaman: "şimdi" · "5 dk" · "2 sa" · "Dün" · "Sal" · "12 May". */
export function gecenZaman(ts: number): string {
  const fark = Date.now() - ts;
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return 'şimdi';
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} sa`;
  const gun = Math.floor(sa / 24);
  if (gun === 1) return 'Dün';
  if (gun < 7) return TR_GUN[new Date(ts).getDay()];
  const d = new Date(ts);
  return `${d.getDate()} ${TR_AY[d.getMonth()]}`;
}

/** Mesaj listesindeki gün ayracı etiketi: "Bugün · 09:41" / "Dün · 18:20" / "12 May · 14:05". */
export function ayracEtiketi(ts: number): string {
  const d = new Date(ts);
  const saat = `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
  const bugun = new Date();
  const dun = new Date(bugun);
  dun.setDate(bugun.getDate() - 1);
  if (d.toDateString() === bugun.toDateString()) return `Bugün · ${saat}`;
  if (d.toDateString() === dun.toDateString()) return `Dün · ${saat}`;
  return `${d.getDate()} ${TR_AY[d.getMonth()]} · ${saat}`;
}

/**
 * Çekmece satırı için ikon + renk — sohbet içeriğinden türetilir (sabit/sahte veri değil).
 * Önce üretilen kart tipleri, sonra foto, sonra anahtar kelimeler; hiçbiri yoksa nötr koç ikonu.
 */
export function sohbetGorseli(s: Sohbet): { ikon: IoniconAdi; renk: string } {
  const tipler = new Set(s.mesajlar.flatMap((m) => m.kartlar ?? []).map((k) => k.tip));
  if (tipler.has('oturumZamanPlani') || tipler.has('molaRecetesi'))
    return { ikon: 'timer-outline', renk: COLORS.accent };
  if (
    tipler.has('denemeKiyasi') ||
    tipler.has('miniDenemeAnalizi') ||
    tipler.has('projeksiyon') ||
    tipler.has('enBuyukKazanc') ||
    tipler.has('hedefOzeti')
  )
    return { ikon: 'trending-up', renk: COLORS.success };
  if (tipler.has('haftalikPlan') || tipler.has('takvimAksiyonu'))
    return { ikon: 'calendar-outline', renk: COLORS.accent };
  if (tipler.has('momentum')) return { ikon: 'flame', renk: COLORS.amber };
  if (
    tipler.has('cozumAdimlari') ||
    tipler.has('konuAdimlari') ||
    tipler.has('formulKarti') ||
    tipler.has('ipucu')
  )
    return { ikon: 'book-outline', renk: COLORS.primary };
  if (s.mesajlar.some((m) => m.foto)) return { ikon: 'camera-outline', renk: COLORS.primary };

  const metin = `${sohbetBasligi(s)} ${s.mesajlar[0]?.metin ?? ''}`.toLowerCase();
  if (/motivasyon|moral|pes|yorgun|stres|isteksiz/.test(metin))
    return { ikon: 'flame', renk: COLORS.amber };
  if (/plan|program|takvim/.test(metin)) return { ikon: 'calendar-outline', renk: COLORS.accent };
  return { ikon: 'chatbubble-ellipses-outline', renk: COLORS.primary };
}
