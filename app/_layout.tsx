import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { PlanProvider } from '../contexts/PlanContext';
import { BaglantiUyari } from '../components/BaglantiUyari';
import { COLORS } from '../constants/colors';
import { auth } from '../services/firebaseConfig';
import { profilGetir } from '../services/authService';
import { sonGirisGuncelle } from '../services/firestoreService';
import {
  proaktifBildirimleriPlanla,
  tumBildirimleriIptalEt,
} from '../services/notificationService';

// Uygulama geneli gezinme teması: konteyner arka planını ekran zeminine eşitle —
// böylece yüzen alt çubuğun arkasında varsayılan beyaz/gri plaka görünmez.
const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: COLORS.background },
};

export default function RootLayout() {
  // Oturum açıldığında/uygulama açıldığında proaktif bildirimleri (yeniden) planla;
  // çıkışta temizle. Her açılışta inaktiflik hatırlatıcısı ileri tarihe kurulduğundan
  // bildirim yalnızca öğrenci günlerce hiç uğramazsa tetiklenir.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        tumBildirimleriIptalEt();
        return;
      }
      // Son giriş zamanını güncelle (best-effort; davranışsal analiz için).
      sonGirisGuncelle(user.uid).catch(() => {});
      // Adı al ki bildirim metni kişiselleşsin; alınamazsa genel metin kullanılır.
      let isim: string | undefined;
      try {
        const p = (await profilGetir(user.uid)) as { isim?: string } | null;
        isim = p?.isim;
      } catch {
        // profil okunamadı — bildirim yine de genel metinle planlanır
      }
      proaktifBildirimleriPlanla(isim);
    });
    return unsub;
  }, []);

  return (
    <ThemeProvider value={NAV_THEME}>
      <PlanProvider>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          {/* Çevrimdışı/yeniden-bağlandı şeridi — tüm uygulamanın üstünde. */}
          <BaglantiUyari />
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="soru-yukle" />
              <Stack.Screen name="deneme-ekle" />
              <Stack.Screen name="hata-analiz" />
              <Stack.Screen name="istatistik" />
              <Stack.Screen name="yanlis-defteri" />
              <Stack.Screen name="koc-hafiza" />
              <Stack.Screen name="plan-kur" />
              <Stack.Screen name="plan/[id]" />
            </Stack>
          </View>
        </View>
      </PlanProvider>
    </ThemeProvider>
  );
}
