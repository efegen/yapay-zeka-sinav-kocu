// Koç hafızası — öğrencinin zorlandığı/iyi olduğu konuları ve kalıcı kişisel notlarını tutar.
// İZOLE: ana sayfanın kullandığı firestoreService'e DOKUNMAZ; ayrı doküman: users/{uid}/koc/hafiza
import { deleteField, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { NOT_KATEGORILERI } from '../types/koc';
import type { KisiselNot, KocHafiza, KonuKaydi, KonuSinyali, NotKategori } from '../types/koc';

function hafizaRef(uid: string) {
  return doc(db, 'users', uid, 'koc', 'hafiza');
}

/** Konu adını sade bir anahtara çevirir ("AYT · Limit " → "ayt_limit"). */
function konuAnahtari(ad: string): string {
  return ad
    .toLocaleLowerCase('tr')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_çğıöşü]/g, '')
    .slice(0, 60);
}

/** Bir konu kaydı kaç gündür görülmedi. sonGorulme bozuksa 0 (taze say). */
function gunFarki(sonGorulme: string, simdi: number): number {
  const t = Date.parse(sonGorulme);
  return Number.isFinite(t) ? (simdi - t) / 86_400_000 : 0;
}

/** Tazelik ağırlığı: bugün ~1, CURUME_GUN'de ~0.1. Eski kayıtlar sıralamada geri düşer. */
function recencyFaktor(sonGorulme: string, simdi: number): number {
  return Math.max(0.1, 1 - gunFarki(sonGorulme, simdi) / CURUME_GUN);
}

/** Bu süreden eski sinyaller "solar": özetlerden düşer (öğrenci o günden beri ilerlemiş olabilir). */
const CURUME_GUN = 45;
/** Firestore dokümanını sınırlı tutmak için saklanan en çok konu sayısı. */
const KONU_AZAMI = 40;
/** Kişisel notlar konulardan kalıcıdır (tercih/rutin yavaş değişir) ama sonsuza dek de bağlama gitmez. */
const NOT_CURUME_GUN = 120;
/** Saklanan en çok kişisel not sayısı (taşarsa en eski düşer). */
const NOT_AZAMI = 20;

/** Hafızayı canlı dinler (onSnapshot). useKocHafiza tarafından kullanılır. */
export function kocHafizaDinle(uid: string, cb: (h: KocHafiza) => void) {
  return onSnapshot(
    hafizaRef(uid),
    (snap) => cb(snap.exists() ? (snap.data() as KocHafiza) : {}),
    (e) => console.error('[kocHafiza] dinleme hatası:', e)
  );
}

/** Bir konu için sinyal işler: skoru güncelle, durum yeniden hesaplanır. */
export async function konuSinyali(
  uid: string,
  girdi: { ad: string; ders?: string; sinyal: KonuSinyali }
): Promise<void> {
  const ad = girdi.ad?.trim();
  if (!ad) return;

  const ref = hafizaRef(uid);
  let mevcut: KocHafiza = {};
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) mevcut = snap.data() as KocHafiza;
  } catch (e) {
    console.error('[kocHafiza] okuma hatası:', e);
  }

  const anahtar = konuAnahtari(ad);
  const eski = mevcut.konular?.[anahtar];
  const skor = (eski?.skor ?? 0) + (girdi.sinyal === 'zorlaniyor' ? -1 : 1);

  const kayit: KonuKaydi = {
    ad: eski?.ad ?? ad,
    ders: girdi.ders ?? eski?.ders,
    skor,
    sayac: (eski?.sayac ?? 0) + 1,
    durum: skor < 0 ? 'zayif' : 'iyi',
    sonGorulme: new Date().toISOString(),
  };

  try {
    const yeni = { ...(mevcut.konular ?? {}), [anahtar]: kayit };
    if (Object.keys(yeni).length > KONU_AZAMI) {
      // Sınır aşıldı: en düşük öncelikli (eski + sinyali zayıf) konuları düşür.
      // Nested merge anahtar SİLEMEZ, bu yüzden burada tam yazım yapılır.
      const simdi = Date.now();
      const oncelik = (k: KonuKaydi) => Math.abs(k.skor) * recencyFaktor(k.sonGorulme, simdi);
      const korunan = Object.entries(yeni)
        .sort(([, a], [, b]) => oncelik(b) - oncelik(a))
        .slice(0, KONU_AZAMI);
      await setDoc(ref, { konular: Object.fromEntries(korunan), guncelleme: simdi });
    } else {
      // Nested map merge → yalnızca bu konu güncellenir.
      await setDoc(ref, { konular: { [anahtar]: kayit }, guncelleme: Date.now() }, { merge: true });
    }
  } catch (e) {
    console.error('[kocHafiza] yazma hatası:', e);
  }
}

/** Tüm hafızayı (konular + kişisel notlar) temizler. */
export async function hafizaTemizle(uid: string): Promise<void> {
  try {
    await setDoc(hafizaRef(uid), { konular: {}, notlar: {}, guncelleme: Date.now() });
  } catch (e) {
    console.error('[kocHafiza] temizleme hatası:', e);
  }
}

// ─── Kişisel notlar ──────────────────────────────────────────────────────────

/**
 * Modelin sohbetten çıkardığı kalıcı kişisel notu kaydeder (tercih/rutin/duygu).
 * Aynı not tekrar gelirse kayıt tazelenir (sayaç artar); NOT_AZAMI aşılırsa en eski düşer.
 */
export async function kisiselNotEkle(
  uid: string,
  girdi: { metin: string; kategori: NotKategori }
): Promise<void> {
  const metin = girdi.metin?.trim().slice(0, 120);
  if (!metin || !NOT_KATEGORILERI.includes(girdi.kategori)) return;

  const ref = hafizaRef(uid);
  let mevcut: KocHafiza = {};
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) mevcut = snap.data() as KocHafiza;
  } catch (e) {
    console.error('[kocHafiza] okuma hatası:', e);
  }

  const anahtar = konuAnahtari(metin);
  const eski = mevcut.notlar?.[anahtar];
  const kayit: KisiselNot = {
    metin: eski?.metin ?? metin,
    kategori: girdi.kategori,
    sayac: (eski?.sayac ?? 0) + 1,
    sonGorulme: new Date().toISOString(),
  };

  try {
    const yeni = { ...(mevcut.notlar ?? {}), [anahtar]: kayit };
    if (Object.keys(yeni).length > NOT_AZAMI) {
      // Sınır aşıldı: en eski görülen notlar düşer. Nested merge anahtar silemez → tam map yazılır.
      const korunan = Object.entries(yeni)
        .sort(([, a], [, b]) => Date.parse(b.sonGorulme) - Date.parse(a.sonGorulme))
        .slice(0, NOT_AZAMI);
      await setDoc(ref, { notlar: Object.fromEntries(korunan), guncelleme: Date.now() }, { merge: true });
    } else {
      await setDoc(ref, { notlar: { [anahtar]: kayit }, guncelleme: Date.now() }, { merge: true });
    }
  } catch (e) {
    console.error('[kocHafiza] not yazma hatası:', e);
  }
}

/** Tek bir kişisel notu siler (öğrenci "bunu unut" der). */
export async function kisiselNotSil(uid: string, anahtar: string): Promise<void> {
  if (!anahtar) return;
  try {
    await setDoc(
      hafizaRef(uid),
      { notlar: { [anahtar]: deleteField() }, guncelleme: Date.now() },
      { merge: true }
    );
  } catch (e) {
    console.error('[kocHafiza] not silme hatası:', e);
  }
}

/**
 * Bağlama gönderilecek kişisel notlar (en yeni N). NOT_CURUME_GUN'den eski notlar
 * elenir — bayatlamış bir duygu/rutin notu koçu yanlış yönlendirmesin.
 */
export function kisiselNotlarOzet(hafiza: KocHafiza | null, n = 6): string[] {
  const notlar = hafiza?.notlar;
  if (!notlar) return [];
  const simdi = Date.now();
  return Object.values(notlar)
    .filter((k) => gunFarki(k.sonGorulme, simdi) <= NOT_CURUME_GUN)
    .sort((a, b) => Date.parse(b.sonGorulme) - Date.parse(a.sonGorulme))
    .slice(0, n)
    .map((k) => k.metin);
}

/**
 * Tek bir konu kaydını siler (öğrenci profilinden "bunu unut" der).
 * Nested merge anahtar silemez; bu yüzden deleteField() sentinel'i kullanılır.
 */
export async function konuSil(uid: string, anahtar: string): Promise<void> {
  if (!anahtar) return;
  try {
    await setDoc(
      hafizaRef(uid),
      { konular: { [anahtar]: deleteField() }, guncelleme: Date.now() },
      { merge: true }
    );
  } catch (e) {
    console.error('[kocHafiza] konu silme hatası:', e);
  }
}

/**
 * Öğrenci bir konunun durumunu elle düzeltir ("artık biliyorum" / "hâlâ zorlanıyorum").
 * Skoru duruma uygun bir değere sabitler (özetlerin doğru çalışması için) ve
 * kaydı tazeler — böylece manuel düzeltme eski sinyaller yüzünden geri sallanmaz.
 * Nested map merge: yalnız bu konunun durum/skor/sonGorulme alanları güncellenir.
 */
export async function konuDurumGuncelle(
  uid: string,
  anahtar: string,
  durum: KonuKaydi['durum']
): Promise<void> {
  if (!anahtar) return;
  const skor = durum === 'iyi' ? 2 : -2;
  try {
    await setDoc(
      hafizaRef(uid),
      {
        konular: { [anahtar]: { durum, skor, sonGorulme: new Date().toISOString() } },
        guncelleme: Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error('[kocHafiza] durum güncelleme hatası:', e);
  }
}

/** Konu etiketi: "Ders · Ad" ya da yalnız "Ad". */
function konuEtiketi(k: KonuKaydi): string {
  return k.ders ? `${k.ders} · ${k.ad}` : k.ad;
}

/**
 * Bağlama gönderilecek zorlanılan konu adları (en zayıftan, en çok N tane).
 * Zaman-çürümesi: CURUME_GUN'den eski sinyaller düşer; sıralama tazelikle ağırlıklı
 * (eski bir takıntı listeyi tıkamaz — öğrenci o gün bugün ilerlemiş olabilir).
 */
export function zorlananKonularOzet(hafiza: KocHafiza | null, n = 5): string[] {
  const konular = hafiza?.konular;
  if (!konular) return [];
  const simdi = Date.now();
  return Object.values(konular)
    .filter((k) => k.durum === 'zayif' && gunFarki(k.sonGorulme, simdi) <= CURUME_GUN)
    .map((k) => ({ k, oncelik: k.skor * recencyFaktor(k.sonGorulme, simdi) }))
    .sort((a, b) => a.oncelik - b.oncelik) // en negatif (en taze+zayıf) önce
    .slice(0, n)
    .map(({ k }) => konuEtiketi(k));
}

/**
 * Öğrencinin İYİ olduğu konular — koç bunları gereksiz yere baştan anlatmasın diye.
 * Temkinli: yalnızca net olumlu sinyal (skor >= 2) ve yakın zamanlı kayıtlar.
 */
export function iyiKonularOzet(hafiza: KocHafiza | null, n = 5): string[] {
  const konular = hafiza?.konular;
  if (!konular) return [];
  const simdi = Date.now();
  return Object.values(konular)
    .filter((k) => k.skor >= 2 && gunFarki(k.sonGorulme, simdi) <= CURUME_GUN)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, n)
    .map(konuEtiketi);
}
