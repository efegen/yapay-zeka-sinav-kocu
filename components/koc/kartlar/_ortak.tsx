// Kart bileşenleri için ortak props + küçük yardımcı parçalar.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { RADIUS } from '../tokens';
import { ZenginMetin } from '../ZenginMetin';

/** Tüm kart bileşenlerinin ortak prop sözleşmesi. */
export interface KartBilesenProps<V> {
  veri: V;
  /** Kartın iç-state'ini günceller (kalıcı olur). */
  onGuncelle: (yeniVeri: V) => void;
  /** CTA / aksiyon: derin bağlantı (aksiyon) veya sohbete mesaj (mesaj). */
  onAksiyon: (aksiyon?: string, mesaj?: string) => void;
}

/** Yatay net/ilerleme barı. */
export function NetBar({ oran, renk, yukseklik = 7 }: { oran: number; renk: string; yukseklik?: number }) {
  return (
    <View style={[o.barRay, { height: yukseklik }]}>
      <View style={{ height: '100%', width: `${Math.max(0, Math.min(100, oran * 100))}%`, borderRadius: RADIUS.hap, backgroundColor: renk }} />
    </View>
  );
}

/** Açık zeminli içgörü/altın-kural kutusu. */
export function AltKutu({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[o.altKutu, style]}>{children}</View>;
}

export function AltKutuMetin({ children }: { children?: string }) {
  return <ZenginMetin style={o.altKutuMetin}>{children}</ZenginMetin>;
}

const o = StyleSheet.create({
  barRay: { borderRadius: RADIUS.hap, backgroundColor: COLORS.background, overflow: 'hidden' },
  altKutu: {
    marginHorizontal: 14,
    marginBottom: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: RADIUS.kutu,
    backgroundColor: COLORS.background,
  },
  altKutuMetin: { fontSize: 12.5, lineHeight: 18, color: COLORS.text },
});
