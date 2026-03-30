import 'expo-router/entry';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { User } from 'firebase/auth';
import { kullaniciyiDinle } from '../services/authService';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/colors';

export default function RootLayout() {
  const [kullanici, setKullanici] = useState<User | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const unsub = kullaniciyiDinle((user) => {
      setKullanici(user);
      setYukleniyor(false);
    });
    return unsub;
  }, []);

  if (yukleniyor) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {kullanici ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <>
          <Stack.Screen name="login" />
          <Stack.Screen name="onboarding" />
        </>
      )}
    </Stack>
  );
}
