// Oturum Zaman Planı — sınav oturumu süre dağılımı (yığılı bar) + altın kural.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { OturumZamanPlaniVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { AltKutu } from './_ortak';
import type { KartBilesenProps } from './_ortak';

export function OturumZamanPlani({ veri }: KartBilesenProps<OturumZamanPlaniVeri>) {
  const dagilim = veri.dagilim ?? [];
  const toplam = dagilim.reduce((a, b) => a + (b.dk || 0), 0) || 1;
  return (
    <View>
      <KartBaslik icon="clock" baslik={veri.baslik} alt={veri.altBaslik} />
      <View style={{ paddingHorizontal: 15, paddingTop: 12, paddingBottom: 6 }}>
        <View style={s.yiginBar}>
          {dagilim.map((d, i) => (
            <View key={i} style={{ width: `${(d.dk / toplam) * 100}%`, backgroundColor: d.renk ?? COLORS.primary }} />
          ))}
        </View>
        {dagilim.map((d, i) => (
          <View key={i} style={[s.satir, i > 0 && s.ustCizgi]}>
            <View style={[s.kare, { backgroundColor: d.renk ?? COLORS.primary }]} />
            <Text style={s.ad}>{d.ad}</Text>
            <Text style={[s.dk, { color: d.renk ?? COLORS.primary }]}>{d.dk} dk</Text>
          </View>
        ))}
      </View>
      {!!veri.altinKural && (
        <AltKutu style={{ marginTop: 4 }}>
          <Text style={s.kural}>
            <Text style={{ fontWeight: '700' }}>Altın kural: </Text>
            {veri.altinKural}
          </Text>
        </AltKutu>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  yiginBar: { flexDirection: 'row', height: 12, borderRadius: 99, overflow: 'hidden', marginBottom: 12 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  ustCizgi: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  kare: { width: 9, height: 9, borderRadius: 3 },
  ad: { flex: 1, fontSize: 13.5, fontWeight: '600', color: COLORS.text },
  dk: { fontSize: 13, fontWeight: '700' },
  kural: { fontSize: 12.5, lineHeight: 18, color: COLORS.text },
});
