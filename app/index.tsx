import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { User } from 'firebase/auth';
import { kullaniciyiDinle } from '../services/authService';
import { COLORS } from '../constants/colors';

export default function Index() {
  const [kullanici, setKullanici] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsub = kullaniciyiDinle((user) => {
      setKullanici(user);
    });
    return unsub;
  }, []);

  if (kullanici === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (kullanici) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}
