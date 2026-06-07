import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
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
    // Auth restorasyonu (özellikle web'de) asenkrondur: mount anında auth.currentUser
    // henüz null olabilir. Eskiden burada tek seferlik kontrol edilip çıkılıyordu; bu
    // durumda profil HİÇ yüklenmiyordu (koç "seni tanımıyorum" diyordu). Artık auth
    // durumunu dinleyip kullanıcı hazır olunca (ve değiştikçe) profile abone oluyoruz.
    let profilUnsub: (() => void) | undefined;

    const authUnsub = onAuthStateChanged(auth, (kullanici) => {
      profilUnsub?.();
      profilUnsub = undefined;

      if (!kullanici) {
        setProfil(null);
        setYukleniyor(false);
        return;
      }

      setYukleniyor(true);
      profilUnsub = onSnapshot(
        doc(db, 'users', kullanici.uid),
        (snap) => {
          setProfil(snap.exists() ? (snap.data() as Profil) : null);
          setYukleniyor(false);
        },
        (error) => {
          console.error('[useProfile] onSnapshot hatası:', error);
          setYukleniyor(false);
        }
      );
    });

    return () => {
      authUnsub();
      profilUnsub?.();
    };
  }, []);

  return { profil, yukleniyor };
}
