// KocButon — kart CTA/aksiyon butonları. 3 varyant: gradyan, birincil, ikincil.
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { Press } from './Press';
import { Gradyan } from './Gradyan';
import { RADIUS, GOLGE_CTA, kocIkon } from './tokens';

interface KocButonProps {
  etiket: string;
  onPress?: () => void;
  varyant?: 'gradyan' | 'birincil' | 'ikincil';
  ikon?: string;
  style?: StyleProp<ViewStyle>;
  /** flex:1 ile sıraya yayılsın mı. */
  esnek?: boolean;
}

export function KocButon({ etiket, onPress, varyant = 'gradyan', ikon, style, esnek }: KocButonProps) {
  const ikincil = varyant === 'ikincil';
  const renk = ikincil ? COLORS.text : '#fff';

  const icerik = (
    <View style={s.ic}>
      {!!ikon && <Ionicons name={kocIkon(ikon)} size={15} color={renk} />}
      <Text style={[s.metin, { color: renk }]} numberOfLines={1}>
        {etiket}
      </Text>
    </View>
  );

  if (varyant === 'gradyan') {
    return (
      <Press onPress={onPress} style={[esnek && { flex: 1 }, style]}>
        <Gradyan style={[s.taban, GOLGE_CTA]}>{icerik}</Gradyan>
      </Press>
    );
  }

  return (
    <Press
      onPress={onPress}
      style={[
        s.taban,
        ikincil ? s.ikincil : { backgroundColor: COLORS.primary },
        esnek && { flex: 1 },
        style,
      ]}
    >
      {icerik}
    </Press>
  );
}

const s = StyleSheet.create({
  taban: { borderRadius: RADIUS.buton, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  ikincil: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.cardBorder },
  ic: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  metin: { fontSize: 13.5, fontWeight: '700' },
});
