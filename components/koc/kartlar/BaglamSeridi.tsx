// Bağlam Şeridi — 3 mini stat (geri sayım, seri, günlük soru halkası).
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { BaglamSeridiVeri } from '../../../types/koc';
import { Ring } from '../Ring';
import type { KartBilesenProps } from './_ortak';

const TIP_RENK: Record<string, string> = {
  geriSayim: COLORS.primary,
  seri: COLORS.amber,
  soru: COLORS.success,
};
const TIP_IKON: Record<string, any> = {
  geriSayim: 'flag',
  seri: 'flame',
  soru: 'flash',
};

export function BaglamSeridi({ veri }: KartBilesenProps<BaglamSeridiVeri>) {
  return (
    <View style={s.satir}>
      {(veri.ogeler ?? []).map((o, i) => {
        const renk = TIP_RENK[o.tip] ?? COLORS.primary;
        const halka = o.tip === 'soru' && o.hedef != null;
        return (
          <View key={i} style={s.stat}>
            {i > 0 && <View style={s.bolucu} />}
            {halka ? (
              <Ring size={34} stroke={4.5} value={o.deger} max={o.hedef!} color={renk}>
                <Ionicons name="flash" size={12} color={renk} />
              </Ring>
            ) : (
              <View style={[s.ikonKutu, { backgroundColor: renk + '1A' }]}>
                <Ionicons name={TIP_IKON[o.tip] ?? 'ellipse'} size={17} color={renk} />
              </View>
            )}
            <Text style={s.deger}>{halka ? `${o.deger}/${o.hedef}` : o.deger}</Text>
            <Text style={s.etiket}>{o.etiket}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 12 },
  stat: { flex: 1, alignItems: 'flex-start', paddingHorizontal: 6, gap: 6 },
  bolucu: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 1, backgroundColor: COLORS.cardBorder },
  ikonKutu: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  deger: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  etiket: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
});
