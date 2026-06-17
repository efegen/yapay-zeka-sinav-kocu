import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { ALT_CUBUK_BOSLUK } from '../../components/AltCubuk';
import { auth } from '../../services/firebaseConfig';
import { denemeleriGetir, denemeSil } from '../../services/firestoreService';
import { netlerdenSiralama } from '../../services/yokatlasService';
import { useProfile } from '../../hooks/useProfile';
import { fmtNet, fmtSira, tarihKisa, type DenemeSonuc } from '../../models/deneme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const KAPSAM_ETIKET: Record<DenemeSonuc['kapsam'], string> = {
  tyt: 'Sadece TYT',
  ayt: 'Sadece AYT',
  ikisi: 'TYT + AYT',
};

export default function Denemeler() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profil } = useProfile();
  const diploma = profil?.diplomaNotu ?? 0;
  const uid = auth.currentUser?.uid;
  const [denemeler, setDenemeler] = useState<DenemeSonuc[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [silOnayId, setSilOnayId] = useState<string | null>(null);

  const yukle = useCallback(() => {
    if (!uid) {
      setYukleniyor(false);
      return;
    }
    denemeleriGetir(uid)
      .then(setDenemeler)
      .catch((err) => console.error('[Denemeler] yükleme hatası:', err))
      .finally(() => setYukleniyor(false));
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      setSilOnayId(null);
      yukle();
    }, [yukle])
  );

  // Silme onayını kart içinde aç/kapat (basılı tutmaya gerek yok).
  function onayDegistir(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSilOnayId((cur) => (cur === id ? null : id));
  }

  async function sil(d: DenemeSonuc) {
    if (!uid) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSilOnayId(null);
    // İyimser kaldır: liste anında güncellensin, hata olursa geri yükle.
    setDenemeler((list) => list.filter((x) => x.id !== d.id));
    try {
      await denemeSil(uid, d.id);
    } catch (err) {
      console.error('[Denemeler] silme hatası:', err);
      yukle();
    }
  }

  function duzenle(d: DenemeSonuc) {
    router.push({ pathname: '/deneme-ekle', params: { id: d.id } });
  }

  function analizEt(d: DenemeSonuc) {
    router.push({ pathname: '/hata-analiz', params: { id: d.id } });
  }

  // Her deneme için tahmini sıralama. Sıralama yalnız tam TYT+AYT denemelerinde
  // anlamlı (puan türü sıralaması iki föyü de gerektirir). Puan türü denemenin
  // kendi alanından, OBP ise profildeki diploma notundan gelir.
  const siralamalar = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const d of denemeler) {
      m[d.id] = d.kapsam === 'ikisi' ? netlerdenSiralama(d.tytNet, d.aytNet, d.alan, diploma) : null;
    }
    return m;
  }, [denemeler, diploma]);

  // En iyi (en düşük) tahmini sıralama — başlık özeti için.
  const gecerliSiralar = Object.values(siralamalar).filter((s): s is number => s != null);
  const enIyiSira = gecerliSiralar.length ? Math.min(...gecerliSiralar) : null;

  return (
    <View style={styles.ekran}>
      <View style={styles.baslik}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.baslikMetin}>Denemeler</Text>
          {denemeler.length > 0 && (
            <Text style={styles.baslikAlt}>
              {denemeler.length} deneme
              {enIyiSira != null && (
                <>
                  {' · en iyi '}
                  <Text style={styles.baslikAltVurgu}>≈{fmtSira(enIyiSira)}</Text>
                </>
              )}
            </Text>
          )}
        </View>
        <View style={styles.baslikSagBtnler}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.istatistikBtn}
            onPress={() => router.push('/istatistik')}
          >
            <Ionicons name="bar-chart-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/deneme-ekle')}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.yeniBtn}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.yeniMetin}>Yeni</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {yukleniyor ? (
        <View style={styles.merkez}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : denemeler.length === 0 ? (
        <View style={styles.bosAlan}>
          <View style={styles.bosIkon}>
            <Ionicons name="clipboard-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.bosBaslik}>Henüz deneme yok</Text>
          <Text style={styles.bosAlt}>
            Çözdüğün denemenin doğru/yanlışlarını gir; net ve tahmini sıralaman otomatik hesaplansın.
          </Text>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/deneme-ekle')} style={{ marginTop: 4 }}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bosBtn}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.bosBtnMetin}>İlk denemeni ekle</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.liste, { paddingBottom: insets.bottom + ALT_CUBUK_BOSLUK }]}
          showsVerticalScrollIndicator={false}
        >
          {denemeler.map((d) => {
            if (silOnayId === d.id) {
              return (
                <View key={d.id} style={[styles.kart, styles.kartOnay]}>
                  <Text style={styles.onaySoru}>
                    <Text style={styles.onaySoruAd}>“{d.ad}”</Text> silinsin mi?
                  </Text>
                  <View style={styles.onayBtnSatir}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.onayBtn, styles.onayVazgec]}
                      onPress={() => onayDegistir(d.id)}
                    >
                      <Text style={styles.onayVazgecMetin}>Vazgeç</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.onayBtn, styles.onaySil]}
                      onPress={() => sil(d)}
                    >
                      <Text style={styles.onaySilMetin}>Sil</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            return (
              <View key={d.id} style={styles.kart}>
                <View style={styles.bilgi}>
                  <Text style={styles.kartAd} numberOfLines={1}>{d.ad}</Text>
                  <Text style={styles.kartMeta} numberOfLines={1}>
                    {tarihKisa(d.tarih.toDate())} · {KAPSAM_ETIKET[d.kapsam]}
                    {d.sure ? ` · ${d.sure} dk` : ''}
                  </Text>
                  <View style={styles.netSatir}>
                    {d.kapsam !== 'ayt' && (
                      <View style={styles.netParca}>
                        <Text style={styles.netEtiket}>TYT NET</Text>
                        <Text style={styles.netDeger}>{fmtNet(d.tytNet)}</Text>
                      </View>
                    )}
                    {d.kapsam === 'ikisi' && <View style={styles.netAyirac} />}
                    {d.kapsam !== 'tyt' && (
                      <View style={styles.netParca}>
                        <Text style={styles.netEtiket}>AYT NET</Text>
                        <Text style={styles.netDeger}>{fmtNet(d.aytNet)}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.sira}>
                  <Text style={styles.siraEtiket} numberOfLines={1}>Tahmini sıralama</Text>
                  {siralamalar[d.id] != null ? (
                    <Text style={styles.siraDeger}>
                      <Text style={styles.siraYaklasik}>≈</Text>
                      {fmtSira(siralamalar[d.id]!)}
                    </Text>
                  ) : (
                    <Text style={[styles.siraDeger, styles.siraYok]}>—</Text>
                  )}
                </View>

                <View style={styles.kontrol}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.icoBtn, styles.icoBtnAnaliz]}
                    onPress={() => analizEt(d)}
                  >
                    <Ionicons
                      name={d.hataAnalizi ? 'analytics' : 'analytics-outline'}
                      size={18}
                      color={COLORS.accent}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} style={styles.icoBtn} onPress={() => duzenle(d)}>
                    <Ionicons name="create-outline" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.icoBtn, styles.icoBtnSil]}
                    onPress={() => onayDegistir(d.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <Text style={styles.ipucu}>Sağdaki ikonlarla düzenle veya sil.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
  },
  baslikMetin: { fontSize: 25, fontWeight: '800', color: COLORS.text, letterSpacing: -0.6 },
  baslikAlt: { fontSize: 11.5, fontWeight: '700', color: COLORS.textLight, marginTop: 3 },
  baslikAltVurgu: { color: COLORS.primary, fontWeight: '800' },
  baslikSagBtnler: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  istatistikBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary + '33',
    justifyContent: 'center', alignItems: 'center',
  },
  yeniBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 9, paddingLeft: 12, paddingRight: 14, borderRadius: 12,
  },
  yeniMetin: { fontSize: 14, fontWeight: '800', color: '#fff' },

  merkez: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  bosAlan: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  bosIkon: {
    width: 76, height: 76, borderRadius: 24, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  bosBaslik: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  bosAlt: { fontSize: 13.5, fontWeight: '500', color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  bosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 13, paddingHorizontal: 22, borderRadius: 14,
  },
  bosBtnMetin: { fontSize: 15, fontWeight: '800', color: '#fff' },

  liste: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },

  // ── Sade kompakt kart: net solda, tahmini sıralama sağ üstte, ikonlar sağda ──
  kart: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingVertical: 13, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: COLORS.ink, shadowOpacity: 0.09, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2,
  },
  bilgi: { flex: 1, minWidth: 0 },
  kartAd: { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  kartMeta: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, marginTop: 3 },

  // ── TYT / AYT netleri ayrı ayrı (kapsam'a göre tek ya da çift kolon) ──
  netSatir: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  netParca: { minWidth: 0 },
  netEtiket: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: COLORS.textLight },
  netDeger: { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, marginTop: 2, fontVariant: ['tabular-nums'] },
  netAyirac: { width: 1, alignSelf: 'stretch', marginVertical: 2, backgroundColor: COLORS.cardBorder },

  sira: { flexShrink: 0, alignItems: 'flex-end', alignSelf: 'flex-start' },
  siraEtiket: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: COLORS.textLight },
  siraDeger: { fontSize: 19, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5, marginTop: 2, fontVariant: ['tabular-nums'] },
  siraYaklasik: { color: COLORS.textLight, fontWeight: '700' },
  siraYok: { color: COLORS.textLight },

  kontrol: { flexShrink: 0, flexDirection: 'column', gap: 7 },
  icoBtn: {
    width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: COLORS.cardBorder,
    backgroundColor: '#FBFBFE', justifyContent: 'center', alignItems: 'center',
  },
  icoBtnSil: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  icoBtnAnaliz: { borderColor: COLORS.accent + '55', backgroundColor: COLORS.accent + '10' },

  // ── Silme onayı (kart içi) ──
  kartOnay: {
    flexDirection: 'column', alignItems: 'stretch', gap: 11,
    backgroundColor: '#FFF7F7', borderColor: '#FBD5D5',
  },
  onaySoru: { fontSize: 13.5, fontWeight: '700', color: '#B91C1C', textAlign: 'center' },
  onaySoruAd: { fontWeight: '800' },
  onayBtnSatir: { flexDirection: 'row', gap: 9 },
  onayBtn: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: 'center' },
  onayVazgec: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.cardBorder },
  onayVazgecMetin: { fontSize: 13.5, fontWeight: '800', color: COLORS.textSecondary },
  onaySil: { backgroundColor: COLORS.error },
  onaySilMetin: { fontSize: 13.5, fontWeight: '800', color: '#fff' },

  ipucu: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight, textAlign: 'center', marginTop: 6 },
});
