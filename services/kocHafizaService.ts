// Koç hafızası — öğrencinin zorlandığı/iyi olduğu konuları tutar.
// İZOLE: ana sayfanın kullandığı firestoreService'e DOKUNMAZ; ayrı doküman: users/{uid}/koc/hafiza
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { KocHafiza, KonuKaydi, KonuSinyali } from '../types/koc';

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
    // Nested map merge → yalnızca bu konu güncellenir.
    await setDoc(ref, { konular: { [anahtar]: kayit }, guncelleme: Date.now() }, { merge: true });
  } catch (e) {
    console.error('[kocHafiza] yazma hatası:', e);
  }
}

/** Tüm hafızayı temizler. */
export async function hafizaTemizle(uid: string): Promise<void> {
  try {
    await setDoc(hafizaRef(uid), { konular: {}, guncelleme: Date.now() });
  } catch (e) {
    console.error('[kocHafiza] temizleme hatası:', e);
  }
}

/** Bağlama gönderilecek zorlanılan konu adları (en zayıftan, en çok N tane). */
export function zorlananKonularOzet(hafiza: KocHafiza | null, n = 5): string[] {
  const konular = hafiza?.konular;
  if (!konular) return [];
  return Object.values(konular)
    .filter((k) => k.durum === 'zayif')
    .sort((a, b) => a.skor - b.skor)
    .slice(0, n)
    .map((k) => (k.ders ? `${k.ders} · ${k.ad}` : k.ad));
}
