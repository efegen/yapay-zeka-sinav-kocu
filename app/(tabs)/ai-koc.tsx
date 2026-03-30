import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

export default function AiKoc() {
  const router = useRouter();

  return (
    <View style={styles.ekran}>
      <Text style={styles.baslik}>AI Koç</Text>

      <TouchableOpacity
        style={styles.kart}
        onPress={() => router.push('/soru-yukle' as any)}
        activeOpacity={0.8}
      >
        <View style={styles.kartIkon}>
          <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
        </View>
        <View style={styles.kartMetinAlani}>
          <Text style={styles.kartBaslik}>Soru Yükle</Text>
          <Text style={styles.kartAlt}>Fotoğraftan soru tara ve çözüm al</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background, paddingTop: 56, paddingHorizontal: 20 },
  baslik: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  kart: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16,
  },
  kartIkon: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  kartMetinAlani: { flex: 1 },
  kartBaslik: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  kartAlt: { fontSize: 13, color: COLORS.textSecondary },
});
