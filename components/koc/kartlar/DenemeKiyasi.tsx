// Deneme Ders Kıyası — yeni vs önceki deneme (ders bazında fark) + toplam net & sıra.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { DenemeKiyasiVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { NetBar } from './_ortak';
import type { KartBilesenProps } from './_ortak';

function farkRenk(f: number) {
  return f > 0 ? COLORS.success : f < 0 ? COLORS.error : COLORS.textLight;
}
function farkZemin(f: number) {
  return f > 0 ? '#10B9811A' : f < 0 ? '#EF44441A' : COLORS.background;
}

export function DenemeKiyasi({ veri }: KartBilesenProps<DenemeKiyasiVeri>) {
  const yonOk = veri.tahminiSira?.yon === 'yukari' ? '↑' : veri.tahminiSira?.yon === 'asagi' ? '↓' : '→';
  return (
    <View>
      <KartBaslik icon="trendUp" renk={COLORS.success} baslik={veri.baslik} alt={veri.altBaslik} />
      <View style={{ paddingHorizontal: 15, paddingTop: 8, paddingBottom: 6 }}>
        {(veri.dersler ?? []).map((d, i) => {
          const fark = d.net - d.onceki;
          return (
            <View key={i} style={[{ paddingVertical: 7 }, i > 0 && s.ustCizgi]}>
              <View style={s.satir}>
                <Text style={s.ad}>{d.ad}</Text>
                <View style={s.sag}>
                  <Text style={s.net}>
                    {d.net}
                    <Text style={s.max}>/{d.max}</Text>
                  </Text>
                  <View style={[s.fark, { backgroundColor: farkZemin(fark) }]}>
                    <Text style={[s.farkMetin, { color: farkRenk(fark) }]}>
                      {fark > 0 ? '+' : ''}
                      {fark || '—'}
                    </Text>
                  </View>
                </View>
              </View>
              <NetBar oran={d.max > 0 ? d.net / d.max : 0} renk={d.renk ?? COLORS.primary} />
            </View>
          );
        })}
      </View>
      <View style={s.ozetSatir}>
        <View style={s.ozetKutu}>
          <Text style={s.ozetEtiket}>Toplam net</Text>
          <Text style={s.ozetDeger}>
            {veri.toplamNet?.deger}{' '}
            {veri.toplamNet?.fark != null && (
              <Text style={{ fontSize: 13, color: COLORS.success }}>
                {veri.toplamNet.fark > 0 ? '+' : ''}
                {veri.toplamNet.fark}
              </Text>
            )}
          </Text>
        </View>
        {!!veri.tahminiSira && (
          <View style={s.ozetKutu}>
            <Text style={s.ozetEtiket}>Tahmini sıra</Text>
            <Text style={s.ozetDeger}>
              {veri.tahminiSira.deger} <Text style={{ fontSize: 13, color: COLORS.success }}>{yonOk}</Text>
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ustCizgi: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  satir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ad: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  sag: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  net: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  max: { color: COLORS.textLight, fontWeight: '500' },
  fark: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 99 },
  farkMetin: { fontSize: 11, fontWeight: '800' },
  ozetSatir: { flexDirection: 'row', gap: 10, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 14 },
  ozetKutu: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.background },
  ozetEtiket: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  ozetDeger: { fontSize: 19, fontWeight: '800', color: COLORS.text, marginTop: 2 },
});
