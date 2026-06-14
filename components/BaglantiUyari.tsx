// Çevrimdışı/yeniden-bağlandı üst şeridi (akış içinde; içeriği aşağı kaydırır).
// Çevrimdışıyken kalıcı nötr bir bilgi şeridi; bağlantı dönünce ~3 sn'lik yeşil bildirim.
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useBaglanti } from '../hooks/useBaglanti';

// Durum çubuğu güvenli üst boşluğu (SafeAreaProvider'a bağlı kalmadan).
const UST_GUVENLI = (Platform.select({
  android: StatusBar.currentHeight ?? 24,
  ios: 44,
  default: 0,
}) ?? 0) as number;

export function BaglantiUyari() {
  const cevrimdisi = useBaglanti();
  const [yenidenBaglandi, setYenidenBaglandi] = useState(false);
  const oncekiRef = useRef(cevrimdisi);

  useEffect(() => {
    const onceki = oncekiRef.current;
    oncekiRef.current = cevrimdisi;
    // Çevrimdışı → çevrimiçi geçişinde kısa bir "bağlantı kuruldu" bildirimi göster.
    if (onceki && !cevrimdisi) {
      setYenidenBaglandi(true);
      const t = setTimeout(() => setYenidenBaglandi(false), 3000);
      return () => clearTimeout(t);
    }
  }, [cevrimdisi]);

  if (cevrimdisi) {
    return (
      <View style={[styles.bar, styles.cevrimdisi]}>
        <Ionicons name="cloud-offline-outline" size={15} color="#fff" />
        <Text style={styles.metin}>
          Çevrimdışısın — bazı özellikler kullanılamayabilir. Kaydettiğin son veriler görünmeye devam eder.
        </Text>
      </View>
    );
  }

  if (yenidenBaglandi) {
    return (
      <View style={[styles.bar, styles.online]}>
        <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
        <Text style={styles.metin}>Bağlantı yeniden kuruldu</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: UST_GUVENLI + 8, paddingBottom: 8, paddingHorizontal: 16,
  },
  cevrimdisi: { backgroundColor: '#475569' }, // nötr slate — alarm değil, bilgi
  online: { backgroundColor: COLORS.success },
  metin: { flex: 1, color: '#fff', fontSize: 12.5, fontWeight: '700' },
});
