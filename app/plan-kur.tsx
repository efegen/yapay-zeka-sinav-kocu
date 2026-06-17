import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Timestamp } from 'firebase/firestore';
import { auth } from '../services/firebaseConfig';
import { Adim, AdimTip, Gorev, gorevEkle, gunGorevleriniGetir } from '../services/firestoreService';
import { COLORS } from '../constants/colors';
import { dersRenk } from '../constants/dersler';
import { yksSinavGunuMu } from '../constants/sinav';
import { bildir } from '../utils/bildirim';

const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

// ÇT-TC-02: Pomodoro tekniği gereği planlanan toplam süre en az 25 dakika olmalı.
const POMODORO_MIN = 25;
const ikiHane = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/**
 * ÇT-TC-03 (cakismaVarMi): Aynı GÜNDE, başlangıç saati TANIMLI bir planla zaman örtüşmesi
 * var mı? Saatsiz (gece yarısı = "tüm gün") planlar ve denemeler çakışmaya dahil edilmez.
 */
async function cakismaBul(uid: string, baslangic: Date, sureDk: number): Promise<Gorev | null> {
  const { planned } = await gunGorevleriniGetir(uid, baslangic);
  const yeniBas = baslangic.getHours() * 60 + baslangic.getMinutes();
  const yeniBit = yeniBas + sureDk;
  for (const g of planned) {
    if (g.tur === 'deneme' || !g.tarih) continue;
    const d = g.tarih.toDate();
    if (d.getHours() === 0 && d.getMinutes() === 0) continue; // saatsiz (tüm gün) plan
    const bas = d.getHours() * 60 + d.getMinutes();
    const bit = bas + (g.sure || 0);
    if (yeniBas < bit && bas < yeniBit) return g; // [yeniBas,yeniBit) ile [bas,bit) örtüşüyor
  }
  return null;
}

// Ders, alana göre iki ayrı grupta sunulur. AYT seti Sayısal alana göredir.
const TYT_DERSLER = ['Türkçe', 'Matematik', 'Fen', 'Sosyal'];
const AYT_DERSLER = ['Matematik', 'Fizik', 'Kimya', 'Biyoloji'];

const ADIM_META: Record<AdimTip, { ad: string; ikon: keyof typeof Ionicons.glyphMap; meta: string }> = {
  oku: { ad: 'Okuma', ikon: 'book-outline', meta: 'konu tekrarı' },
  soru: { ad: 'Soru', ikon: 'radio-button-on', meta: 'netine işlenir' },
  mola: { ad: 'Mola', ikon: 'cafe-outline', meta: 'dinlen, soru yok' },
};

// "Ekle" butonuna basınca eklenen varsayılan adım (kullanıcı sonra düzenler).
function yeniAdim(tip: AdimTip): Adim {
  if (tip === 'oku') return { tip, ad: 'Konu tekrarı', dk: 10, done: false };
  if (tip === 'soru') return { tip, ad: 'Soru çözümü', dk: 15, soru: 10, done: false };
  return { tip, ad: 'Kısa mola', dk: 5, done: false };
}

// Adımın vurgu rengi: soru adımı seçili dersin rengini alır; diğerleri sabit.
function adimRenk(tip: AdimTip, renk: string): string {
  if (tip === 'soru') return renk;
  if (tip === 'oku') return COLORS.primary;
  return COLORS.textSecondary;
}
function adimBg(tip: AdimTip, renk: string): string {
  if (tip === 'soru') return renk + '18';
  if (tip === 'oku') return COLORS.primaryLight;
  return '#EEF2F8';
}

export default function PlanKur() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tarih?: string | string[] }>();
  const uid = auth.currentUser?.uid;

  // Takvimde seçili gün param olarak gelir (builder'da tarih seçici yok — sade).
  const hedefTarih = useMemo(() => {
    const ham = Array.isArray(params.tarih) ? params.tarih[0] : params.tarih;
    const t = ham ? new Date(Number(ham)) : new Date();
    if (isNaN(t.getTime())) return new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, [params.tarih]);

  // YKS sınav gününe (TYT/AYT) çalışma planı eklenemez.
  const sinavGunu = useMemo(() => yksSinavGunuMu(hedefTarih), [hedefTarih]);

  const [baslik, setBaslik] = useState('');
  const [secili, setSecili] = useState<{ grup: string; ders: string } | null>(null);
  const [adimlar, setAdimlar] = useState<Adim[]>([]);
  // Ayar sayfası: hangi adım + hangi alanı (dk/soru) düzenlemek için açıldığı.
  const [ayar, setAyar] = useState<{ index: number; odak: 'dk' | 'soru' } | null>(null);
  const [saat, setSaat] = useState(''); // '' = tüm gün · 'HH:MM' = başlangıç saati
  const [saatPickerAcik, setSaatPickerAcik] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const renk = dersRenk(secili?.ders);

  // Native saat seçicinin başlangıç değeri.
  const saatDate = useMemo(() => {
    const d = new Date(hedefTarih);
    if (saat) {
      const [h, m] = saat.split(':').map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    return d;
  }, [saat, hedefTarih]);
  const toplamDk = adimlar.reduce((t, a) => t + (a.dk || 0), 0);
  const soruToplam = adimlar.reduce((t, a) => t + (a.soru || 0), 0);

  function adimEkle(tip: AdimTip) {
    setAdimlar((prev) => [...prev, yeniAdim(tip)]);
  }
  function adimSil(i: number) {
    setAdimlar((prev) => prev.filter((_, j) => j !== i));
  }
  function adimAdDegis(i: number, ad: string) {
    setAdimlar((prev) => prev.map((a, j) => (j === i ? { ...a, ad } : a)));
  }
  function adimAyarKaydet(i: number, dk: number, soru: number) {
    setAdimlar((prev) =>
      prev.map((a, j) => (j === i ? { ...a, dk, ...(a.tip === 'soru' ? { soru } : {}) } : a))
    );
  }

  async function olustur() {
    if (!uid) return;
    if (sinavGunu) {
      bildir('Sınav günü', 'YKS sınav gününe çalışma planı eklenemez. Lütfen başka bir gün seç.');
      return;
    }
    if (!baslik.trim()) {
      bildir('Eksik bilgi', 'Önce ne çalışacağını yaz.');
      return;
    }

    const temiz: Adim[] = adimlar.map((a) => ({
      tip: a.tip,
      ad: a.ad.trim() || ADIM_META[a.tip].ad,
      dk: Math.max(1, a.dk || 0),
      done: false,
      ...(a.tip === 'soru' ? { soru: Math.max(0, a.soru || 0) } : {}),
    }));
    const sure = temiz.reduce((t, a) => t + a.dk, 0);

    // ÇT-TC-02: Pomodoro min süre kuralı.
    if (sure < POMODORO_MIN) {
      bildir(
        'Süre yetersiz',
        `Sistem Pomodoro tekniği ile çalıştığı için planlanan süre en az ${POMODORO_MIN} dakika olmalıdır.`
      );
      return;
    }

    // Başlangıç günü (+ opsiyonel saat). Saat verilmezse gece yarısı = "tüm gün".
    const gun = new Date(hedefTarih);
    gun.setHours(0, 0, 0, 0);
    if (saat) {
      const [h, m] = saat.split(':').map(Number);
      gun.setHours(h || 0, m || 0, 0, 0);
    }

    setKaydediliyor(true);
    try {
      // ÇT-TC-03: saat verildiyse aynı saatteki planlarla çakışma kontrolü.
      if (saat) {
        const cakisan = await cakismaBul(uid, gun, sure);
        if (cakisan) {
          bildir('Saat çakışması', `Bu saatte başka bir plan var: "${cakisan.baslik}". Lütfen farklı bir saat seç.`);
          setKaydediliyor(false);
          return;
        }
      }
      await gorevEkle(uid, {
        baslik: baslik.trim(),
        ders: secili?.ders ?? 'Genel',
        tur: 'plan',
        sure,
        tip: 'planned',
        tarih: Timestamp.fromDate(gun),
        tamamlandi: false,
        adimlar: temiz,
      });
      router.back();
    } catch (err) {
      console.error('[PlanKur] oluştur hatası:', err);
      bildir('Hata', 'Plan oluşturulamadı, tekrar dene.');
    } finally {
      setKaydediliyor(false);
    }
  }

  const tarihMetni = `${hedefTarih.getDate()} ${AY_KISA[hedefTarih.getMonth()]} · ${GUN_KISA[hedefTarih.getDay()]}`;

  return (
    <View style={styles.ekran}>
      {/* ─── Başlık ─── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.ikonBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerBaslik}>Plan Kur</Text>
          <Text style={styles.headerTarih}>{tarihMetni}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 16 }}
        >
          {sinavGunu && (
            <View style={styles.sinavUyari}>
              <Ionicons name="flag" size={16} color={COLORS.accent} />
              <Text style={styles.sinavUyariMetin}>Bu gün YKS sınav günü — plan eklenemez.</Text>
            </View>
          )}

          {/* ─── Başlık alanı (düzenlenebilir) ─── */}
          <View>
            <Text style={[styles.etiket, { marginBottom: 8 }]}>Ne çalışacaksın?</Text>
            <View style={[styles.baslikKutu, { borderColor: renk + '55', shadowColor: renk }]}>
              <Ionicons name="pencil" size={17} color={renk} />
              <TextInput
                style={styles.baslikInput}
                value={baslik}
                onChangeText={setBaslik}
                placeholder="Konu / görev adı"
                placeholderTextColor={COLORS.textLight}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* ─── Ders — TYT / AYT ayrık ─── */}
          <View style={{ gap: 9 }}>
            <DersGrubu
              etiket="TYT"
              dersler={TYT_DERSLER}
              secili={secili}
              onSec={(d) => setSecili({ grup: 'TYT', ders: d })}
            />
            <DersGrubu
              etiket="AYT"
              rozet="Sayısal"
              dersler={AYT_DERSLER}
              secili={secili}
              onSec={(d) => setSecili({ grup: 'AYT', ders: d })}
            />
          </View>

          {/* ─── Başlangıç saati (opsiyonel) ─── */}
          <View>
            <Text style={[styles.etiket, { marginBottom: 8 }]}>Başlangıç saati (opsiyonel)</Text>
            {Platform.OS === 'web' ? (
              <View style={styles.saatKutu}>
                <Ionicons name="time-outline" size={17} color={COLORS.primary} />
                <input
                  type="time"
                  value={saat}
                  onChange={(e: any) => setSaat(e.target.value)}
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    padding: 0, fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                    color: COLORS.text, colorScheme: 'light',
                  }}
                />
                {!!saat && (
                  <TouchableOpacity onPress={() => setSaat('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity style={styles.saatKutu} activeOpacity={0.85} onPress={() => setSaatPickerAcik(true)}>
                <Ionicons name="time-outline" size={17} color={COLORS.primary} />
                <Text style={[styles.saatMetin, !saat && { color: COLORS.textLight }]}>
                  {saat || 'Tüm gün (saat seçilmedi)'}
                </Text>
                {saat ? (
                  <TouchableOpacity onPress={() => setSaat('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={15} color={COLORS.textLight} />
                )}
              </TouchableOpacity>
            )}
            <Text style={styles.saatYardim}>
              Saat seçersen o gün aynı saate denk gelen planlarla çakışma kontrol edilir.
            </Text>
          </View>

          {/* ─── Çalışma adımları ─── */}
          <View>
            <View style={styles.adimBaslikSatir}>
              <Text style={styles.etiket}>Adımlar</Text>
              {adimlar.length > 0 && (
                <Text style={styles.toplamMetin}>
                  {`${toplamDk} dk`}
                  {soruToplam > 0 && (
                    <Text style={{ color: renk }}>{`  ·  ${soruToplam} soru`}</Text>
                  )}
                </Text>
              )}
            </View>

            {adimlar.length === 0 ? (
              <View style={styles.bosAdim}>
                <Text style={styles.bosAdimMetin}>Henüz adım yok</Text>
                <Text style={styles.bosAdimAlt}>Aşağıdaki butonlarla okuma, soru ya da mola ekle.</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {adimlar.map((a, i) => (
                  <AdimSatiri
                    key={i}
                    adim={a}
                    renk={renk}
                    onAd={(t) => adimAdDegis(i, t)}
                    onAyar={(odak) => setAyar({ index: i, odak })}
                    onSil={() => adimSil(i)}
                  />
                ))}
              </View>
            )}

            {/* Yeni adım ekle — belirgin Okuma / Soru / Mola butonları */}
            <Text style={[styles.etiket, { marginTop: 14, marginBottom: 8 }]}>Yeni adım ekle</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['oku', 'soru', 'mola'] as AdimTip[]).map((tip) => {
                const c = adimRenk(tip, renk);
                return (
                  <TouchableOpacity
                    key={tip}
                    style={[styles.ekleBtn, { backgroundColor: c + '14', borderColor: c + '55' }]}
                    onPress={() => adimEkle(tip)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.ekleArti, { backgroundColor: c }]}>
                      <Ionicons name="add" size={15} color="#fff" />
                    </View>
                    <Text style={[styles.ekleMetin, { color: c }]}>{ADIM_META[tip].ad}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* ─── Footer ─── */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <TouchableOpacity activeOpacity={0.9} onPress={olustur} disabled={kaydediliyor || sinavGunu}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.olusturBtn, (kaydediliyor || sinavGunu) && { opacity: 0.5 }]}
            >
              {kaydediliyor ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={19} color="#fff" />
                  <Text style={styles.olusturMetin}>Planı oluştur</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Başlangıç saati seçici (native) */}
      {saatPickerAcik && Platform.OS === 'android' && (
        <DateTimePicker
          value={saatDate}
          mode="time"
          is24Hour
          display="default"
          onChange={(e, sel) => {
            setSaatPickerAcik(false);
            if (e.type === 'set' && sel) setSaat(`${ikiHane(sel.getHours())}:${ikiHane(sel.getMinutes())}`);
          }}
        />
      )}
      {Platform.OS === 'ios' && (
        <Modal
          visible={saatPickerAcik}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setSaatPickerAcik(false)}
        >
          <Pressable style={styles.overlay} onPress={() => setSaatPickerAcik(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetTutamac} />
            <View style={styles.saatSheetBaslikSatir}>
              <Text style={styles.sheetBaslik}>Başlangıç saati</Text>
              <TouchableOpacity onPress={() => setSaatPickerAcik(false)} hitSlop={10}>
                <Text style={styles.saatTamam}>Tamam</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={saatDate}
              mode="time"
              display="spinner"
              locale="tr-TR"
              themeVariant="light"
              onChange={(_, sel) => {
                if (sel) setSaat(`${ikiHane(sel.getHours())}:${ikiHane(sel.getMinutes())}`);
              }}
            />
          </View>
        </Modal>
      )}

      <AyarModal
        acik={ayar !== null}
        adim={ayar !== null ? adimlar[ayar.index] : null}
        odak={ayar?.odak ?? 'dk'}
        renk={renk}
        onKapat={() => setAyar(null)}
        onKaydet={(dk, soru) => {
          if (ayar !== null) adimAyarKaydet(ayar.index, dk, soru);
          setAyar(null);
        }}
      />
    </View>
  );
}

// ─── TYT / AYT ders grubu ─────────────────────

function DersGrubu({
  etiket,
  rozet,
  dersler,
  secili,
  onSec,
}: {
  etiket: string;
  rozet?: string;
  dersler: string[];
  secili: { grup: string; ders: string } | null;
  onSec: (ders: string) => void;
}) {
  return (
    <View style={styles.dersGrubu}>
      <View style={styles.dersEtiketKol}>
        <Text style={styles.dersEtiket}>{etiket}</Text>
        {rozet && <Text style={styles.dersRozet}>{rozet}</Text>}
      </View>
      <View style={styles.dersChipler}>
        {dersler.map((d) => {
          const on = secili?.grup === etiket && secili?.ders === d;
          const c = dersRenk(d);
          return (
            <TouchableOpacity
              key={d}
              style={[
                styles.dersChip,
                { backgroundColor: on ? c + '1A' : COLORS.card, borderColor: on ? c : COLORS.cardBorder },
              ]}
              onPress={() => onSec(d)}
              activeOpacity={0.85}
            >
              <View style={[styles.dersNokta, { backgroundColor: c }]} />
              <Text style={[styles.dersChipMetin, { color: on ? c : COLORS.textSecondary }]} numberOfLines={1}>
                {d}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Adım satırı ──────────────────────────────

function AdimSatiri({
  adim,
  renk,
  onAd,
  onAyar,
  onSil,
}: {
  adim: Adim;
  renk: string;
  onAd: (ad: string) => void;
  onAyar: (odak: 'dk' | 'soru') => void;
  onSil: () => void;
}) {
  const soru = adim.tip === 'soru';
  const c = adimRenk(adim.tip, renk);
  // Soru adımında sayı artık kendi pill'inde düzenlenir; meta satırı sade kalır.
  const meta = soru ? 'netine işlenir' : ADIM_META[adim.tip].meta;
  return (
    <View style={[styles.adimSatir, { borderColor: soru ? renk + '40' : COLORS.cardBorder }]}>
      <Ionicons name="ellipsis-vertical" size={15} color={COLORS.textLight} />
      <View style={[styles.adimIkonKutu, { backgroundColor: adimBg(adim.tip, renk) }]}>
        <Ionicons name={ADIM_META[adim.tip].ikon} size={17} color={c} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextInput
          style={styles.adimAdInput}
          value={adim.ad}
          onChangeText={onAd}
          placeholder="Adım adı"
          placeholderTextColor={COLORS.textLight}
        />
        <Text style={[styles.adimMeta, { color: soru ? renk : COLORS.textLight }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {/* Soru sayısı doğrudan düzenlenebilir pill — ders renginde, "netine işlenen" değer. */}
      {soru && (
        <TouchableOpacity
          style={[styles.soruPill, { backgroundColor: renk + '14', borderColor: renk + '55' }]}
          onPress={() => onAyar('soru')}
          activeOpacity={0.75}
        >
          <Text style={[styles.soruPillSayi, { color: renk }]}>{adim.soru ?? 0}</Text>
          <Text style={[styles.soruPillBirim, { color: renk }]}>soru</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.dkPill} onPress={() => onAyar('dk')} activeOpacity={0.75}>
        <Text style={styles.dkPillSayi}>{adim.dk}</Text>
        <Text style={styles.dkPillBirim}>dk</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.silBtn} onPress={onSil} activeOpacity={0.7} hitSlop={6}>
        <Ionicons name="close" size={16} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Adım ayar sayfası (süre + soru sayısı) ───

function AyarModal({
  acik,
  adim,
  odak,
  renk,
  onKapat,
  onKaydet,
}: {
  acik: boolean;
  adim: Adim | null;
  odak: 'dk' | 'soru';
  renk: string;
  onKapat: () => void;
  onKaydet: (dk: number, soru: number) => void;
}) {
  const [dk, setDk] = useState(10);
  const [soru, setSoru] = useState(10);

  useEffect(() => {
    if (acik && adim) {
      setDk(adim.dk || 5);
      setSoru(adim.soru ?? 10);
    }
  }, [acik, adim]);

  const soruVar = adim?.tip === 'soru';
  // Soru pill'inden açıldıysa soru alanını, aksi halde süreyi vurgula.
  const soruOdak = soruVar && odak === 'soru';

  return (
    <Modal visible={acik} animationType="slide" transparent statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onKapat} />
      <View style={styles.sheet}>
        <View style={styles.sheetTutamac} />
        <Text style={styles.sheetBaslik}>{adim ? `${ADIM_META[adim.tip].ad} adımı` : 'Adım'}</Text>

        {soruVar && (
          <>
            <Text style={styles.ayarEtiket}>Soru sayısı</Text>
            <Stepper deger={soru} adim={5} min={0} birim="soru" renk={renk} vurgu={soruOdak} onDegis={setSoru} />
          </>
        )}

        <Text style={styles.ayarEtiket}>Süre (dakika)</Text>
        <Stepper deger={dk} adim={5} min={5} birim="dk" renk={renk} vurgu={soruVar && !soruOdak} onDegis={setDk} />

        <TouchableOpacity
          style={[styles.ayarKaydet, { backgroundColor: renk }]}
          onPress={() => onKaydet(dk, soru)}
          activeOpacity={0.9}
        >
          <Text style={styles.ayarKaydetMetin}>Tamam</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function Stepper({
  deger,
  adim,
  min,
  birim,
  renk,
  vurgu = false,
  onDegis,
}: {
  deger: number;
  adim: number;
  min: number;
  birim: string;
  renk: string;
  vurgu?: boolean;
  onDegis: (v: number) => void;
}) {
  return (
    <View style={[styles.stepper, vurgu && { borderColor: renk, backgroundColor: renk + '0D' }]}>
      <TouchableOpacity
        style={styles.stepperBtn}
        onPress={() => onDegis(Math.max(min, deger - adim))}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={20} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.stepperDegerKutu}>
        <Text style={styles.stepperDeger}>{deger}</Text>
        <Text style={styles.stepperBirim}>{birim}</Text>
      </View>
      <TouchableOpacity
        style={[styles.stepperBtn, styles.stepperArti, { backgroundColor: renk }]}
        onPress={() => onDegis(deger + adim)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Stiller ──────────────────────────────────

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 13,
    paddingHorizontal: 14,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  ikonBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBaslik: { fontSize: 16, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  headerTarih: { fontSize: 11.5, fontWeight: '700', color: COLORS.textLight, marginTop: 1 },

  etiket: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.textLight,
  },

  // Başlık alanı
  baslikKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 1,
  },
  baslikInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: COLORS.text,
    padding: 0,
  },

  // Başlangıç saati
  saatKutu: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  saatMetin: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  saatYardim: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, marginTop: 6 },
  saatSheetBaslikSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saatTamam: { fontSize: 15, fontWeight: '800', color: COLORS.primary },

  // Ders grupları
  dersGrubu: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dersEtiketKol: { width: 44, flexShrink: 0 },
  dersEtiket: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.3 },
  dersRozet: { fontSize: 9.5, fontWeight: '700', color: COLORS.textLight, marginTop: 1 },
  dersChipler: { flex: 1, flexDirection: 'row', gap: 7 },
  dersChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  dersNokta: { width: 7, height: 7, borderRadius: 99 },
  dersChipMetin: { fontSize: 12.5, fontWeight: '700' },

  // Adımlar başlığı
  adimBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toplamMetin: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },

  // Boş durum
  bosAdim: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  bosAdimMetin: { fontSize: 13.5, fontWeight: '700', color: COLORS.textSecondary },
  bosAdimAlt: { fontSize: 12, fontWeight: '600', color: COLORS.textLight, marginTop: 3, textAlign: 'center' },

  // Adım satırı
  adimSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
  },
  adimIkonKutu: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  adimAdInput: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.text,
    padding: 0,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  adimMeta: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  dkPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  dkPillSayi: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  dkPillBirim: { fontSize: 10, fontWeight: '700', color: COLORS.textLight },
  soruPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
  },
  soruPillSayi: { fontSize: 14, fontWeight: '800' },
  soruPillBirim: { fontSize: 10, fontWeight: '700' },
  silBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: COLORS.error + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Ekleme butonları
  ekleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  ekleArti: {
    width: 22,
    height: 22,
    borderRadius: 99,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  ekleMetin: { fontSize: 13.5, fontWeight: '800' },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  olusturBtn: {
    height: 52,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 6,
  },
  olusturMetin: { fontSize: 16, fontWeight: '800', color: '#fff' },
  sinavUyari: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 13,
    borderRadius: 14,
    backgroundColor: COLORS.accent + '14',
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  sinavUyariMetin: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.accent },

  // Ayar modalı
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTutamac: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetBaslik: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  ayarEtiket: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 14, marginBottom: 8 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 5,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  stepperArti: { borderWidth: 0 },
  stepperDegerKutu: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  stepperDeger: { fontSize: 22, fontWeight: '800', color: COLORS.text, fontVariant: ['tabular-nums'] },
  stepperBirim: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  ayarKaydet: {
    height: 50,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  ayarKaydetMetin: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
