import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { auth } from '../../services/firebaseConfig';
import {
  Gorev,
  gorevSil,
  ayGorevleriniGetir,
  gunGorevleriniGetir,
} from '../../services/firestoreService';
import { COLORS } from '../../constants/colors';
import { dersRenk } from '../../constants/dersler';
import { hedefYksTarihi } from '../../constants/sinav';
import { Ring } from '../../components/koc/Ring';
import { ALT_CUBUK_BOSLUK } from '../../components/AltCubuk';
import { useProfile } from '../../hooks/useProfile';
import { bildir } from '../../utils/bildirim';

const PRIMARY = COLORS.primary;

const GUN_KISALTMALARI = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const GUN_ADLARI_TAM = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi',
];
const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// Pazartesi-başlangıçlı gün indeksi (0 = Pazartesi).
function pazartesiIndeksi(jsGun: number): number {
  return (jsGun + 6) % 7;
}

function ayniGunMu(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sureMetni(dk: number): string {
  if (!dk) return '0 dk';
  const s = Math.floor(dk / 60);
  const k = dk % 60;
  return s ? (k ? `${s}s ${k}dk` : `${s} saat`) : `${k} dk`;
}

function ikiHane(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Bir görevin saatini "HH:MM" döndürür — yalnızca gece yarısı DIŞINDA bir saat
// taşıyorsa. Plan görevleri saf tarih (gece yarısı) tutar → null (saat gösterilmez).
// Deneme/sınav gerçek bir saat taşıyabilir → "10:00" gibi.
function saatMetni(ts: Gorev['tarih']): string | null {
  if (!ts) return null;
  const d = ts.toDate();
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return `${ikiHane(d.getHours())}:${ikiHane(d.getMinutes())}`;
}

// YKS oturum bilgisi (gerçek takvim olayı: saat + süre taşır).
const SINAV_OTURUM: Record<'tyt' | 'ayt', { ad: string; saat: string; meta: string }> = {
  tyt: { ad: 'YKS · 1. Oturum (TYT)', saat: '10:15', meta: 'Sınav günü · 165 dk' },
  ayt: { ad: 'YKS · 2. Oturum (AYT)', saat: '10:15', meta: 'Sınav günü · 180 dk' },
};

function gunMu(g: Gorev, gun: number): boolean {
  return !!g.tarih && g.tarih.toDate().getDate() === gun;
}

export default function Takvim() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profil } = useProfile();
  const bugun = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // YKS oturumları sınıfa göre: 11. sınıf bir SONRAKİ YKS'ye girer (TYT, ertesi gün AYT).
  const TYT_TARIHI = useMemo(() => hedefYksTarihi(profil?.sinif), [profil?.sinif]);
  const AYT_TARIHI = useMemo(
    () => new Date(TYT_TARIHI.getFullYear(), TYT_TARIHI.getMonth(), TYT_TARIHI.getDate() + 1),
    [TYT_TARIHI]
  );

  const [goruntulenen, setGoruntulenen] = useState(() => ({
    ay: bugun.getMonth(),
    yil: bugun.getFullYear(),
  }));
  const [secilenTarih, setSecilenTarih] = useState<Date>(bugun);
  const [ayGorevleri, setAyGorevleri] = useState<Gorev[]>([]);
  const [istediginZaman, setIstediginZaman] = useState<Gorev[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const uid = auth.currentUser?.uid;

  const ayYukle = useCallback(async () => {
    if (!uid) return;
    setYukleniyor(true);
    try {
      // anytime sorgusu tarihten bağımsızdır; sabit bir referans tarih yeterli.
      const [planned, gunVerisi] = await Promise.all([
        ayGorevleriniGetir(uid, goruntulenen.yil, goruntulenen.ay),
        gunGorevleriniGetir(uid, bugun),
      ]);
      setAyGorevleri(planned);
      setIstediginZaman(gunVerisi.anytime);
    } catch (err) {
      console.error('[Takvim] ayYukle hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  }, [uid, goruntulenen.yil, goruntulenen.ay, bugun]);

  useEffect(() => {
    ayYukle();
  }, [uid, goruntulenen.yil, goruntulenen.ay]);

  // Plan detayından dönüldüğünde (adım tamamlama vb.) listeyi tazele.
  useFocusEffect(
    useCallback(() => {
      ayYukle();
    }, [ayYukle])
  );

  function ayDegistir(delta: number) {
    setGoruntulenen((prev) => {
      let ay = prev.ay + delta;
      let yil = prev.yil;
      if (ay < 0) { ay = 11; yil--; }
      if (ay > 11) { ay = 0; yil++; }
      // Seçili günü yeni aya taşı: bu ay bugünü içeriyorsa bugün, değilse 1'i.
      const yeniSecili =
        yil === bugun.getFullYear() && ay === bugun.getMonth()
          ? new Date(bugun)
          : new Date(yil, ay, 1);
      setSecilenTarih(yeniSecili);
      return { ay, yil };
    });
  }

  // ── Izgara verisi ──
  const ilkGun = new Date(goruntulenen.yil, goruntulenen.ay, 1);
  const gunSayisi = new Date(goruntulenen.yil, goruntulenen.ay + 1, 0).getDate();
  const onOfset = pazartesiIndeksi(ilkGun.getDay());
  const hucreler: number[] = [
    ...Array(onOfset).fill(0),
    ...Array.from({ length: gunSayisi }, (_, i) => i + 1),
  ];
  while (hucreler.length % 7 !== 0) hucreler.push(0);
  const haftalar: number[][] = [];
  for (let i = 0; i < hucreler.length; i += 7) haftalar.push(hucreler.slice(i, i + 7));

  const sinavBuAy =
    goruntulenen.yil === TYT_TARIHI.getFullYear() && goruntulenen.ay === TYT_TARIHI.getMonth();

  function sinavGunuMu(gun: number): 'tyt' | 'ayt' | null {
    if (!sinavBuAy) return null;
    if (gun === TYT_TARIHI.getDate()) return 'tyt';
    if (gun === AYT_TARIHI.getDate()) return 'ayt';
    return null;
  }

  // Gün → o günün renk noktaları (en çok 3 farklı ders rengi).
  function gunNoktalari(gun: number): string[] {
    const renkler: string[] = [];
    ayGorevleri.forEach((g) => {
      if (gunMu(g, gun) && g.tur !== 'deneme') {
        const r = dersRenk(g.ders);
        if (!renkler.includes(r)) renkler.push(r);
      }
    });
    return renkler.slice(0, 3);
  }

  function denemeGunuMu(gun: number): boolean {
    return ayGorevleri.some((g) => gunMu(g, gun) && g.tur === 'deneme');
  }

  // ── Seçili gün ajandası ──
  const seciliGun = secilenTarih.getDate();
  const seciliAyMi =
    secilenTarih.getMonth() === goruntulenen.ay &&
    secilenTarih.getFullYear() === goruntulenen.yil;

  const gunPlanlari = useMemo(() => {
    if (!seciliAyMi) return [];
    return ayGorevleri
      .filter((g) => gunMu(g, seciliGun))
      .sort((a, b) => {
        const ta = a.tarih ? a.tarih.toMillis() : 0;
        const tb = b.tarih ? b.tarih.toMillis() : 0;
        return ta - tb;
      });
  }, [ayGorevleri, seciliGun, seciliAyMi]);

  const planlar = gunPlanlari.filter((g) => g.tur !== 'deneme');
  const planSay = planlar.length;
  const bitenSay = planlar.filter((g) => g.tamamlandi).length;
  const toplamDk = gunPlanlari.reduce((t, g) => t + (g.sure || 0), 0);
  const dersNoktalari = [...new Set(planlar.map((g) => dersRenk(g.ders)))].slice(0, 5);
  const seciliSinav = seciliAyMi ? sinavGunuMu(seciliGun) : null;
  const bugunSecili = ayniGunMu(secilenTarih, bugun);
  // "ŞİMDİ": yalnızca bugünü görüntülerken, ilk bitmemiş plan görevi öne çıkar.
  const simdiId = bugunSecili ? planlar.find((g) => !g.tamamlandi)?.id ?? null : null;

  // YKS'ye kalan gün.
  const geriSayim = Math.max(
    0,
    Math.ceil((TYT_TARIHI.getTime() - bugun.getTime()) / 86400000)
  );

  // ── Görev işlemleri ──
  function silOnay(g: Gorev) {
    bildir('Görevi Sil', `"${g.baslik}" görevini silmek istediğinizden emin misiniz?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          if (!uid) return;
          try {
            await gorevSil(uid, g.id);
            await ayYukle();
          } catch (err) {
            console.error('[Takvim] gorevSil hatası:', err);
          }
        },
      },
    ]);
  }

  function planAc(g: Gorev) {
    router.push(`/plan/${g.id}`);
  }

  return (
    <View style={styles.ekran}>
      {/* ─── Başlık + ay geçişi ─── */}
      <View style={styles.header}>
        <View style={styles.ayNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => ayDegistir(-1)} activeOpacity={0.7} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.ayBaslik}>
            {AY_ADLARI[goruntulenen.ay]} <Text style={styles.ayYil}>{goruntulenen.yil}</Text>
          </Text>
          <TouchableOpacity style={styles.navBtn} onPress={() => ayDegistir(1)} activeOpacity={0.7} hitSlop={8}>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={[COLORS.primary, COLORS.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.geriSayimPill}
        >
          <Ionicons name="flag" size={13} color="#fff" />
          <Text style={styles.geriSayimMetin}>YKS&apos;ye {geriSayim} gün</Text>
        </LinearGradient>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + ALT_CUBUK_BOSLUK }}>
        {/* ─── Takvim paneli: hafta günleri + ızgara + gün özeti tek yüzeyde ─── */}
        <View style={styles.panel}>
          {/* hafta günü başlıkları */}
          <View style={styles.gunBasliklari}>
            {GUN_KISALTMALARI.map((g, i) => (
              <Text key={g} style={[styles.gunBaslik, i >= 5 && { color: COLORS.accent }]}>
                {g}
              </Text>
            ))}
          </View>

          {/* ızgara */}
          <View style={styles.izgara}>
            {haftalar.map((hafta, hi) => (
              <View key={hi} style={styles.haftaSatiri}>
                {hafta.map((gun, gi) => (
                  <GunHucresi
                    key={gi}
                    gun={gun}
                    bugunMu={gun > 0 && ayniGunMu(new Date(goruntulenen.yil, goruntulenen.ay, gun), bugun)}
                    secili={gun > 0 && seciliAyMi && gun === seciliGun}
                    sinav={gun > 0 ? sinavGunuMu(gun) : null}
                    deneme={gun > 0 && denemeGunuMu(gun)}
                    noktalar={gun > 0 ? gunNoktalari(gun) : []}
                    onPress={() => setSecilenTarih(new Date(goruntulenen.yil, goruntulenen.ay, gun))}
                  />
                ))}
              </View>
            ))}
          </View>

          {/* gün özeti alt şeridi (panelin tonlu krom kısmı) */}
          <View style={styles.ozetSerit}>
            <View style={styles.ozetTarihBlok}>
              <Text style={styles.ozetTarihGun}>{seciliGun}</Text>
              <Text style={styles.ozetTarihAy}>
                {AY_ADLARI[secilenTarih.getMonth()].slice(0, 3)}
              </Text>
            </View>
            <View style={styles.ozetAyrac} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.ozetGunSatir}>
                <Text style={styles.ozetGunAdi}>{GUN_ADLARI_TAM[secilenTarih.getDay()]}</Text>
                {bugunSecili && (
                  <View style={styles.bugunPill}>
                    <Text style={styles.bugunPillMetin}>BUGÜN</Text>
                  </View>
                )}
              </View>
              {planSay > 0 ? (
                <>
                  <Text style={styles.ozetDurum}>
                    {bitenSay}/{planSay} görev bitti · {sureMetni(toplamDk)} planlı
                  </Text>
                  <View style={styles.segmentSatir}>
                    {planlar.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.segment,
                          { backgroundColor: i < bitenSay ? COLORS.success : '#fff' },
                        ]}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.ozetBos}>Plan yok</Text>
              )}
            </View>
            {dersNoktalari.length > 0 && (
              <View style={styles.ozetNoktalar}>
                {dersNoktalari.map((r, i) => (
                  <View key={i} style={[styles.ozetNokta, { backgroundColor: r }]} />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ─── Günün planı (ayrı yüzeydeki yüzen kartlar) ─── */}
        <Text style={styles.bolumBaslik}>GÜNÜN PLANI</Text>

        <View style={styles.ajanda}>
          {yukleniyor && gunPlanlari.length === 0 && !seciliSinav ? (
            <View style={styles.yukleniyor}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : (
            <>
              {seciliSinav && <SinavKarti tur={seciliSinav} />}

              {gunPlanlari.length === 0 && !seciliSinav && (
                <View style={styles.bosHal}>
                  <View style={styles.bosHalIkon}>
                    <Ionicons name="calendar-outline" size={22} color={PRIMARY} />
                  </View>
                  <Text style={styles.bosHalMetin}>Bu güne planın yok</Text>
                  <Text style={styles.bosHalAlt}>Aşağıdan ekle ya da koçtan plan iste.</Text>
                </View>
              )}

              {gunPlanlari.map((g) =>
                g.tur === 'deneme' ? (
                  <DenemeKarti
                    key={g.id}
                    gorev={g}
                    onPress={() => router.push('/(tabs)/denemeler' as never)}
                    onLongPress={() => silOnay(g)}
                  />
                ) : (
                  <PlanKarti
                    key={g.id}
                    gorev={g}
                    simdi={g.id === simdiId}
                    onPress={() => planAc(g)}
                    onLongPress={() => silOnay(g)}
                  />
                )
              )}

              <TouchableOpacity
                style={styles.planaEkle}
                onPress={() =>
                  router.push({ pathname: '/plan-kur', params: { tarih: String(secilenTarih.getTime()) } })
                }
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={17} color={PRIMARY} />
                <Text style={styles.planaEkleMetin}>Plana ekle</Text>
              </TouchableOpacity>

              {/* İstediğin zaman (tarihe bağlı olmayan görevler) */}
              {istediginZaman.length > 0 && (
                <>
                  <Text style={styles.altBaslik}>İSTEDİĞİN ZAMAN</Text>
                  {istediginZaman.map((g) => (
                    <PlanKarti
                      key={g.id}
                      gorev={g}
                      simdi={false}
                      onPress={() => planAc(g)}
                      onLongPress={() => silOnay(g)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Izgara hücresi ───────────────────────────

function GunHucresi({
  gun,
  bugunMu,
  secili,
  sinav,
  deneme,
  noktalar,
  onPress,
}: {
  gun: number;
  bugunMu: boolean;
  secili: boolean;
  sinav: 'tyt' | 'ayt' | null;
  deneme: boolean;
  noktalar: string[];
  onPress: () => void;
}) {
  if (gun === 0) return <View style={styles.bosHucre} />;

  const beyazMetin = !!sinav || bugunMu;
  const cemberStil = [
    styles.gunDaire,
    secili && !sinav && !bugunMu && styles.seciliDaire,
    bugunMu && !sinav && styles.bugunDaire,
    deneme && !sinav && !bugunMu && !secili && styles.denemeDaire,
  ];
  const metinStil = [
    styles.gunSayi,
    secili && !sinav && !bugunMu && { color: PRIMARY, fontWeight: '800' as const },
    beyazMetin && { color: '#fff', fontWeight: '800' as const },
    deneme && !sinav && !bugunMu && !secili && { color: COLORS.accent, fontWeight: '700' as const },
  ];

  return (
    <TouchableOpacity style={styles.hucre} onPress={onPress} activeOpacity={0.7}>
      {sinav ? (
        <LinearGradient
          colors={[COLORS.primary, COLORS.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gunDaire, styles.sinavDaire]}
        >
          <Text style={[styles.gunSayi, { color: '#fff', fontWeight: '800' }]}>{gun}</Text>
          <View style={styles.sinavBayrak}>
            <Ionicons name="flag" size={8} color={COLORS.accent} />
          </View>
        </LinearGradient>
      ) : (
        <View style={cemberStil}>
          <Text style={metinStil}>{gun}</Text>
        </View>
      )}

      <View style={styles.noktaSatir}>
        {!sinav && !deneme &&
          noktalar.map((r, i) => (
            <View
              key={i}
              style={[styles.gunNokta, { backgroundColor: r }]}
            />
          ))}
        {deneme && !sinav && <Text style={styles.denemeEtiket}>DENEME</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Ajanda kartları ──────────────────────────

// Durum madalyonu: solda tek, tutarlı durum göstergesi (elle onay kutusu YOK).
// Tamamlanma adımlardan türetilir → 0 adım: ders renginde halka + play ·
// kısmî: dolan halka + "k/n" · tümü/işaretli: yeşil dolu daire + ✓.
function DurumMadalyon({
  renk,
  biten,
  toplam,
  tamam,
}: {
  renk: string;
  biten: number;
  toplam: number;
  tamam: boolean;
}) {
  if (tamam) {
    return (
      <View style={[planStyles.madalyonTam, { backgroundColor: COLORS.success }]}>
        <Ionicons name="checkmark" size={23} color="#fff" />
      </View>
    );
  }
  return (
    <Ring size={46} stroke={5} value={biten} max={toplam || 1} color={renk} track={COLORS.cardBorder}>
      {biten === 0 ? (
        <Ionicons name="play" size={15} color={renk} style={{ marginLeft: 2 }} />
      ) : (
        <Text style={planStyles.madalyonSayi}>
          {biten}
          <Text style={planStyles.madalyonPay}>/{toplam}</Text>
        </Text>
      )}
    </Ring>
  );
}

function PlanKarti({
  gorev,
  simdi,
  onPress,
  onLongPress,
}: {
  gorev: Gorev;
  simdi: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const renk = dersRenk(gorev.ders);
  const adimSay = gorev.adimlar?.length ?? 0;
  const bitenAdim = gorev.adimlar?.filter((a) => a.done).length ?? 0;
  const done = gorev.tamamlandi;
  const simdiVurgu = simdi && !done;
  const saat = saatMetni(gorev.tarih); // başlangıç saati varsa göster

  return (
    <TouchableOpacity
      style={[
        planStyles.kart,
        simdiVurgu && { borderColor: renk + '55', shadowColor: renk, shadowOpacity: 0.16 },
        done && { opacity: 0.7 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      activeOpacity={0.85}
    >
      <DurumMadalyon renk={renk} biten={bitenAdim} toplam={adimSay} tamam={done} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={planStyles.dersSatir}>
          <Text style={[planStyles.dersEtiket, { color: renk }]} numberOfLines={1}>
            {(gorev.ders ?? 'Genel').toLocaleUpperCase('tr')}
          </Text>
          {simdiVurgu && (
            <View style={[planStyles.simdiRozet, { backgroundColor: renk }]}>
              <Text style={planStyles.simdiRozetMetin}>ŞİMDİ</Text>
            </View>
          )}
        </View>
        <Text style={[planStyles.konu, done && planStyles.konuDone]} numberOfLines={2}>
          {gorev.baslik}
        </Text>
        <View style={planStyles.metaSatir}>
          <Ionicons name={saat ? 'time-outline' : 'timer-outline'} size={12} color={COLORS.textLight} />
          <Text style={planStyles.meta}>
            {saat ? `${saat} · ` : ''}
            {sureMetni(gorev.sure)}
            {done ? ' · tamamlandı' : adimSay > 0 ? ` · ${bitenAdim}/${adimSay} adım` : ''}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={17} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

function DenemeKarti({
  gorev,
  onPress,
  onLongPress,
}: {
  gorev: Gorev;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const saat = saatMetni(gorev.tarih);
  return (
    <TouchableOpacity
      style={denemeStyles.kart}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      activeOpacity={0.85}
    >
      <View style={denemeStyles.ikonKutu}>
        <Ionicons name="trophy" size={22} color={COLORS.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={denemeStyles.ustSatir}>
          <Text style={denemeStyles.etiket}>DENEME</Text>
          {saat && <Text style={denemeStyles.saat}>{saat}</Text>}
        </View>
        <Text style={denemeStyles.ad} numberOfLines={1}>{gorev.baslik}</Text>
        <Text style={denemeStyles.meta}>{sureMetni(gorev.sure)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

function SinavKarti({ tur }: { tur: 'tyt' | 'ayt' }) {
  const oturum = SINAV_OTURUM[tur];
  return (
    <LinearGradient
      colors={[COLORS.primary, COLORS.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={sinavStyles.kart}
    >
      <View style={sinavStyles.ikonKutu}>
        <Ionicons name="flag" size={22} color="#fff" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={sinavStyles.ustSatir}>
          <Text style={sinavStyles.etiket}>YKS SINAVI</Text>
          <Text style={sinavStyles.saat}>{oturum.saat}</Text>
        </View>
        <Text style={sinavStyles.ad}>{oturum.ad}</Text>
        <Text style={sinavStyles.meta}>{oturum.meta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.85)" />
    </LinearGradient>
  );
}

// ─── Stiller ──────────────────────────────────

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  ayNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ayBaslik: { fontSize: 19, fontWeight: '800', color: COLORS.text, minWidth: 118, textAlign: 'center' },
  ayYil: { color: COLORS.textLight, fontWeight: '700' },
  geriSayimPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 99,
  },
  geriSayimMetin: { fontSize: 12.5, fontWeight: '800', color: '#fff' },

  gunBasliklari: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
  gunBaslik: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: COLORS.textLight,
  },

  izgara: { paddingHorizontal: 8, paddingBottom: 8 },
  haftaSatiri: { flexDirection: 'row' },
  hucre: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 4 },
  bosHucre: { flex: 1 },
  gunDaire: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sinavDaire: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.34,
    shadowRadius: 14,
    elevation: 5,
  },
  sinavBayrak: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 15,
    height: 15,
    borderRadius: 99,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  bugunDaire: {
    backgroundColor: PRIMARY,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  seciliDaire: { backgroundColor: COLORS.primaryLight, borderColor: PRIMARY },
  denemeDaire: { backgroundColor: COLORS.card, borderColor: COLORS.accent },
  gunSayi: { fontSize: 15, fontWeight: '600', color: COLORS.text },

  noktaSatir: { flexDirection: 'row', gap: 3, height: 8, alignItems: 'center' },
  gunNokta: { width: 5, height: 5, borderRadius: 99 },
  denemeEtiket: { fontSize: 8, fontWeight: '800', letterSpacing: 0.3, color: COLORS.accent },

  // Panel: hafta günleri + ızgara + gün özeti tek beyaz yüzeyde birleşir.
  panel: {
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 28,
    elevation: 3,
  },
  // Gün özeti alt şeridi — panelin tonlu (açık mor) kromu.
  ozetSerit: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    backgroundColor: COLORS.primaryLight + '66',
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  ozetTarihBlok: { alignItems: 'center' },
  ozetTarihGun: { fontSize: 24, fontWeight: '800', color: PRIMARY, letterSpacing: -0.6, lineHeight: 26 },
  ozetTarihAy: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: PRIMARY, opacity: 0.7, textTransform: 'uppercase', marginTop: 2 },
  ozetAyrac: { width: 1, alignSelf: 'stretch', backgroundColor: PRIMARY + '26' },
  ozetGunSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ozetGunAdi: { fontSize: 14, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  bugunPill: { backgroundColor: PRIMARY, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  bugunPillMetin: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  ozetDurum: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary, marginTop: 3, marginBottom: 7 },
  segmentSatir: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 5, borderRadius: 99 },
  ozetBos: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
  ozetNoktalar: { flexDirection: 'row', gap: 4 },
  ozetNokta: { width: 7, height: 7, borderRadius: 99 },

  bolumBaslik: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  ajanda: { paddingHorizontal: 16, paddingTop: 10, gap: 9 },
  yukleniyor: { paddingVertical: 30, alignItems: 'center' },
  bosHal: {
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.cardBorder,
  },
  bosHalIkon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  bosHalMetin: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  bosHalAlt: { fontSize: 12.5, fontWeight: '600', color: COLORS.textSecondary, marginTop: 3, textAlign: 'center' },
  planaEkle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary + '55',
    backgroundColor: COLORS.primaryLight + '70',
    marginTop: 2,
  },
  planaEkleMetin: { fontSize: 13.5, fontWeight: '700', color: PRIMARY },
  altBaslik: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: COLORS.textLight,
    marginTop: 14,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
});

const planStyles = StyleSheet.create({
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  madalyonTam: {
    width: 46,
    height: 46,
    borderRadius: 99,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
  },
  madalyonSayi: { fontSize: 12.5, fontWeight: '800', color: COLORS.text },
  madalyonPay: { color: COLORS.textLight, fontWeight: '700' },
  dersSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  dersEtiket: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  simdiRozet: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  simdiRozetMetin: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4, color: '#fff' },
  konu: { fontSize: 15, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2, lineHeight: 19 },
  konuDone: { color: COLORS.textLight, textDecorationLine: 'line-through' },
  metaSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  meta: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary },
});

const denemeStyles = StyleSheet.create({
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.accent + '44',
  },
  ikonKutu: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: COLORS.accent + '16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  etiket: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, color: COLORS.accent },
  saat: { fontSize: 11.5, fontWeight: '700', color: COLORS.textLight },
  ad: { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  meta: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary, marginTop: 5 },
});

const sinavStyles = StyleSheet.create({
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
    borderRadius: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 6,
  },
  ikonKutu: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  etiket: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, color: 'rgba(255,255,255,0.9)' },
  saat: { fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  ad: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  meta: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.82)', marginTop: 5 },
});
