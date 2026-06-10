import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../constants/colors';
import { useProfile } from '../hooks/useProfile';
import { bildir } from '../utils/bildirim';
import { denemeEkle, denemeleriGetir } from '../services/firestoreService';
import { auth } from '../services/firebaseConfig';
import {
  TYT_TESTLER,
  AYT_ALANLAR,
  type Alan,
  type Kapsam,
  type Cevaplar,
  type DenemeSonuc,
  type Test,
  alanNormalize,
  dRenk,
  netOf,
  bosOf,
  toplamNet,
  toplamGirildi,
  fmtNet,
  fmtDelta,
  setDY,
  tarihKisa,
} from '../models/deneme';

// AYT hedef net alanları — puan türüne göre (app/(tabs)/index.tsx ile aynı eşleme).
const HEDEF_AYT_KEYLERI: Record<Alan, string[]> = {
  SAY: ['ayt_matematik', 'ayt_fizik', 'ayt_kimya', 'ayt_biyoloji'],
  EA: ['ayt_matematik', 'ayt_edebiyat', 'ayt_tarih1', 'ayt_cografya1'],
  SOZ: ['ayt_edebiyat', 'ayt_tarih1', 'ayt_tarih2', 'ayt_cografya1', 'ayt_cografya2', 'ayt_felsefe', 'ayt_din'],
  DIL: ['ayt_yabancidil'],
};
const TYT_HEDEF_KEYLERI = ['tyt_turkce', 'tyt_matematik', 'tyt_fen', 'tyt_sosyal'];

export default function DenemeEkle() {
  const router = useRouter();
  const { profil } = useProfile();
  const uid = auth.currentUser?.uid;

  const alan: Alan = alanNormalize(profil?.puanTuru);

  const [kapsam, setKapsam] = useState<Kapsam>('ikisi');
  const [aktif, setAktif] = useState<'tyt' | 'ayt'>('tyt');
  const [ad, setAd] = useState('');
  const [tarih, setTarih] = useState<Date>(() => new Date());
  const [tarihSeciciAcik, setTarihSeciciAcik] = useState(false);
  const [sure, setSure] = useState('');
  const [cevap, setCevap] = useState<Cevaplar>({});
  const [odakli, setOdakli] = useState<string | null>(null); // "<ders>-d" | "<ders>-y"

  const [denemeNo, setDenemeNo] = useState(1);
  const [onceki, setOnceki] = useState<DenemeSonuc | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // Mevcut deneme sayısı (sonraki numara) + önceki deneme (kıyas için).
  useEffect(() => {
    if (!uid) return;
    denemeleriGetir(uid)
      .then((list) => {
        setDenemeNo(list.length + 1);
        setOnceki(list[0] ?? null);
      })
      .catch((err) => console.error('[DenemeEkle] denemeleriGetir hatası:', err));
  }, [uid]);

  // Kapsam değişince aktif föyü düzelt.
  useEffect(() => {
    if (kapsam === 'tyt') setAktif('tyt');
    else if (kapsam === 'ayt') setAktif('ayt');
  }, [kapsam]);

  const otoAd = `Deneme ${denemeNo}`;
  const aytTestler = AYT_ALANLAR[alan].testler;
  const aytGoster = kapsam !== 'tyt';
  const aktifTYT = aktif === 'tyt';
  const testler = aktifTYT ? TYT_TESTLER : aytTestler;
  const ANAHTAR = aktifTYT ? 'TYT' : 'AYT';
  const renk = aktifTYT ? COLORS.primary : COLORS.accent;

  const net = toplamNet(testler, cevap);

  // Önceki denemenin ilgili net'i (delta için) — yalnızca önceki deneme aynı
  // föyü (TYT/AYT) içeriyorsa anlamlıdır.
  const oncekiUygun = onceki ? (aktifTYT ? onceki.kapsam !== 'ayt' : onceki.kapsam !== 'tyt') : false;
  const oncekiNet = oncekiUygun ? (aktifTYT ? onceki!.tytNet : onceki!.aytNet) : null;
  const delta = oncekiNet != null ? net - oncekiNet : null;

  // Hedef net (profil.hedefNetBilgisi'nden, ana sayfa ile aynı mantık).
  const hedef = useMemo(() => {
    const hn = profil?.hedefNetBilgisi;
    if (!hn || profil?.netFetchStatus !== 'done') return null;
    const topla = (keys: string[]): number | null => {
      let toplam = 0;
      let bulundu = false;
      for (const k of keys) {
        const v = hn[k];
        if (typeof v === 'number') {
          toplam += v;
          bulundu = true;
        }
      }
      return bulundu ? Math.round(toplam * 10) / 10 : null;
    };
    return aktifTYT ? topla(TYT_HEDEF_KEYLERI) : topla(HEDEF_AYT_KEYLERI[alan]);
  }, [profil?.hedefNetBilgisi, profil?.netFetchStatus, aktifTYT, alan]);

  const kalan = hedef != null ? Math.max(0, hedef - net) : null;

  // Web'de <input type="date"> için "YYYY-MM-DD" (yerel saat, gün kayması olmadan).
  const isoYerel = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function girisDegistir(ders: string, key: 'd' | 'y', raw: string, soru: number, other: string) {
    setCevap((c) => setDY(c, ders, key, raw, soru, other));
  }

  async function kaydet() {
    if (!uid || kaydediliyor) return;

    const tytGirildi = kapsam !== 'ayt' && toplamGirildi(TYT_TESTLER, cevap);
    const aytGirildi = kapsam !== 'tyt' && toplamGirildi(aytTestler, cevap);
    if (!tytGirildi && !aytGirildi) {
      bildir('Eksik bilgi', 'Kaydetmek için en az bir derse doğru/yanlış gir.');
      return;
    }

    // Yalnızca kapsama giren derslerin cevaplarını sakla.
    const ilgiliTestler: Test[] = [
      ...(kapsam !== 'ayt' ? TYT_TESTLER : []),
      ...(kapsam !== 'tyt' ? aytTestler : []),
    ];
    const cevaplar: Cevaplar = {};
    for (const t of ilgiliTestler) {
      const c = cevap[t.ad];
      if (c && (c.d !== '' || c.y !== '')) cevaplar[t.ad] = { d: c.d || '', y: c.y || '' };
    }

    const tytNet = kapsam !== 'ayt' ? toplamNet(TYT_TESTLER, cevap) : 0;
    const aytNet = kapsam !== 'tyt' ? toplamNet(aytTestler, cevap) : 0;
    const sureNum = parseInt(sure, 10);

    setKaydediliyor(true);
    try {
      await denemeEkle(uid, {
        ad: ad.trim() || otoAd,
        denemeNo,
        kapsam,
        alan,
        ...(isNaN(sureNum) || sureNum <= 0 ? {} : { sure: sureNum }),
        cevaplar,
        tytNet: Math.round(tytNet * 100) / 100,
        aytNet: Math.round(aytNet * 100) / 100,
        toplamNet: Math.round((tytNet + aytNet) * 100) / 100,
        tarih: Timestamp.fromDate(tarih),
      });
      bildir('Kaydedildi', `${ad.trim() || otoAd} eklendi.`);
      router.back();
    } catch (err) {
      console.error('[DenemeEkle] kaydet hatası:', err);
      bildir('Hata', 'Deneme kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setKaydediliyor(false);
    }
  }

  // ── Alt parçalar (component DEĞİL düz render fonksiyonu: her tuş vuruşunda
  // yeniden mount olup TextInput odağını kaybetmesin diye JSX bileşeni yapılmadı) ──
  function netInputRender(
    ders: string,
    soru: number,
    field: 'd' | 'y',
    kutuRenk: string,
    other: string
  ) {
    const anahtar = `${ders}-${field}`;
    const foc = odakli === anahtar;
    const val = cevap[ders]?.[field] ?? '';
    return (
      <TextInput
        key={anahtar}
        value={val}
        onChangeText={(t) => girisDegistir(ders, field, t, soru, other)}
        onFocus={() => setOdakli(anahtar)}
        onBlur={() => setOdakli((o) => (o === anahtar ? null : o))}
        placeholder="0"
        placeholderTextColor={COLORS.textLight}
        keyboardType="number-pad"
        maxLength={3}
        style={[
          styles.netInput,
          foc && { borderColor: kutuRenk, backgroundColor: kutuRenk + '0E' },
        ]}
      />
    );
  }

  function satirRender(k: Test) {
    const dy = cevap[k.ad] ?? { d: '', y: '' };
    const r = dRenk(k.ad);
    return (
      <View key={k.ad} style={styles.satir}>
        <View style={styles.dersHucre}>
          <View style={[styles.nokta, { backgroundColor: r }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.dersAd} numberOfLines={1}>{k.ad}</Text>
            <Text style={styles.dersAlt}>{k.soru} soru</Text>
          </View>
        </View>
        {netInputRender(k.ad, k.soru, 'd', COLORS.success, dy.y)}
        {netInputRender(k.ad, k.soru, 'y', COLORS.error, dy.d)}
        <Text style={styles.bosHucre}>{bosOf(dy, k.soru)}</Text>
        <View style={[styles.netRozet, { backgroundColor: r + '14' }]}>
          <Text style={[styles.netRozetSayi, { color: r }]}>{fmtNet(netOf(dy))}</Text>
          <Text style={[styles.netRozetEtiket, { color: r }]}>NET</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.ekran}>
      {/* Başlık */}
      <View style={styles.baslik}>
        <TouchableOpacity style={styles.kapatBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.baslikMetin}>Yeni Deneme</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.icerik}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Künye */}
        <View>
          <View style={styles.etiketRow}>
            <Text style={styles.etiket}>Deneme adı</Text>
            <View style={styles.isteğePill}>
              <Text style={styles.isteğePillMetin}>isteğe bağlı</Text>
            </View>
          </View>
          <View style={styles.girisKart}>
            <Ionicons name="book-outline" size={17} color={COLORS.primary} />
            <TextInput
              value={ad}
              onChangeText={setAd}
              placeholder={otoAd}
              placeholderTextColor={COLORS.textLight}
              style={styles.adInput}
            />
          </View>
          <Text style={styles.yardim}>
            Boş bırakırsan <Text style={styles.yardimVurgu}>“{otoAd}”</Text> olarak kaydedilir.
          </Text>
        </View>

        {/* Tarih + Süre */}
        <View style={styles.ikiliRow}>
          <View style={{ flex: 1.4 }}>
            <Text style={styles.etiket}>Tarih</Text>
            {Platform.OS === 'web' ? (
              // Web: tarayıcının yerel tarih girişi (takvim güvenilir açılır).
              <View style={styles.girisKart}>
                <Ionicons name="calendar-outline" size={17} color={COLORS.primary} />
                <input
                  type="date"
                  value={isoYerel(tarih)}
                  max={isoYerel(new Date())}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const [y, m, d] = v.split('-').map(Number);
                    setTarih(new Date(y, m - 1, d));
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    color: COLORS.text,
                    colorScheme: 'light',
                  }}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.girisKart}
                activeOpacity={0.85}
                onPress={() => setTarihSeciciAcik(true)}
              >
                <Ionicons name="calendar-outline" size={17} color={COLORS.primary} />
                <Text style={styles.kartMetin}>{tarihKisa(tarih)}</Text>
                <Ionicons name="chevron-forward" size={15} color={COLORS.textLight} />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.etiket}>Süre</Text>
            <View style={styles.girisKart}>
              <Ionicons name="timer-outline" size={17} color={COLORS.primary} />
              <TextInput
                value={sure}
                onChangeText={(t) => setSure(t.replace(/[^0-9]/g, '').slice(0, 3))}
                placeholder="dk"
                placeholderTextColor={COLORS.textLight}
                keyboardType="number-pad"
                style={[styles.kartMetin, { flex: 1, padding: 0 }]}
              />
            </View>
          </View>
        </View>

        {/* Android: yerel tarih iletişim kutusu (seçince kapanır) */}
        {tarihSeciciAcik && Platform.OS === 'android' && (
          <DateTimePicker
            value={tarih}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(e, secilen) => {
              setTarihSeciciAcik(false);
              if (e.type === 'set' && secilen) setTarih(secilen);
            }}
          />
        )}

        {/* Kapsam */}
        <View>
          <Text style={styles.etiket}>Kapsam</Text>
          <View style={styles.segmentTrack}>
            {([
              { k: 'tyt', et: 'Sadece TYT' },
              { k: 'ayt', et: 'Sadece AYT' },
              { k: 'ikisi', et: 'TYT + AYT' },
            ] as const).map((o) => {
              const on = o.k === kapsam;
              return (
                <TouchableOpacity
                  key={o.k}
                  style={[styles.segment, on && styles.segmentAktif]}
                  activeOpacity={0.85}
                  onPress={() => setKapsam(o.k)}
                >
                  <Text style={[styles.segmentMetin, on && styles.segmentMetinAktif]}>{o.et}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* AYT alanı — profilden (seçilmez) */}
        {aytGoster && (
          <View style={styles.aytKart}>
            <Ionicons name="school-outline" size={17} color={COLORS.accent} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.aytBaslik}>AYT · {AYT_ALANLAR[alan].ad}</Text>
              <Text style={styles.aytAlt} numberOfLines={1}>
                {AYT_ALANLAR[alan].testler.map((t) => t.ad).join(' · ')}
              </Text>
            </View>
            <View style={styles.profilPill}>
              <Text style={styles.profilPillMetin}>profilinden</Text>
            </View>
          </View>
        )}

        {/* Föy segmenti (ikisi modunda) */}
        {kapsam === 'ikisi' && (
          <View style={styles.foyRow}>
            {([
              { k: 'tyt', et: 'TYT', renk: COLORS.primary, testler: TYT_TESTLER },
              { k: 'ayt', et: 'AYT', renk: COLORS.accent, testler: aytTestler },
            ] as const).map((o) => {
              const on = aktif === o.k;
              const nt = toplamNet(o.testler, cevap);
              return (
                <TouchableOpacity
                  key={o.k}
                  activeOpacity={0.9}
                  onPress={() => setAktif(o.k)}
                  style={[
                    styles.foyKart,
                    on
                      ? { backgroundColor: o.renk, borderColor: o.renk, shadowColor: o.renk, shadowOpacity: 0.33, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 }
                      : { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder },
                  ]}
                >
                  <Text style={[styles.foyEt, { color: on ? '#fff' : COLORS.text }]}>{o.et}</Text>
                  <Text style={[styles.foyNet, { color: on ? 'rgba(255,255,255,0.92)' : COLORS.textLight }]}>
                    {fmtNet(nt)} net
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Ders ızgarası */}
        <View style={{ gap: 7 }}>
          <View style={styles.kolonBaslik}>
            <Text style={[styles.kolonMetin, { flex: 1, textAlign: 'left' }]}>DERS</Text>
            <Text style={[styles.kolonMetin, styles.kolonD]}>DOĞRU</Text>
            <Text style={[styles.kolonMetin, styles.kolonY]}>YANLIŞ</Text>
            <Text style={[styles.kolonMetin, styles.kolonBos]}>BOŞ</Text>
            <Text style={[styles.kolonMetin, styles.kolonNet]}>NET</Text>
          </View>
          {testler.map((k) => satirRender(k))}
        </View>
      </ScrollView>

      {/* iOS: alttan açılan Türkçe takvim — görünürlük yalnızca state'e bağlı,
          onChange tarihi günceller ama kapatmaz (güvenilir yeniden açılır) */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={tarihSeciciAcik}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setTarihSeciciAcik(false)}
        >
          <Pressable style={styles.tarihArka} onPress={() => setTarihSeciciAcik(false)}>
            <Pressable style={styles.tarihSheet}>
              <View style={styles.tarihTutamac} />
              <View style={styles.tarihSheetBaslik}>
                <Text style={styles.tarihSheetTitle}>Tarih seç</Text>
                <TouchableOpacity onPress={() => setTarihSeciciAcik(false)} hitSlop={10}>
                  <Text style={styles.tarihSheetTamam}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tarih}
                mode="date"
                display="inline"
                locale="tr-TR"
                themeVariant="light"
                accentColor={COLORS.primary}
                maximumDate={new Date()}
                onChange={(_, secilen) => {
                  if (secilen) setTarih(secilen);
                }}
                style={styles.tarihPicker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Yapışkan sonuç barı + kaydet */}
      <View style={styles.footer}>
        <View style={styles.footerUst}>
          <View>
            <Text style={styles.footerEtiket}>{ANAHTAR} TOPLAM NET</Text>
            <View style={styles.footerNetRow}>
              <Text style={[styles.heroNet, { color: renk }]}>{fmtNet(net)}</Text>
              {delta != null && (
                <View style={[styles.deltaPill, { backgroundColor: (delta >= 0 ? COLORS.success : COLORS.error) + '16' }]}>
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
          </View>
          <View style={{ flex: 1 }} />
          {hedef != null && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.hedefMetin}>
                Hedef <Text style={styles.hedefSayi}>{fmtNet(hedef)}</Text>
              </Text>
              <Text style={styles.kalanMetin}>
                {kalan && kalan > 0 ? (
                  <>
                    hedefe <Text style={{ color: renk }}>{fmtNet(kalan)}</Text> net
                  </>
                ) : (
                  <Text style={{ color: COLORS.success }}>hedef geçildi ✓</Text>
                )}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={kaydet} disabled={kaydediliyor}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.7 }]}
          >
            <Ionicons name="checkmark" size={19} color="#fff" />
            <Text style={styles.kaydetMetin}>Denemeyi kaydet</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 14,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  kapatBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  baslikMetin: { fontSize: 16, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },

  icerik: { padding: 16, gap: 18 },

  etiketRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  etiket: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase',
    color: COLORS.textLight, marginBottom: 8,
  },
  isteğePill: { backgroundColor: COLORS.backgroundSecondary, borderRadius: 99, paddingVertical: 2, paddingHorizontal: 8, marginBottom: 8 },
  isteğePillMetin: { fontSize: 10, fontWeight: '700', color: COLORS.textLight },

  girisKart: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 13,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  adInput: { flex: 1, fontSize: 14.5, fontWeight: '600', color: COLORS.text, padding: 0 },
  kartMetin: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  yardim: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, marginTop: 6 },
  yardimVurgu: { color: COLORS.textSecondary, fontWeight: '700' },

  ikiliRow: { flexDirection: 'row', gap: 11 },

  segmentTrack: {
    flexDirection: 'row', gap: 5, padding: 4, borderRadius: 14,
    backgroundColor: COLORS.backgroundSecondary,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  segmentAktif: {
    backgroundColor: COLORS.card,
    shadowColor: COLORS.ink, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  segmentMetin: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary },
  segmentMetinAktif: { color: COLORS.primary },

  aytKart: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 13,
    backgroundColor: COLORS.accent + '0E', borderWidth: 1, borderColor: COLORS.accent + '2E',
  },
  aytBaslik: { fontSize: 13.5, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  aytAlt: { fontSize: 10.5, fontWeight: '600', color: COLORS.textLight, marginTop: 1 },
  profilPill: { backgroundColor: COLORS.accent + '1A', borderRadius: 99, paddingVertical: 3, paddingHorizontal: 9 },
  profilPillMetin: { fontSize: 10, fontWeight: '700', color: COLORS.accent },

  foyRow: { flexDirection: 'row', gap: 8 },
  foyKart: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1.5,
  },
  foyEt: { fontSize: 14, fontWeight: '800' },
  foyNet: { fontSize: 13, fontWeight: '800' },

  kolonBaslik: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 2 },
  kolonMetin: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4, color: COLORS.textLight, textAlign: 'center' },
  kolonD: { width: 46 },
  kolonY: { width: 46 },
  kolonBos: { width: 38 },
  kolonNet: { width: 54 },

  satir: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 13,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  dersHucre: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  nokta: { width: 9, height: 9, borderRadius: 99 },
  dersAd: { fontSize: 13.5, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2 },
  dersAlt: { fontSize: 10.5, fontWeight: '600', color: COLORS.textLight },

  netInput: {
    width: 46, height: 38, textAlign: 'center', fontSize: 16, fontWeight: '800', color: COLORS.text,
    borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
    borderRadius: 11, padding: 0,
  },
  bosHucre: { width: 38, textAlign: 'center', fontSize: 14, fontWeight: '700', color: COLORS.textLight },
  netRozet: { width: 54, alignItems: 'center', paddingVertical: 6, borderRadius: 10 },
  netRozetSayi: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, lineHeight: 17 },
  netRozetEtiket: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5, opacity: 0.7, marginTop: 2 },

  footer: {
    backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24,
    shadowColor: COLORS.ink, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: -8 }, elevation: 12,
  },
  footerUst: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  footerEtiket: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, color: COLORS.textLight, textTransform: 'uppercase' },
  footerNetRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroNet: { fontSize: 34, fontWeight: '800', letterSpacing: -1, lineHeight: 36 },
  deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 3, paddingLeft: 6, paddingRight: 9, borderRadius: 99 },
  deltaMetin: { fontSize: 12, fontWeight: '800' },
  hedefMetin: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary },
  hedefSayi: { color: COLORS.text, fontWeight: '700' },
  kalanMetin: { fontSize: 12.5, fontWeight: '700', color: COLORS.text, marginTop: 2 },

  kaydetBtn: {
    height: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    shadowColor: COLORS.primary, shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  kaydetMetin: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Tarih seçici sayfası (iOS)
  tarihArka: { flex: 1, backgroundColor: 'rgba(15,18,40,0.45)', justifyContent: 'flex-end' },
  tarihSheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28,
  },
  tarihTutamac: { alignSelf: 'center', width: 40, height: 4, borderRadius: 99, backgroundColor: COLORS.cardBorder, marginBottom: 10 },
  tarihSheetBaslik: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  tarihSheetTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  tarihSheetTamam: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  tarihPicker: { alignSelf: 'stretch' },
});
