// Projeksiyon — "bu tempoda yetişir mi?" bar grafiği + sonuç kutusu.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { ProjeksiyonVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { Gradyan } from '../Gradyan';
import { RADIUS } from '../tokens';
import type { KartBilesenProps } from './_ortak';

const SONUC_RENK: Record<string, string> = {
  yetisir: COLORS.success,
  riskli: COLORS.amber,
  yetismez: COLORS.error,
};

export function Projeksiyon({ veri }: KartBilesenProps<ProjeksiyonVeri>) {
  const barlar = veri.barlar ?? [];
  const enYuksek = Math.max(1, ...barlar.map((b) => b.yukseklik || 0));
  const durum = veri.sonuc?.durum ?? 'yetisir';
  const sonucRenk = SONUC_RENK[durum] ?? COLORS.success;

  return (
    <View>
      <KartBaslik icon="trendUp" renk={COLORS.success} baslik={veri.baslik} alt={veri.altBaslik} />
      <View style={s.grafik}>
        {barlar.map((b, i) => {
          const h = 30 + (b.yukseklik / enYuksek) * 56; // 30..86 px
          const gri = b.tip === 'notr';
          return (
            <View key={i} style={s.barSutun}>
              <Text style={[s.barDeger, { color: gri ? COLORS.textLight : b.tip === 'hedef' ? COLORS.success : COLORS.primary }]}>
                {b.deger}
              </Text>
              {gri ? (
                <View style={[s.bar, { height: h, backgroundColor: COLORS.cardBorder }]} />
              ) : (
                <Gradyan
                  renkler={b.tip === 'hedef' ? [COLORS.success, '#34D399'] : [COLORS.primary, COLORS.accent]}
                  style={[s.bar, { height: h }]}
                />
              )}
              <Text style={s.barEtiket}>{b.etiket}</Text>
            </View>
          );
        })}
      </View>
      {!!veri.sonuc && (
        <View style={[s.sonuc, { backgroundColor: sonucRenk + '1A', borderColor: sonucRenk + '33' }]}>
          <Text style={s.sonucMetin}>
            <Text style={{ color: sonucRenk, fontWeight: '700' }}>
              {durum === 'yetisir' ? 'Yetişir. ' : durum === 'riskli' ? 'Riskli. ' : 'Zor. '}
            </Text>
            {veri.sonuc.metin}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  grafik: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  barSutun: { flex: 1, alignItems: 'center', gap: 6 },
  barDeger: { fontSize: 11, fontWeight: '700' },
  bar: { width: '100%', maxWidth: 56, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  barEtiket: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  sonuc: { marginHorizontal: 14, marginBottom: 14, paddingVertical: 10, paddingHorizontal: 13, borderRadius: RADIUS.kutu, borderWidth: 1 },
  sonucMetin: { fontSize: 12.5, lineHeight: 18, color: COLORS.text },
});
