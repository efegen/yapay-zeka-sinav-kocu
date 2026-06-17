import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../hooks/useProfile';
import { COLORS } from '../../constants/colors';
import { ALT_CUBUK_BOSLUK } from '../../components/AltCubuk';
import { YKS_TARIHI, YKS_SEZON_BASLANGIC, YKS_YIL } from '../../constants/sinav';
import { gunFarki, tarihUzun, aralikOrani } from '../../utils/tarih';
import { auth } from '../../services/firebaseConfig';
import { denemeleriGetir } from '../../services/firestoreService';
import { netlerdenSiralama } from '../../services/yokatlasService';
import { fmtSira, type DenemeSonuc } from '../../models/deneme';

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// AYT alan dersleri — puan türüne göre hedef net toplamı için.
const AYT_ALANLARI: Record<string, string[]> = {
  SAY: ['ayt_matematik', 'ayt_fizik', 'ayt_kimya', 'ayt_biyoloji'],
  EA: ['ayt_matematik', 'ayt_edebiyat', 'ayt_tarih1', 'ayt_cografya1'],
  SOZ: ['ayt_edebiyat', 'ayt_tarih1', 'ayt_tarih2', 'ayt_cografya1', 'ayt_cografya2', 'ayt_felsefe', 'ayt_din'],
  DIL: ['ayt_yabancidil'],
};

export default function AnaSayfa() {
  const { profil, yukleniyor } = useProfile();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const SOR_SORULARI = [
    'Limit nasıl çalışılır?',
    'Türev ile integral farkı?',
    'Osmanlı neden çöktü?',
    'TYT mat nasıl biter?',
    'Paragraf nasıl çözülür?',
    'Kimyasal bağlar nelerdir?',
    'Trig formülleri nelerdir?',
    'İklim çeşitleri nelerdir?',
    'Felsefe AYT konuları neler?',
    'Günde kaç saat çalışayım?',
    'Zayıf ders nasıl çalışılır?',
    'Biyoloji hücre özeti ver',
  ];

  const [sorIdx, setSorIdx] = useState(0);
  const sorOpasit = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const dongu = setInterval(() => {
      Animated.timing(sorOpasit, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setSorIdx(prev => (prev + 1) % SOR_SORULARI.length);
        Animated.timing(sorOpasit, {
          toValue: 1,
          duration: 350,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    }, 4000);
    return () => clearInterval(dongu);
  }, []);

  const bugun = useMemo(() => new Date(), []);
  const tarihMetni = `${GUNLER[bugun.getDay()]} · ${bugun.getDate()} ${AYLAR[bugun.getMonth()]}`;
  const kalanGun = useMemo(() => gunFarki(YKS_TARIHI), []);
  const sinavTarihMetni = useMemo(() => tarihUzun(YKS_TARIHI), []);
  const sezonOrani = useMemo(() => aralikOrani(YKS_SEZON_BASLANGIC, YKS_TARIHI), []);

  // ── Denemelerden tahmini sıralama (son tam TYT+AYT denemesi) ──
  const uid = auth.currentUser?.uid;
  const [denemeler, setDenemeler] = useState<DenemeSonuc[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      denemeleriGetir(uid)
        .then(setDenemeler)
        .catch((e) => console.error('[AnaSayfa] denemeler yüklenemedi:', e));
    }, [uid])
  );

  const diploma = profil?.diplomaNotu ?? 0;
  const tamDenemeler = useMemo(() => denemeler.filter((d) => d.kapsam === 'ikisi'), [denemeler]);
  const guncelSira = useMemo(
    () => (tamDenemeler[0] ? netlerdenSiralama(tamDenemeler[0].tytNet, tamDenemeler[0].aytNet, tamDenemeler[0].alan, diploma) : null),
    [tamDenemeler, diploma]
  );
  const oncekiSira = useMemo(
    () => (tamDenemeler[1] ? netlerdenSiralama(tamDenemeler[1].tytNet, tamDenemeler[1].aytNet, tamDenemeler[1].alan, diploma) : null),
    [tamDenemeler, diploma]
  );
  // Pozitif trend = sıralama küçüldü (iyileşme).
  const siraTrend = guncelSira != null && oncekiSira != null ? oncekiSira - guncelSira : null;

  if (yukleniyor) {
    return (
      <View style={styles.merkezle}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const ilkAd = profil?.isim?.trim().split(' ')[0] || 'Öğrenci';
  const harf = (profil?.isim?.trim()?.[0] || '?').toUpperCase();
  const puanTuru = profil?.puanTuru;

  // ── Hedef özeti (üniversite/bölüm veya sıralama) ──
  const hedefMetni =
    profil?.hedefTuru === 'siralama' && profil?.hedefSiralama
      ? `${profil.hedefSiralama.toLocaleString('tr-TR')}. sıra`
      : profil?.hedefUniversite
        ? `${profil.hedefUniversite.split(' ')[0]}${profil.hedefBolum ? ' · ' + profil.hedefBolum.split(' ')[0] : ''}`
        : 'Hedef belirle';

  // ── Hedef netler (gerçek veri: hedefNetBilgisi) ──
  const hedefNet = profil?.hedefNetBilgisi;
  const netHazir = profil?.netFetchStatus === 'done' && !!hedefNet;

  const topla = (keys: string[]): number | null => {
    if (!hedefNet) return null;
    let toplam = 0;
    let bulundu = false;
    for (const k of keys) {
      const v = hedefNet[k];
      if (typeof v === 'number') {
        toplam += v;
        bulundu = true;
      }
    }
    return bulundu ? Math.round(toplam * 10) / 10 : null;
  };

  const tytHedef = topla(['tyt_turkce', 'tyt_matematik', 'tyt_fen', 'tyt_sosyal']);
  const aytHedef = topla(AYT_ALANLARI[puanTuru ?? ''] ?? []);
  const toplamHedef =
    tytHedef != null || aytHedef != null
      ? Math.round(((tytHedef ?? 0) + (aytHedef ?? 0)) * 10) / 10
      : null;

  const siralamaHedefVar = profil?.hedefTuru === 'siralama' && typeof profil?.hedefSiralama === 'number';

  return (
    <ScrollView
      style={styles.ekran}
      contentContainerStyle={[styles.icerik, { paddingBottom: insets.bottom + ALT_CUBUK_BOSLUK }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Başlık ─── */}
      <View style={styles.baslik}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tarih}>{tarihMetni}</Text>
          <Text style={styles.selam} numberOfLines={1}>Merhaba, {ilkAd}</Text>
        </View>
        <View style={styles.baslikSag}>
          {!!puanTuru && (
            <View style={styles.puanBadge}>
              <Text style={styles.puanMetin}>{puanTuru}</Text>
            </View>
          )}
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarHarf}>{harf}</Text>
          </LinearGradient>
        </View>
      </View>

      {/* ─── ★ Kalıcı AI Koç sor çubuğu ─── */}
      <Yukselen gecikme={40}>
        <TouchableOpacity
          style={styles.sorCubugu}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/(tabs)/ai-koc' as any, params: { soru: SOR_SORULARI[sorIdx] } })}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sorIkon}
          >
            <Ionicons name="sparkles" size={15} color="#fff" />
          </LinearGradient>
          <Text style={styles.sorMetin} numberOfLines={1}>
            AI Koç’a sor: <Animated.Text style={[styles.sorMetinVurgu, { opacity: sorOpasit }]}>“{SOR_SORULARI[sorIdx]}”</Animated.Text>
          </Text>
          <View style={styles.sorGonder}>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      </Yukselen>

      {/* ─── Geri sayım (hero) ─── */}
      <Yukselen gecikme={20}>
        <View style={styles.heroGolge}>
          <LinearGradient
            colors={['#6D28D9', COLORS.primary, COLORS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroDaire1} />
            <View style={styles.heroDaire2} />

            <View style={styles.heroUst}>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.heroEtiket}>YKS {YKS_YIL}’YA KALAN</Text>
                <View style={styles.heroSayiSatir}>
                  <Text style={styles.heroSayi}>{kalanGun}</Text>
                  <Text style={styles.heroGun}>gün</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.heroSinavEtiket}>Sınav</Text>
                <Text style={styles.heroSinavTarih}>{sinavTarihMetni}</Text>
                <View style={styles.heroPill}>
                  <Ionicons
                    name={siralamaHedefVar ? 'podium' : 'flag'}
                    size={12}
                    color="#fff"
                  />
                  <Text style={styles.heroPillMetin} numberOfLines={1}>{hedefMetni}</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroAlt}>
              <View style={styles.heroAltSatir}>
                <Text style={styles.heroAltMetin}>Hazırlık sezonu</Text>
                <Text style={styles.heroAltMetin}>%{Math.round(sezonOrani * 100)}</Text>
              </View>
              <View style={styles.heroRay}>
                <View style={[styles.heroDolgu, { width: `${Math.round(sezonOrani * 100)}%` }]} />
              </View>
            </View>
          </LinearGradient>
        </View>
      </Yukselen>

      {/* ─── Hedef netlerin (gerçek veri) ─── */}
      <Yukselen gecikme={200}>
        <View style={styles.kart}>
          <View style={styles.netBaslikSatir}>
            <View style={styles.satirSol}>
              <Ionicons name="locate" size={16} color={COLORS.accent} />
              <Text style={styles.kartBaslik}>Hedef netlerin</Text>
            </View>
            {netHazir && toplamHedef != null && (
              <Text style={styles.netToplam}>
                Toplam <Text style={styles.netToplamSayi}>{toplamHedef}</Text>
              </Text>
            )}
          </View>

          {netHazir ? (
            <View style={styles.netGovde}>
              {([
                { ad: 'TYT', deger: tytHedef, max: 120, renk: COLORS.primary },
                { ad: 'AYT', deger: aytHedef, max: 80, renk: COLORS.accent },
              ] as const).map((n) => (
                <View key={n.ad} style={{ flex: 1 }}>
                  <Text style={styles.netDers}>{n.ad} hedef</Text>
                  <View style={styles.netDegerSatir}>
                    <Text style={styles.netDeger}>{n.deger ?? '—'}</Text>
                    <Text style={styles.netMax}>/ {n.max}</Text>
                  </View>
                  <View style={styles.netRay}>
                    <View
                      style={[
                        styles.netDolgu,
                        { width: `${Math.min(100, ((n.deger ?? 0) / n.max) * 100)}%`, backgroundColor: n.renk },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.bosSatir}>
              <Text style={styles.kartNot}>
                Hedef netlerin profil ekranında hesaplanıyor. Hesaplanınca burada görünecek.
              </Text>
            </View>
          )}
        </View>
      </Yukselen>

      {/* ─── Tahmini sıralama — son tam denemeden ─── */}
      <Yukselen gecikme={280}>
        <View style={styles.kart}>
          <View style={styles.netBaslikSatir}>
            <View style={styles.satirSol}>
              <Ionicons name="podium" size={16} color={COLORS.primary} />
              <Text style={styles.kartBaslik}>Tahmini sıralama</Text>
            </View>
            {guncelSira == null ? (
              <YakindaPill />
            ) : siraTrend != null && siraTrend !== 0 ? (
              <View style={[styles.siraTrend, { backgroundColor: (siraTrend > 0 ? COLORS.success : COLORS.error) + '16' }]}>
                <Ionicons name={siraTrend > 0 ? 'trending-up' : 'trending-down'} size={12} color={siraTrend > 0 ? COLORS.success : COLORS.error} />
                <Text style={[styles.siraTrendMetin, { color: siraTrend > 0 ? COLORS.success : COLORS.error }]}>
                  {fmtSira(Math.abs(siraTrend))}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.siraGovde}>
            <Text style={styles.siraDeger}>{guncelSira != null ? `≈${fmtSira(guncelSira)}` : '—'}</Text>
            <Text style={styles.siraAlt}>{guncelSira != null ? 'tahmini sıran' : 'şu anki sıran'}</Text>
          </View>

          <Text style={styles.kartNot}>
            {guncelSira != null
              ? siralamaHedefVar
                ? guncelSira <= profil!.hedefSiralama!
                  ? `🎯 Hedefini geçtin — hedef ${profil!.hedefSiralama!.toLocaleString('tr-TR')}. sıra.`
                  : `Hedefin ${profil!.hedefSiralama!.toLocaleString('tr-TR')}. sıra · arada ≈${fmtSira(guncelSira - profil!.hedefSiralama!)} sıra var.`
                : 'Son tam (TYT+AYT) denemene göre — puan türün ve diploma notun hesaba katılır.'
              : siralamaHedefVar
                ? `Hedefin ${profil!.hedefSiralama!.toLocaleString('tr-TR')}. sıra. Tam bir TYT+AYT denemesi ekleyince tahmini sıralaman burada oluşacak.`
                : 'Tam bir TYT+AYT denemesi ekleyince tahmini sıralaman burada görünecek.'}
          </Text>

          <View style={styles.ctaSatir}>
            <TouchableOpacity
              style={styles.denemeCta}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/denemeler' as any)}
            >
              <Ionicons name="clipboard-outline" size={15} color={COLORS.primary} />
              <Text style={styles.denemeCtaMetin}>Denemelerim</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.denemeCta}
              activeOpacity={0.85}
              onPress={() => router.push('/istatistik')}
            >
              <Ionicons name="bar-chart-outline" size={15} color={COLORS.primary} />
              <Text style={styles.denemeCtaMetin}>İstatistiklerim</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Yukselen>

      {/* ─── ★ AI Koç · Günün analizi (koyu) — içgörü yakında ─── */}
      <Yukselen gecikme={360}>
        <View style={styles.analizKart}>
          <View style={styles.analizUst}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.analizIkon}
            >
              <Ionicons name="sparkles" size={18} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.analizMikro}>AI KOÇ · GÜNÜN ANALİZİ</Text>
              <Text style={styles.analizBaslik}>Bugün neye odaklanmalısın</Text>
            </View>
            <YakindaPill koyu />
          </View>

          <View style={styles.analizPanel}>
            <Text style={styles.analizPanelMetin}>
              Denemelerini ve çalışma verilerini ekledikçe koçun en zayıf konunu belirleyip
              sana özel tekrar ve soru önerileri sunacak.
            </Text>
          </View>

          <View style={styles.analizAksiyon}>
            <TouchableOpacity
              style={styles.analizBirincil}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/ai-koc' as any)}
            >
              <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.ink} />
              <Text style={styles.analizBirincilMetin}>AI Koç’a sor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.analizIkincil}
              activeOpacity={0.85}
              onPress={() => router.push('/soru-yukle' as any)}
            >
              <Ionicons name="camera-outline" size={14} color="#fff" />
              <Text style={styles.analizIkincilMetin}>Soru yükle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Yukselen>

      {/* ─── Yanlış Defteri girişi ─── */}
      <Yukselen gecikme={420}>
        <TouchableOpacity
          style={styles.aracKart}
          activeOpacity={0.85}
          onPress={() => router.push('/yanlis-defteri')}
        >
          <View style={styles.aracIkon}>
            <Ionicons name="reader-outline" size={19} color={COLORS.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.aracBaslik}>Yanlış Defteri</Text>
            <Text style={styles.aracAlt} numberOfLines={1}>Yanlışlarını kaydet, tekrar et, koç hafızana işle</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      </Yukselen>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// Yardımcı bileşenler
// ─────────────────────────────────────────────

/** Karta giriş animasyonu — yukarı kayarak belirir (kademeli gecikme). */
function Yukselen({ gecikme = 0, children }: { gecikme?: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 450,
      delay: gecikme,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, gecikme]);
  return (
    <Animated.View
      style={{
        marginBottom: 10,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** "Yakında" rozeti — veri kaynağı olmayan kartlar için dürüst boş durum. */
function YakindaPill({ koyu = false }: { koyu?: boolean }) {
  return (
    <View style={[styles.yakindaPill, koyu && styles.yakindaPillKoyu]}>
      <Ionicons name="time-outline" size={11} color={koyu ? 'rgba(255,255,255,0.85)' : COLORS.textLight} />
      <Text style={[styles.yakindaPillMetin, koyu && { color: 'rgba(255,255,255,0.85)' }]}>Yakında</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },
  icerik: { paddingHorizontal: 15, paddingTop: 56, paddingBottom: 24 },
  merkezle: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  // Başlık
  baslik: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tarih: { fontSize: 12.5, color: COLORS.textSecondary, fontWeight: '500' },
  selam: { fontSize: 23, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, marginTop: 1 },
  baslikSag: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  puanBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  puanMetin: { fontSize: 11.5, fontWeight: '700', color: COLORS.primary },
  avatar: { width: 40, height: 40, borderRadius: 99, justifyContent: 'center', alignItems: 'center' },
  avatarHarf: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Sor çubuğu
  sorCubugu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.13)',
    borderRadius: 99,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  sorIkon: { width: 30, height: 30, borderRadius: 99, justifyContent: 'center', alignItems: 'center' },
  sorMetin: { flex: 1, fontSize: 12.5, fontWeight: '500', color: COLORS.textLight },
  sorMetinVurgu: { color: COLORS.textSecondary },
  sorGonder: { width: 32, height: 32, borderRadius: 99, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },

  // Kart tabanı
  kart: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  kartBaslik: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  kartNot: { fontSize: 11, fontWeight: '500', color: COLORS.textLight, marginTop: 4 },
  satirSol: { flexDirection: 'row', alignItems: 'center', gap: 7 },

  // Hero
  heroGolge: {
    borderRadius: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 8,
  },
  hero: { borderRadius: 24, padding: 17, overflow: 'hidden' },
  heroDaire1: { position: 'absolute', right: -24, top: -28, width: 120, height: 120, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroDaire2: { position: 'absolute', right: 30, bottom: -34, width: 90, height: 90, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEtiket: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: 'rgba(255,255,255,0.85)' },
  heroSayiSatir: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 3 },
  heroSayi: { fontSize: 46, fontWeight: '800', color: '#fff', lineHeight: 48, letterSpacing: -0.5 },
  heroGun: { fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.9)', paddingBottom: 6 },
  heroSinavEtiket: { fontSize: 11.5, color: 'rgba(255,255,255,0.8)' },
  heroSinavTarih: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
    maxWidth: 170,
  },
  heroPillMetin: { fontSize: 11.5, fontWeight: '600', color: '#fff', flexShrink: 1 },
  heroAlt: { marginTop: 14 },
  heroAltSatir: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  heroAltMetin: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  heroRay: { height: 6, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.22)', overflow: 'hidden' },
  heroDolgu: { height: '100%', borderRadius: 99, backgroundColor: '#fff' },

  // Hedef netler
  netBaslikSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  netToplam: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  netToplamSayi: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  netGovde: { flexDirection: 'row', gap: 16 },
  netDers: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  netDegerSatir: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  netDeger: { fontSize: 19, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  netMax: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight },
  netRay: { height: 6, borderRadius: 99, backgroundColor: '#EEF1F8', overflow: 'hidden', marginTop: 7 },
  netDolgu: { height: '100%', borderRadius: 99 },
  bosSatir: { paddingTop: 2 },

  // Tahmini sıralama
  siraGovde: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  siraDeger: { fontSize: 30, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  siraAlt: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
  siraTrend: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  siraTrendMetin: { fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  // Yanlış Defteri giriş kartı
  aracKart: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingVertical: 14, paddingHorizontal: 14,
  },
  aracIkon: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.accent + '14',
    justifyContent: 'center', alignItems: 'center',
  },
  aracBaslik: { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  aracAlt: { fontSize: 12, fontWeight: '600', color: COLORS.textLight, marginTop: 2 },

  ctaSatir: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  denemeCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
  },
  denemeCtaMetin: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },

  // Yakında rozeti
  yakindaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.background, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99,
  },
  yakindaPillKoyu: { backgroundColor: 'rgba(255,255,255,0.1)' },
  yakindaPillMetin: { fontSize: 10.5, fontWeight: '700', color: COLORS.textLight },

  // AI Koç · günün analizi (koyu)
  analizKart: { backgroundColor: COLORS.ink, borderRadius: 20, padding: 16 },
  analizUst: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analizIkon: {
    width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 13, elevation: 4,
  },
  analizMikro: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)' },
  analizBaslik: { fontSize: 13.5, fontWeight: '800', color: '#fff', marginTop: 1 },
  analizPanel: { marginTop: 13, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 13, padding: 12 },
  analizPanelMetin: { fontSize: 11.5, fontWeight: '500', color: 'rgba(255,255,255,0.65)', lineHeight: 17 },
  analizAksiyon: { flexDirection: 'row', gap: 8, marginTop: 12 },
  analizBirincil: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12,
  },
  analizBirincilMetin: { fontSize: 12.5, fontWeight: '800', color: COLORS.ink },
  analizIkincil: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14,
  },
  analizIkincilMetin: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
});
