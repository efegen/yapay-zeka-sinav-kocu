// GecmisCekmecesi — soldan kayan geçmiş sohbet çekmecesi (Çözüm A — Tam Ekran Sohbet).
// Devir: koc-altbar-shared.jsx → HistoryDrawer + SohbetSatiri. Backdrop + panel manuel animasyonla.
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { Press } from './Press';
import { Gradyan } from './Gradyan';
import { GOLGE_CTA } from './tokens';
import {
  gecenZaman,
  sohbetBasligi,
  sohbetGorseli,
  sohbetOzeti,
  type Sohbet,
} from '../../services/sohbetService';

interface Props {
  gorunur: boolean;
  gecmis: Sohbet[];
  aktifId: string | null;
  onKapat: () => void;
  onSec: (id: string) => void;
  onYeni: () => void;
  onTumunuTemizle: () => void;
}

export function GecmisCekmecesi({
  gorunur,
  gecmis,
  aktifId,
  onKapat,
  onSec,
  onYeni,
  onTumunuTemizle,
}: Props) {
  const { width } = useWindowDimensions();
  const panelGenislik = Math.round(width * 0.87);
  const ilerle = useRef(new Animated.Value(0)).current;
  const [render, setRender] = useState(false);
  const [temizleOnay, setTemizleOnay] = useState(false);

  useEffect(() => {
    if (gorunur) {
      setRender(true);
      Animated.timing(ilerle, {
        toValue: 1,
        duration: 320,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(ilerle, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setRender(false);
          setTemizleOnay(false);
        }
      });
    }
  }, [gorunur, ilerle]);

  const kaydir = ilerle.interpolate({
    inputRange: [0, 1],
    outputRange: [-(panelGenislik + 48), 0],
  });

  function sec(id: string) {
    onSec(id);
    onKapat();
  }

  return (
    <Modal visible={render} transparent animationType="none" statusBarTranslucent onRequestClose={onKapat}>
      <View style={styles.kap}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: ilerle }]}>
          <Pressable style={styles.backdropDokun} onPress={onKapat} />
        </Animated.View>

        {/* Panel */}
        <Animated.View
          style={[styles.panel, { width: panelGenislik, transform: [{ translateX: kaydir }] }]}
        >
          <View style={styles.panelBaslikSatir}>
            <Text style={styles.panelBaslik}>Sohbetler</Text>
            <Press style={styles.kapatBtn} onPress={onKapat} scale={0.92}>
              <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
            </Press>
          </View>

          {/* Yeni sohbet başlat — gradyan CTA */}
          <View style={styles.ctaKap}>
            <Press
              onPress={() => {
                onYeni();
                onKapat();
              }}
              scale={0.98}
            >
              <Gradyan style={[styles.cta, GOLGE_CTA]}>
                <View style={styles.ctaIkon}>
                  <Ionicons name="add" size={20} color="#fff" />
                </View>
                <Text style={styles.ctaMetin}>Yeni sohbet başlat</Text>
              </Gradyan>
            </Press>
          </View>

          <FlatList
            data={gecmis}
            keyExtractor={(s) => s.id}
            style={styles.liste}
            contentContainerStyle={styles.listeIcerik}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={<Text style={styles.bolumEtiket}>GEÇMİŞ</Text>}
            ListEmptyComponent={
              <View style={styles.bos}>
                <Ionicons name="chatbubbles-outline" size={26} color={COLORS.textLight} />
                <Text style={styles.bosMetin}>Henüz geçmiş sohbet yok.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <SohbetSatiri s={item} aktif={item.id === aktifId} onPress={() => sec(item.id)} />
            )}
            ListFooterComponent={
              gecmis.length ? (
                <Press
                  style={styles.temizle}
                  scale={0.97}
                  onPress={() => {
                    if (temizleOnay) {
                      onTumunuTemizle();
                      setTemizleOnay(false);
                      onKapat();
                    } else {
                      setTemizleOnay(true);
                    }
                  }}
                >
                  <Ionicons
                    name={temizleOnay ? 'alert-circle-outline' : 'trash-outline'}
                    size={15}
                    color={temizleOnay ? COLORS.error : COLORS.textLight}
                  />
                  <Text style={[styles.temizleMetin, temizleOnay && { color: COLORS.error }]}>
                    {temizleOnay ? 'Emin misin? Tüm geçmişi sil' : 'Geçmişi temizle'}
                  </Text>
                </Press>
              ) : null
            }
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

function SohbetSatiri({ s, aktif, onPress }: { s: Sohbet; aktif: boolean; onPress: () => void }) {
  const { ikon, renk } = sohbetGorseli(s);
  return (
    <Press style={[styles.satir, aktif && styles.satirAktif]} scale={0.985} onPress={onPress}>
      <View style={[styles.satirIkon, { backgroundColor: `${renk}1A` }]}>
        <Ionicons name={ikon} size={20} color={renk} />
      </View>
      <View style={styles.satirMetinKap}>
        <View style={styles.satirUst}>
          <Text style={styles.satirBaslik} numberOfLines={1}>
            {sohbetBasligi(s)}
          </Text>
          <Text style={styles.satirZaman}>{gecenZaman(s.guncellendi)}</Text>
        </View>
        <Text style={styles.satirOzet} numberOfLines={1}>
          {sohbetOzeti(s)}
        </Text>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,27,75,0.34)' },
  backdropDokun: { flex: 1 },

  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.background,
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.22,
    shadowRadius: 40,
    shadowOffset: { width: 12, height: 0 },
    elevation: 16,
  },

  panelBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 12,
    paddingLeft: 18,
    paddingRight: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  panelBaslik: { fontSize: 21, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  kapatBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ctaKap: { paddingHorizontal: 14, paddingTop: 14 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 15,
  },
  ctaIkon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaMetin: { fontSize: 14.5, fontWeight: '700', color: '#fff' },

  liste: { flex: 1 },
  listeIcerik: { padding: 14, paddingBottom: 28, gap: 9 },
  bolumEtiket: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },

  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  satirAktif: { backgroundColor: COLORS.primaryLight, borderColor: `${COLORS.primary}33` },
  satirIkon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satirMetinKap: { flex: 1, minWidth: 0 },
  satirUst: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  satirBaslik: { flex: 1, fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  satirZaman: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight },
  satirOzet: { fontSize: 12.5, fontWeight: '500', color: COLORS.textSecondary, marginTop: 2 },

  bos: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  bosMetin: { fontSize: 13, color: COLORS.textLight, fontWeight: '500' },

  temizle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
  },
  temizleMetin: { fontSize: 12.5, fontWeight: '600', color: COLORS.textLight },
});
