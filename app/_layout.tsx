import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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

  const icerik = (
    <>
      {/* Çevrimdışı/yeniden-bağlandı şeridi — tüm uygulamanın üstünde. */}
      <BaglantiUyari />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="deneme-ekle" />
          <Stack.Screen name="hata-analiz" />
          <Stack.Screen name="istatistik" />
          <Stack.Screen name="yanlis-defteri" />
          <Stack.Screen name="koc-hafiza" />
          <Stack.Screen name="plan-kur" />
          <Stack.Screen name="plan/[id]" />
        </Stack>
      </View>
    </>
  );

  return (
    <ThemeProvider value={NAV_THEME}>
      <PlanProvider>
        {Platform.OS === 'web' ? (
          // Web/masaüstü: uygulamayı ortalanmış, telefon genişliğinde bir çerçeveye al —
          // geniş tarayıcıda kenara yayılıp gerilmesin (native'de tam ekran kalır).
          <View style={webStiller.sayfa}>
            <View style={webStiller.cihaz}>{icerik}</View>
          </View>
        ) : (
          <View style={{ flex: 1, backgroundColor: COLORS.background }}>{icerik}</View>
        )}
      </PlanProvider>
    </ThemeProvider>
  );
}

const webStiller = StyleSheet.create({
  sayfa: {
    flex: 1,
    backgroundColor: '#DDE3F0', // çerçevenin arkasındaki nötr zemin
    alignItems: 'center',
    justifyContent: 'center',
  },
  cihaz: {
    flex: 1,
    width: 440,
    maxWidth: '100%',
    position: 'relative', // yüzen alt çubuk (absolute) bu çerçeveye göre konumlansın
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.18,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
});
