// Adım Adım Çözüm — akordeon çözüm adımları + yeşil sonuç rozeti.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { CozumAdimlariVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { Press } from '../Press';
import { Formul, iceriyorMat } from '../Formul';
import { Sekil } from '../Sekil';
import { RADIUS } from '../tokens';
import type { KartBilesenProps } from './_ortak';

export function CozumAdimlari({ veri, onGuncelle }: KartBilesenProps<CozumAdimlariVeri>) {
  const acik = veri.acikAdim ?? -1;
  const adimlar = veri.adimlar ?? [];

  function toggle(i: number) {
    onGuncelle({ ...veri, acikAdim: acik === i ? -1 : i });
  }

  return (
    <View>
      <KartBaslik icon="book" baslik="Adım adım çözüm" />
      {!!veri.giris && (
        <View style={s.soruKutu}>
          <Formul icerik={veri.giris} renk={COLORS.textSecondary} boyut={13} />
        </View>
      )}
      {!!veri.sekil && <Sekil svg={veri.sekil} />}
      <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 }}>
        {adimlar.map((s2, i) => {
          const o = acik === i;
          return (
            <Press key={i} scale={0.99} onPress={() => toggle(i)} style={[s.adim, i > 0 && s.ustCizgi]}>
              <View style={s.satir}>
                <View style={s.no}>
                  <Text style={s.noMetin}>{i + 1}</Text>
                </View>
                {iceriyorMat(s2.ad) ? (
                  <View style={{ flex: 1 }}>
                    <Formul icerik={s2.ad} renk={COLORS.text} boyut={13.5} kalin />
                  </View>
                ) : (
                  <Text style={s.ad}>{s2.ad}</Text>
                )}
                <Ionicons name={o ? 'chevron-down' : 'chevron-forward'} size={15} color={COLORS.textLight} />
              </View>
              {o && (
                <View style={s.detayKutu}>
                  <Formul icerik={s2.detay} renk={COLORS.text} boyut={13.5} />
                </View>
              )}
              {o && !!s2.sekil && <Sekil svg={s2.sekil} maksYukseklik={200} />}
            </Press>
          );
        })}
      </View>
      {!!veri.sonuc && (
        <View style={s.sonucKutu}>
          <Text style={s.sonucEtiket}>Sonuç</Text>
          <Formul
            icerik={`= ${veri.sonuc}`}
            renk={COLORS.success}
            boyut={20}
            kalin
            hizala="center"
            style={{ alignSelf: 'stretch', marginTop: 2 }}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  soruKutu: { paddingHorizontal: 15, paddingTop: 10 },
  adim: { paddingVertical: 9 },
  ustCizgi: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  no: { width: 24, height: 24, borderRadius: 8, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  noMetin: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },
  ad: { flex: 1, fontSize: 13.5, fontWeight: '600', color: COLORS.text },
  detayKutu: { marginLeft: 35, marginTop: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: RADIUS.kucukKutu, backgroundColor: COLORS.background },
  sonucKutu: { marginHorizontal: 14, marginTop: 6, marginBottom: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.buton, alignItems: 'center', backgroundColor: '#10B9811A', borderWidth: 1, borderColor: '#10B98133' },
  sonucEtiket: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
});
