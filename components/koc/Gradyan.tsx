// Gradyan — imza gradyanını (135deg) saran ince LinearGradient yardımcısı.
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle } from 'react-native';
import { GRADYAN, GRADYAN_BASLANGIC, GRADYAN_BITIS } from './tokens';

interface GradyanProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  renkler?: [string, string];
}

export function Gradyan({ children, style, renkler = GRADYAN }: GradyanProps) {
  return (
    <LinearGradient
      colors={renkler}
      start={GRADYAN_BASLANGIC}
      end={GRADYAN_BITIS}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
