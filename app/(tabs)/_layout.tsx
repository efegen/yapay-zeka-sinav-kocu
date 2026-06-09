import { Tabs } from 'expo-router';
import { AltCubuk } from '../../components/AltCubuk';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AltCubuk {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="takvim" options={{ title: 'Takvim' }} />
      <Tabs.Screen
        name="ai-koc"
        options={{
          title: 'AI Koç',
          // Tam Ekran Sohbet: sohbet açıkken global alt sekme çubuğunu gizle —
          // altta tek çubuk (mesaj girişi) kalsın. Geri için başlıktaki ← butonu kullanılır.
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen name="pomodoro" options={{ title: 'Sayaç' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
      <Tabs.Screen name="denemeler" options={{ href: null }} />
      <Tabs.Screen name="timer" options={{ href: null }} />
    </Tabs>
  );
}
