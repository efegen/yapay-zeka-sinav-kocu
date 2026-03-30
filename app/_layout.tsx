import { Stack } from 'expo-router';
import { PlanProvider } from '../contexts/PlanContext';

export default function RootLayout() {
  return (
    <PlanProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="soru-yukle" />
      </Stack>
    </PlanProvider>
  );
}
