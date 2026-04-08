import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';

export interface Profil {
  isim: string;
  email: string;
  puanTuru: string;
  hedefTuru?: 'universite' | 'siralama';
  hedefUniversite: string;
  hedefBolum: string;
  hedefProgramId?: string;
  hedefSiralama?: number;
  sinif: string;
  gunlukSoruHedefi: number;
  haftaCalismaSayisi: number;
  hedefNetBilgisi?: Record<string, number>;
  netFetchStatus?: string;
  netFetchRetryCount?: number;
}

export function useProfile() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const kullanici = auth.currentUser;
    if (!kullanici) { setYukleniyor(false); return; }

    const unsub = onSnapshot(
      doc(db, 'users', kullanici.uid),
      (snap) => {
        if (snap.exists()) setProfil(snap.data() as Profil);
        else setProfil(null);
        setYukleniyor(false);
      },
      (error) => {
        console.error('[useProfile] onSnapshot hatası:', error);
        setYukleniyor(false);
      }
    );

    return unsub;
  }, []);

  return { profil, yukleniyor };
}
