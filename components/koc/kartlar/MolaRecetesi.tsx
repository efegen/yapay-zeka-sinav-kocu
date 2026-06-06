// Mola Reçetesi — dinlenme önerileri (ikon + metin) + opsiyonel gradyan CTA.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { MolaRecetesiVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { KocButon } from '../KocButon';
import { kocIkon } from '../tokens';
import type { KartBilesenProps } from './_ortak';

export function MolaRecetesi({ veri, onAksiyon }: KartBilesenProps<MolaRecetesiVeri>) {
  return (
    <View>
      <KartBaslik icon="moon" renk={COLORS.accent} baslik={veri.baslik} alt={veri.altBaslik} />
      <View style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
        {(veri.ogeler ?? []).map((o, i) => (
          <View key={i} style={s.oge}>
            <View style={s.ikonKutu}>
              <Ionicons name={kocIkon(o.icon)} size={16} color={COLORS.primary} />
            </View>
            <Text style={s.metin}>{o.metin}</Text>
          </View>
        ))}
      </View>
      {!!veri.cta && (
        <KocButon
          etiket={veri.cta.etiket}
          ikon="play"
          varyant="gradyan"
          onPress={() => onAksiyon(veri.cta?.aksiyon, veri.cta?.etiket)}
          style={{ marginHorizontal: 12, marginBottom: 14 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  oge: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 8 },
  ikonKutu: { width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  metin: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: '500', color: COLORS.text },
});
