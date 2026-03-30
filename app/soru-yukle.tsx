import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/colors';

type Adim = 'bos' | 'yukleniyor' | 'basarili' | 'bulanik' | 'alakasiz';

const SAHTE_SONUC: Adim[] = ['basarili', 'bulanik', 'alakasiz'];

function rastgeleSonuc(): Adim {
  return SAHTE_SONUC[Math.floor(Math.random() * SAHTE_SONUC.length)];
}

export default function SoruYukle() {
  const router = useRouter();
  const [adim, setAdim] = useState<Adim>('bos');
  const [gorselUri, setGorselUri] = useState<string | null>(null);
  const [snackbarMesaj, setSnackbarMesaj] = useState('');

  const spinAnim = useRef(new Animated.Value(0)).current;
  const ilerlemeAnim = useRef(new Animated.Value(0)).current;
  const snackbarAnim = useRef(new Animated.Value(0)).current;
  const sonucAnim = useRef(new Animated.Value(0)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Spinner animasyonu
  useEffect(() => {
    if (adim === 'yukleniyor') {
      spinLoopRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinLoopRef.current.start();
      Animated.timing(ilerlemeAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    } else {
      spinLoopRef.current?.stop();
      spinAnim.setValue(0);
      ilerlemeAnim.setValue(0);
    }
    return () => { spinLoopRef.current?.stop(); };
  }, [adim]);

  function snackbarGoster(mesaj: string) {
    setSnackbarMesaj(mesaj);
    snackbarAnim.setValue(0);
    Animated.sequence([
      Animated.timing(snackbarAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(snackbarAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  function sonucGoster(s: Adim) {
    setAdim(s);
    if (s === 'basarili') {
      sonucAnim.setValue(0);
      Animated.timing(sonucAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (s === 'bulanik') {
      snackbarGoster('Görsel net değil, lütfen tekrar çekiniz.');
    } else {
      snackbarGoster('Bu görselde soru bulunamadı.');
    }
  }

  async function gorselSec(kaynak: 'kamera' | 'galeri') {
    const izin = kaynak === 'kamera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!izin.granted) {
      snackbarGoster('İzin verilmedi. Lütfen ayarlardan izin ver.');
      return;
    }

    const sonuc = kaynak === 'kamera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (sonuc.canceled) return;

    const uri = sonuc.assets[0].uri;
    setGorselUri(uri);
    setAdim('yukleniyor');

    setTimeout(() => {
      sonucGoster(rastgeleSonuc());
    }, 4000);
  }

  function sifirla() {
    setAdim('bos');
    setGorselUri(null);
    sonucAnim.setValue(0);
  }

  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ilerlemeGenislik = ilerlemeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.ekran}>
      {/* Başlık */}
      <View style={styles.baslik}>
        <TouchableOpacity style={styles.geriBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.baslikMetin}>Soru Yükle</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.icerik} showsVerticalScrollIndicator={false}>

        {/* Görsel alanı */}
        <View style={styles.gorselKart}>
          {gorselUri ? (
            <Image source={{ uri: gorselUri }} style={styles.onizleme} resizeMode="contain" />
          ) : (
            <View style={styles.bosGorsel}>
              <Ionicons name="image-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.bosGorselMetin}>Henüz görsel seçilmedi</Text>
              <Text style={styles.bosGorselAlt}>Kamera veya galeri kullanarak{'\n'}soru fotoğrafı ekle</Text>
            </View>
          )}
        </View>

        {/* Yükleniyor durumu */}
        {adim === 'yukleniyor' && (
          <View style={styles.yukleniyorAlani}>
            <View style={styles.spinnerSarici}>
              <View style={styles.spinnerArka} />
              <Animated.View style={[styles.spinnerOn, { transform: [{ rotate: spinRotate }] }]}>
                <View style={styles.spinnerKol} />
              </Animated.View>
              <View style={styles.spinnerMerkez}>
                <Ionicons name="scan-outline" size={22} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.yukleniyorMetin}>Soru analiz ediliyor…</Text>
            <View style={styles.progressArka}>
              <Animated.View style={[styles.progressOn, { width: ilerlemeGenislik }]} />
            </View>
            <Text style={styles.progressEtiket}>OCR işleniyor</Text>
          </View>
        )}

        {/* Başarılı sonuç */}
        {adim === 'basarili' && (
          <Animated.View style={[styles.sonucKart, { opacity: sonucAnim, transform: [{ translateY: sonucAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
            <View style={styles.sonucBaslik}>
              <View style={styles.basariBadge}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                <Text style={styles.basariMetin}>Çözüm Oluşturuldu</Text>
              </View>
              <View style={styles.konuBadge}>
                <Text style={styles.konuMetin}>Türev</Text>
              </View>
            </View>

            <View style={styles.ayirici} />

            <Text style={styles.ocrEtiket}>Tespit Edilen Soru</Text>
            <Text style={styles.ocrMetin}>f(x) = x² fonksiyonunun türevini bulunuz.</Text>

            <View style={styles.ayirici} />

            <Text style={styles.cozumEtiket}>Çözüm</Text>
            <Text style={styles.cozumMetin}>
              f(x) = x² için türev kuralı uygulanır:{'\n\n'}
              {'   '}f′(x) = 2·x²⁻¹ = <Text style={styles.vurgu}>2x</Text>
            </Text>

            <TouchableOpacity style={styles.tekrarBtn} onPress={sifirla} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
              <Text style={styles.tekrarMetin}>Yeni Soru Yükle</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Hatalı sonuç sonrası tekrar butonu */}
        {(adim === 'bulanik' || adim === 'alakasiz') && (
          <View style={styles.hataSonrasiAlani}>
            <View style={styles.hataBadge}>
              <Ionicons name="alert-circle-outline" size={20} color={COLORS.error} />
              <Text style={styles.hataMetin}>
                {adim === 'bulanik' ? 'Görsel okunamadı' : 'Soru bulunamadı'}
              </Text>
            </View>
            <TouchableOpacity style={styles.tekrarBtn} onPress={sifirla} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
              <Text style={styles.tekrarMetin}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Kaynak seçim butonları — sadece bos veya hata durumunda */}
        {(adim === 'bos' || adim === 'bulanik' || adim === 'alakasiz') && (
          <View style={styles.kaynakRow}>
            <TouchableOpacity style={styles.kaynakBtn} onPress={() => gorselSec('kamera')} activeOpacity={0.8}>
              <View style={styles.kaynakIkon}>
                <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.kaynakMetin}>Kamera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.kaynakBtn} onPress={() => gorselSec('galeri')} activeOpacity={0.8}>
              <View style={styles.kaynakIkon}>
                <Ionicons name="images-outline" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.kaynakMetin}>Galeri</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Snackbar */}
      <Animated.View
        style={[
          styles.snackbar,
          {
            opacity: snackbarAnim,
            transform: [{ translateY: snackbarAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="alert-circle-outline" size={18} color={COLORS.white} />
        <Text style={styles.snackbarMetin}>{snackbarMesaj}</Text>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.background,
  },
  geriBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  baslikMetin: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  icerik: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  gorselKart: {
    backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    overflow: 'hidden', minHeight: 220,
    justifyContent: 'center', alignItems: 'center',
  },
  onizleme: { width: '100%', height: 280 },
  bosGorsel: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  bosGorselMetin: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  bosGorselAlt: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', lineHeight: 18 },

  kaynakRow: { flexDirection: 'row', gap: 12 },
  kaynakBtn: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingVertical: 16, alignItems: 'center', gap: 8,
  },
  kaynakIkon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  kaynakMetin: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  yukleniyorAlani: { alignItems: 'center', gap: 16, paddingVertical: 8 },
  spinnerSarici: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  spinnerArka: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    borderWidth: 5, borderColor: COLORS.primaryLight,
  },
  spinnerOn: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
  },
  spinnerKol: {
    position: 'absolute', top: -3, left: 35,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  spinnerMerkez: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  yukleniyorMetin: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  progressArka: {
    width: '70%', height: 4, borderRadius: 2,
    backgroundColor: COLORS.primaryLight, overflow: 'hidden',
  },
  progressOn: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
  progressEtiket: { fontSize: 12, color: COLORS.textLight },

  sonucKart: {
    backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 18, gap: 0,
  },
  sonucBaslik: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  basariBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  basariMetin: { fontSize: 14, fontWeight: '700', color: COLORS.success },
  konuBadge: {
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  konuMetin: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  ayirici: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 12 },
  ocrEtiket: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  ocrMetin: { fontSize: 15, fontWeight: '600', color: COLORS.text, fontStyle: 'italic' },
  cozumEtiket: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  cozumMetin: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  vurgu: { color: COLORS.primary, fontWeight: '700' },

  tekrarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 14, height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  tekrarMetin: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  hataSonrasiAlani: { gap: 12 },
  hataBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12,
    borderWidth: 1, borderColor: '#FECACA',
    padding: 14,
  },
  hataMetin: { fontSize: 14, fontWeight: '600', color: COLORS.error },

  snackbar: {
    position: 'absolute', bottom: 28, left: 20, right: 20,
    backgroundColor: COLORS.text,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  snackbarMetin: { flex: 1, fontSize: 13, color: COLORS.white, lineHeight: 18 },
});
