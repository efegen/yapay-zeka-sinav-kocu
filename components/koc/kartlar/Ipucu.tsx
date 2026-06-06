// Ezber İpucu — tek satır, açılabilir (akordeon).
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { IpucuVeri } from '../../../types/koc';
import { Press } from '../Press';
import { Formul } from '../Formul';
import type { KartBilesenProps } from './_ortak';

export function Ipucu({ veri, onGuncelle }: KartBilesenProps<IpucuVeri>) {
  const acik = !!veri.acik;
  return (
    <View style={{ padding: 15 }}>
      <Press scale={0.99} onPress={() => onGuncelle({ ...veri, acik: !acik })} style={s.satir}>
        <Ionicons name="flash" size={17} color={COLORS.amber} />
        <Text style={s.baslik}>{veri.baslik}</Text>
        <Ionicons name={acik ? 'chevron-down' : 'chevron-forward'} size={15} color={COLORS.textLight} />
      </Press>
      {acik && (
        <View style={{ marginTop: 10 }}>
          <Formul icerik={veri.metin} renk={COLORS.text} boyut={13.5} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  baslik: { flex: 1, fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  metin: { marginTop: 10, fontSize: 13.5, lineHeight: 20, color: COLORS.text },
});
