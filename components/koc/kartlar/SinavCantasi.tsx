// Sınav Günü Çantası — işaretlenebilir hazırlık listesi + ilerleme rozeti.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { SinavCantasiVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { Press } from '../Press';
import { RADIUS } from '../tokens';
import type { KartBilesenProps } from './_ortak';

export function SinavCantasi({ veri, onGuncelle }: KartBilesenProps<SinavCantasiVeri>) {
  const maddeler = veri.maddeler ?? [];
  const tamamlanan = veri.tamamlanan ?? [];
  const isaretli = (i: number) => tamamlanan.includes(i);
  const hepsi = maddeler.length > 0 && tamamlanan.length === maddeler.length;

  function toggle(i: number) {
    const yeni = isaretli(i) ? tamamlanan.filter((x) => x !== i) : [...tamamlanan, i];
    onGuncelle({ ...veri, tamamlanan: yeni });
  }

  return (
    <View>
      <KartBaslik
        icon="shield"
        renk={COLORS.success}
        baslik={veri.baslik}
        alt={veri.altBaslik}
        sag={
          <View style={[s.rozet, { backgroundColor: hepsi ? '#10B9811A' : COLORS.primaryLight }]}>
            <Text style={[s.rozetMetin, { color: hepsi ? COLORS.success : COLORS.primary }]}>
              {tamamlanan.length}/{maddeler.length}
            </Text>
          </View>
        }
      />
      <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 12 }}>
        {maddeler.map((m, i) => {
          const on = isaretli(i);
          return (
            <Press key={i} scale={0.99} onPress={() => toggle(i)} style={[s.madde, i > 0 && s.ustCizgi]}>
              <View style={[s.kutu, on ? s.kutuDolu : s.kutuBos]}>
                {on && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={[s.metin, on && s.metinDolu]}>{m}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rozet: { borderRadius: RADIUS.hap, paddingVertical: 3, paddingHorizontal: 9 },
  rozetMetin: { fontSize: 11, fontWeight: '800' },
  madde: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  ustCizgi: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  kutu: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  kutuBos: { borderWidth: 2, borderColor: COLORS.cardBorder },
  kutuDolu: { backgroundColor: COLORS.success },
  metin: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: '500', color: COLORS.text },
  metinDolu: { color: COLORS.textLight, textDecorationLine: 'line-through' },
});
