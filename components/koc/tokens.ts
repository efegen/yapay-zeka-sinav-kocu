// AI Koç tasarım tokenları — handoff'tan türetilir, COLORS'u DEĞİŞTİRMEZ.
// Kaynak: design_handoff_ai_koc/README.md §2.

import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

/** İmza gradyanı — linear-gradient(135deg, #7C3AED, #EC4899). COLORS.gradient DEĞİL. */
export const GRADYAN: [string, string] = [COLORS.primary, COLORS.accent];
export const GRADYAN_BASLANGIC = { x: 0, y: 0 };
export const GRADYAN_BITIS = { x: 1, y: 1 }; // ~135deg

/** Köşe yarıçapları (handoff). */
export const RADIUS = {
  balon: 18,
  kart: 18,
  ic: 16,
  buton: 13,
  kutu: 12,
  kucukKutu: 11,
  hap: 99,
} as const;

/** Matematiksel ifadeler için kasıtlı serif. */
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

/** Kart gölgesi — 0 6px 18px rgba(124,58,237,0.07). */
export const GOLGE_KART = {
  shadowColor: '#7C3AED',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

/** CTA gölgesi — 0 6px 16px rgba(236,72,153,0.26). */
export const GOLGE_CTA = {
  shadowColor: '#EC4899',
  shadowOpacity: 0.26,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
} as const;

/** Avatar ışıltısı — 0 6px 16px rgba(236,72,153,0.32). */
export const GOLGE_AVATAR = {
  shadowColor: '#EC4899',
  shadowOpacity: 0.32,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 5,
} as const;

type IoniconsAdi = React.ComponentProps<typeof Ionicons>['name'];

/** Handoff Icon seti → Ionicons eşlemesi. */
const IKON_HARITASI: Record<string, IoniconsAdi> = {
  timer: 'timer-outline',
  book: 'book-outline',
  trendUp: 'trending-up',
  calendar: 'calendar-outline',
  clock: 'time-outline',
  shield: 'shield-checkmark-outline',
  target: 'locate',
  moon: 'moon-outline',
  bolt: 'flash',
  flame: 'flame',
  flag: 'flag',
  pencil: 'pencil',
  play: 'play',
  check: 'checkmark',
  chevron: 'chevron-forward',
  download: 'download-outline',
  sparkle: 'sparkles-outline',
  sparkleFill: 'sparkles',
  arrowRight: 'arrow-forward',
};

/** Kart şemasındaki ikon adını Ionicons adına çevirir (bilinmeyende makul yedek). */
export function kocIkon(ad?: string): IoniconsAdi {
  if (ad && IKON_HARITASI[ad]) return IKON_HARITASI[ad];
  return 'ellipse-outline';
}
