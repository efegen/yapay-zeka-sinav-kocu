// Momentum / Gerçek Tablo — "ne kadar yol aldın" 3 metrik + içgörü notu.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { MomentumVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { AltKutu, AltKutuMetin } from './_ortak';
import { kocIkon } from '../tokens';
import type { KartBilesenProps } from './_ortak';

export function Momentum({ veri }: KartBilesenProps<MomentumVeri>) {
  const metrikler = veri.metrikler ?? [];
  return (
    <View>
      <KartBaslik icon="trendUp" renk={COLORS.success} baslik={veri.baslik} alt={veri.altBaslik} />
      <View style={s.satir}>
        {metrikler.map((m, i) => (
          <View key={i} style={s.metrik}>
            {i > 0 && <View style={s.bolucu} />}
            <View style={[s.ikonKutu, { backgroundColor: (m.renk ?? COLORS.primary) + '1A' }]}>
              <Ionicons name={kocIkon(m.icon)} size={18} color={m.renk ?? COLORS.primary} />
            </View>
            <Text style={[s.deger, { color: m.renk ?? COLORS.primary }]}>{m.deger}</Text>
            <Text style={s.etiket}>{m.etiket}</Text>
          </View>
        ))}
      </View>
      {!!veri.not && (
        <AltKutu>
          <AltKutuMetin>{veri.not}</AltKutuMetin>
        </AltKutu>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 12 },
  metrik: { flex: 1, alignItems: 'center' },
  bolucu: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 1, backgroundColor: COLORS.cardBorder },
  ikonKutu: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  deger: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  etiket: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginTop: 4, textAlign: 'center' },
});
