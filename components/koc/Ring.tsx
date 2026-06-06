// Ring — dairesel ilerleme halkası (react-native-svg). Handoff shared.jsx Ring'in RN karşılığı.
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../../constants/colors';

interface RingProps {
  size?: number;
  stroke?: number;
  value?: number;
  max?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}

export function Ring({
  size = 64,
  stroke = 7,
  value = 0,
  max = 100,
  color = COLORS.primary,
  track = '#E9E5FB',
  children,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          // -90° başlangıç: halka tepeden başlasın
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}
