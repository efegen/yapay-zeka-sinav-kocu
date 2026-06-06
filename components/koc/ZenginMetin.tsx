// ZenginMetin — hafif (WebView'siz) markdown kalın desteği: **kalın** → bold.
// Matematik içermeyen metinler için (balon, içgörü kutusu vb.). Math gereken yerde Formul kullan.
import { Text, StyleProp, TextStyle } from 'react-native';

interface ZenginMetinProps {
  children?: string;
  style?: StyleProp<TextStyle>;
  kalinRenk?: string;
}

export function ZenginMetin({ children, style, kalinRenk }: ZenginMetinProps) {
  const metin = children ?? '';
  if (!metin.includes('**')) {
    return <Text style={style}>{metin}</Text>;
  }
  const parcalar = metin.split(/(\*\*[^*]+?\*\*)/g);
  return (
    <Text style={style}>
      {parcalar.map((p, i) =>
        p.length > 4 && p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} style={[{ fontWeight: '700' }, kalinRenk ? { color: kalinRenk } : null]}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          p
        )
      )}
    </Text>
  );
}
