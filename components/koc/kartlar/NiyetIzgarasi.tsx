// Niyet Izgarası — koçun yapabildikleri. 2×3 ızgara veya yatay haplar; dokununca mesaj gönderir.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { NiyetIzgarasiVeri } from '../../../types/koc';
import { Press } from '../Press';
import { RADIUS, kocIkon } from '../tokens';
import type { KartBilesenProps } from './_ortak';

export function NiyetIzgarasi({ veri, onAksiyon }: KartBilesenProps<NiyetIzgarasiVeri>) {
  const niyetler = veri.niyetler ?? [];

  if (veri.varyant === 'hap') {
    return (
      <View style={s.haplar}>
        {niyetler.map((n) => (
          <Press key={n.id} scale={0.95} onPress={() => onAksiyon(n.id, n.baslik)} style={s.hap}>
            <Ionicons name={kocIkon(n.icon)} size={14} color={n.renk} />
            <Text style={s.hapMetin}>{n.baslik}</Text>
          </Press>
        ))}
      </View>
    );
  }

  return (
    <View style={s.izgara}>
      {niyetler.map((n) => (
        <Press key={n.id} onPress={() => onAksiyon(n.id, n.baslik)} style={s.hucre}>
          <View style={[s.ikonKutu, { backgroundColor: n.renk + '1A' }]}>
            <Ionicons name={kocIkon(n.icon)} size={20} color={n.renk} />
          </View>
          <Text style={s.baslik}>{n.baslik}</Text>
          {!!n.altMetin && <Text style={s.alt}>{n.altMetin}</Text>}
        </Press>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  izgara: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  hucre: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.ic,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    padding: 13,
    gap: 9,
  },
  ikonKutu: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  baslik: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  alt: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '500' },
  haplar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  hap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.hap,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  hapMetin: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
});
