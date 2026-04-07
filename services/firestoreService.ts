import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  fetchHedefNetBilgisi,
  findReferencePrograms,
  HedefNetBilgisi,
} from './yokatlasService';

export type NetFetchStatus = 'pending' | 'done' | 'not_needed' | 'failed';

const MAX_FETCH_RETRIES = 3;

/**
 * YÖK Atlas'tan net bilgisini çekip Firestore'daki kullanıcı belgesine yazar.
 * hedefTuru === 'universite' → programId ile doğrudan çeker.
 * hedefTuru === 'siralama'   → referans programlar üzerinden ortalama alır.
 * Başarısızsa netFetchStatus: "pending" yazar. Asla throw etmez.
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

    if (userData.hedefTuru === 'siralama') {
      const hedefSiralama = userData.hedefSiralama;
      const puanTuru = userData.puanTuru as 'SAY' | 'EA' | 'SOZ' | 'DIL' | undefined;

      if (!hedefSiralama || !puanTuru) {
        await updateDoc(userRef, { netFetchStatus: 'pending' as NetFetchStatus });
        return;
      }

      let referanslar = findReferencePrograms(hedefSiralama, puanTuru);
      if (referanslar.length === 0) {
        referanslar = findReferencePrograms(hedefSiralama, puanTuru, 5000);
      }
      if (referanslar.length === 0) {
        await updateDoc(userRef, { netFetchStatus: 'pending' as NetFetchStatus });
        return;
      }

      const sonuclar: HedefNetBilgisi[] = [];
      const hedefReferanslar = referanslar.slice(0, 3);
      for (let i = 0; i < hedefReferanslar.length; i++) {
        const net = await fetchHedefNetBilgisi(hedefReferanslar[i].programId);
        if (net) sonuclar.push(net);
        if (i < hedefReferanslar.length - 1) {
          await new Promise(r => setTimeout(r, 700));
        }
      }

      if (sonuclar.length === 0) {
        await updateDoc(userRef, { netFetchStatus: 'pending' as NetFetchStatus });
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

      await updateDoc(userRef, {
        hedefNetBilgisi: { ...ortalama, kaynak_yil: 2025 },
        netFetchStatus: 'done' as NetFetchStatus,
      });
      return;
    }

    // hedefTuru === 'universite' — mevcut mantık
    const netBilgisi: HedefNetBilgisi | null = programId
      ? await fetchHedefNetBilgisi(programId)
      : null;
    if (netBilgisi) {
      await updateDoc(userRef, {
        hedefNetBilgisi: netBilgisi,
        netFetchStatus: 'done' as NetFetchStatus,
      });
    } else {
      await updateDoc(userRef, {
        netFetchStatus: 'pending' as NetFetchStatus,
      });
    }
  } catch (err) {
    console.error('[firestoreService] syncHedefNetBilgisi hatası:', err);
  }
};

/**
 * Firestore'daki netFetchStatus değerini kontrol eder;
 * "pending" ise senkronizasyonu yeniden dener.
 */
export const checkAndRetrySyncIfNeeded = async (
  uid: string,
  programId?: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data() as {
      netFetchStatus?: NetFetchStatus;
      hedefTuru?: string;
      netFetchRetryCount?: number;
    };

    if (data.netFetchStatus === 'pending') {
      const retryCount = data.netFetchRetryCount ?? 0;
      if (retryCount >= MAX_FETCH_RETRIES) {
        await updateDoc(userRef, { netFetchStatus: 'failed' as NetFetchStatus });
        return;
      }
      await updateDoc(userRef, { netFetchRetryCount: retryCount + 1 });
      await syncHedefNetBilgisi(uid, programId);
    }
  } catch (err) {
    console.error('[firestoreService] checkAndRetrySyncIfNeeded hatası:', err);
  }
};
