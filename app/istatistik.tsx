import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Svg, { Polyline, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';
import { auth } from '../services/firebaseConfig';
import { denemeleriGetir } from '../services/firestoreService';
import { netlerdenSiralama } from '../services/yokatlasService';
import { useProfile } from '../hooks/useProfile';
import {
  TYT_TESTLER,
  AYT_ALANLAR,
  netOf,
  dRenk,
  fmtNet,
  fmtDelta,
  fmtSira,
  tarihKisa,
  type DenemeSonuc,
  type Test,
} from '../models/deneme';

// Bir denemenin girilen derslerinin net/max değerleri.
function dersNetleri(d: DenemeSonuc): { ad: string; net: number; max: number }[] {
  const testler: Test[] = [
    ...(d.kapsam !== 'ayt' ? TYT_TESTLER : []),
    ...(d.kapsam !== 'tyt' ? AYT_ALANLAR[d.alan].testler : []),
  ];
  return testler
    .filter((t) => {
      const c = d.cevaplar?.[t.ad];
      return !!c && (c.d !== '' || c.y !== '');
    })
    .map((t) => ({ ad: t.ad, net: Math.max(0, netOf(d.cevaplar[t.ad])), max: t.soru }));
}

export default function Istatistik() {
  const router = useRouter();
  const { profil } = useProfile();
  const uid = auth.currentUser?.uid;
  const diploma = profil?.diplomaNotu ?? 0;

  const [denemeler, setDenemeler] = useState<DenemeSonuc[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    if (!uid) {
      setYukleniyor(false);
      return;
    }
    denemeleriGetir(uid)
      .then(setDenemeler) // yeni → eski
      .catch((e) => console.error('[Istatistik] yükleme hatası:', e))
      .finally(() => setYukleniyor(false));
  }, [uid]);

  // ── Özet metrikler ──
  const ozet = useMemo(() => {
    if (!denemeler.length) return null;
    const enIyiNet = Math.max(...denemeler.map((d) => d.toplamNet));
    const sonNet = denemeler[0].toplamNet;
    const oncekiNet = denemeler[1]?.toplamNet;
    const delta = oncekiNet != null ? sonNet - oncekiNet : null;
    const siralar = denemeler
      .filter((d) => d.kapsam === 'ikisi')
      .map((d) => netlerdenSiralama(d.tytNet, d.aytNet, d.alan, diploma))
      .filter((s): s is number => s != null);
    const enIyiSira = siralar.length ? Math.min(...siralar) : null;
    return { adet: denemeler.length, enIyiNet, sonNet, delta, enIyiSira };
  }, [denemeler, diploma]);

  // ── Net trendi (eski → yeni) ──
  const trend = useMemo(
    () =>
      [...denemeler]
        .reverse()
        .map((d) => ({ net: d.toplamNet, etiket: tarihKisa(d.tarih.toDate()) })),
    [denemeler]
  );

  // ── Son denemenin ders dağılımı (en zayıf önce) ──
  const sonDersler = useMemo(() => {
    if (!denemeler.length) return [];
    return dersNetleri(denemeler[0]).sort((a, b) => a.net / a.max - b.net / b.max);
  }, [denemeler]);

  return (
    <View style={styles.ekran}>
      <View style={styles.baslik}>
        <TouchableOpacity style={styles.geriBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={21} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.baslikMetin}>İstatistikler</Text>
        <View style={{ width: 38 }} />
      </View>

      {yukleniyor ? (
        <View style={styles.merkez}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !denemeler.length ? (
        <View style={styles.merkez}>
          <View style={styles.bosIkon}>
            <Ionicons name="bar-chart-outline" size={38} color={COLORS.primary} />
          </View>
          <Text style={styles.bosBaslik}>Henüz veri yok</Text>
          <Text style={styles.bosMetin}>Deneme ekledikçe net trendin ve ders analizin burada oluşur.</Text>
          <TouchableOpacity style={styles.bosBtn} onPress={() => router.push('/deneme-ekle')} activeOpacity={0.85}>
            <Ionicons name="add" size={17} color="#fff" />
            <Text style={styles.bosBtnMetin}>Deneme ekle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.icerik} showsVerticalScrollIndicator={false}>
          {/* ── Özet kartları ── */}
          <View style={styles.metrikGrid}>
            <MetrikKart etiket="Deneme" deger={String(ozet!.adet)} ikon="documents-outline" />
            <MetrikKart etiket="En iyi net" deger={fmtNet(ozet!.enIyiNet)} ikon="trophy-outline" renk={COLORS.success} />
            <MetrikKart
              etiket="Son net"
              deger={fmtNet(ozet!.sonNet)}
              alt={ozet!.delta != null ? fmtDelta(ozet!.delta) : undefined}
              altRenk={ozet!.delta != null ? (ozet!.delta >= 0 ? COLORS.success : COLORS.error) : undefined}
              ikon="pulse-outline"
            />
            <MetrikKart
              etiket="En iyi sıra"
              deger={ozet!.enIyiSira != null ? `≈${fmtSira(ozet!.enIyiSira)}` : '—'}
              ikon="podium-outline"
              renk={COLORS.accent}
            />
          </View>

          {/* ── Net trendi ── */}
          <Text style={styles.bolumBaslik}>Net trendi</Text>
          <View style={styles.kart}>
            {trend.length >= 2 ? (
              <>
                <NetGrafik noktalar={trend} />
                <View style={styles.eksenSatir}>
                  <Text style={styles.eksenMetin}>{trend[0].etiket}</Text>
                  <Text style={styles.eksenMetin}>{trend[trend.length - 1].etiket}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.azVeri}>Trend için en az 2 deneme gerekir. Bir deneme daha ekle!</Text>
            )}
          </View>

          {/* ── Ders dağılımı (son deneme) ── */}
          <Text style={styles.bolumBaslik}>Son denemende dersler</Text>
          <View style={styles.kart}>
            {sonDersler.map((d, i) => {
              const yuzde = d.max ? Math.round((d.net / d.max) * 100) : 0;
              const renk = dRenk(d.ad);
              return (
                <View key={d.ad} style={[styles.dersSatir, i > 0 && styles.dersAyrac]}>
                  <View style={styles.dersUst}>
                    <Text style={styles.dersAd}>{d.ad}</Text>
                    {i === 0 && <View style={styles.zayifPill}><Text style={styles.zayifMetin}>en zayıf</Text></View>}
                    <View style={{ flex: 1 }} />
                    <Text style={styles.dersNet}>
                      {fmtNet(d.net)}
                      <Text style={styles.dersMax}> / {d.max}</Text>
                    </Text>
                  </View>
                  <View style={styles.barYol}>
                    <View style={[styles.barDolu, { width: `${yuzde}%`, backgroundColor: renk }]} />
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.dipnot}>Veriler denemelerinden otomatik hesaplanır.</Text>
        </ScrollView>
      )}
    </View>
  );
}

// ── Özet metrik kartı ──
function MetrikKart({
  etiket,
  deger,
  alt,
  altRenk,
  ikon,
  renk,
}: {
  etiket: string;
  deger: string;
  alt?: string;
  altRenk?: string;
  ikon: keyof typeof Ionicons.glyphMap;
  renk?: string;
}) {
  return (
    <View style={styles.metrikKart}>
      <View style={styles.metrikUst}>
        <Ionicons name={ikon} size={15} color={renk ?? COLORS.primary} />
        <Text style={styles.metrikEtiket}>{etiket}</Text>
      </View>
      <View style={styles.metrikDegerSatir}>
        <Text style={[styles.metrikDeger, renk ? { color: renk } : null]}>{deger}</Text>
        {alt && <Text style={[styles.metrikAlt, altRenk ? { color: altRenk } : null]}>{alt}</Text>}
      </View>
    </View>
  );
}

// ── SVG net trendi çizgi grafiği (responsive: viewBox + width %100) ──
function NetGrafik({ noktalar }: { noktalar: { net: number; etiket: string }[] }) {
  const W = 320;
  const H = 150;
  const P = 28;
  const netler = noktalar.map((n) => n.net);
  const maxY = Math.max(...netler, 1);
  const minY = Math.min(...netler, 0);
  const span = Math.max(1, maxY - minY);
  const n = noktalar.length;
  const x = (i: number) => (n === 1 ? W / 2 : P + (i / (n - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - ((v - minY) / span) * (H - 2 * P);
  const points = noktalar.map((p, i) => `${x(i)},${y(p.net)}`).join(' ');

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 0.5, 1].map((f) => {
        const gy = P + f * (H - 2 * P);
        const val = maxY - f * span;
        return (
          <G key={f}>
            <Line x1={P} y1={gy} x2={W - P} y2={gy} stroke={COLORS.cardBorder} strokeWidth={1} />
            <SvgText x={4} y={gy + 3} fontSize={9} fill={COLORS.textLight}>
              {Math.round(val)}
            </SvgText>
          </G>
        );
      })}
      <Polyline
        points={points}
        fill="none"
        stroke={COLORS.primary}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {noktalar.map((p, i) => (
        <Circle key={i} cx={x(i)} cy={y(p.net)} r={3.2} fill={COLORS.primary} />
      ))}
      {/* Son değer etiketi */}
      <SvgText
        x={x(n - 1)}
        y={y(noktalar[n - 1].net) - 8}
        fontSize={11}
        fontWeight="bold"
        fill={COLORS.primary}
        textAnchor="end"
      >
        {fmtNet(noktalar[n - 1].net)}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  geriBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  baslikMetin: { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },

  merkez: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  bosIkon: {
    width: 76, height: 76, borderRadius: 24, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  bosBaslik: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  bosMetin: { fontSize: 13.5, fontWeight: '500', color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  bosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
    backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14,
  },
  bosBtnMetin: { fontSize: 15, fontWeight: '800', color: '#fff' },

  icerik: { padding: 16, gap: 12 },

  // Metrik grid
  metrikGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metrikKart: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 13, gap: 8,
  },
  metrikUst: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metrikEtiket: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', color: COLORS.textLight },
  metrikDegerSatir: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  metrikDeger: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  metrikAlt: { fontSize: 12.5, fontWeight: '800' },

  bolumBaslik: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase',
    color: COLORS.textLight, marginTop: 8, marginBottom: -2, marginLeft: 2,
  },
  kart: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 14,
  },
  azVeri: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 16 },
  eksenSatir: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 },
  eksenMetin: { fontSize: 10.5, fontWeight: '700', color: COLORS.textLight },

  // Ders barları
  dersSatir: { gap: 6 },
  dersAyrac: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  dersUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dersAd: { fontSize: 13.5, fontWeight: '800', color: COLORS.text },
  dersNet: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  dersMax: { fontSize: 11.5, fontWeight: '700', color: COLORS.textLight },
  zayifPill: { backgroundColor: COLORS.error + '16', borderRadius: 99, paddingVertical: 2, paddingHorizontal: 8 },
  zayifMetin: { fontSize: 9.5, fontWeight: '800', color: COLORS.error, letterSpacing: 0.2 },
  barYol: { height: 8, borderRadius: 99, backgroundColor: COLORS.backgroundSecondary, overflow: 'hidden' },
  barDolu: { height: 8, borderRadius: 99 },

  dipnot: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, textAlign: 'center', marginTop: 4 },
});
