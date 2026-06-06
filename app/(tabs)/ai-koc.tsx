import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../services/firebaseConfig';
import { useProfile } from '../../hooks/useProfile';
import { COLORS } from '../../constants/colors';
import {
  kocaSor,
  baglamKur,
  AiHatasi,
  type SohbetMesaji,
} from '../../services/aiService';

interface Balon extends SohbetMesaji {
  id: string;
  hatali?: boolean;
}

const ONERILER = [
  'Bu hafta neye odaklanmalıyım?',
  'Limit konusunu nasıl çalışırım?',
  'Motivasyonum düştü, ne yapmalıyım?',
  'Bana bir Pomodoro planı kur',
];

function gecmisAnahtari(uid: string) {
  return `aikoc_gecmis_${uid}`;
}

export default function AiKoc() {
  const router = useRouter();
  const { profil } = useProfile();
  const uid = auth.currentUser?.uid;

  const [mesajlar, setMesajlar] = useState<Balon[]>([]);
  const [girdi, setGirdi] = useState('');
  const [yaziyor, setYaziyor] = useState(false);
  const listeRef = useRef<FlatList<Balon>>(null);

  // ── Geçmişi yükle ──
  useEffect(() => {
    if (!uid) return;
    AsyncStorage.getItem(gecmisAnahtari(uid))
      .then((kayit) => {
        if (kayit) setMesajlar(JSON.parse(kayit));
      })
      .catch(() => {});
  }, [uid]);

  // ── Geçmişi kaydet (her değişimde) ──
  useEffect(() => {
    if (!uid) return;
    AsyncStorage.setItem(gecmisAnahtari(uid), JSON.stringify(mesajlar)).catch(() => {});
  }, [mesajlar, uid]);

  function asagiKaydir() {
    requestAnimationFrame(() => listeRef.current?.scrollToEnd({ animated: true }));
  }

  async function gonder(metin: string) {
    const temiz = metin.trim();
    if (!temiz || yaziyor) return;
    Keyboard.dismiss();
    setGirdi('');

    const kullaniciBalon: Balon = { id: `${Date.now()}-k`, rol: 'kullanici', metin: temiz };
    const sonraki = [...mesajlar.filter((m) => !m.hatali), kullaniciBalon];
    setMesajlar(sonraki);
    setYaziyor(true);
    asagiKaydir();

    try {
      const yanit = await kocaSor(
        sonraki.map(({ rol, metin }) => ({ rol, metin })),
        baglamKur(profil)
      );
      setMesajlar((m) => [...m, { id: `${Date.now()}-a`, rol: 'asistan', metin: yanit }]);
    } catch (e) {
      const mesaj =
        e instanceof AiHatasi ? e.message : 'Beklenmeyen bir hata oluştu.';
      setMesajlar((m) => [...m, { id: `${Date.now()}-h`, rol: 'asistan', metin: mesaj, hatali: true }]);
    } finally {
      setYaziyor(false);
      asagiKaydir();
    }
  }

  function tekrarDene() {
    // Son kullanıcı mesajını bulup yeniden gönder.
    const sonKullanici = [...mesajlar].reverse().find((m) => m.rol === 'kullanici');
    if (sonKullanici) {
      setMesajlar((m) => m.filter((x) => !x.hatali));
      gonder(sonKullanici.metin);
    }
  }

  function gecmisiTemizle() {
    setMesajlar([]);
  }

  const bos = mesajlar.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.ekran}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Başlık */}
      <View style={styles.baslik}>
        <View style={styles.baslikSol}>
          <View style={styles.baslikIkon}>
            <Ionicons name="sparkles" size={16} color="#fff" />
          </View>
          <View>
            <Text style={styles.baslikMetin}>AI Koç</Text>
            <Text style={styles.baslikAlt}>{yaziyor ? 'yazıyor…' : 'çevrimiçi'}</Text>
          </View>
        </View>
        <View style={styles.baslikSag}>
          <TouchableOpacity
            style={styles.baslikBtn}
            onPress={() => router.push('/soru-yukle' as any)}
            hitSlop={8}
          >
            <Ionicons name="camera-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          {!bos && (
            <TouchableOpacity style={styles.baslikBtn} onPress={gecmisiTemizle} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mesajlar */}
      {bos ? (
        <View style={styles.karsilama}>
          <View style={styles.karsilamaIkon}>
            <Ionicons name="sparkles" size={30} color={COLORS.primary} />
          </View>
          <Text style={styles.karsilamaBaslik}>
            Merhaba{profil?.isim ? `, ${profil.isim.split(' ')[0]}` : ''} 👋
          </Text>
          <Text style={styles.karsilamaAlt}>
            Ben senin sınav koçunum. Çalışma planı, konu anlatımı veya motivasyon — ne istersen sor.
          </Text>
          <View style={styles.cipler}>
            {ONERILER.map((o) => (
              <TouchableOpacity key={o} style={styles.cip} onPress={() => gonder(o)} activeOpacity={0.8}>
                <Text style={styles.cipMetin}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listeRef}
          data={mesajlar}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.liste}
          onContentSizeChange={asagiKaydir}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <Mesaj balon={item} onTekrar={tekrarDene} />}
        />
      )}

      {/* "yazıyor" göstergesi */}
      {yaziyor && (
        <View style={styles.yaziyorSatir}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.yaziyorMetin}>Koç düşünüyor…</Text>
        </View>
      )}

      {/* Giriş çubuğu */}
      <View style={styles.girisCubugu}>
        <TextInput
          style={styles.giris}
          placeholder="Koçuna bir şey sor…"
          placeholderTextColor={COLORS.textLight}
          value={girdi}
          onChangeText={setGirdi}
          multiline
          editable={!yaziyor}
          onSubmitEditing={() => gonder(girdi)}
        />
        <TouchableOpacity
          style={[styles.gonderBtn, (!girdi.trim() || yaziyor) && styles.gonderBtnPasif]}
          onPress={() => gonder(girdi)}
          disabled={!girdi.trim() || yaziyor}
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Mesaj({ balon, onTekrar }: { balon: Balon; onTekrar: () => void }) {
  const benim = balon.rol === 'kullanici';
  if (balon.hatali) {
    return (
      <View style={styles.hataKart}>
        <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
        <Text style={styles.hataMetin}>{balon.metin}</Text>
        <TouchableOpacity style={styles.tekrarBtn} onPress={onTekrar}>
          <Ionicons name="refresh" size={14} color={COLORS.primary} />
          <Text style={styles.tekrarMetin}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={[styles.balonSatir, benim ? styles.balonSatirSag : styles.balonSatirSol]}>
      <View style={[styles.balon, benim ? styles.balonBenim : styles.balonKoc]}>
        <Text style={[styles.balonMetin, benim && styles.balonMetinBenim]}>{balon.metin}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  baslikSol: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baslikIkon: {
    width: 34, height: 34, borderRadius: 99, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  baslikMetin: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  baslikAlt: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '500' },
  baslikSag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  baslikBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },

  // Karşılama
  karsilama: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  karsilamaIkon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  karsilamaBaslik: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  karsilamaAlt: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  cipler: { gap: 8, alignSelf: 'stretch' },
  cip: {
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  cipMetin: { fontSize: 13.5, color: COLORS.text, fontWeight: '500' },

  // Liste
  liste: { padding: 16, gap: 10 },
  balonSatir: { flexDirection: 'row' },
  balonSatirSag: { justifyContent: 'flex-end' },
  balonSatirSol: { justifyContent: 'flex-start' },
  balon: { maxWidth: '82%', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 14 },
  balonBenim: { backgroundColor: COLORS.primary, borderBottomRightRadius: 5 },
  balonKoc: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderBottomLeftRadius: 5 },
  balonMetin: { fontSize: 14.5, lineHeight: 21, color: COLORS.text },
  balonMetinBenim: { color: '#fff' },

  // Hata kartı
  hataKart: {
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14,
    padding: 12, gap: 8, alignItems: 'flex-start',
  },
  hataMetin: { fontSize: 13, color: COLORS.error, lineHeight: 18 },
  tekrarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  tekrarMetin: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Yazıyor
  yaziyorSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  yaziyorMetin: { fontSize: 12.5, color: COLORS.textSecondary, fontStyle: 'italic' },

  // Giriş
  girisCubugu: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 26,
    backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
  },
  giris: {
    flex: 1, maxHeight: 120, backgroundColor: COLORS.background, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 14.5, color: COLORS.text,
  },
  gonderBtn: {
    width: 42, height: 42, borderRadius: 99, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  gonderBtnPasif: { backgroundColor: COLORS.textLight },
});
