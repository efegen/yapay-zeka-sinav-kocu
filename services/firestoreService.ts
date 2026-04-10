import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  hedefNetHesapla,
  findReferencePrograms,
  HedefNetBilgisi,
} from './yokatlasService';

export type NetFetchStatus = 'pending' | 'done' | 'not_needed' | 'failed';

/**
 * Hedef net bilgisini lokal veri üzerinden hesaplayıp Firestore'a yazar.
 * hedefTuru === 'universite' → programId ile doğrudan hesaplar.
 * hedefTuru === 'siralama'   → referans programlar üzerinden ortalama alır.
 */
export const syncHedefNetBilgisi = async (
  uid: string,
  programId?: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const userData = snap.data() as {
      hedefTuru?: string;
      hedefSiralama?: number;
      puanTuru?: string;
    };

    let netBilgisi: HedefNetBilgisi | null = null;

    if (userData.hedefTuru === 'siralama') {
      const hedefSiralama = userData.hedefSiralama;
      const puanTuru = userData.puanTuru as 'SAY' | 'EA' | 'SOZ' | 'DIL' | undefined;

      if (!hedefSiralama || !puanTuru) {
        await updateDoc(userRef, { netFetchStatus: 'failed' as NetFetchStatus });
        return;
      }

      let referanslar = findReferencePrograms(hedefSiralama, puanTuru);
      if (referanslar.length === 0) {
        referanslar = findReferencePrograms(hedefSiralama, puanTuru, 5000);
      }
      if (referanslar.length === 0) {
        referanslar = findReferencePrograms(hedefSiralama, puanTuru, 20000);
      }
      if (referanslar.length === 0) {
        await updateDoc(userRef, { netFetchStatus: 'failed' as NetFetchStatus });
        return;
      }

      const sonuclar: HedefNetBilgisi[] = [];
      for (const ref of referanslar.slice(0, 3)) {
        const net = hedefNetHesapla(ref.programId);
        if (net) sonuclar.push(net);
      }

      if (sonuclar.length === 0) {
        await updateDoc(userRef, { netFetchStatus: 'failed' as NetFetchStatus });
        return;
      }

      // Alan bazında aritmetik ortalama
      const ortalama: Record<string, number> = {};
      const sayaclar: Record<string, number> = {};
      for (const net of sonuclar) {
        for (const [key, val] of Object.entries(net)) {
          if (key === 'kaynak_yil' || typeof val !== 'number') continue;
          ortalama[key] = (ortalama[key] ?? 0) + val;
          sayaclar[key] = (sayaclar[key] ?? 0) + 1;
        }
      }
      for (const key of Object.keys(ortalama)) {
        ortalama[key] = Math.round((ortalama[key] / sayaclar[key]) * 10) / 10;
      }

      netBilgisi = { ...ortalama, kaynak_yil: 2025 } as HedefNetBilgisi;
    } else {
      // hedefTuru === 'universite'
      netBilgisi = programId ? hedefNetHesapla(programId) : null;
    }

    if (netBilgisi) {
      await updateDoc(userRef, {
        hedefNetBilgisi: netBilgisi,
        netFetchStatus: 'done' as NetFetchStatus,
      });
    } else {
      await updateDoc(userRef, { netFetchStatus: 'failed' as NetFetchStatus });
    }
  } catch (err) {
    console.error('[firestoreService] syncHedefNetBilgisi hatası:', err);
  }
};

/**
 * Status'u sıfırlayıp senkronizasyonu yeniden çalıştırır.
 */
export const manuelSyncHedefNet = async (
  uid: string,
  programId?: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { netFetchStatus: 'pending' as NetFetchStatus });
    await syncHedefNetBilgisi(uid, programId);
  } catch (err) {
    console.error('[firestoreService] manuelSyncHedefNet hatası:', err);
  }
};

/**
 * Giriş sonrası net bilgisi eksikse senkronize et.
 */
export const checkAndRetrySyncIfNeeded = async (
  uid: string,
  programId?: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data() as { netFetchStatus?: NetFetchStatus };

    if (data.netFetchStatus !== 'done') {
      await syncHedefNetBilgisi(uid, programId);
    }
  } catch (err) {
    console.error('[firestoreService] checkAndRetrySyncIfNeeded hatası:', err);
  }
};

// ─────────────────────────────────────────────
// Görev (task) types & Firestore helpers
// ─────────────────────────────────────────────

export type GorevTip = 'planned' | 'anytime';

export interface Gorev {
  id: string;
  baslik: string;
  sure: number; // minutes
  tip: GorevTip;
  tarih: Timestamp | null; // only set when tip === 'planned'
  tamamlandi: boolean;
  olusturmaTarihi: Timestamp;
}

export const gorevEkle = async (
  uid: string,
  gorev: Omit<Gorev, 'id' | 'olusturmaTarihi'>
): Promise<void> => {
  const kolRef = collection(db, 'users', uid, 'gorevler');
  await addDoc(kolRef, {
    ...gorev,
    olusturmaTarihi: Timestamp.now(),
  });
};

/**
 * Returns tasks for a given calendar day.
 *
 * IMPORTANT — two composite Firestore indexes are required on the `gorevler` subcollection:
 *   1. planned query  → fields: tip ASC, tarih ASC
 *   2. anytime query  → fields: tip ASC, tamamlandi ASC, olusturmaTarihi ASC
 * Create them in Firebase Console → Firestore Database → Indexes → Composite → Add index.
 */
export const gunGorevleriniGetir = async (
  uid: string,
  tarih: Date
): Promise<{ planned: Gorev[]; anytime: Gorev[] }> => {
  const kolRef = collection(db, 'users', uid, 'gorevler');

  const gunBaslangic = new Date(tarih);
  gunBaslangic.setHours(0, 0, 0, 0);
  const gunBitis = new Date(tarih);
  gunBitis.setHours(23, 59, 59, 999);

  // Composite index required: tip ASC, tarih ASC
  const plannedQuery = query(
    kolRef,
    where('tip', '==', 'planned'),
    where('tarih', '>=', Timestamp.fromDate(gunBaslangic)),
    where('tarih', '<=', Timestamp.fromDate(gunBitis)),
    orderBy('tarih', 'asc')
  );

  // Composite index required: tip ASC, tamamlandi ASC, olusturmaTarihi ASC
  const anytimeQuery = query(
    kolRef,
    where('tip', '==', 'anytime'),
    where('tamamlandi', '==', false),
    orderBy('olusturmaTarihi', 'asc')
  );

  const [plannedSnap, anytimeSnap] = await Promise.all([
    getDocs(plannedQuery),
    getDocs(anytimeQuery),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planned: Gorev[] = plannedSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anytime: Gorev[] = anytimeSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  return { planned, anytime };
};

export const gorevTamamla = async (
  uid: string,
  gorevId: string,
  tamamlandi: boolean
): Promise<void> => {
  const gorevRef = doc(db, 'users', uid, 'gorevler', gorevId);
  await updateDoc(gorevRef, { tamamlandi });
};

export const gorevSil = async (uid: string, gorevId: string): Promise<void> => {
  const gorevRef = doc(db, 'users', uid, 'gorevler', gorevId);
  await deleteDoc(gorevRef);
};
