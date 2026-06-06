// Günlük Brifing — proaktif selam + günün mesajı + "ilk hamle" CTA.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { GunlukBrifingVeri } from '../../../types/koc';
import { KocAvatar } from '../KocAvatar';
import { Press } from '../Press';
import { Gradyan } from '../Gradyan';
import { RADIUS, GOLGE_CTA } from '../tokens';
import type { KartBilesenProps } from './_ortak';

export function GunlukBrifing({ veri, onAksiyon }: KartBilesenProps<GunlukBrifingVeri>) {
  return (
    <View style={{ padding: 16 }}>
      <View style={s.ust}>
        <KocAvatar size={42} radius={13} />
        <View style={{ flex: 1 }}>
          {!!veri.tarih && <Text style={s.tarih}>{veri.tarih}</Text>}
          <Text style={s.selam}>
            {veri.selam}, {veri.isim} 👋
          </Text>
        </View>
      </View>
      <Text style={s.mesaj}>{veri.mesaj}</Text>
      {!!veri.ilkHamle && (
        <Press onPress={() => onAksiyon(veri.ilkHamle?.aksiyon, veri.ilkHamle?.baslik)}>
          <Gradyan style={[s.cta, GOLGE_CTA]}>
            <View style={s.ctaIkon}>
              <Ionicons name="play" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ctaBaslik}>{veri.ilkHamle.baslik}</Text>
              <Text style={s.ctaAlt}>{veri.ilkHamle.altMetin}</Text>
            </View>
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </Gradyan>
        </Press>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ust: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  tarih: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '600' },
  selam: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  mesaj: { fontSize: 14, lineHeight: 21, color: COLORS.text, marginBottom: 14 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.ic },
  ctaIkon: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  ctaBaslik: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  ctaAlt: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
});
