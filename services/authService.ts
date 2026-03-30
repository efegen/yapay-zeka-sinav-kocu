import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

export interface KayitData {
  isim: string;
  sinif: string;
  okulTuru: string;
  diplomaNotu: number;
  puanTuru: string;
  hedefUniversite: string;
  hedefBolum: string;
  hedefProgramId: string;
  haftaCalismaSayisi: number;
  gunlukSoruHedefi: number;
  kvkkOnay: boolean;
}

export const kayitOl = async (
  email: string,
  sifre: string,
  data: KayitData
) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, sifre);
  const user = userCredential.user;
  await setDoc(doc(db, 'users', user.uid), {
    ...data,
    email,
    kvkkOnayTarihi: new Date().toISOString(),
    olusturmaTarihi: serverTimestamp(),
    sonGirisTarihi: serverTimestamp(),
  });
  return user;
};

export const girisYap = async (email: string, sifre: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, sifre);
  return userCredential.user;
};

export const cikisYap = async () => {
  await signOut(auth);
};

export const kullaniciyiDinle = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const profilGetir = async (uid: string) => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) return docSnap.data();
  return null;
};
