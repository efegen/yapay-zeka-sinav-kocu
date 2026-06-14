import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { COLORS } from '../constants/colors';
import { dersRenk } from '../constants/dersler';
import { bildir } from '../utils/bildirim';
import { auth } from '../services/firebaseConfig';
import {
  yanlisEkle,
  yanlislariGetir,
  yanlisGuncelle,
  yanlisSil,
  type Yanlis,
} from '../services/firestoreService';
import { konuSinyali } from '../services/kocHafizaService';
import { KATEGORILER, type NedenKategori } from '../utils/hataAnalizi';

const DERSLER = [
  'TYT Türkçe', 'TYT Matematik', 'TYT Fen', 'TYT Sosyal',
  'AYT Matematik', 'AYT Fizik', 'AYT Kimya', 'AYT Biyoloji', 'AYT Edebiyat',
];
const KATEGORI_SIRA: NedenKategori[] = ['dikkatsizlik', 'sure', 'bilgi'];

// "AYT Matematik" → "Matematik" (renk eşlemesi için).
const dersBase = (d: string) => d.replace(/^(TYT|AYT)\s/, '');

function tarihKisa(ts?: Timestamp): string {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const aylar = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return `${d.getDate()} ${aylar[d.getMonth()]}`;
}

export default function YanlisDefteri() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  const [yanlislar, setYanlislar] = useState<Yanlis[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [formAcik, setFormAcik] = useState(false);
  const [ders, setDers] = useState('');
  const [konu, setKonu] = useState('');
  const [not, setNot] = useState('');
  const [kategori, setKategori] = useState<NedenKategori | null>(null);
  const [ekleniyor, setEkleniyor] = useState(false);

  const yukle = useCallback(() => {
    if (!uid) {
      setYukleniyor(false);
      return;
    }
    yanlislariGetir(uid)
      .then(setYanlislar)
      .catch((e) => console.error('[YanlisDefteri] yükleme hatası:', e))
      .finally(() => setYukleniyor(false));
  }, [uid]);

  useFocusEffect(useCallback(() => { yukle(); }, [yukle]));

  const aktif = useMemo(() => yanlislar.filter((y) => !y.ogrenildi), [yanlislar]);
  const ogrenilmis = useMemo(() => yanlislar.filter((y) => y.ogrenildi), [yanlislar]);

  function formSifirla() {
    setDers('');
    setKonu('');
    setNot('');
    setKategori(null);
  }

  async function ekle() {
    if (!uid) return;
    if (!ders) {
      bildir('Ders seç', 'Önce yanlışın hangi derste olduğunu seç.');
      return;
    }
    if (konu.trim().length < 2) {
      bildir('Konu gir', 'Hangi konuda yanlış yaptın? Kısaca yaz (örn. Türev).');
      return;
    }
    setEkleniyor(true);
    const yeni: Omit<Yanlis, 'id' | 'olusturmaTarihi'> = {
      ders,
      konu: konu.trim(),
      not: not.trim() || undefined,
      kategori: kategori || undefined,
      ogrenildi: false,
    };
    try {
      const id = await yanlisEkle(uid, yeni);
      // Koç hafızasına işle: bu konuda zorlanıyor.
      konuSinyali(uid, { ad: yeni.konu, ders, sinyal: 'zorlaniyor' }).catch((e) =>
        console.error('[YanlisDefteri] konuSinyali hatası:', e)
      );
      setYanlislar((prev) => [{ id, ...yeni, olusturmaTarihi: Timestamp.now() }, ...prev]);
      formSifirla();
      setFormAcik(false);
    } catch (e) {
      console.error('[YanlisDefteri] ekleme hatası:', e);
      bildir('Hata', 'Eklenemedi, lütfen tekrar dene.');
    } finally {
      setEkleniyor(false);
    }
  }

  async function ogrenildiYap(y: Yanlis, deger: boolean) {
    if (!uid) return;
    setYanlislar((prev) => prev.map((x) => (x.id === y.id ? { ...x, ogrenildi: deger } : x)));
    try {
      await yanlisGuncelle(uid, y.id, { ogrenildi: deger });
      if (deger) {
        konuSinyali(uid, { ad: y.konu, ders: y.ders, sinyal: 'anladi' }).catch(() => {});
      }
    } catch (e) {
      console.error('[YanlisDefteri] güncelleme hatası:', e);
      yukle();
    }
  }

  async function sil(y: Yanlis) {
    if (!uid) return;
    setYanlislar((prev) => prev.filter((x) => x.id !== y.id));
    try {
      await yanlisSil(uid, y.id);
    } catch (e) {
      console.error('[YanlisDefteri] silme hatası:', e);
      yukle();
    }
  }

  return (
    <View style={styles.ekran}>
      <View style={styles.baslik}>
        <TouchableOpacity style={styles.geriBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={21} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.baslikMetin}>Yanlış Defteri</Text>
          {aktif.length > 0 && <Text style={styles.baslikAlt}>{aktif.length} tekrar bekliyor</Text>}
        </View>
        <TouchableOpacity
          style={styles.ekleBtn}
          onPress={() => setFormAcik((a) => !a)}
          activeOpacity={0.85}
        >
          <Ionicons name={formAcik ? 'close' : 'add'} size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.icerik}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* ── Ekleme formu ── */}
        {formAcik && (
          <View style={styles.formKart}>
            <Text style={styles.formEtiket}>Ders</Text>
            <View style={styles.dersSarma}>
              {DERSLER.map((d) => {
                const on = ders === d;
                const r = dersRenk(dersBase(d));
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDers(d)}
                    activeOpacity={0.85}
                    style={[styles.dersChip, on && { backgroundColor: r + '1A', borderColor: r }]}
                  >
                    <View style={[styles.dersNokta, { backgroundColor: r }]} />
                    <Text style={[styles.dersChipMetin, on && { color: r }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.formEtiket}>Konu</Text>
            <TextInput
              value={konu}
              onChangeText={setKonu}
              placeholder="Hangi konu? (örn. Türev, Paragraf)"
              placeholderTextColor={COLORS.textLight}
              style={styles.girdi}
            />

            <Text style={styles.formEtiket}>Not (opsiyonel)</Text>
            <TextInput
              value={not}
              onChangeText={setNot}
              placeholder="Sorunun özeti ya da neyi karıştırdığın"
              placeholderTextColor={COLORS.textLight}
              style={[styles.girdi, { minHeight: 42 }]}
              multiline
            />

            <Text style={styles.formEtiket}>Hata türü (opsiyonel)</Text>
            <View style={styles.kategoriSatir}>
              {KATEGORI_SIRA.map((k) => {
                const meta = KATEGORILER[k];
                const on = kategori === k;
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setKategori(on ? null : k)}
                    activeOpacity={0.85}
                    style={[styles.katChip, on && { backgroundColor: meta.renk + '16', borderColor: meta.renk }]}
                  >
                    <Ionicons name={meta.ikon as any} size={13} color={on ? meta.renk : COLORS.textLight} />
                    <Text style={[styles.katChipMetin, on && { color: meta.renk }]}>{meta.ad}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity activeOpacity={0.9} onPress={ekle} disabled={ekleniyor} style={{ marginTop: 14 }}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.kaydetBtn, ekleniyor && { opacity: 0.7 }]}
              >
                <Ionicons name="bookmark-outline" size={17} color="#fff" />
                <Text style={styles.kaydetMetin}>Deftere ekle</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {yukleniyor ? (
          <View style={styles.merkez}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : yanlislar.length === 0 ? (
          <View style={styles.bosAlan}>
            <View style={styles.bosIkon}>
              <Ionicons name="reader-outline" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.bosBaslik}>Defterin boş</Text>
            <Text style={styles.bosMetin}>
              Yanlış yaptığın konuları buraya ekle; tekrar edip "öğrendim" deyince arşivlenir.
              Eklediğin konular koç hafızana da işlenir.
            </Text>
            {!formAcik && (
              <TouchableOpacity style={styles.bosBtn} onPress={() => setFormAcik(true)} activeOpacity={0.85}>
                <Ionicons name="add" size={17} color="#fff" />
                <Text style={styles.bosBtnMetin}>İlk yanlışını ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {aktif.map((y) => (
              <YanlisKart key={y.id} y={y} onOgrendim={() => ogrenildiYap(y, true)} onSil={() => sil(y)} />
            ))}

            {ogrenilmis.length > 0 && (
              <>
                <Text style={styles.bolumBaslik}>Öğrenilenler ({ogrenilmis.length})</Text>
                {ogrenilmis.map((y) => (
                  <YanlisKart
                    key={y.id}
                    y={y}
                    ogrenilmis
                    onGeriAl={() => ogrenildiYap(y, false)}
                    onSil={() => sil(y)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function YanlisKart({
  y,
  ogrenilmis,
  onOgrendim,
  onGeriAl,
  onSil,
}: {
  y: Yanlis;
  ogrenilmis?: boolean;
  onOgrendim?: () => void;
  onGeriAl?: () => void;
  onSil: () => void;
}) {
  const r = dersRenk(dersBase(y.ders));
  const kat = y.kategori ? KATEGORILER[y.kategori] : null;
  return (
    <View style={[styles.kart, ogrenilmis && styles.kartOgrenilmis]}>
      <View style={[styles.kartNokta, { backgroundColor: r }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.kartUst}>
          <Text style={styles.kartDers}>{y.ders}</Text>
          <Text style={styles.kartTarih}>{tarihKisa(y.olusturmaTarihi)}</Text>
        </View>
        <Text style={[styles.kartKonu, ogrenilmis && styles.kartKonuOgrenilmis]}>{y.konu}</Text>
        {!!y.not && <Text style={styles.kartNot} numberOfLines={2}>{y.not}</Text>}
        <View style={styles.kartAltSatir}>
          {kat && (
            <View style={[styles.katRozet, { backgroundColor: kat.renk + '16' }]}>
              <Ionicons name={kat.ikon as any} size={11} color={kat.renk} />
              <Text style={[styles.katRozetMetin, { color: kat.renk }]}>{kat.ad}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {ogrenilmis ? (
            <TouchableOpacity style={styles.kartAksiyon} onPress={onGeriAl} hitSlop={6}>
              <Ionicons name="refresh-outline" size={15} color={COLORS.textSecondary} />
              <Text style={styles.kartAksiyonMetin}>Geri al</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.kartAksiyon, styles.ogrendimBtn]} onPress={onOgrendim} hitSlop={6} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle-outline" size={15} color={COLORS.success} />
              <Text style={[styles.kartAksiyonMetin, { color: COLORS.success }]}>Öğrendim</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.silBtn} onPress={onSil} hitSlop={6}>
            <Ionicons name="trash-outline" size={15} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  baslikAlt: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight, marginTop: 1 },
  ekleBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary + '33',
    justifyContent: 'center', alignItems: 'center',
  },

  icerik: { padding: 16, gap: 10 },

  // Form
  formKart: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 14, marginBottom: 4,
  },
  formEtiket: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase',
    color: COLORS.textLight, marginTop: 12, marginBottom: 8,
  },
  dersSarma: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dersChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 11, borderRadius: 99,
    borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
  },
  dersNokta: { width: 7, height: 7, borderRadius: 99 },
  dersChipMetin: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  girdi: {
    backgroundColor: COLORS.background, borderRadius: 11, borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '600', color: COLORS.text,
  },
  kategoriSatir: { flexDirection: 'row', gap: 7 },
  katChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
  },
  katChipMetin: { fontSize: 11, fontWeight: '800', color: COLORS.textLight },
  kaydetBtn: {
    height: 48, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  kaydetMetin: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Boş / yükleniyor
  merkez: { paddingVertical: 50, alignItems: 'center' },
  bosAlan: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 },
  bosIkon: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  bosBaslik: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  bosMetin: { fontSize: 13.5, fontWeight: '500', color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  bosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
    backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14,
  },
  bosBtnMetin: { fontSize: 15, fontWeight: '800', color: '#fff' },

  bolumBaslik: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase',
    color: COLORS.textLight, marginTop: 12, marginBottom: 2, marginLeft: 2,
  },

  // Yanlış kartı
  kart: {
    flexDirection: 'row', gap: 11,
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 13,
  },
  kartOgrenilmis: { opacity: 0.66 },
  kartNokta: { width: 9, height: 9, borderRadius: 99, marginTop: 5 },
  kartUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kartDers: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2, color: COLORS.textSecondary, flex: 1 },
  kartTarih: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },
  kartKonu: { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2, marginTop: 2 },
  kartKonuOgrenilmis: { textDecorationLine: 'line-through', color: COLORS.textSecondary },
  kartNot: { fontSize: 12.5, fontWeight: '500', color: COLORS.textSecondary, marginTop: 3, lineHeight: 17 },
  kartAltSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  katRozet: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  katRozetMetin: { fontSize: 10.5, fontWeight: '800' },
  kartAksiyon: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 9 },
  ogrendimBtn: { backgroundColor: COLORS.success + '12' },
  kartAksiyonMetin: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary },
  silBtn: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.error + '10',
    justifyContent: 'center', alignItems: 'center',
  },
});
