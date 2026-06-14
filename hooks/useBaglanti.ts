// Bağlantı (çevrimiçi/çevrimdışı) algılama — yeni native bağımlılık (NetInfo) GEREKTİRMEZ.
// ----------------------------------------------------------------------------------------
// Web:    navigator.onLine + 'online'/'offline' olayları (anlık ve güvenilir).
// Native: Firestore snapshot metadata.fromCache (backend gerçekten erişilebilir mi).
//         Bir kez server verisi görüldükten SONRA snapshot cache'e düşerse çevrimdışı sayılır
//         (ilk açılışta cache'ten gelen veriyi "çevrimdışı" sanmamak için baz çizgisi beklenir).
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebaseConfig';

/** Uygulama çevrimdışı mı? (true = bağlantı yok) */
export function useBaglanti(): boolean {
  const [cevrimdisi, setCevrimdisi] = useState(false);

  // ── Web: navigator.onLine + olaylar ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const g = globalThis as any;
    if (g?.navigator && typeof g.navigator.onLine === 'boolean') {
      setCevrimdisi(!g.navigator.onLine);
    }
    const cevrimici = () => setCevrimdisi(false);
    const cevrimdisiOl = () => setCevrimdisi(true);
    g.addEventListener?.('online', cevrimici);
    g.addEventListener?.('offline', cevrimdisiOl);
    return () => {
      g.removeEventListener?.('online', cevrimici);
      g.removeEventListener?.('offline', cevrimdisiOl);
    };
  }, []);

  // ── Native: Firestore backend erişilebilirliği (snapshot metadata) ──
  const bazCizgi = useRef(false); // en az bir kez server verisi gördük mü
  useEffect(() => {
    if (Platform.OS === 'web') return; // web'de navigator.onLine yeterli
    let docUnsub: (() => void) | undefined;
    const authUnsub = onAuthStateChanged(auth, (kullanici) => {
      docUnsub?.();
      docUnsub = undefined;
      bazCizgi.current = false;
      if (!kullanici) return;
      docUnsub = onSnapshot(
        doc(db, 'users', kullanici.uid),
        { includeMetadataChanges: true },
        (snap) => {
          if (!snap.metadata.fromCache) {
            bazCizgi.current = true; // server'a ulaşıldı
            setCevrimdisi(false);
          } else if (bazCizgi.current) {
            setCevrimdisi(true); // server'ı gördükten sonra cache'e düştük → çevrimdışı
          }
        },
        () => {} // dinleme hatası → durumu değiştirme
      );
    });
    return () => {
      authUnsub();
      docUnsub?.();
    };
  }, []);

  return cevrimdisi;
}
