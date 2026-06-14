import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// getReactNativePersistence yalnızca firebase/auth'ın React Native bundle'ında
// bulunur (Metro `react-native` koşulunu çözer). TS'in public tipleri bu export'u
// görmediği için ayrı ve bastırılmış import kullanıyoruz; çalışma zamanında mevcut.
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Web'de getAuth zaten tarayıcı (localStorage) kalıcılığı kullanır.
// React Native'de oturumu kapanış sonrası korumak için AsyncStorage'a bağlı
// initializeAuth gerekir; aksi halde her açılışta oturum kaybolur.
export const auth: Auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

// Web'de kalıcı (IndexedDB) önbellek: çevrimdışıyken — sayfa yenilense bile — son veriler
// (plan, denemeler, profil) görünmeye devam eder. Native'de JS SDK'nın oturum-içi cache'i
// zaten yeterli (IndexedDB yok). Kurulum başarısız olursa varsayılan örneğe düşülür.
function olusturDb() {
  if (Platform.OS === 'web') {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch (e) {
      console.warn('[firebase] kalıcı önbellek açılamadı, varsayılana dönülüyor:', e);
    }
  }
  return getFirestore(app);
}

export const db = olusturDb();
