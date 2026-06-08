import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth } from '../../services/firebaseConfig';
import {
  Gorev,
  Adim,
  AdimTip,
  gorevGetir,
  gorevTamamla,
  adimlariGuncelle,
} from '../../services/firestoreService';
import { COLORS } from '../../constants/colors';
import { dersRenk } from '../../constants/dersler';
import { Ring } from '../../components/koc/Ring';

function ikiHane(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Saniye → "M:SS"
function ssFormat(saniye: number): string {
  const dk = Math.floor(saniye / 60);
  const sn = saniye % 60;
  return `${dk}:${ikiHane(sn)}`;
}

// Adım meta metni — tipe göre ayrık. Mola'nın "net"i YOK.
function adimMetaMetni(a: Adim): string {
  if (a.tip === 'soru') return `${a.dk} dk · ${a.soru ?? 0} soru → net`;
  if (a.tip === 'mola') return `${a.dk} dk · dinlen, soru yok`;
  return `${a.dk} dk · konu tekrarı`;
}

// Adım tipine göre küçük ikon (oku → ikon yok). Ionicons karşılıkları.
function adimTipIkon(tip: AdimTip): keyof typeof Ionicons.glyphMap | null {
  if (tip === 'soru') return 'radio-button-on';
  if (tip === 'mola') return 'cafe-outline';
  return null;
}

export default function PlanDetay() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = auth.currentUser?.uid;

  const [gorev, setGorev] = useState<Gorev | null>(null);
  const [adimlar, setAdimlar] = useState<Adim[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mod, setMod] = useState<'liste' | 'duzenle'>('liste');

  // Sayaç durumu
  const [aktifAdim, setAktifAdim] = useState<number | null>(null);
  const [gecen, setGecen] = useState(0); // saniye
  const [duraklatildi, setDuraklatildi] = useState(false);

  // Adım ekle/düzenle modalı
  const [adimModal, setAdimModal] = useState<{ index: number | null } | null>(null);

  const renk = dersRenk(gorev?.ders);

  // ── Yükle ──
  useEffect(() => {
    let iptal = false;
    (async () => {
      if (!uid || !id) return;
      try {
        const g = await gorevGetir(uid, id);
        if (iptal) return;
        setGorev(g);
        setAdimlar(g?.adimlar ?? []);
      } catch (err) {
        console.error('[PlanDetay] yükleme hatası:', err);
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    })();
    return () => {
      iptal = true;
    };
  }, [uid, id]);

  // ── Sayaç tik ──
  useEffect(() => {
    if (aktifAdim === null || duraklatildi) return;
    const t = setInterval(() => setGecen((g) => g + 1), 1000);
    return () => clearInterval(t);
  }, [aktifAdim, duraklatildi]);

  // Süre dolunca otomatik bitir.
  useEffect(() => {
    if (aktifAdim === null) return;
    const hedef = (adimlar[aktifAdim]?.dk ?? 0) * 60;
    if (hedef > 0 && gecen >= hedef) {
      adimBitir(aktifAdim);
    }
  }, [gecen, aktifAdim]);

  // ── Kalıcılaştır ──
  const kaydet = useCallback(
    async (yeni: Adim[]) => {
      setAdimlar(yeni);
      if (!uid || !id) return;
      try {
        await adimlariGuncelle(uid, id, yeni);
      } catch (err) {
        console.error('[PlanDetay] adım kaydı hatası:', err);
      }
    },
    [uid, id]
  );

  // ── Adım işlemleri ──
  function adimBasla(i: number) {
    setAktifAdim(i);
    setGecen(0);
    setDuraklatildi(false);
    setMod('liste');
  }

  function adimBitir(i: number) {
    const yeni = adimlar.map((a, j) => (j === i ? { ...a, done: true } : a));
    setAktifAdim(null);
    setGecen(0);
    setDuraklatildi(false);
    kaydet(yeni);
  }

  function tasi(i: number, yon: -1 | 1) {
    const j = i + yon;
    if (j < 0 || j >= adimlar.length) return;
    const yeni = [...adimlar];
    [yeni[i], yeni[j]] = [yeni[j], yeni[i]];
    kaydet(yeni);
  }

  function sil(i: number) {
    kaydet(adimlar.filter((_, j) => j !== i));
  }

  function adimKaydet(taslak: Adim, index: number | null) {
    if (index === null) {
      kaydet([...adimlar, taslak]);
    } else {
      kaydet(adimlar.map((a, j) => (j === index ? { ...a, ...taslak } : a)));
    }
    setAdimModal(null);
  }

  // ── Tek alt eylem: adımsız (hızlı eklenen) görevi doğrudan tamamla ──
  async function goreviTamamla() {
    if (!uid || !id) return;
    try {
      await gorevTamamla(uid, id, true);
      setGorev((g) => (g ? { ...g, tamamlandi: true } : g));
    } catch (err) {
      console.error('[PlanDetay] görev tamamlama hatası:', err);
    }
  }

  // ── Türetilenler ──
  const toplamDk = adimlar.reduce((t, a) => t + (a.dk || 0), 0) || gorev?.sure || 0;
  const bitenSay = adimlar.filter((a) => a.done).length;
  const siradaIndex = adimlar.findIndex((a) => !a.done);
  // Tamamlanma adımlardan TÜRETİLİR — tüm adımlar bitince görev kendiliğinden biter.
  const hepBitti = adimlar.length > 0 && bitenSay === adimlar.length;
  // Adımsız görevlerde yedek: doğrudan işaretlenmiş tamamlanma.
  const tamamMi = hepBitti || (adimlar.length === 0 && !!gorev?.tamamlandi);

  // ── Render durumları ──
  if (yukleniyor) {
    return (
      <View style={[styles.ekran, styles.merkez]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!gorev) {
    return (
      <View style={[styles.ekran, styles.merkez]}>
        <Text style={styles.bosBaslik}>Plan bulunamadı</Text>
        <TouchableOpacity style={styles.geriBtnDuz} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.geriBtnDuzMetin}>Geri dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sayacAktif = aktifAdim !== null;

  return (
    <View style={styles.ekran}>
      {/* ─── Başlık ─── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.ikonBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerBaslik}>
          {mod === 'duzenle' ? 'Adımları düzenle' : 'Plan Detayı'}
        </Text>
        <View style={styles.headerSag}>
          {/* Tamamlanmış görevde düzenle gizli — başlık ortada kalsın diye 36px boşluk. */}
          {sayacAktif || tamamMi ? null : mod === 'duzenle' ? (
            <TouchableOpacity style={styles.bittiBtn} onPress={() => setMod('liste')} activeOpacity={0.85}>
              <Text style={styles.bittiBtnMetin}>Bitti</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.ikonBtn} onPress={() => setMod('duzenle')} activeOpacity={0.85}>
              <Ionicons name="pencil" size={15} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {sayacAktif ? (
          <SayacGorunum
            renk={renk}
            adimlar={adimlar}
            aktifAdim={aktifAdim!}
            gecen={gecen}
            duraklatildi={duraklatildi}
            onDuraklat={() => setDuraklatildi((d) => !d)}
            onBitir={() => adimBitir(aktifAdim!)}
            onSiradakiBasla={adimBasla}
          />
        ) : mod === 'duzenle' ? (
          <DuzenleGorunum
            renk={renk}
            gorev={gorev}
            adimlar={adimlar}
            toplamDk={toplamDk}
            onTasi={tasi}
            onSil={sil}
            onDuzenle={(i) => setAdimModal({ index: i })}
            onEkle={() => setAdimModal({ index: null })}
          />
        ) : (
          <ListeGorunum
            renk={renk}
            gorev={gorev}
            adimlar={adimlar}
            toplamDk={toplamDk}
            bitenSay={bitenSay}
            siradaIndex={siradaIndex}
            hepBitti={hepBitti}
            tamamMi={tamamMi}
            onBasla={adimBasla}
            onEkle={() => setAdimModal({ index: null })}
          />
        )}
      </ScrollView>

      {/* Liste modunda alt çubuk: durum-farkında TEK eylem (otomatik tamamlanma) */}
      {!sayacAktif && mod === 'liste' && (
        <View style={styles.altCubuk}>
          {tamamMi ? (
            <View style={styles.tamamliSerit}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.tamamliMetin}>Görev tamamlandı</Text>
            </View>
          ) : adimlar.length > 0 ? (
            <TouchableOpacity onPress={() => adimBasla(siradaIndex)} activeOpacity={0.9}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.baslatBtn}
              >
                <Ionicons name="play" size={19} color="#fff" />
                <Text style={styles.baslatMetin}>Sıradaki adımı başlat</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.tamamlaBtn} activeOpacity={0.9} onPress={goreviTamamla}>
              <Ionicons name="checkmark" size={19} color={COLORS.success} />
              <Text style={styles.tamamlaBtnMetin}>Görevi tamamla</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <AdimDuzenleModal
        acik={!!adimModal}
        renk={renk}
        mevcut={adimModal?.index != null ? adimlar[adimModal.index] : null}
        onKapat={() => setAdimModal(null)}
        onKaydet={(t) => adimKaydet(t, adimModal?.index ?? null)}
      />
    </View>
  );
}

// ─── Hero (ortak başlık bloğu) ────────────────

function Hero({
  renk,
  gorev,
  toplamDk,
  adet,
}: {
  renk: string;
  gorev: Gorev;
  toplamDk: number;
  adet: number;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.heroDersSatir}>
        <View style={[styles.heroNokta, { backgroundColor: renk }]} />
        <Text style={[styles.heroDers, { color: renk }]}>{(gorev.ders ?? 'Genel').toLocaleUpperCase('tr')}</Text>
      </View>
      <Text style={styles.heroKonu}>{gorev.baslik}</Text>
      <View style={styles.heroMetaSatir}>
        <View style={styles.heroMeta}>
          <Ionicons name="timer-outline" size={15} color={COLORS.textSecondary} />
          <Text style={styles.heroMetaMetin}>
            {toplamDk} dk{adet > 0 ? ` · ${adet} adım` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Liste görünümü (Ekran 2) ─────────────────

function ListeGorunum({
  renk,
  gorev,
  adimlar,
  toplamDk,
  bitenSay,
  siradaIndex,
  hepBitti,
  tamamMi,
  onBasla,
  onEkle,
}: {
  renk: string;
  gorev: Gorev;
  adimlar: Adim[];
  toplamDk: number;
  bitenSay: number;
  siradaIndex: number;
  hepBitti: boolean;
  tamamMi: boolean;
  onBasla: (i: number) => void;
  onEkle: () => void;
}) {
  const toplam = adimlar.length;
  const ilerleme = toplam > 0 ? bitenSay / toplam : 0;

  return (
    <>
      <Hero renk={renk} gorev={gorev} toplamDk={toplamDk} adet={toplam} />

      {/* Görev ilerleme çubuğu — adımlar bitince yeşile döner */}
      {toplam > 0 && (
        <View style={styles.ilerlemeSatir}>
          <View style={styles.ilerlemeRay}>
            {hepBitti ? (
              <View style={[styles.ilerlemeDolgu, { width: '100%', backgroundColor: COLORS.success }]} />
            ) : (
              <LinearGradient
                colors={[COLORS.primary, COLORS.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.ilerlemeDolgu, { width: `${Math.max(6, ilerleme * 100)}%` }]}
              />
            )}
          </View>
          <Text style={[styles.ilerlemeSay, hepBitti && { color: COLORS.success }]}>
            {hepBitti ? 'Bitti' : `${bitenSay}/${toplam}`}
          </Text>
        </View>
      )}

      <View style={styles.bolumBaslikSatir}>
        <Text style={styles.bolumBaslik}>Çalışma adımları</Text>
        {toplam > 0 && <Text style={styles.bolumSay}>{bitenSay}/{toplam} tamam</Text>}
      </View>
      <Text style={styles.bolumAlt}>
        Adımları bitirdikçe görev kendiliğinden tamamlanır.
      </Text>

      <View style={styles.listeKart}>
        {toplam === 0 && (
          <Text style={styles.listeBos}>Henüz adım yok. Aşağıdan ilk adımını ekle.</Text>
        )}
        {adimlar.map((a, i) => {
          const next = i === siradaIndex;
          const ikon = adimTipIkon(a.tip);
          const ikonRenk = a.done ? COLORS.textLight : a.tip === 'mola' ? COLORS.textSecondary : renk;
          return (
            <View
              key={i}
              style={[
                styles.adimSatir,
                i > 0 && styles.adimSatirSinir,
                next && { backgroundColor: COLORS.primaryLight + '66' },
              ]}
            >
              {/* sol durum dairesi — tutarlı tek gösterge */}
              {a.done ? (
                <View style={styles.durumTam}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              ) : next ? (
                <View style={[styles.durumNext, { borderColor: renk }]}>
                  <View style={[styles.durumNextNokta, { backgroundColor: renk }]} />
                </View>
              ) : (
                <View style={styles.durumBos} />
              )}

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.adimAdSatir}>
                  {ikon && <Ionicons name={ikon} size={13} color={ikonRenk} />}
                  <Text
                    style={[styles.adimAd, a.done && styles.adimAdDone, { flex: 1, minWidth: 0 }]}
                    numberOfLines={2}
                  >
                    {a.ad}
                  </Text>
                </View>
                <View style={styles.adimMetaSatir}>
                  <Ionicons name="timer-outline" size={11} color={COLORS.textLight} />
                  <Text
                    style={[
                      styles.adimMeta,
                      { color: a.tip === 'soru' && !a.done ? renk : COLORS.textLight },
                    ]}
                  >
                    {adimMetaMetni(a)}
                  </Text>
                </View>
              </View>

              {/* sağ eylem: yalnızca sıradaki dolu Başla; diğer bitmemişler çizgili; biten yok */}
              {!a.done && <BaslaBtn solid={next} renk={renk} onPress={() => onBasla(i)} />}
            </View>
          );
        })}

        {/* Adım ekle — yalnızca görev bitmemişken */}
        {!tamamMi && (
          <TouchableOpacity style={styles.ekleSatir} onPress={onEkle} activeOpacity={0.8}>
            <View style={styles.ekleKutu}>
              <Ionicons name="add" size={14} color={COLORS.primary} />
            </View>
            <Text style={styles.ekleMetin}>Adım ekle</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

function BaslaBtn({ solid, renk, onPress }: { solid: boolean; renk: string; onPress: () => void }) {
  if (solid) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.baslaSolid}
        >
          <Ionicons name="play" size={13} color="#fff" />
          <Text style={styles.baslaSolidMetin}>Başla</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={styles.baslaSoft} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="play" size={13} color={COLORS.primary} />
      <Text style={styles.baslaSoftMetin}>Başla</Text>
    </TouchableOpacity>
  );
}

// ─── Düzenle görünümü (Ekran 3) ───────────────

function DuzenleGorunum({
  renk,
  gorev,
  adimlar,
  toplamDk,
  onTasi,
  onSil,
  onDuzenle,
  onEkle,
}: {
  renk: string;
  gorev: Gorev;
  adimlar: Adim[];
  toplamDk: number;
  onTasi: (i: number, yon: -1 | 1) => void;
  onSil: (i: number) => void;
  onDuzenle: (i: number) => void;
  onEkle: () => void;
}) {
  return (
    <>
      <View style={styles.duzenleBaglamSatir}>
        <View style={styles.duzenleBaglam}>
          <View style={[styles.heroNokta, { backgroundColor: renk }]} />
          <Text style={styles.duzenleBaglamMetin} numberOfLines={1}>
            {gorev.baslik}
          </Text>
        </View>
        <View style={styles.toplamPill}>
          <Text style={styles.toplamPillMetin}>Toplam {toplamDk} dk</Text>
        </View>
      </View>

      <View style={{ gap: 9 }}>
        {adimlar.map((a, i) => {
          const soru = a.tip === 'soru';
          return (
            <View
              key={i}
              style={[styles.duzenleKart, soru && { borderColor: renk + '44' }]}
            >
              {/* sıralama tutamacı */}
              <View style={styles.tasiSutun}>
                <TouchableOpacity
                  onPress={() => onTasi(i, -1)}
                  disabled={i === 0}
                  hitSlop={6}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="chevron-up"
                    size={16}
                    color={i === 0 ? COLORS.cardBorder : COLORS.textLight}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onTasi(i, 1)}
                  disabled={i === adimlar.length - 1}
                  hitSlop={6}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={i === adimlar.length - 1 ? COLORS.cardBorder : COLORS.textLight}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.duzenleTurIkon,
                  { backgroundColor: soru ? renk + '18' : COLORS.primaryLight },
                ]}
              >
                <Ionicons
                  name={soru ? 'radio-button-on' : 'book-outline'}
                  size={16}
                  color={soru ? renk : COLORS.primary}
                />
              </View>

              <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => onDuzenle(i)} activeOpacity={0.7}>
                <Text style={styles.duzenleAd} numberOfLines={1}>{a.ad}</Text>
                {soru && (
                  <Text style={[styles.duzenleAlt, { color: renk }]}>
                    {a.soru ?? 0} soru · netine işlenir
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.dkPill} onPress={() => onDuzenle(i)} activeOpacity={0.7}>
                <Text style={styles.dkPillSayi}>{a.dk}</Text>
                <Text style={styles.dkPillBirim}>dk</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.silBtn} onPress={() => onSil(i)} activeOpacity={0.7}>
                <Ionicons name="close" size={16} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={styles.yeniAdimBtn} onPress={onEkle} activeOpacity={0.85}>
        <Ionicons name="add" size={17} color={COLORS.primary} />
        <Text style={styles.yeniAdimMetin}>Yeni adım ekle</Text>
      </TouchableOpacity>

      <View style={styles.ipucuSatir}>
        <Ionicons name="options-outline" size={13} color={COLORS.textLight} />
        <Text style={styles.ipucuMetin}>Oklarla sırala · dakikaya dokunup değiştir · × ile sil</Text>
      </View>
    </>
  );
}

// ─── Sayaç görünümü (Ekran 4) ─────────────────

function SayacGorunum({
  renk,
  adimlar,
  aktifAdim,
  gecen,
  duraklatildi,
  onDuraklat,
  onBitir,
  onSiradakiBasla,
}: {
  renk: string;
  adimlar: Adim[];
  aktifAdim: number;
  gecen: number;
  duraklatildi: boolean;
  onDuraklat: () => void;
  onBitir: () => void;
  onSiradakiBasla: (i: number) => void;
}) {
  const a = adimlar[aktifAdim];
  const hedefSn = (a?.dk ?? 0) * 60;
  const kalan = Math.max(0, hedefSn - gecen);

  const bitenler = adimlar.filter((x) => x.done);
  const siradaki = adimlar.findIndex((x, i) => i !== aktifAdim && !x.done);

  return (
    <>
      {/* aktif sayaç kartı */}
      <View style={[styles.sayacKart, { borderColor: renk, shadowColor: renk }]}>
        <View style={styles.sayacUstSatir}>
          <View style={[styles.heroNokta, { backgroundColor: renk }]} />
          <Text style={[styles.sayacUst, { color: renk }]}>
            ADIM {aktifAdim + 1}/{adimlar.length} · ÇALIŞILIYOR
          </Text>
        </View>
        <Text style={styles.sayacAd}>{a?.ad}</Text>

        <Ring size={150} stroke={11} value={gecen} max={hedefSn || 1} color={renk} track={renk + '1A'}>
          <Text style={styles.sayacSure}>{ssFormat(kalan)}</Text>
          <Text style={styles.sayacHedef}>{a?.dk} dk hedef · kaldı</Text>
        </Ring>

        <View style={styles.sayacButonlar}>
          <TouchableOpacity style={styles.duraklatBtn} onPress={onDuraklat} activeOpacity={0.85}>
            <Ionicons name={duraklatildi ? 'play' : 'pause'} size={17} color={COLORS.textSecondary} />
            <Text style={styles.duraklatMetin}>{duraklatildi ? 'Devam' : 'Duraklat'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBitir} activeOpacity={0.85} style={{ flex: 1 }}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bitirBtn}
            >
              <Ionicons name="checkmark" size={17} color="#fff" />
              <Text style={styles.bitirMetin}>Adımı bitir</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* tamamlanan */}
      {bitenler.length > 0 && (
        <>
          <Text style={styles.sayacBolumBaslik}>TAMAMLANAN</Text>
          <View style={styles.sayacListe}>
            {bitenler.map((b, i) => (
              <View key={i} style={[styles.sayacBitenSatir, i > 0 && styles.adimSatirSinir]}>
                <View style={styles.sayacBitenKutu}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                </View>
                <Text style={styles.sayacBitenAd} numberOfLines={1}>{b.ad}</Text>
                <Text style={styles.sayacBitenDk}>{b.dk} dk</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* sırada */}
      {siradaki !== -1 && (
        <>
          <Text style={styles.sayacBolumBaslik}>SIRADA</Text>
          <View style={styles.siradaKart}>
            <View style={[styles.adimIkon, { backgroundColor: renk + '1A' }]}>
              <Ionicons
                name={adimTipIkon(adimlar[siradaki].tip) ?? 'book-outline'}
                size={16}
                color={adimlar[siradaki].tip === 'mola' ? COLORS.textSecondary : renk}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.siradaAd} numberOfLines={1}>{adimlar[siradaki].ad}</Text>
              <View style={styles.adimMetaSatir}>
                <Ionicons name="timer-outline" size={11} color={COLORS.textLight} />
                <Text style={[styles.adimMeta, { color: renk }]}>
                  {adimMetaMetni(adimlar[siradaki])}
                </Text>
              </View>
            </View>
            <BaslaBtn solid={false} renk={renk} onPress={() => onSiradakiBasla(siradaki)} />
          </View>
        </>
      )}
    </>
  );
}

// ─── Adım ekle/düzenle modalı ─────────────────

function AdimDuzenleModal({
  acik,
  renk,
  mevcut,
  onKapat,
  onKaydet,
}: {
  acik: boolean;
  renk: string;
  mevcut: Adim | null;
  onKapat: () => void;
  onKaydet: (a: Adim) => void;
}) {
  const [ad, setAd] = useState('');
  const [tip, setTip] = useState<AdimTip>('oku');
  const [dk, setDk] = useState(10);
  const [soru, setSoru] = useState(10);

  useEffect(() => {
    if (acik) {
      setAd(mevcut?.ad ?? '');
      setTip(mevcut?.tip ?? 'oku');
      setDk(mevcut?.dk ?? 10);
      setSoru(mevcut?.soru ?? 10);
    }
  }, [acik, mevcut]);

  function kaydet() {
    if (!ad.trim()) return;
    const a: Adim = {
      tip,
      ad: ad.trim(),
      dk: Math.max(1, dk),
      done: mevcut?.done ?? false,
    };
    if (tip === 'soru') a.soru = Math.max(1, soru);
    onKaydet(a);
  }

  return (
    <Modal visible={acik} animationType="slide" transparent statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onKapat} />
      <View style={styles.modalSheet}>
        <View style={styles.sheetTutamac} />
        <Text style={styles.modalBaslik}>{mevcut ? 'Adımı düzenle' : 'Yeni adım'}</Text>

        <Text style={styles.modalEtiket}>Adım adı</Text>
        <View style={styles.modalInputSarici}>
          <TextInput
            style={styles.modalInput}
            value={ad}
            onChangeText={setAd}
            placeholder="Kavram tekrarı"
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        <Text style={styles.modalEtiket}>Tür</Text>
        <View style={styles.modalSegment}>
          <TouchableOpacity
            style={[styles.modalSegBtn, tip === 'oku' && styles.modalSegBtnAktif]}
            onPress={() => setTip('oku')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modalSegMetin, tip === 'oku' && styles.modalSegMetinAktif]}>Okuma</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalSegBtn, tip === 'soru' && styles.modalSegBtnAktif]}
            onPress={() => setTip('soru')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modalSegMetin, tip === 'soru' && styles.modalSegMetinAktif]}>Soru</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalSegBtn, tip === 'mola' && styles.modalSegBtnAktif]}
            onPress={() => setTip('mola')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modalSegMetin, tip === 'mola' && styles.modalSegMetinAktif]}>Mola</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepperSatir}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalEtiket}>Süre (dk)</Text>
            <Stepper deger={dk} onAzalt={() => setDk((v) => Math.max(1, v - 1))} onArtir={() => setDk((v) => v + 1)} />
          </View>
          {tip === 'soru' && (
            <View style={{ flex: 1 }}>
              <Text style={styles.modalEtiket}>Soru sayısı</Text>
              <Stepper deger={soru} onAzalt={() => setSoru((v) => Math.max(1, v - 1))} onArtir={() => setSoru((v) => v + 1)} />
            </View>
          )}
        </View>

        <View style={styles.modalButonlar}>
          <TouchableOpacity style={styles.modalIptal} onPress={onKapat} activeOpacity={0.85}>
            <Text style={styles.modalIptalMetin}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalKaydet, { backgroundColor: renk }]}
            onPress={kaydet}
            activeOpacity={0.85}
          >
            <Text style={styles.modalKaydetMetin}>{mevcut ? 'Güncelle' : 'Ekle'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Stepper({ deger, onAzalt, onArtir }: { deger: number; onAzalt: () => void; onArtir: () => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepperBtn} onPress={onAzalt} activeOpacity={0.7}>
        <Ionicons name="remove" size={18} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.stepperDeger}>{deger}</Text>
      <TouchableOpacity style={styles.stepperBtn} onPress={onArtir} activeOpacity={0.7}>
        <Ionicons name="add" size={18} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Stiller ──────────────────────────────────

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },
  merkez: { justifyContent: 'center', alignItems: 'center', gap: 14 },
  bosBaslik: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  geriBtnDuz: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  geriBtnDuzMetin: { color: '#fff', fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 14,
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
  headerSag: { minWidth: 36, alignItems: 'flex-end' },
  bittiBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
  },
  bittiBtnMetin: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Hero
  heroDersSatir: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  heroNokta: { width: 8, height: 8, borderRadius: 99 },
  heroDers: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  heroKonu: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  heroMetaSatir: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 9 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMetaMetin: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  // Liste
  bolumBaslikSatir: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 },
  bolumBaslik: { fontSize: 14.5, fontWeight: '800', color: COLORS.text },
  bolumSay: { fontSize: 11.5, fontWeight: '700', color: COLORS.textSecondary },
  bolumAlt: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight, paddingHorizontal: 2, marginTop: 4, marginBottom: 10 },
  listeKart: {
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  listeBos: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, textAlign: 'center', padding: 18 },
  adimSatir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  adimSatirSinir: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  adimIkon: { width: 26, height: 26, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  adimAdSatir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adimAd: { fontSize: 14, fontWeight: '600', color: COLORS.text, lineHeight: 18 },
  adimAdDone: { color: COLORS.textLight, textDecorationLine: 'line-through' },
  adimMetaSatir: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  adimMeta: { fontSize: 11.5, fontWeight: '600' },

  // İlerleme çubuğu (hero altında)
  ilerlemeSatir: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14, marginBottom: 18 },
  ilerlemeRay: { flex: 1, height: 8, borderRadius: 99, backgroundColor: COLORS.cardBorder, overflow: 'hidden' },
  ilerlemeDolgu: { height: '100%', borderRadius: 99 },
  ilerlemeSay: { fontSize: 12.5, fontWeight: '800', color: COLORS.text },

  // Adım sol durum dairesi (26px, tutarlı)
  durumTam: {
    width: 26,
    height: 26,
    borderRadius: 99,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durumNext: {
    width: 26,
    height: 26,
    borderRadius: 99,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durumNextNokta: { width: 9, height: 9, borderRadius: 99 },
  durumBos: { width: 26, height: 26, borderRadius: 99, borderWidth: 2, borderColor: COLORS.cardBorder },

  baslaSolid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 11,
  },
  baslaSolidMetin: { fontSize: 13, fontWeight: '800', color: '#fff' },
  baslaSoft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
  },
  baslaSoftMetin: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  ekleSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  ekleKutu: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary + '88',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ekleMetin: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },

  // Düzenle
  duzenleBaglamSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  duzenleBaglam: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, marginRight: 10 },
  duzenleBaglamMetin: { fontSize: 13.5, fontWeight: '700', color: COLORS.textSecondary },
  toplamPill: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  toplamPillMetin: { fontSize: 12.5, fontWeight: '800', color: COLORS.text },
  duzenleKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tasiSutun: { alignItems: 'center', justifyContent: 'center' },
  duzenleTurIkon: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  duzenleAd: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  duzenleAlt: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  dkPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  dkPillSayi: { fontSize: 12.5, fontWeight: '800', color: COLORS.text },
  dkPillBirim: { fontSize: 10.5, fontWeight: '700', color: COLORS.textLight },
  silBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: COLORS.error + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yeniAdimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    marginTop: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary + '55',
    backgroundColor: COLORS.primaryLight + '70',
  },
  yeniAdimMetin: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  ipucuSatir: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 14, paddingHorizontal: 4 },
  ipucuMetin: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight, flex: 1 },

  // Sayaç
  sayacKart: {
    borderRadius: 22,
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 5,
    marginBottom: 14,
  },
  sayacUstSatir: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 },
  sayacUst: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4 },
  sayacAd: { fontSize: 16.5, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 16, paddingHorizontal: 6 },
  sayacSure: { fontSize: 38, fontWeight: '800', color: COLORS.text, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  sayacHedef: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginTop: 4 },
  sayacButonlar: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
  duraklatBtn: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  duraklatMetin: { fontSize: 14.5, fontWeight: '800', color: COLORS.textSecondary },
  bitirBtn: {
    height: 46,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  bitirMetin: { fontSize: 14.5, fontWeight: '800', color: '#fff' },

  sayacBolumBaslik: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4, color: COLORS.textLight, paddingHorizontal: 2, marginBottom: 8, marginTop: 4 },
  sayacListe: { borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden', marginBottom: 14 },
  sayacBitenSatir: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 11 },
  sayacBitenKutu: { width: 24, height: 24, borderRadius: 7, backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center' },
  sayacBitenAd: { flex: 1, fontSize: 13.5, fontWeight: '600', color: COLORS.textLight, textDecorationLine: 'line-through' },
  sayacBitenDk: { fontSize: 11.5, fontWeight: '700', color: COLORS.textSecondary },
  siradaKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  siradaAd: { fontSize: 14, fontWeight: '800', color: COLORS.text },

  // Alt çubuk
  altCubuk: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  // Sıradaki adımı başlat (birincil eylem)
  baslatBtn: {
    height: 54,
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
  baslatMetin: { fontSize: 15.5, fontWeight: '800', color: '#fff' },
  // Görev tamamlandı bilgi şeridi
  tamamliSerit: {
    height: 54,
    borderRadius: 15,
    backgroundColor: COLORS.success + '14',
    borderWidth: 1.5,
    borderColor: COLORS.success + '55',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  tamamliMetin: { fontSize: 16, fontWeight: '800', color: COLORS.success },
  // Adımsız görevler için yedek tamamlama butonu
  tamamlaBtn: {
    height: 54,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  tamamlaBtnMetin: { fontSize: 16, fontWeight: '800', color: COLORS.text },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTutamac: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.cardBorder, alignSelf: 'center', marginBottom: 18 },
  modalBaslik: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  modalEtiket: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  modalInputSarici: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: 'center',
  },
  modalInput: { fontSize: 15, color: COLORS.text },
  modalSegment: { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 3, gap: 3 },
  modalSegBtn: { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalSegBtnAktif: { backgroundColor: COLORS.primary },
  modalSegMetin: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  modalSegMetinAktif: { color: '#fff' },
  stepperSatir: { flexDirection: 'row', gap: 14 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 6,
    height: 48,
    marginTop: 0,
  },
  stepperBtn: { width: 36, height: 36, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  stepperDeger: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalButonlar: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalIptal: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalIptalMetin: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  modalKaydet: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalKaydetMetin: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
