import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS } from '../constants/colors';
import { bildir } from '../utils/bildirim';
import { auth } from '../services/firebaseConfig';
import { denemeleriGetir, denemeGuncelle } from '../services/firestoreService';
import { konuSinyali } from '../services/kocHafizaService';
import {
  TYT_TESTLER,
  AYT_ALANLAR,
  fmtNet,
  type DenemeSonuc,
  type Test,
} from '../models/deneme';
import {
  KATEGORILER,
  kategorize,
  analizYap,
  kayipNetHesapla,
  konulariAyikla,
  type NedenKategori,
  type DersHata,
  type HataAnaliziRapor,
} from '../utils/hataAnalizi';

const KATEGORI_SIRA: NedenKategori[] = ['dikkatsizlik', 'sure', 'bilgi'];
const TYT_ADLARI = new Set(TYT_TESTLER.map((t) => t.ad));

// Hata yapılan bir dersin ekranda tutulan girdisi.
interface DersGiris {
  not: string;
  kategori: NedenKategori | null;
  konu: string; // yalnızca 'bilgi' kategorisinde: öğrencinin yazdığı gerçek konu(lar)
  manuel: boolean; // öğrenci çipi elle seçti mi (otomatik kategorize'ı ezsin)
}

// Denemede yanlış/boş olan, analiz edilecek ders satırı.
interface HataliDers {
  ad: string;
  yanlis: number;
  bos: number;
  kayipNet: number;
  foy: 'TYT' | 'AYT';
}

// Denemenin yanlış/boşu olan derslerini (analiz adayları) hesaplar. SAF — denemeden türetilir,
// hem giriş formu hem de kaydedilmiş raporun yeniden kurulumu bunu paylaşır.
function hataliDerslerHesapla(deneme: DenemeSonuc | null): HataliDers[] {
  if (!deneme) return [];
  const testler: Test[] = [
    ...(deneme.kapsam !== 'ayt' ? TYT_TESTLER : []),
    ...(deneme.kapsam !== 'tyt' ? AYT_ALANLAR[deneme.alan].testler : []),
  ];
  const out: HataliDers[] = [];
  for (const t of testler) {
    const c = deneme.cevaplar?.[t.ad];
    if (!c) continue; // öğrenci bu derse hiç girmemiş
    const d = parseInt(c.d || '0', 10) || 0;
    const y = parseInt(c.y || '0', 10) || 0;
    const bos = Math.max(0, t.soru - d - y);
    if (y === 0 && bos === 0) continue; // tam doğru → hata yok
    out.push({
      ad: t.ad,
      yanlis: y,
      bos,
      kayipNet: kayipNetHesapla(y, bos),
      foy: TYT_ADLARI.has(t.ad) ? 'TYT' : 'AYT',
    });
  }
  return out;
}

// Kaydedilmiş analizden rapor görünümünü yeniden kurar (geri girişte formu değil sonucu göster).
// Net/yanlış/boş kayda yazılmıyor; denemeden taze hesaplanıp kategoriyle eşleştirilir.
function raporKur(
  deneme: DenemeSonuc
): { rapor: HataAnaliziRapor; konular: { konu: string; ders: string }[] } | null {
  const kayit = deneme.hataAnalizi;
  if (!kayit) return null;
  const byAd = new Map(hataliDerslerHesapla(deneme).map((h): [string, HataliDers] => [h.ad, h]));
  const hatalar: DersHata[] = kayit.hatalar.map((r) => {
    const h = byAd.get(r.ders);
    return {
      ders: r.ders,
      yanlis: h?.yanlis ?? 0,
      bos: h?.bos ?? 0,
      kayipNet: h?.kayipNet ?? 0,
      kategori: r.kategori,
      not: r.not,
    };
  });
  const konular: { konu: string; ders: string }[] = [];
  for (const r of kayit.hatalar) {
    if (r.kategori !== 'bilgi' || !r.konu) continue;
    const foy = byAd.get(r.ders)?.foy ?? 'TYT';
    for (const k of konulariAyikla(r.konu)) konular.push({ konu: k, ders: `${foy} ${r.ders}` });
  }
  return { rapor: analizYap(hatalar), konular };
}

export default function HataAnaliz() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [deneme, setDeneme] = useState<DenemeSonuc | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [girisler, setGirisler] = useState<Record<string, DersGiris>>({});
  const [rapor, setRapor] = useState<HataAnaliziRapor | null>(null);
  const [eklenenKonular, setEklenenKonular] = useState<{ konu: string; ders: string }[]>([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // Denemeyi yükle (liste ekranından id ile gelinir).
  useEffect(() => {
    if (!uid || typeof id !== 'string') {
      setYukleniyor(false);
      return;
    }
    denemeleriGetir(uid)
      .then((list) => {
        const d = list.find((x) => x.id === id) ?? null;
        setDeneme(d);
        // Daha önce analiz edildiyse: formu kayıttan doldur (Düzenle için) ve raporu yeniden
        // kur ki geri girişte seçim formu değil doğrudan sonuç ekranı açılsın.
        if (d?.hataAnalizi) {
          const on: Record<string, DersGiris> = {};
          for (const h of d.hataAnalizi.hatalar) {
            on[h.ders] = { not: h.not ?? '', kategori: h.kategori, konu: h.konu ?? '', manuel: true };
          }
          setGirisler(on);
          const kur = raporKur(d);
          if (kur) {
            setRapor(kur.rapor);
            setEklenenKonular(kur.konular);
          }
        }
      })
      .catch((err) => console.error('[HataAnaliz] yükleme hatası:', err))
      .finally(() => setYukleniyor(false));
  }, [uid, id]);

  // Denemede yanlış/boşu olan dersler (yalnızca öğrencinin girdiği dersler).
  const hataliDersler = useMemo<HataliDers[]>(() => hataliDerslerHesapla(deneme), [deneme]);

  function girisAl(ad: string): DersGiris {
    return girisler[ad] ?? { not: '', kategori: null, konu: '', manuel: false };
  }

  function notDegis(ad: string, t: string) {
    setGirisler((g) => {
      const cur = g[ad] ?? { not: '', kategori: null, konu: '', manuel: false };
      // Elle seçim yoksa kategoriyi metinden otomatik çıkar.
      const kategori = cur.manuel ? cur.kategori : kategorize(t);
      return { ...g, [ad]: { ...cur, not: t, kategori } };
    });
  }

  function cipSec(ad: string, k: NedenKategori) {
    setGirisler((g) => {
      const cur = g[ad] ?? { not: '', kategori: null, konu: '', manuel: false };
      const ayni = cur.manuel && cur.kategori === k; // aynı çipe tekrar → otomatiğe dön
      return {
        ...g,
        [ad]: { ...cur, kategori: ayni ? kategorize(cur.not) : k, manuel: !ayni },
      };
    });
  }

  function konuDegis(ad: string, t: string) {
    setGirisler((g) => {
      const cur = g[ad] ?? { not: '', kategori: null, konu: '', manuel: false };
      return { ...g, [ad]: { ...cur, konu: t } };
    });
  }

  async function analizEt() {
    // Kategorisi belirlenmiş dersler (çip veya metinden otomatik).
    const dolu: { h: HataliDers; kategori: NedenKategori; not?: string }[] = [];
    for (const h of hataliDersler) {
      const g = girisAl(h.ad);
      if (g.kategori) dolu.push({ h, kategori: g.kategori, not: g.not.trim() || undefined });
    }

    if (!dolu.length) {
      bildir(
        'Açıklama gerekli',
        'Sağlıklı bir analiz için en az bir dersin hata sebebini kısaca yaz ya da bir kategori seç.'
      );
      return;
    }

    const hatalar: DersHata[] = dolu.map(({ h, kategori, not }) => ({
      ders: h.ad,
      yanlis: h.yanlis,
      bos: h.bos,
      kayipNet: h.kayipNet,
      kategori,
      not,
    }));
    const r = analizYap(hatalar);

    // "Bilgi Eksikliği" derslerinde öğrencinin yazdığı GERÇEK konuları topla — ders adını DEĞİL.
    // Konu yazılmadıysa hafızaya hiçbir şey yazma (yanlış/kaba kayıt oluşmasın).
    const eklenen: { konu: string; ders: string }[] = [];
    for (const { h, kategori } of dolu) {
      if (kategori !== 'bilgi') continue;
      const ham = girisAl(h.ad).konu.trim();
      if (!ham) continue;
      const dersEtiket = `${h.foy} ${h.ad}`; // bağlam: "TYT Fen Bilimleri"
      for (const k of konulariAyikla(ham)) eklenen.push({ konu: k, ders: dersEtiket });
    }

    setEklenenKonular(eklenen);
    setRapor(r);
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    if (!uid || typeof id !== 'string') return;
    setKaydediliyor(true);
    try {
      // Yalnızca öğrencinin adını yazdığı GERÇEK konuları koç hafızasına yaz.
      await Promise.all(
        eklenen.map((e) =>
          konuSinyali(uid, { ad: e.konu, ders: e.ders, sinyal: 'zorlaniyor' }).catch((err) =>
            console.error('[HataAnaliz] konuSinyali hatası:', err)
          )
        )
      );
      // Analizi denemeye kaydet (yeniden açınca görünsün).
      await denemeGuncelle(uid, id, {
        hataAnalizi: {
          hatalar: hatalar.map((h) => {
            const konu = girisAl(h.ders).konu.trim();
            return {
              ders: h.ders,
              kategori: h.kategori,
              ...(h.not ? { not: h.not } : {}),
              ...(h.kategori === 'bilgi' && konu ? { konu } : {}),
            };
          }),
          baskinKategori: r.baskinKategori,
          eksikKonular: r.eksikKonular,
          toplamKayipNet: r.toplamKayipNet,
          tarih: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[HataAnaliz] analiz kaydı hatası:', err);
    } finally {
      setKaydediliyor(false);
    }
  }

  // ── Başlık ─────────────────────────────────────────────────────────────
  const baslik = (
    <View style={styles.baslik}>
      <TouchableOpacity style={styles.kapatBtn} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="close" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={styles.baslikMetin}>Hata Analizi</Text>
        {deneme && (
          <Text style={styles.baslikAlt} numberOfLines={1}>
            {deneme.ad}
          </Text>
        )}
      </View>
      <View style={{ width: 36 }} />
    </View>
  );

  if (yukleniyor) {
    return (
      <View style={styles.ekran}>
        {baslik}
        <View style={styles.merkez}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (!deneme) {
    return (
      <View style={styles.ekran}>
        {baslik}
        <View style={styles.merkez}>
          <Text style={styles.bosMetin}>Deneme bulunamadı.</Text>
        </View>
      </View>
    );
  }

  if (hataliDersler.length === 0) {
    return (
      <View style={styles.ekran}>
        {baslik}
        <View style={styles.merkez}>
          <View style={styles.kutlamaIkon}>
            <Ionicons name="trophy-outline" size={38} color={COLORS.success} />
          </View>
          <Text style={styles.bosBaslik}>Analiz edilecek hata yok</Text>
          <Text style={styles.bosMetin}>
            Bu denemede yanlış ya da boşun yok. Tebrikler, harika iş! 🎉
          </Text>
        </View>
      </View>
    );
  }

  // ── Rapor görünümü ─────────────────────────────────────────────────────
  if (rapor) {
    const maxKayip = Math.max(...rapor.dagilim.map((d) => d.kayipNet), 1);
    const baskin = rapor.baskinKategori ? KATEGORILER[rapor.baskinKategori] : null;
    return (
      <View style={styles.ekran}>
        {baslik}
        <ScrollView ref={scrollRef} contentContainerStyle={styles.icerik} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          {baskin && (
            <LinearGradient
              colors={[baskin.renk, baskin.renk + 'CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroIkon}>
                <Ionicons name={baskin.ikon as any} size={22} color="#fff" />
              </View>
              <Text style={styles.heroEtiket}>EN ÇOK NET KAYBI</Text>
              <Text style={styles.heroBaslik}>{baskin.ad}</Text>
              <Text style={styles.heroAlt}>
                Bu denemede yaklaşık <Text style={styles.heroAltVurgu}>{fmtNet(rapor.toplamKayipNet)} net</Text> kaçtı.
              </Text>
            </LinearGradient>
          )}

          {/* Dağılım */}
          <Text style={styles.bolumBaslik}>Hata dağılımı</Text>
          <View style={styles.kart}>
            {rapor.dagilim.map((d, i) => {
              const meta = KATEGORILER[d.kategori];
              return (
                <View key={d.kategori} style={[styles.dagSatir, i > 0 && styles.dagAyrac]}>
                  <View style={styles.dagUst}>
                    <Ionicons name={meta.ikon as any} size={16} color={meta.renk} />
                    <Text style={styles.dagAd}>{meta.ad}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.dagNet, { color: meta.renk }]}>≈{fmtNet(d.kayipNet)} net</Text>
                  </View>
                  <View style={styles.barYol}>
                    <View style={[styles.barDolu, { width: `${(d.kayipNet / maxKayip) * 100}%`, backgroundColor: meta.renk }]} />
                  </View>
                  <Text style={styles.dagDersler}>
                    {d.dersSayisi} ders · {d.dersler.map((k) => k.ad).join(', ')}
                  </Text>
                  {/* Öğrencinin kendi yazdığı açıklamalar — kategori tahminini besleyen metin artık görünür. */}
                  {d.dersler.some((k) => k.not) && (
                    <View style={styles.notKutu}>
                      {d.dersler
                        .filter((k) => k.not)
                        .map((k) => (
                          <View key={k.ad} style={styles.notSatir}>
                            <Ionicons
                              name="chatbubble-ellipses-outline"
                              size={12}
                              color={meta.renk}
                              style={{ marginTop: 2 }}
                            />
                            <Text style={styles.notMetin}>
                              <Text style={styles.notDers}>{k.ad}: </Text>
                              {k.not}
                            </Text>
                          </View>
                        ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Stratejik öneriler */}
          <Text style={styles.bolumBaslik}>Sana özel öneriler</Text>
          {rapor.dagilim.map((d) => {
            const meta = KATEGORILER[d.kategori];
            return (
              <View key={d.kategori} style={[styles.oneriKart, { borderLeftColor: meta.renk }]}>
                <View style={styles.oneriUst}>
                  <Ionicons name={meta.ikon as any} size={15} color={meta.renk} />
                  <Text style={[styles.oneriBaslik, { color: meta.renk }]}>{meta.ad}</Text>
                </View>
                <Text style={styles.oneriMetin}>{meta.oneri}</Text>
              </View>
            );
          })}

          {/* Öğrencinin yazdığı gerçek konular → koç hafızası */}
          {eklenenKonular.length > 0 && (
            <View style={styles.hafizaKart}>
              <View style={styles.oneriUst}>
                <Ionicons name="sparkles-outline" size={15} color={COLORS.accent} />
                <Text style={[styles.oneriBaslik, { color: COLORS.accent }]}>Koç hafızana eklendi</Text>
              </View>
              <Text style={styles.oneriMetin}>
                Şu konular "zorlandığın konular" olarak işaretlendi; AI Koç planını bunlara göre önceliklendirecek:
              </Text>
              <View style={styles.etiketSarma}>
                {eklenenKonular.map((e, i) => (
                  <View key={`${e.konu}-${i}`} style={styles.konuEtiket}>
                    <Text style={styles.konuEtiketMetin}>{e.konu}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.duzenleBtn} onPress={() => setRapor(null)} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={17} color={COLORS.textSecondary} />
            <Text style={styles.duzenleMetin}>Düzenle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.9} onPress={() => router.back()}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bitirBtn}
            >
              <Ionicons name="checkmark" size={19} color="#fff" />
              <Text style={styles.bitirMetin}>Bitir</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Giriş formu ────────────────────────────────────────────────────────
  return (
    <View style={styles.ekran}>
      {baslik}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.icerik}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.aciklamaKart}>
          <Ionicons name="bulb-outline" size={18} color={COLORS.primary} />
          <Text style={styles.aciklamaMetin}>
            Yanlış/boş yaptığın her ders için <Text style={styles.aciklamaVurgu}>neden kaçırdığını</Text> kısaca yaz.
            Sebebini kategoriye ayırıp sana özel bir hata raporu çıkaracağım.
          </Text>
        </View>

        {hataliDersler.map((h) => {
          const g = girisAl(h.ad);
          return (
            <View key={h.ad} style={styles.dersKart}>
              <View style={styles.dersUst}>
                <Text style={styles.dersAd} numberOfLines={1}>{h.ad}</Text>
                <View style={styles.dersMeta}>
                  {h.yanlis > 0 && (
                    <Text style={[styles.metaPill, { color: COLORS.error, backgroundColor: COLORS.error + '14' }]}>
                      {h.yanlis} yanlış
                    </Text>
                  )}
                  {h.bos > 0 && (
                    <Text style={[styles.metaPill, { color: COLORS.textSecondary, backgroundColor: COLORS.backgroundSecondary }]}>
                      {h.bos} boş
                    </Text>
                  )}
                </View>
              </View>

              <TextInput
                value={g.not}
                onChangeText={(t) => notDegis(h.ad, t)}
                placeholder="örn: süre yetmedi / dikkatsizlik yaptım / konuyu bilmiyordum"
                placeholderTextColor={COLORS.textLight}
                style={styles.notInput}
                multiline
              />

              <View style={styles.cipSatir}>
                {KATEGORI_SIRA.map((k) => {
                  const meta = KATEGORILER[k];
                  const secili = g.kategori === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      activeOpacity={0.85}
                      onPress={() => cipSec(h.ad, k)}
                      style={[
                        styles.cip,
                        secili && { backgroundColor: meta.renk + '16', borderColor: meta.renk },
                      ]}
                    >
                      <Ionicons name={meta.ikon as any} size={13} color={secili ? meta.renk : COLORS.textLight} />
                      <Text style={[styles.cipMetin, secili && { color: meta.renk }]}>{meta.ad}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bilgi eksikliğinde GERÇEK konuyu sor — koç hafızasına bu yazılır (ders adı değil). */}
              {g.kategori === 'bilgi' && (
                <View style={styles.konuSatir}>
                  <Ionicons name="book-outline" size={14} color={COLORS.accent} />
                  <TextInput
                    value={g.konu}
                    onChangeText={(t) => konuDegis(h.ad, t)}
                    placeholder="Hangi konu(lar)? örn: Optik, Hareket"
                    placeholderTextColor={COLORS.textLight}
                    style={styles.konuInput}
                  />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.9} onPress={analizEt} disabled={kaydediliyor}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bitirBtn, kaydediliyor && { opacity: 0.7 }]}
          >
            <Ionicons name="analytics-outline" size={19} color="#fff" />
            <Text style={styles.bitirMetin}>Analiz et</Text>
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
  baslikAlt: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight, marginTop: 1, maxWidth: 220 },

  merkez: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  bosBaslik: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  bosMetin: { fontSize: 13.5, fontWeight: '500', color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  kutlamaIkon: {
    width: 76, height: 76, borderRadius: 24, backgroundColor: COLORS.success + '18',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },

  icerik: { padding: 16, gap: 12 },

  // ── Açıklama ──
  aciklamaKart: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight, borderRadius: 14, padding: 13,
  },
  aciklamaMetin: { flex: 1, fontSize: 12.5, fontWeight: '500', color: COLORS.text, lineHeight: 18 },
  aciklamaVurgu: { fontWeight: '800', color: COLORS.primary },

  // ── Ders giriş kartı ──
  dersKart: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 13, gap: 10,
  },
  dersUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dersAd: { fontSize: 14.5, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2, flexShrink: 1 },
  dersMeta: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  metaPill: {
    fontSize: 10.5, fontWeight: '800', overflow: 'hidden',
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99,
  },
  notInput: {
    backgroundColor: COLORS.background, borderRadius: 11, borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, fontWeight: '500', color: COLORS.text,
    minHeight: 42,
  },
  cipSatir: { flexDirection: 'row', gap: 7 },
  cip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
  },
  cipMetin: { fontSize: 11, fontWeight: '800', color: COLORS.textLight },
  konuSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.accent + '0E', borderRadius: 11,
    borderWidth: 1, borderColor: COLORS.accent + '2E',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  konuInput: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text, padding: 0 },

  // ── Rapor: hero ──
  hero: { borderRadius: 18, padding: 18, gap: 3 },
  heroIkon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  heroEtiket: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: 'rgba(255,255,255,0.85)' },
  heroBaslik: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroAlt: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.92)', marginTop: 4, lineHeight: 19 },
  heroAltVurgu: { fontWeight: '800', color: '#fff' },

  // ── Rapor: dağılım ──
  bolumBaslik: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase',
    color: COLORS.textLight, marginTop: 6, marginBottom: -2, marginLeft: 2,
  },
  kart: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 14,
  },
  dagSatir: { gap: 6 },
  dagAyrac: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  dagUst: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dagAd: { fontSize: 13.5, fontWeight: '800', color: COLORS.text },
  dagNet: { fontSize: 13, fontWeight: '800' },
  barYol: { height: 8, borderRadius: 99, backgroundColor: COLORS.backgroundSecondary, overflow: 'hidden' },
  barDolu: { height: 8, borderRadius: 99 },
  dagDersler: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight },
  notKutu: { gap: 5, marginTop: 6 },
  notSatir: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  notMetin: { flex: 1, fontSize: 12, fontWeight: '500', color: COLORS.textSecondary, lineHeight: 17, fontStyle: 'italic' },
  notDers: { fontWeight: '800', fontStyle: 'normal', color: COLORS.text },

  // ── Rapor: öneri ──
  oneriKart: {
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderLeftWidth: 4, padding: 13, gap: 6,
  },
  oneriUst: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  oneriBaslik: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  oneriMetin: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, lineHeight: 19 },

  hafizaKart: {
    backgroundColor: COLORS.accent + '0E', borderRadius: 14, borderWidth: 1, borderColor: COLORS.accent + '2E',
    padding: 13, gap: 8,
  },
  etiketSarma: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  konuEtiket: { backgroundColor: COLORS.accent + '1A', borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 },
  konuEtiketMetin: { fontSize: 11.5, fontWeight: '800', color: COLORS.accent },

  // ── Footer ──
  footer: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24,
    shadowColor: COLORS.ink, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: -8 }, elevation: 12,
  },
  bitirBtn: {
    height: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    shadowColor: COLORS.primary, shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  bitirMetin: { fontSize: 16, fontWeight: '800', color: '#fff' },
  duzenleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 15,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  duzenleMetin: { fontSize: 14.5, fontWeight: '800', color: COLORS.textSecondary },
});
