// KartBaslik — standart kart başlığı: ikon kutusu + başlık + alt başlık + sağ slot.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { kocIkon } from './tokens';

interface KartBaslikProps {
  icon: string;
  renk?: string;
  baslik: string;
  alt?: string;
  sag?: React.ReactNode;
  /** Alt sınır çizgisi (varsayılan açık). */
  cizgi?: boolean;
}

export function KartBaslik({ icon, renk = COLORS.primary, baslik, alt, sag, cizgi = true }: KartBaslikProps) {
  return (
    <View style={[s.kap, cizgi && s.cizgi]}>
      <View style={[s.ikonKutu, { backgroundColor: renk + '1A' }]}>
        <Ionicons name={kocIkon(icon)} size={18} color={renk} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.baslik}>{baslik}</Text>
        {!!alt && <Text style={s.alt}>{alt}</Text>}
      </View>
      {sag}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 15 },
  cizgi: { borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  ikonKutu: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  baslik: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  alt: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '500', marginTop: 1 },
});
