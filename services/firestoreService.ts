import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
