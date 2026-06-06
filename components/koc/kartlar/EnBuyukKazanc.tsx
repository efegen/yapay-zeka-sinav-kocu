// En Çok Kazandıracak Hamle — tek odak önerisi + halka + CTA.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { EnBuyukKazancVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { Ring } from '../Ring';
import { KocButon } from '../KocButon';
import { ZenginMetin } from '../ZenginMetin';
import type { KartBilesenProps } from './_ortak';

export function EnBuyukKazanc({ veri, onAksiyon }: KartBilesenProps<EnBuyukKazancVeri>) {
  const renk = veri.renk ?? COLORS.primary;
  return (
    <View>
      <KartBaslik icon="target" baslik="En çok kazandıracak hamle" alt="enerjini buraya ver" />
      <View style={{ padding: 15 }}>
        <View style={s.satir}>
          <Ring size={56} stroke={7} value={veri.yuzde} max={100} color={renk}>
            <Text style={[s.yuzde, { color: renk }]}>%{veri.yuzde}</Text>
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={s.ders}>{veri.ders}</Text>
            <ZenginMetin style={s.metin}>{veri.metin}</ZenginMetin>
          </View>
        </View>
        {!!veri.cta && (
          <KocButon
            etiket={veri.cta.etiket}
            ikon="calendar"
            varyant="birincil"
            onPress={() => onAksiyon(veri.cta?.aksiyon, veri.cta?.etiket)}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  yuzde: { fontSize: 13, fontWeight: '800' },
  ders: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  metin: { fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 18, marginTop: 2 },
});
