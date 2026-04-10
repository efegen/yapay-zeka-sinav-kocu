import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Timestamp } from 'firebase/firestore';
import { auth } from '../../services/firebaseConfig';
import {
  Gorev,
  GorevTip,
  gorevEkle,
  gorevSil,
  gorevTamamla,
  gunGorevleriniGetir,
} from '../../services/firestoreService';
import { COLORS } from '../../constants/colors';

const PRIMARY = COLORS.primary;
const TEAL = '#00BFA5';

const GUN_KISALTMALARI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const GUN_ADLARI = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi',
];
const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function pazartesiBaslangicGunIndeksi(gun: number): number {
  return (gun + 6) % 7;
}

function haftaGunleriniGetir(tarih: Date): Date[] {
  const monday = new Date(tarih);
  monday.setDate(tarih.getDate() - pazartesiBaslangicGunIndeksi(tarih.getDay()));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function ayniGunMu(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function tarihDetayiFormatla(tarih: Date): string {
  return `${tarih.getDate()} ${AY_ADLARI[tarih.getMonth()]} ${tarih.getFullYear()}`;
}

const BOŞ_FORM = {
  baslik: '',
  tip: 'planned' as GorevTip,
  sure: '25',
  saat: new Date(),
};

export default function Takvim() {
  const [secilenTarih, setSecilenTarih] = useState(() => {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    return bugun;
  });
  const [planlananGorevler, setPlanlananGorevler] = useState<Gorev[]>([]);
  const [istediginZamanGorevler, setIstediginZamanGorevler] = useState<Gorev[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [gorevModalAcik, setGorevModalAcik] = useState(false);
  const [ayTakvimAcik, setAyTakvimAcik] = useState(false);
  const [form, setForm] = useState({ ...BOŞ_FORM });
  const [saatPickerAcik, setSaatPickerAcik] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const uid = auth.currentUser?.uid;

  const gorevleriYukle = useCallback(async () => {
    if (!uid) return;
    setYukleniyor(true);
    try {
      const { planned, anytime } = await gunGorevleriniGetir(uid, secilenTarih);
      setPlanlananGorevler(planned);
      setIstediginZamanGorevler(anytime);
    } catch (err) {
      console.error('[Takvim] gorevleriYukle hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  }, [uid, secilenTarih]);

  useEffect(() => {
    gorevleriYukle();
  }, [gorevleriYukle]);

  function buguneGit() {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setSecilenTarih(t);
  }

  function haftaDegistir(delta: number) {
    setSecilenTarih((prev) => {
      const yeni = new Date(prev);
      yeni.setDate(prev.getDate() + delta);
      return yeni;
    });
  }

  async function tamamlaToggle(gorevId: string, mevcutDurum: boolean) {
    if (!uid) return;
    try {
      await gorevTamamla(uid, gorevId, !mevcutDurum);
      await gorevleriYukle();
    } catch (err) {
      console.error('[Takvim] tamamlaToggle hatası:', err);
    }
  }

  function silOnay(gorevId: string, baslik: string) {
    Alert.alert(
      'Görevi Sil',
      `"${baslik}" görevini silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (!uid) return;
            try {
              await gorevSil(uid, gorevId);
              await gorevleriYukle();
            } catch (err) {
              console.error('[Takvim] gorevSil hatası:', err);
            }
          },
        },
      ]
    );
  }

  async function kaydet() {
    if (!uid || !form.baslik.trim()) return;
    const sureNum = parseInt(form.sure, 10);
    if (isNaN(sureNum) || sureNum <= 0) return;

    setKaydediliyor(true);
    try {
      let tarih: Timestamp | null = null;
      if (form.tip === 'planned') {
        const combined = new Date(secilenTarih);
        combined.setHours(form.saat.getHours(), form.saat.getMinutes(), 0, 0);
        tarih = Timestamp.fromDate(combined);
      }
      await gorevEkle(uid, {
        baslik: form.baslik.trim(),
        sure: sureNum,
        tip: form.tip,
        tarih,
        tamamlandi: false,
      });
      setGorevModalAcik(false);
      setForm({ ...BOŞ_FORM, saat: new Date() });
      await gorevleriYukle();
    } catch (err) {
      console.error('[Takvim] kaydet hatası:', err);
    } finally {
      setKaydediliyor(false);
    }
  }

  function modalKapat() {
    setGorevModalAcik(false);
    setForm({ ...BOŞ_FORM, saat: new Date() });
    setSaatPickerAcik(false);
  }

  const haftaGunleri = haftaGunleriniGetir(secilenTarih);
  const bugun = new Date();

  return (
    <View style={styles.ekran}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        {/* Orta: gün adı + tarih — absolute so it stays centered regardless of side widths */}
        <View style={styles.headerOrta} pointerEvents="none">
          <Text style={styles.gunAdi}>{GUN_ADLARI[secilenTarih.getDay()]}</Text>
          <Text style={styles.tarihDetay}>{tarihDetayiFormatla(secilenTarih)}</Text>
        </View>

        {/* Sol: Bugün + aylık takvim */}
        <View style={styles.headerSol}>
          <TouchableOpacity style={styles.bugunButon} onPress={buguneGit} activeOpacity={0.8}>
            <Ionicons name="time-outline" size={12} color={PRIMARY} style={{ marginRight: 3 }} />
            <Text style={styles.bugunMetin}>Bugün</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ikonButon}
            onPress={() => setAyTakvimAcik(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={18} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        {/* Sağ: + FAB */}
        <TouchableOpacity
          style={styles.fabButon}
          onPress={() => setGorevModalAcik(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ─── Week strip with arrows ─── */}
      <View style={styles.haftaSeritSarici}>
        <TouchableOpacity
          onPress={() => haftaDegistir(-7)}
          style={styles.okButon}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={styles.gunlerSatir}>
          {haftaGunleri.map((gun, i) => {
            const secili = ayniGunMu(gun, secilenTarih);
            const bugunMu = ayniGunMu(gun, bugun);
            return (
              <TouchableOpacity
                key={i}
                style={styles.gunButon}
                onPress={() => setSecilenTarih(gun)}
                activeOpacity={0.7}
              >
                <Text style={[styles.gunKisaltma, secili && styles.seciliGunMetin]}>
                  {GUN_KISALTMALARI[pazartesiBaslangicGunIndeksi(gun.getDay())]}
                </Text>
                <View
                  style={[
                    styles.gunDaire,
                    secili && styles.seciliGunDaire,
                    bugunMu && !secili && styles.bugunDaire,
                  ]}
                >
                  <Text
                    style={[
                      styles.gunSayi,
                      secili && styles.seciliGunSayiMetin,
                      bugunMu && !secili && styles.bugunSayiMetin,
                    ]}
                  >
                    {gun.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => haftaDegistir(7)}
          style={styles.okButon}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ─── Task content ─── */}
      {yukleniyor ? (
        <View style={styles.yukleniyor}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.icerik} showsVerticalScrollIndicator={false}>
          <BolumBasligi ikon="time-outline" renk={PRIMARY} baslik="Planlandı" />
          {planlananGorevler.length === 0 ? (
            <BosHal />
          ) : (
            planlananGorevler.map((gorev) => (
              <GorevKarti
                key={gorev.id}
                gorev={gorev}
                solRenk={PRIMARY}
                onToggle={() => tamamlaToggle(gorev.id, gorev.tamamlandi)}
                onLongPress={() => silOnay(gorev.id, gorev.baslik)}
              />
            ))
          )}

          <BolumBasligi ikon="checkmark-circle-outline" renk={TEAL} baslik="İstediğin Zaman" />
          {istediginZamanGorevler.length === 0 ? (
            <BosHal />
          ) : (
            istediginZamanGorevler.map((gorev) => (
              <GorevKarti
                key={gorev.id}
                gorev={gorev}
                solRenk={TEAL}
                onToggle={() => tamamlaToggle(gorev.id, gorev.tamamlandi)}
                onLongPress={() => silOnay(gorev.id, gorev.baslik)}
              />
            ))
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ─── Monthly calendar modal ─── */}
      <AyTakvimModal
        visible={ayTakvimAcik}
        secilenTarih={secilenTarih}
        onSecim={(tarih) => {
          setSecilenTarih(tarih);
          setAyTakvimAcik(false);
        }}
        onKapat={() => setAyTakvimAcik(false)}
      />

      {/* ─── Add task modal ─── */}
      <Modal visible={gorevModalAcik} animationType="slide" transparent statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={modalKapat} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          <View style={styles.sheetTutamac} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetBaslik}>Yeni Görev Ekle</Text>

            <View style={styles.alan}>
              <Text style={styles.alanEtiket}>Görev Adı</Text>
              <View style={styles.inputSarici}>
                <TextInput
                  style={styles.input}
                  value={form.baslik}
                  onChangeText={(v) => setForm((f) => ({ ...f, baslik: v }))}
                  placeholder="Matematik - Türev"
                  placeholderTextColor={COLORS.textLight}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.alan}>
              <Text style={styles.alanEtiket}>Tür</Text>
              <View style={styles.segmentSarici}>
                <TouchableOpacity
                  style={[styles.segmentButon, form.tip === 'planned' && styles.segmentButonAktif]}
                  onPress={() => setForm((f) => ({ ...f, tip: 'planned' }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentMetin, form.tip === 'planned' && styles.segmentMetinAktif]}>
                    Planlandı
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentButon, form.tip === 'anytime' && styles.segmentButonAktif]}
                  onPress={() => setForm((f) => ({ ...f, tip: 'anytime' }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentMetin, form.tip === 'anytime' && styles.segmentMetinAktif]}>
                    İstediğin Zaman
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {form.tip === 'planned' && (
              <View style={styles.alan}>
                <Text style={styles.alanEtiket}>Saat</Text>
                <TouchableOpacity
                  style={styles.inputSarici}
                  onPress={() => setSaatPickerAcik(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={16} color={COLORS.textLight} style={styles.inputIkon} />
                  <Text style={[styles.input, { color: COLORS.text }]}>
                    {form.saat.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color={COLORS.textLight} />
                </TouchableOpacity>

                {saatPickerAcik && Platform.OS === 'ios' && (
                  <View style={styles.iosPickerSarici}>
                    <DateTimePicker
                      value={form.saat}
                      mode="time"
                      display="spinner"
                      onChange={(_: DateTimePickerEvent, d?: Date) => {
                        if (d) setForm((f) => ({ ...f, saat: d }));
                      }}
                      locale="tr-TR"
                      themeVariant="light"
                    />
                    <TouchableOpacity
                      style={styles.iosPickerTamam}
                      onPress={() => setSaatPickerAcik(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.iosPickerTamamMetin}>Tamam</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {saatPickerAcik && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={form.saat}
                    mode="time"
                    display="default"
                    onChange={(_: DateTimePickerEvent, d?: Date) => {
                      setSaatPickerAcik(false);
                      if (d) setForm((f) => ({ ...f, saat: d }));
                    }}
                  />
                )}
              </View>
            )}

            <View style={styles.alan}>
              <Text style={styles.alanEtiket}>Süre (dakika)</Text>
              <View style={styles.inputSarici}>
                <Ionicons name="hourglass-outline" size={16} color={COLORS.textLight} style={styles.inputIkon} />
                <TextInput
                  style={styles.input}
                  value={form.sure}
                  onChangeText={(v) => setForm((f) => ({ ...f, sure: v }))}
                  placeholder="25"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.butonlar}>
              <TouchableOpacity style={styles.iptalButon} onPress={modalKapat} activeOpacity={0.8}>
                <Text style={styles.iptalMetin}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.kaydetButon, kaydediliyor && { opacity: 0.7 }]}
                onPress={kaydet}
                activeOpacity={0.8}
                disabled={kaydediliyor}
              >
                {kaydediliyor ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.kaydetMetin}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Monthly calendar modal ───────────────────

function AyTakvimModal({
  visible,
  secilenTarih,
  onSecim,
  onKapat,
}: {
  visible: boolean;
  secilenTarih: Date;
  onSecim: (tarih: Date) => void;
  onKapat: () => void;
}) {
  const [ayYil, setAyYil] = useState({
    ay: secilenTarih.getMonth(),
    yil: secilenTarih.getFullYear(),
  });

  useEffect(() => {
    if (visible) {
      setAyYil({ ay: secilenTarih.getMonth(), yil: secilenTarih.getFullYear() });
    }
  }, [visible, secilenTarih]);

  function ayDegistir(delta: number) {
    setAyYil((prev) => {
      let ay = prev.ay + delta;
      let yil = prev.yil;
      if (ay < 0) { ay = 11; yil--; }
      if (ay > 11) { ay = 0; yil++; }
      return { ay, yil };
    });
  }

  const ilkGun = new Date(ayYil.yil, ayYil.ay, 1);
  const gridBaslangic = new Date(ilkGun);
  gridBaslangic.setDate(1 - pazartesiBaslangicGunIndeksi(ilkGun.getDay()));

  const gunler = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridBaslangic);
    d.setDate(gridBaslangic.getDate() + i);
    return d;
  });

  const bugun = new Date();

  // Split into 6 rows of 7
  const haftalar = Array.from({ length: 6 }, (_, h) => gunler.slice(h * 7, h * 7 + 7));

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <Pressable style={ayStyles.overlay} onPress={onKapat}>
        {/* onStartShouldSetResponder stops touches on the card from bubbling up to the Pressable */}
        <View style={ayStyles.kart} onStartShouldSetResponder={() => true}>
          {/* Month navigation */}
          <View style={ayStyles.ayBaslik}>
            <TouchableOpacity onPress={() => ayDegistir(-1)} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={ayStyles.ayAdi}>
              {AY_ADLARI[ayYil.ay]} {ayYil.yil}
            </Text>
            <TouchableOpacity onPress={() => ayDegistir(1)} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={ayStyles.gunBasliklari}>
            {GUN_KISALTMALARI.map((k) => (
              <Text key={k} style={ayStyles.gunBaslik}>{k}</Text>
            ))}
          </View>

          {/* Grid */}
          {haftalar.map((hafta, hi) => (
            <View key={hi} style={ayStyles.haftaSatiri}>
              {hafta.map((gun, gi) => {
                const buAy = gun.getMonth() === ayYil.ay;
                const secili = ayniGunMu(gun, secilenTarih);
                const bugunMu = ayniGunMu(gun, bugun);
                return (
                  <TouchableOpacity
                    key={gi}
                    style={ayStyles.gunHucre}
                    onPress={() => onSecim(gun)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        ayStyles.gunHucreDaire,
                        secili && { backgroundColor: PRIMARY },
                        bugunMu && !secili && { borderWidth: 1.5, borderColor: PRIMARY },
                      ]}
                    >
                      <Text
                        style={[
                          ayStyles.gunSayi,
                          !buAy && ayStyles.digerAyMetin,
                          secili && ayStyles.seciliMetin,
                          bugunMu && !secili && { color: PRIMARY, fontWeight: '700' },
                        ]}
                      >
                        {gun.getDate()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────

function BolumBasligi({
  ikon,
  renk,
  baslik,
}: {
  ikon: React.ComponentProps<typeof Ionicons>['name'];
  renk: string;
  baslik: string;
}) {
  return (
    <View style={bolumStyles.satir}>
      <Ionicons name={ikon} size={14} color={renk} />
      <Text style={[bolumStyles.baslik, { color: renk }]}>{baslik}</Text>
    </View>
  );
}

const bolumStyles = StyleSheet.create({
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  baslik: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
});

function BosHal() {
  return (
    <View style={bosStyles.sarici}>
      <Ionicons name="calendar-outline" size={18} color={COLORS.textLight} />
      <Text style={bosStyles.metin}>Henüz görev yok</Text>
    </View>
  );
}

const bosStyles = StyleSheet.create({
  sarici: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  metin: { fontSize: 13, color: COLORS.textLight },
});

function GorevKarti({
  gorev,
  solRenk,
  onToggle,
  onLongPress,
}: {
  gorev: Gorev;
  solRenk: string;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={kartStyles.kart}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      delayLongPress={500}
    >
      <View style={[kartStyles.solSinir, { backgroundColor: solRenk }]} />
      <View style={kartStyles.icerik}>
        <Text style={[kartStyles.baslik, gorev.tamamlandi && kartStyles.tamamlandiMetin]} numberOfLines={2}>
          {gorev.baslik}
        </Text>
        <View style={kartStyles.rozet}>
          <Text style={kartStyles.rozetMetin}>{gorev.sure} dk</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onToggle} hitSlop={8} style={kartStyles.checkSarici} activeOpacity={0.7}>
        <View style={[kartStyles.checkbox, gorev.tamamlandi && { backgroundColor: solRenk, borderColor: solRenk }]}>
          {gorev.tamamlandi && <Ionicons name="checkmark" size={13} color="#fff" />}
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const kartStyles = StyleSheet.create({
  kart: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  solSinir: { width: 4 },
  icerik: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, gap: 6 },
  baslik: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  tamamlandiMetin: { textDecorationLine: 'line-through', color: COLORS.textLight },
  rozet: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rozetMetin: { fontSize: 12, color: COLORS.textSecondary },
  checkSarici: { justifyContent: 'center', paddingRight: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─── Monthly calendar styles ──────────────────

const ayStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  kart: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  ayBaslik: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ayAdi: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  gunBasliklari: { flexDirection: 'row', marginBottom: 6 },
  gunBaslik: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: COLORS.textLight },
  haftaSatiri: { flexDirection: 'row' },
  gunHucre: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  gunHucreDaire: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  gunSayi: { fontSize: 13, color: COLORS.text },
  digerAyMetin: { color: COLORS.textLight },
  seciliMetin: { color: '#fff', fontWeight: '700' },
});

// ─── Main styles ──────────────────────────────

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  headerSol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerOrta: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  bugunButon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bugunMetin: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  ikonButon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },

  gunAdi: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  tarihDetay: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },

  fabButon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },

  haftaSeritSarici: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  okButon: { paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  gunlerSatir: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  gunButon: { alignItems: 'center', paddingVertical: 2 },
  gunKisaltma: { fontSize: 11, fontWeight: '500', color: COLORS.textLight, marginBottom: 4 },
  seciliGunMetin: { color: PRIMARY },
  gunDaire: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  seciliGunDaire: { backgroundColor: PRIMARY },
  bugunDaire: { borderWidth: 1.5, borderColor: PRIMARY },
  gunSayi: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  seciliGunSayiMetin: { color: '#fff', fontWeight: '700' },
  bugunSayiMetin: { color: PRIMARY, fontWeight: '700' },

  yukleniyor: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  icerik: { paddingBottom: 32 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  sheetTutamac: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetBaslik: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 20 },

  alan: { marginBottom: 14 },
  alanEtiket: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  inputSarici: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIkon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: COLORS.text },

  segmentSarici: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 3,
    gap: 3,
  },
  segmentButon: { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  segmentButonAktif: { backgroundColor: PRIMARY },
  segmentMetin: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  segmentMetinAktif: { color: '#fff' },

  iosPickerSarici: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: 8,
    overflow: 'hidden',
  },
  iosPickerTamam: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  iosPickerTamamMetin: { fontSize: 15, fontWeight: '600', color: PRIMARY },

  butonlar: { flexDirection: 'row', gap: 10, marginTop: 8 },
  iptalButon: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  iptalMetin: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  kaydetButon: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PRIMARY,
  },
  kaydetMetin: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
