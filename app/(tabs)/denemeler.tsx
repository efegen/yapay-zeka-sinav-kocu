import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { ALT_CUBUK_BOSLUK } from '../../components/AltCubuk';
import { auth } from '../../services/firebaseConfig';
import { denemeleriGetir, denemeSil } from '../../services/firestoreService';
import { bildir } from '../../utils/bildirim';
import { fmtNet, fmtDelta, tarihKisa, type DenemeSonuc } from '../../models/deneme';

const KAPSAM_ETIKET: Record<DenemeSonuc['kapsam'], string> = {
  tyt: 'Sadece TYT',
  ayt: 'Sadece AYT',
  ikisi: 'TYT + AYT',
};

export default function Denemeler() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = auth.currentUser?.uid;
  const [denemeler, setDenemeler] = useState<DenemeSonuc[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

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
      yukle();
    }, [yukle])
  );

  function silOnay(d: DenemeSonuc) {
    bildir('Denemeyi Sil', `"${d.ad}" denemesini silmek istediğine emin misin?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          if (!uid) return;
          try {
            await denemeSil(uid, d.id);
            yukle();
          } catch (err) {
            console.error('[Denemeler] silme hatası:', err);
          }
        },
      },
    ]);
  }

  // En iyi toplam net (kıyas çubuğu için).
  const enIyi = denemeler.reduce((m, d) => Math.max(m, d.toplamNet), 0);

  return (
    <View style={styles.ekran}>
      <View style={styles.baslik}>
        <Text style={styles.baslikMetin}>Denemeler</Text>
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
            Çözdüğün denemenin doğru/yanlışlarını gir; net, boş ve hedefe kalan otomatik hesaplansın.
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
        <ScrollView contentContainerStyle={[styles.liste, { paddingBottom: insets.bottom + ALT_CUBUK_BOSLUK }]} showsVerticalScrollIndicator={false}>
          {denemeler.map((d, i) => {
            // Listede en yeni önce; "önceki" = bir sonraki eleman (daha eski).
            const onceki = denemeler[i + 1];
            const delta = onceki ? d.toplamNet - onceki.toplamNet : null;
            const oran = enIyi > 0 ? d.toplamNet / enIyi : 0;
            return (
              <TouchableOpacity
                key={d.id}
                activeOpacity={0.85}
                onLongPress={() => silOnay(d)}
                style={styles.kart}
              >
                <View style={styles.kartUst}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.kartAd} numberOfLines={1}>{d.ad}</Text>
                    <Text style={styles.kartMeta}>
                      {tarihKisa(d.tarih.toDate())} · {KAPSAM_ETIKET[d.kapsam]}
                      {d.sure ? ` · ${d.sure} dk` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.kartNet}>{fmtNet(d.toplamNet)}</Text>
                    <Text style={styles.kartNetEtiket}>NET</Text>
                  </View>
                </View>

                <View style={styles.barArka}>
                  <View style={[styles.barOn, { width: `${Math.round(oran * 100)}%` }]} />
                </View>

                <View style={styles.kartAlt}>
                  <View style={styles.rozetGrup}>
                    {d.kapsam !== 'ayt' && (
                      <View style={[styles.rozet, { backgroundColor: COLORS.primary + '14' }]}>
                        <Text style={[styles.rozetMetin, { color: COLORS.primary }]}>TYT {fmtNet(d.tytNet)}</Text>
                      </View>
                    )}
                    {d.kapsam !== 'tyt' && (
                      <View style={[styles.rozet, { backgroundColor: COLORS.accent + '14' }]}>
                        <Text style={[styles.rozetMetin, { color: COLORS.accent }]}>AYT {fmtNet(d.aytNet)}</Text>
                      </View>
                    )}
                  </View>
                  {delta != null && (
                    <View style={styles.deltaGrup}>
                      <Ionicons
                        name={delta >= 0 ? 'trending-up' : 'trending-down'}
                        size={13}
                        color={delta >= 0 ? COLORS.success : COLORS.error}
                      />
                      <Text style={[styles.deltaMetin, { color: delta >= 0 ? COLORS.success : COLORS.error }]}>
                        {fmtDelta(delta)}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.ipucu}>Silmek için bir denemeye basılı tut.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
  },
  baslikMetin: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
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

  liste: { padding: 16, paddingBottom: 32, gap: 12 },
  kart: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 16, gap: 12,
  },
  kartUst: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kartAd: { fontSize: 15.5, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  kartMeta: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight, marginTop: 2 },
  kartNet: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.8, lineHeight: 26 },
  kartNetEtiket: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: COLORS.textLight },

  barArka: { height: 6, borderRadius: 3, backgroundColor: COLORS.backgroundSecondary, overflow: 'hidden' },
  barOn: { height: 6, borderRadius: 3, backgroundColor: COLORS.primary },

  kartAlt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rozetGrup: { flexDirection: 'row', gap: 6 },
  rozet: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9 },
  rozetMetin: { fontSize: 12, fontWeight: '800' },
  deltaGrup: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  deltaMetin: { fontSize: 12.5, fontWeight: '800' },

  ipucu: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight, textAlign: 'center', marginTop: 4 },
});
