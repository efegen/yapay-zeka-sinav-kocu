import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { kocHafizaDinle } from '../services/kocHafizaService';
import type { KocHafiza } from '../types/koc';

/** Koç hafızasını (zorlanılan/iyi konular) canlı verir. */
export function useKocHafiza() {
  const [hafiza, setHafiza] = useState<KocHafiza | null>(null);

  useEffect(() => {
    // useProfile ile aynı gerekçe: auth.currentUser mount anında null olabilir (async
    // restorasyon). Tek seferlik kontrol yerine auth durumunu dinleyip hazır olunca abone ol.
    let hafizaUnsub: (() => void) | undefined;

    const authUnsub = onAuthStateChanged(auth, (kullanici) => {
      hafizaUnsub?.();
      hafizaUnsub = undefined;
      if (!kullanici) {
        setHafiza(null);
        return;
      }
      hafizaUnsub = kocHafizaDinle(kullanici.uid, setHafiza);
    });

    return () => {
      authUnsub();
      hafizaUnsub?.();
    };
  }, []);

  return { hafiza };
}
