import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { syncHedefNetBilgisi, checkAndRetrySyncIfNeeded } from './firestoreService';

export interface KayitData {
  isim: string;
  sinif: string;
  okulTuru: string;
  diplomaNotu: number;
  gecenYilYerlesti?: boolean;
  puanTuru: string;
  hedefTuru: 'universite' | 'siralama';
  hedefUniversite: string;
  hedefBolum: string;
  hedefProgramId: string;
  hedefSiralama?: number;
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
    obpGuncellendi: false,
    netFetchStatus: 'pending',
  });
  // Arka planda net bilgisini çek (await etme)
  syncHedefNetBilgisi(
    user.uid,
    data.hedefTuru === 'universite' ? data.hedefProgramId : undefined
  ).catch(err => console.error('[authService] kayıt sonrası net sync hatası:', err));
  return user;
};

export const girisYap = async (email: string, sifre: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, sifre);
  const user = userCredential.user;
  // Arka planda net bilgisi senkronizasyonunu kontrol et (await etme)
  getDoc(doc(db, 'users', user.uid)).then((snap) => {
    if (snap.exists()) {
      const userData = snap.data() as {
        hedefTuru?: string;
        hedefProgramId?: string;
      };
      if (userData.hedefTuru === 'siralama') {
        checkAndRetrySyncIfNeeded(user.uid)
          .catch(err => console.error('[authService] giriş sonrası retry check hatası:', err));
      } else if (userData.hedefProgramId) {
        checkAndRetrySyncIfNeeded(user.uid, userData.hedefProgramId)
          .catch(err => console.error('[authService] giriş sonrası retry check hatası:', err));
      }
    }
  }).catch(err => console.error('[authService] giriş sonrası retry check hatası:', err));
  return user;
};

/**
 * Şifre sıfırlama e-postası gönderir (Firebase Auth). Kayıt yoksa Firebase
 * `auth/user-not-found` döndürür; çağıran taraf gizlilik için bunu başarı gibi
 * gösterebilir (hesap sayımı/enumeration engellenir).
 */
export const sifreSifirlamaGonder = async (email: string) => {
  await sendPasswordResetEmail(auth, email.trim());
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
