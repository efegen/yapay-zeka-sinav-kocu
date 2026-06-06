// Mini Deneme Analizi — ders bazında net barları + tek cümlelik içgörü.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { MiniDenemeAnaliziVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { NetBar, AltKutu, AltKutuMetin } from './_ortak';
import type { KartBilesenProps } from './_ortak';

export function MiniDenemeAnalizi({ veri }: KartBilesenProps<MiniDenemeAnaliziVeri>) {
  return (
    <View>
      <KartBaslik icon="trendUp" renk={COLORS.success} baslik={veri.baslik} cizgi={false} />
      <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 4 }}>
        {(veri.dersler ?? []).map((d, i) => (
          <View key={i} style={{ paddingVertical: 6 }}>
            <View style={s.satir}>
              <Text style={s.ad}>{d.ad}</Text>
              <Text style={s.deger}>
                {d.net}/{d.max}
              </Text>
            </View>
            <NetBar oran={d.max > 0 ? d.net / d.max : 0} renk={d.renk ?? COLORS.primary} />
          </View>
        ))}
      </View>
      {!!veri.icgoru && (
        <AltKutu style={{ marginTop: 6 }}>
          <AltKutuMetin>{veri.icgoru}</AltKutuMetin>
        </AltKutu>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  ad: { fontSize: 12.5, fontWeight: '600', color: COLORS.text },
  deger: { fontSize: 12.5, fontWeight: '600', color: COLORS.textSecondary },
});
