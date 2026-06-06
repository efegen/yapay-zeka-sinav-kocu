// Konu Çalışma Yolu — işaretlenebilir adım listesi + ilerleme rozeti + 2 aksiyon.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { KonuAdimlariVeri } from '../../../types/koc';
import { Press } from '../Press';
import { KocButon } from '../KocButon';
import { RADIUS } from '../tokens';
import type { KartBilesenProps } from './_ortak';

export function KonuAdimlari({ veri, onGuncelle, onAksiyon }: KartBilesenProps<KonuAdimlariVeri>) {
  const adimlar = veri.adimlar ?? [];
  const tamamlanan = veri.tamamlanan ?? [];
  const isaretli = (i: number) => tamamlanan.includes(i);

  function toggle(i: number) {
    const yeni = isaretli(i) ? tamamlanan.filter((x) => x !== i) : [...tamamlanan, i];
    onGuncelle({ ...veri, tamamlanan: yeni });
  }

  return (
    <View>
      <View style={s.ust}>
        <Text style={s.baslik}>{veri.konu}</Text>
        <View style={s.rozet}>
          <Text style={s.rozetMetin}>
            {tamamlanan.length}/{adimlar.length}
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 15, paddingBottom: 8 }}>
        {adimlar.map((a, i) => {
          const on = isaretli(i);
          return (
            <Press key={i} scale={0.99} onPress={() => toggle(i)} style={[s.adim, i > 0 && s.ustCizgi]}>
              <View style={[s.kutu, on ? s.kutuDolu : s.kutuBos]}>
                {on && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={[s.adimMetin, on && s.adimMetinDolu]}>{a}</Text>
            </Press>
          );
        })}
      </View>
      {!!veri.aksiyonlar?.length && (
        <View style={s.aksiyonlar}>
          {veri.aksiyonlar.map((ak, i) => (
            <KocButon
              key={i}
              etiket={ak.etiket}
              varyant={ak.birincil ? 'birincil' : 'ikincil'}
              esnek={ak.birincil}
              onPress={() => onAksiyon(undefined, ak.etiket)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: 13, paddingBottom: 6 },
  baslik: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rozet: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.hap, paddingVertical: 3, paddingHorizontal: 9 },
  rozetMetin: { fontSize: 11.5, fontWeight: '700', color: COLORS.primary },
  adim: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  ustCizgi: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  kutu: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  kutuBos: { borderWidth: 2, borderColor: COLORS.cardBorder },
  kutuDolu: { backgroundColor: COLORS.success },
  adimMetin: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: '500', color: COLORS.text },
  adimMetinDolu: { color: COLORS.textLight, textDecorationLine: 'line-through' },
  aksiyonlar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
});
