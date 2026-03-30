import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  Animated,
  Easing,
  ScrollView,
  FlatList,
} from 'react-native';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { usePlanlar, CalismaPlani, PomodoroSeans } from '../../contexts/PlanContext';
import { simdi } from '../../utils/tarih';

type Mod = 'calisma' | 'mola';
type Durum = 'bekliyor' | 'calisiyor' | 'duraklatildi';

const CALISMA_SURELERI = [25, 50];
const MOLA_SURELERI = [5, 10, 15];
const DURDURMA_NEDENLERI = ['Sıkıldım', 'Acil İş', 'Diğer'];

function onerMolaSuresi(calismaMin: number) {
  return calismaMin >= 50 ? 10 : 5;
}

export default function Pomodoro() {
  // Zamanlayıcı
  const [mod, setMod] = useState<Mod>('calisma');
  const [durum, setDurum] = useState<Durum>('bekliyor');
  const [calismaDakika, setCalismaDakika] = useState(25);
  const [molaDakika, setMolaDakika] = useState(5);
  const [kalanSaniye, setKalanSaniye] = useState(25 * 60);
  const [toplamSaniye, setToplamSaniye] = useState(25 * 60);

  // Konu
  const [ders, setDers] = useState('');
  const [konu, setKonu] = useState('');

  // Modallar
  const [ozelCalismaAcik, setOzelCalismaAcik] = useState(false);
  const [ozelGiris, setOzelGiris] = useState('');
  const [ozelHata, setOzelHata] = useState('');
  const [tamamlandiAcik, setTamamlandiAcik] = useState(false);
  const [secilenMola, setSecilenMola] = useState(5);
  const [nedenAcik, setNedenAcik] = useState(false);
  const [secilenNeden, setSecilenNeden] = useState('');
  const [molabittiAcik, setMolaBittiAcik] = useState(false);
  const [takvimAcik, setTakvimAcik] = useState(false);

  const { planlar, seanslar, seansEkle } = usePlanlar();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bugunTarih = useMemo(() => simdi().tarih, []);
  const bugunSeansCount = useMemo(
    () => seanslar.filter(s => s.tarih === bugunTarih).length,
    [seanslar, bugunTarih]
  );

  // ── Sayaç ──────────────────────────────────────────────
  useEffect(() => {
    if (durum === 'calisiyor') {
      intervalRef.current = setInterval(() => {
        setKalanSaniye((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setDurum('bekliyor');
            if (mod === 'calisma') {
              const onerilen = onerMolaSuresi(calismaDakika);
              setSecilenMola(onerilen);
              setTamamlandiAcik(true);
              kaydetSeans('tamamlandi', undefined, calismaDakika);
            } else {
              setMolaBittiAcik(true);
              setMod('calisma');
              const yeniSure = calismaDakika * 60;
              setToplamSaniye(yeniSure);
              return yeniSure;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [durum, mod]);

  // ── Nabız animasyonu ───────────────────────────────────
  useEffect(() => {
    if (durum === 'calisiyor') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [durum]);

  // ── Yardımcılar ────────────────────────────────────────
  function kaydetSeans(s: 'tamamlandi' | 'erken_bitti', neden?: string, hedef?: number) {
    const gecenDakika = Math.floor((toplamSaniye - kalanSaniye) / 60);
    const { tarih, saat } = simdi();
    seansEkle({
      tarih, saat,
      ders: ders || '—',
      konu: konu || '—',
      hedefDakika: hedef ?? Math.round(toplamSaniye / 60),
      tamamlananDakika: s === 'tamamlandi' ? (hedef ?? Math.round(toplamSaniye / 60)) : gecenDakika,
      durum: s,
      neden,
    });
  }

  function calismaSuresiSec(dakika: number) {
    if (durum !== 'bekliyor' || mod !== 'calisma') return;
    setCalismaDakika(dakika);
    setToplamSaniye(dakika * 60);
    setKalanSaniye(dakika * 60);
  }

  function ozelSureUygula() {
    const dak = parseInt(ozelGiris, 10);
    if (!ozelGiris || isNaN(dak) || dak < 1 || dak > 180) {
      setOzelHata('1 ile 180 dakika arasında gir');
      return;
    }
    calismaSuresiSec(dak);
    setOzelCalismaAcik(false);
    setOzelGiris('');
    setOzelHata('');
  }

  function baslat() {
    if (kalanSaniye === 0) return;
    setDurum('calisiyor');
  }

  function durdur() { setDurum('duraklatildi'); }

  function bitirBasildi() {
    // Çalışıyor veya duraklatılmışsa neden diyaloğunu aç
    setSecilenNeden('');
    setNedenAcik(true);
  }

  function nedenOnaylandi() {
    if (!secilenNeden) return;
    setNedenAcik(false);
    setDurum('bekliyor');
    if (mod === 'calisma') kaydetSeans('erken_bitti', secilenNeden);
    setMod('calisma');
    setKalanSaniye(calismaDakika * 60);
    setToplamSaniye(calismaDakika * 60);
  }

  function molayiBaslat() {
    setTamamlandiAcik(false);
    setMod('mola');
    setToplamSaniye(secilenMola * 60);
    setKalanSaniye(secilenMola * 60);
    setDurum('calisiyor');
  }

  function molaAtla() {
    setTamamlandiAcik(false);
    setMod('calisma');
    setKalanSaniye(calismaDakika * 60);
    setToplamSaniye(calismaDakika * 60);
  }

  function molaBittiKapat() {
    setMolaBittiAcik(false);
  }

  function planSec(plan: CalismaPlani) {
    setDers(plan.ders);
    setKonu(plan.konu);
    setTakvimAcik(false);
  }

  // ── Hesaplamalar ───────────────────────────────────────
  const dk = Math.floor(kalanSaniye / 60);
  const sn = kalanSaniye % 60;
  const sureMetin = `${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
  const ilerleme = toplamSaniye > 0 ? 1 - kalanSaniye / toplamSaniye : 0;
  const aktifSure = mod === 'mola' ? molaDakika : calismaDakika;

  // ── Render ─────────────────────────────────────────────
  return (
    <View style={styles.ekran}>
      <ScrollView contentContainerStyle={styles.icerik} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Başlık */}
        <View style={styles.baslikRow}>
          <Text style={styles.baslik}>{mod === 'mola' ? 'Mola' : 'Pomodoro'}</Text>
          {seanslar.length > 0 && (
            <View style={styles.bugunBadge}>
              <Text style={styles.bugunMetin}>{bugunSeansCount} seans bugün</Text>
            </View>
          )}
        </View>

        {/* Süre seçici — sadece çalışma modunda ve bekliyor */}
        {mod === 'calisma' && durum === 'bekliyor' && (
          <View style={styles.seciciRow}>
            {CALISMA_SURELERI.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.seciciButon, calismaDakika === d && styles.seciciAktif]}
                onPress={() => calismaSuresiSec(d)}
                activeOpacity={0.8}
              >
                <Text style={[styles.seciciMetin, calismaDakika === d && styles.seciciMetinAktif]}>{d} dk</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.seciciButon} onPress={() => setOzelCalismaAcik(true)} activeOpacity={0.8}>
              <Ionicons name="pencil-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.seciciMetin}>Özel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Zamanlayıcı */}
        <Animated.View style={[styles.halkaSarici, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.halka, mod === 'mola' && styles.halkaMola]}>
            <View style={[styles.halkaIc, { opacity: 0.08 + ilerleme * 0.92 }]} />
            <View style={styles.merkezIcerik}>
              <Text style={styles.sureMetin}>{sureMetin}</Text>
              <Text style={styles.modEtiket}>
                {mod === 'mola'
                  ? '☕ Mola'
                  : durum === 'calisiyor' ? 'Odaklanıyor…'
                  : durum === 'duraklatildi' ? 'Duraklatıldı'
                  : 'Hazır'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Kontrol butonları */}
        <View style={styles.kontrolRow}>
          {durum === 'calisiyor' ? (
            <TouchableOpacity style={styles.durBtn} onPress={durdur} activeOpacity={0.8}>
              <Ionicons name="pause" size={20} color={COLORS.white} />
              <Text style={styles.btnMetin}>Durdur</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.baslatBtn, kalanSaniye === 0 && styles.btnDevre]}
              onPress={baslat}
              activeOpacity={0.8}
              disabled={kalanSaniye === 0}
            >
              <Ionicons name="play" size={20} color={COLORS.white} />
              <Text style={styles.btnMetin}>{durum === 'duraklatildi' ? 'Devam' : 'Başlat'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.bitirBtn, durum === 'bekliyor' && styles.btnDevre]}
            onPress={bitirBasildi}
            activeOpacity={0.8}
            disabled={durum === 'bekliyor'}
          >
            <Ionicons name="stop" size={18} color={COLORS.primary} />
            <Text style={styles.bitirMetin}>Bitir</Text>
          </TouchableOpacity>
        </View>

        {/* Konu kartı */}
        <View style={styles.konuKart}>
          <View style={styles.konuKartBaslik}>
            <Ionicons name="book-outline" size={15} color={COLORS.primary} />
            <Text style={styles.konuKartBaslikMetin}>Ne çalışıyorsun?</Text>
            {planlar.length > 0 && (
              <TouchableOpacity style={styles.takvimBtn} onPress={() => setTakvimAcik(true)} activeOpacity={0.8}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.primary} />
                <Text style={styles.takvimBtnMetin}>Takvimden seç</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput style={styles.konuInput} value={ders} onChangeText={setDers}
            placeholder="Ders  (örn. Matematik)" placeholderTextColor={COLORS.textLight} />
          <TextInput style={[styles.konuInput, { marginBottom: 0 }]} value={konu} onChangeText={setKonu}
            placeholder="Konu  (örn. Türev)" placeholderTextColor={COLORS.textLight} />
        </View>

        {/* Geçmiş seanslar */}
        {seanslar.length > 0 && (
          <View style={styles.gecmisAlani}>
            <Text style={styles.gecmisBaslik}>Son Seanslar</Text>
            {seanslar.slice(0, 8).map((s) => (
              <SeansKarti key={s.id} seans={s} />
            ))}
          </View>
        )}

      </ScrollView>

      {/* ── Özel süre modal ── */}
      <Modal visible={ozelCalismaAcik} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => { setOzelCalismaAcik(false); setOzelHata(''); }} />
        <View style={styles.kucukDialog}>
          <Text style={styles.dialogBaslik}>Özel Süre</Text>
          <View style={[styles.ozelInput, ozelHata ? styles.hataliInput : null]}>
            <TextInput
              style={styles.ozelInputMetin}
              value={ozelGiris}
              onChangeText={(v) => { setOzelGiris(v); setOzelHata(''); }}
              placeholder="örn. 45"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              maxLength={3}
              autoFocus
            />
            <Text style={styles.ozelDk}>dakika</Text>
          </View>
          {ozelHata ? <Text style={styles.hataMetin}>{ozelHata}</Text> : null}
          <View style={styles.dialogButonRow}>
            <TouchableOpacity style={styles.iptalBtn} onPress={() => { setOzelCalismaAcik(false); setOzelHata(''); }} activeOpacity={0.8}>
              <Text style={styles.iptalMetin}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.onayBtn} onPress={ozelSureUygula} activeOpacity={0.8}>
              <Text style={styles.onayMetin}>Uygula</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Tamamlandı + mola seçimi ── */}
      <Modal visible={tamamlandiAcik} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => {}} />
        <View style={styles.buyukDialog}>
          <Text style={styles.emojiMetin}>🎉</Text>
          <Text style={styles.dialogBaslik}>Tebrikler!</Text>
          <Text style={styles.dialogMesaj}>
            {aktifSure} dakika odaklandın.{'\n'}Şimdi mola zamanı!
          </Text>
          <Text style={styles.molaSecBaslik}>Mola süresi seç</Text>
          <View style={styles.molaSecRow}>
            {MOLA_SURELERI.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.molaSecButon, secilenMola === m && styles.molaSecAktif]}
                onPress={() => setSecilenMola(m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.molaSecMetin, secilenMola === m && styles.molaSecMetinAktif]}>{m} dk</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dialogButonRow}>
            <TouchableOpacity style={styles.iptalBtn} onPress={molaAtla} activeOpacity={0.8}>
              <Text style={styles.iptalMetin}>Atla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.onayBtn} onPress={molayiBaslat} activeOpacity={0.8}>
              <Text style={styles.onayMetin}>Molayı Başlat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Mola bitti ── */}
      <Modal visible={molabittiAcik} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={molaBittiKapat} />
        <View style={styles.buyukDialog}>
          <Text style={styles.emojiMetin}>⚡</Text>
          <Text style={styles.dialogBaslik}>Mola Bitti!</Text>
          <Text style={styles.dialogMesaj}>Yeni bir seans başlatmaya hazır mısın?</Text>
          <TouchableOpacity style={[styles.onayBtn, { marginTop: 8 }]} onPress={molaBittiKapat} activeOpacity={0.8}>
            <Text style={styles.onayMetin}>Hazırım!</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Durdurma nedeni ── */}
      <Modal visible={nedenAcik} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setNedenAcik(false)} />
        <View style={styles.buyukDialog}>
          <Text style={styles.emojiMetin}>🛑</Text>
          <Text style={styles.dialogBaslik}>Neden bitiriyorsun?</Text>
          <Text style={styles.dialogMesaj}>Seans erken bitirilecek. Bir neden seç:</Text>
          <View style={styles.nedenListesi}>
            {DURDURMA_NEDENLERI.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.nedenSatir, secilenNeden === n && styles.nedenAktif]}
                onPress={() => setSecilenNeden(n)}
                activeOpacity={0.8}
              >
                <View style={[styles.nedenRadyo, secilenNeden === n && styles.nedenRadyoAktif]}>
                  {secilenNeden === n && <View style={styles.nedenRadyoIc} />}
                </View>
                <Text style={[styles.nedenMetin, secilenNeden === n && styles.nedenMetinAktif]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dialogButonRow}>
            <TouchableOpacity style={styles.iptalBtn} onPress={() => setNedenAcik(false)} activeOpacity={0.8}>
              <Text style={styles.iptalMetin}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.onayBtn, !secilenNeden && styles.btnDevre]}
              onPress={nedenOnaylandi}
              activeOpacity={0.8}
              disabled={!secilenNeden}
            >
              <Text style={styles.onayMetin}>Bitir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Takvimden seç ── */}
      <Modal visible={takvimAcik} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={() => setTakvimAcik(false)} />
        <View style={styles.altSheet}>
          <View style={styles.tutamac} />
          <Text style={styles.altSheetBaslik}>Plan Seç</Text>
          <FlatList
            data={planlar}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 360 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.ayirici} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.planSatir} onPress={() => planSec(item)} activeOpacity={0.75}>
                <View style={styles.planRozet}>
                  <Text style={styles.planRozetMetin}>{item.ders.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planDers}>{item.ders}</Text>
                  <Text style={styles.planKonu}>{item.konu}</Text>
                </View>
                <Text style={styles.planTarih}>{item.tarih}</Text>
                <Ionicons name="chevron-forward" size={15} color={COLORS.textLight} />
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

    </View>
  );
}

function SeansKarti({ seans }: { seans: PomodoroSeans }) {
  const tamamlandi = seans.durum === 'tamamlandi';
  return (
    <View style={styles.seansKart}>
      <View style={[styles.seansIkon, { backgroundColor: tamamlandi ? '#10B98118' : '#EF444418' }]}>
        <Ionicons
          name={tamamlandi ? 'checkmark-circle-outline' : 'close-circle-outline'}
          size={20}
          color={tamamlandi ? COLORS.success : COLORS.error}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.seansDers}>{seans.ders} · {seans.konu}</Text>
        <Text style={styles.seansAlt}>
          {seans.tarih} {seans.saat}
          {' · '}{tamamlandi ? `${seans.tamamlananDakika} dk` : `${seans.tamamlananDakika}/${seans.hedefDakika} dk`}
          {seans.neden ? ` · ${seans.neden}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },
  icerik: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 32 },

  baslikRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  baslik: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  bugunBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  bugunMetin: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  seciciRow: { flexDirection: 'row', gap: 8, marginBottom: 28, justifyContent: 'center' },
  seciciButon: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  seciciAktif: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  seciciMetin: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  seciciMetinAktif: { color: COLORS.primary },

  halkaSarici: { alignSelf: 'center', marginBottom: 28 },
  halka: {
    width: 210, height: 210, borderRadius: 105,
    backgroundColor: COLORS.card,
    borderWidth: 10, borderColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
  },
  halkaMola: { borderColor: '#10B98130' },
  halkaIc: {
    position: 'absolute', width: 210, height: 210, borderRadius: 105,
    backgroundColor: COLORS.primary,
  },
  merkezIcerik: { alignItems: 'center', zIndex: 1 },
  sureMetin: { fontSize: 52, fontWeight: '700', color: COLORS.text, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  modEtiket: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  kontrolRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  baslatBtn: {
    flex: 1, flexDirection: 'row', height: 50,
    backgroundColor: COLORS.primary, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  durBtn: {
    flex: 1, flexDirection: 'row', height: 50,
    backgroundColor: COLORS.accent, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  bitirBtn: {
    flexDirection: 'row', height: 50, paddingHorizontal: 18,
    backgroundColor: COLORS.primaryLight, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  btnDevre: { opacity: 0.35 },
  btnMetin: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  bitirMetin: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  konuKart: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 20,
  },
  konuKartBaslik: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  konuKartBaslikMetin: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, flex: 1 },
  takvimBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: 20,
  },
  takvimBtnMetin: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  konuInput: {
    backgroundColor: COLORS.background, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 12, height: 42, fontSize: 14, color: COLORS.text, marginBottom: 8,
  },

  gecmisAlani: { marginBottom: 8 },
  gecmisBaslik: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 10 },
  seansKart: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 8,
  },
  seansIkon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  seansDers: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  seansAlt: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },

  kucukDialog: {
    position: 'absolute', alignSelf: 'center', top: '35%',
    width: '82%', backgroundColor: COLORS.card, borderRadius: 20, padding: 24,
  },
  buyukDialog: {
    position: 'absolute', alignSelf: 'center', top: '22%',
    width: '84%', backgroundColor: COLORS.card, borderRadius: 20, padding: 24, alignItems: 'center',
  },
  emojiMetin: { fontSize: 40, marginBottom: 10 },
  dialogBaslik: { fontSize: 19, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  dialogMesaj: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },

  molaSecBaslik: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 10, alignSelf: 'flex-start' },
  molaSecRow: { flexDirection: 'row', gap: 8, marginBottom: 18, alignSelf: 'stretch' },
  molaSecButon: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  molaSecAktif: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  molaSecMetin: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  molaSecMetinAktif: { color: COLORS.primary },

  nedenListesi: { alignSelf: 'stretch', marginBottom: 16, gap: 8 },
  nedenSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  nedenAktif: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  nedenRadyo: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: COLORS.textLight,
    justifyContent: 'center', alignItems: 'center',
  },
  nedenRadyoAktif: { borderColor: COLORS.primary },
  nedenRadyoIc: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  nedenMetin: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  nedenMetinAktif: { color: COLORS.primary, fontWeight: '600' },

  dialogButonRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  iptalBtn: {
    flex: 1, height: 46, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  iptalMetin: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  onayBtn: {
    flex: 1, height: 46, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  onayMetin: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  ozelInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 14, height: 50, marginVertical: 12,
  },
  hataliInput: { borderColor: COLORS.error },
  ozelInputMetin: { flex: 1, fontSize: 22, fontWeight: '700', color: COLORS.text },
  ozelDk: { fontSize: 14, color: COLORS.textSecondary },
  hataMetin: { fontSize: 12, color: COLORS.error, marginBottom: 4 },

  altSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  tutamac: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.cardBorder, alignSelf: 'center', marginBottom: 16,
  },
  altSheetBaslik: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  ayirici: { height: 1, backgroundColor: COLORS.cardBorder },
  planSatir: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  planRozet: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  planRozetMetin: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  planDers: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  planKonu: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  planTarih: { fontSize: 11, color: COLORS.textLight, marginRight: 4 },
});
