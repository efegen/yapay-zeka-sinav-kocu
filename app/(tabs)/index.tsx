import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useProfile } from '../../hooks/useProfile';
import { COLORS } from '../../constants/colors';

export default function AnaSayfa() {
  const { profil, yukleniyor } = useProfile();

  const bugunHaftaninGunu = useMemo(
    () => new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }),
    []
  );

  if (yukleniyor) {
    return (
      <View style={styles.merkezle}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.ekran} contentContainerStyle={styles.icerik} showsVerticalScrollIndicator={false}>
      {/* Üst başlık */}
      <View style={styles.baslik}>
        <View>
          <Text style={styles.tarih}>{bugunHaftaninGunu}</Text>
          <Text style={styles.selam}>
            Merhaba, {profil?.isim?.split(' ')[0] ?? 'Öğrenci'} 👋
          </Text>
        </View>
        <View style={styles.puanBadge}>
          <Text style={styles.puanMetin}>{profil?.puanTuru ?? '—'}</Text>
        </View>
      </View>

      {/* Hedef kartı */}
      <View style={styles.kart}>
        <View style={styles.kartBaslik}>
          <Ionicons name="flag-outline" size={18} color={COLORS.primary} />
          <Text style={styles.kartBaslikMetin}>Hedefin</Text>
        </View>
        <Text style={styles.hedefUniversite}>{profil?.hedefUniversite ?? '—'}</Text>
        <Text style={styles.hedefBolum}>{profil?.hedefBolum ?? '—'}</Text>
      </View>

      {/* İstatistik kartları */}
      <View style={styles.istatRow}>
        <View style={[styles.istatKart, styles.istatKartYari]}>
          <Ionicons name="help-circle-outline" size={22} color={COLORS.primary} />
          <Text style={styles.istatSayi}>{profil?.gunlukSoruHedefi ?? 0}</Text>
          <Text style={styles.istatEtiket}>Günlük soru hedefi</Text>
        </View>
        <View style={[styles.istatKart, styles.istatKartYari]}>
          <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
          <Text style={styles.istatSayi}>{profil?.haftaCalismaSayisi ?? 0}</Text>
          <Text style={styles.istatEtiket}>Haftalık çalışma günü</Text>
        </View>
      </View>

      {/* Hızlı erişim */}
      <Text style={styles.bolumBaslik}>Hızlı Erişim</Text>
      <HizliErisim />
    </ScrollView>
  );
}

function HizliErisim() {
  const router = useRouter();
  const kartlar: { ikon: React.ComponentProps<typeof Ionicons>['name']; etiket: string; renk: string; rota: string }[] = [
    { ikon: 'timer-outline', etiket: 'Pomodoro', renk: '#7C3AED', rota: '/(tabs)/pomodoro' },
    { ikon: 'calendar-outline', etiket: 'Takvim', renk: '#EC4899', rota: '/(tabs)/takvim' },
    { ikon: 'sparkles-outline', etiket: 'AI Koç', renk: '#10B981', rota: '/(tabs)/ai-koc' },
  ];
  return (
    <View style={styles.hizliRow}>
      {kartlar.map((k) => (
        <TouchableOpacity
          key={k.etiket}
          style={styles.hizliKart}
          onPress={() => router.push(k.rota as any)}
          activeOpacity={0.75}
        >
          <View style={[styles.hizliIkon, { backgroundColor: k.renk + '18' }]}>
            <Ionicons name={k.ikon} size={22} color={k.renk} />
          </View>
          <Text style={styles.hizliEtiket}>{k.etiket}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },
  icerik: { padding: 20, paddingTop: 56, paddingBottom: 32 },
  merkezle: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  baslik: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  tarih: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  selam: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  puanBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  puanMetin: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  kart: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: COLORS.cardBorder },
  kartBaslik: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  kartBaslikMetin: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  hedefUniversite: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  hedefBolum: { fontSize: 14, color: COLORS.textSecondary },

  istatRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  istatKart: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  istatKartYari: { flex: 1 },
  istatSayi: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginTop: 8, marginBottom: 2 },
  istatEtiket: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },

  bolumBaslik: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 12 },
  hizliRow: { flexDirection: 'row', gap: 12 },
  hizliKart: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  hizliIkon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  hizliEtiket: { fontSize: 12, fontWeight: '600', color: COLORS.text },
});
