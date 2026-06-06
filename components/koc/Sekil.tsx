// Sekil — modelin ürettiği SVG geometri diyagramını "defter" stilinde çizer.
// Image-gen DEĞİL: react-native-svg/SvgXml ile (native + web), grid arka planlı kâğıt görünümü.
import { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Pattern, Path, Rect, SvgXml } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { RADIUS } from './tokens';

/** Güvenlik: yalnızca çizim etiketlerine izin ver; script/image/foreignObject temizle. */
function svgTemizle(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<image[\s\S]*?\/?>/gi, '')
    .trim();
}

/** viewBox'tan en-boy oranı (yükseklik/genişlik). */
function vbOrani(svg: string): number {
  const m = svg.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
  if (m) {
    const w = parseFloat(m[1]);
    const h = parseFloat(m[2]);
    if (w > 0 && h > 0) return h / w;
  }
  return 0.66;
}

function Izgara({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="defterIzgara" width="22" height="22" patternUnits="userSpaceOnUse">
          <Path d="M22 0 H0 V22" stroke={COLORS.cardBorder} strokeWidth={1} fill="none" />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill="url(#defterIzgara)" />
    </Svg>
  );
}

export function Sekil({ svg, maksYukseklik = 240 }: { svg: string; maksYukseklik?: number }) {
  const [w, setW] = useState(0);
  if (!svg || !svg.includes('<svg')) return null;
  const temiz = svgTemizle(svg);
  const h = w ? Math.min(Math.round(w * vbOrani(temiz)), maksYukseklik) : 0;

  function olcum(e: LayoutChangeEvent) {
    const g = Math.round(e.nativeEvent.layout.width);
    if (g && g !== w) setW(g);
  }

  return (
    <View style={s.kagit} onLayout={olcum}>
      {w > 0 && h > 0 && (
        <View style={{ width: w, height: h }}>
          <Izgara w={w} h={h} />
          <SvgXml xml={temiz} width={w} height={h} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kagit: {
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: RADIUS.kutu,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: '#FCFDFF',
    overflow: 'hidden',
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
