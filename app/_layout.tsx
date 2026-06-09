import { Stack } from 'expo-router';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { PlanProvider } from '../contexts/PlanContext';
import { COLORS } from '../constants/colors';

// Uygulama geneli gezinme teması: konteyner arka planını ekran zeminine eşitle —
// böylece yüzen alt çubuğun arkasında varsayılan beyaz/gri plaka görünmez.
const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: COLORS.background },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={NAV_THEME}>
      <PlanProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="soru-yukle" />
          <Stack.Screen name="deneme-ekle" />
          <Stack.Screen name="plan/[id]" />
        </Stack>
      </PlanProvider>
    </ThemeProvider>
  );
}
