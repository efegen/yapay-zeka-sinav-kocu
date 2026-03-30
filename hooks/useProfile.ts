import { useState, useEffect } from 'react';
import { auth } from '../services/firebaseConfig';
import { profilGetir } from '../services/authService';

export interface Profil {
  isim: string;
  email: string;
  puanTuru: string;
  hedefUniversite: string;
  hedefBolum: string;
  sinif: string;
  gunlukSoruHedefi: number;
  haftaCalismaSayisi: number;
}

export function useProfile() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const kullanici = auth.currentUser;
    if (!kullanici) { setYukleniyor(false); return; }
    profilGetir(kullanici.uid).then((data) => {
      if (data) setProfil(data as Profil);
      setYukleniyor(false);
    });
  }, []);

  return { profil, yukleniyor };
}
