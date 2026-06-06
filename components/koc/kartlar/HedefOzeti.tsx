// Hedef Özeti — gradyan başlık + halka + ders bazında güncel↔hedef net farkı.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { HedefOzetiVeri } from '../../../types/koc';
import { Ring } from '../Ring';
import { Gradyan } from '../Gradyan';
import { AltKutu, AltKutuMetin } from './_ortak';
import type { KartBilesenProps } from './_ortak';

export function HedefOzeti({ veri }: KartBilesenProps<HedefOzetiVeri>) {
  return (
    <View>
      <Gradyan style={s.baslik}>
        <Ring size={64} stroke={7} value={veri.yuzde} max={100} color="#fff" track="rgba(255,255,255,0.28)">
          <Text style={s.ringMetin}>%{veri.yuzde}</Text>
        </Ring>
        <View style={{ flex: 1 }}>
          <Text style={s.hedef}>{veri.hedef}</Text>
          <Text style={s.yakin}>Hedefe %{veri.yuzde} yakınsın</Text>
          {(!!veri.hedefSira || !!veri.guncelSira) && (
            <Text style={s.sira}>
              Hedef sıra {veri.hedefSira} · şu an {veri.guncelSira}
            </Text>
          )}
        </View>
      </Gradyan>

      <View style={{ paddingHorizontal: 15, paddingTop: 10, paddingBottom: 6 }}>
        {(veri.netler ?? []).map((n, i) => {
          const pct = Math.min(100, n.hedef > 0 ? (n.simdi / n.hedef) * 100 : 0);
          const kalan = n.hedef - n.simdi;
          return (
            <View key={i} style={[{ paddingVertical: 8 }, i > 0 && s.ustCizgi]}>
              <View style={s.satir}>
                <Text style={s.ad}>{n.ad}</Text>
                <Text style={s.deger}>
                  <Text style={{ color: COLORS.text, fontWeight: '700' }}>{n.simdi}</Text> / {n.hedef} net
                  <Text style={s.fark}> +{Number.isInteger(kalan) ? kalan : kalan.toFixed(1)}</Text>
                </Text>
              </View>
              <View style={s.barRay}>
                <View style={{ height: '100%', width: `${pct}%`, borderRadius: 99, backgroundColor: n.renk ?? COLORS.primary }} />
              </View>
            </View>
          );
        })}
      </View>

      {!!veri.not && (
        <AltKutu style={{ marginTop: 4 }}>
          <AltKutuMetin>{veri.not}</AltKutuMetin>
        </AltKutu>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  baslik: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  ringMetin: { fontSize: 16, fontWeight: '800', color: '#fff' },
  hedef: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  yakin: { fontSize: 16, fontWeight: '800', color: '#fff' },
  sira: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  ustCizgi: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  satir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  ad: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  deger: { fontSize: 12.5, color: COLORS.textSecondary },
  fark: { color: COLORS.accent, fontWeight: '700' },
  barRay: { height: 8, borderRadius: 99, backgroundColor: COLORS.background, overflow: 'hidden' },
});
