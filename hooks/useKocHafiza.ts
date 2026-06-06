import { useEffect, useState } from 'react';
import { auth } from '../services/firebaseConfig';
import { kocHafizaDinle } from '../services/kocHafizaService';
import type { KocHafiza } from '../types/koc';

/** Koç hafızasını (zorlanılan/iyi konular) canlı verir. */
export function useKocHafiza() {
  const [hafiza, setHafiza] = useState<KocHafiza | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return kocHafizaDinle(uid, setHafiza);
  }, []);

  return { hafiza };
}
