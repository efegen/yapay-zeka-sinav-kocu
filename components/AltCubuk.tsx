// AltCubuk — yüzen hap biçiminde alt sekme çubuğu.
// Kenarlardan boşluklu (floating) bir hap; ortadaki AI Koç sekmesi yukarı taşan
// gradyan kapsül olarak hiyerarşide öne çıkar.
import { useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS } from '../constants/colors';
import { GRADYAN, GRADYAN_BASLANGIC, GRADYAN_BITIS } from './koc/tokens';

type IoniconsAdi = React.ComponentProps<typeof Ionicons>['name'];

// Çubuk yüzen (absolute) olduğundan içeriğin üstüne biner. Ekranlar, son içeriğin
// çubuğun arkasında kalıcı olarak gizlenmemesi için alt boşluklarına bunu (+ güvenli
// alan) ekler. Hap yüksekliği + nefes payı.
export const ALT_CUBUK_BOSLUK = 104;

interface SekmeTanim {
  ad: string; // expo-router rota adı
  etiket: string;
  ikon: IoniconsAdi; // pasif (çizgisel)
  ikonAktif: IoniconsAdi; // aktif (dolu)
  koc?: boolean;
}

// Sıra: Ana Sayfa · Takvim · AI Koç (merkez, vurgulu) · Denemeler · Profil
const SEKMELER: SekmeTanim[] = [
  { ad: 'index', etiket: 'Ana Sayfa', ikon: 'home-outline', ikonAktif: 'home' },
  { ad: 'takvim', etiket: 'Takvim', ikon: 'calendar-outline', ikonAktif: 'calendar' },
  { ad: 'ai-koc', etiket: 'AI Koç', ikon: 'sparkles', ikonAktif: 'sparkles', koc: true },
  { ad: 'denemeler', etiket: 'Denemeler', ikon: 'clipboard-outline', ikonAktif: 'clipboard' },
  { ad: 'profil', etiket: 'Profil', ikon: 'person-outline', ikonAktif: 'person' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Opak zemin: saydam pil koyu/yoğun içerik üzerinde okunmuyordu (blur native'de yok,
// liquid glass Expo Go'da çalışmıyor). Çubuk yine içeriğin üstünde YÜZER, ama pil tam
// opak beyaz → sekmeler her zeminde net okunur. Yüzen görünümü gölge + kenar verir.
const hapZemin = { backgroundColor: COLORS.card };

function Sekme({
  tanim,
  aktif,
  onPress,
}: {
  tanim: SekmeTanim;
  aktif: boolean;
  onPress: () => void;
}) {
  const olcek = useRef(new Animated.Value(1)).current;
  const hedef = tanim.koc ? 0.94 : 0.9;
  const bas = () =>
    Animated.timing(olcek, { toValue: hedef, duration: 90, useNativeDriver: true }).start();
  const birak = () =>
    Animated.timing(olcek, { toValue: 1, duration: 160, useNativeDriver: true }).start();

  if (tanim.koc) {
    return (
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityState={{ selected: aktif }}
        accessibilityLabel={tanim.etiket}
        onPress={onPress}
        onPressIn={bas}
        onPressOut={birak}
        style={[styles.kocSekme, { transform: [{ scale: olcek }] }]}
      >
        <LinearGradient
          colors={GRADYAN}
          start={GRADYAN_BASLANGIC}
          end={GRADYAN_BITIS}
          style={[styles.kocKapsul, { shadowOpacity: aktif ? 0.42 : 0.3 }]}
        >
          <Ionicons name="sparkles" size={24} color="#fff" />
          <Text style={styles.kocEtiket}>{tanim.etiket}</Text>
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  const renk = aktif ? COLORS.primary : COLORS.textLight;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
      accessibilityLabel={tanim.etiket}
      onPress={onPress}
      onPressIn={bas}
      onPressOut={birak}
      style={[styles.sekme, { transform: [{ scale: olcek }] }]}
    >
      <Ionicons name={aktif ? tanim.ikonAktif : tanim.ikon} size={23} color={renk} />
      <Text style={[styles.etiket, { color: renk, fontWeight: aktif ? '700' : '500' }]}>
        {tanim.etiket}
      </Text>
    </AnimatedPressable>
  );
}

export function AltCubuk({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Tam ekran sohbet (AI Koç) açıkken çubuğu tamamen gizle.
  const odakliRota = state.routes[state.index];
  const odakliSecenek = descriptors[odakliRota.key]?.options;
  if ((odakliSecenek?.tabBarStyle as { display?: string } | undefined)?.display === 'none') {
    return null;
  }

  return (
    // box-none: pilin dışındaki şeffaf boşluk dokunuşları yakalamaz → arkadaki
    // içerik (çubuğun yanlarındaki/üstündeki alan) tıklanabilir kalır.
    <View pointerEvents="box-none" style={[styles.disSarmal, { paddingBottom: insets.bottom || 22 }]}>
      <View style={[styles.hap, hapZemin]}>
        {SEKMELER.map((tanim) => {
          const rota = state.routes.find((r) => r.name === tanim.ad);
          if (!rota) return null;
          const aktif = state.index === state.routes.indexOf(rota);

          const sec = () => {
            const olay = navigation.emit({
              type: 'tabPress',
              target: rota.key,
              canPreventDefault: true,
            });
            if (!aktif && !olay.defaultPrevented) {
              navigation.navigate(rota.name, rota.params);
            }
          };

          return <Sekme key={tanim.ad} tanim={tanim} aktif={aktif} onPress={sec} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disSarmal: {
    // Yüzen: içeriğin üstüne biner (frosted-glass için içerik arkadan geçer).
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingTop: 16, // yukarı taşan koç kapsülüne nefes alanı (kırpılmayı önler)
  },
  hap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 9,
    paddingHorizontal: 8,
    // hap gölgesi
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  sekme: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  etiket: {
    fontSize: 10,
    marginTop: 4,
  },
  kocSekme: {
    flex: 1.15,
    marginTop: -14, // hapın dışına yukarı taş
    marginHorizontal: 4,
  },
  kocKapsul: {
    alignItems: 'center',
    borderRadius: 20,
    paddingTop: 12,
    paddingBottom: 9,
    paddingHorizontal: 4,
    // koç gölgesi (opacity aktif/pasif duruma göre ayarlanır)
    shadowColor: COLORS.primary,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  kocEtiket: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
  },
});
