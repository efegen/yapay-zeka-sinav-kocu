import { useMemo, useState, type ComponentProps } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';
import { auth } from '../services/firebaseConfig';
import { useKocHafiza } from '../hooks/useKocHafiza';
import {
  konuSil,
  konuDurumGuncelle,
  kisiselNotSil,
  hafizaTemizle,
} from '../services/kocHafizaService';
import type { KisiselNot, KonuKaydi, NotKategori } from '../types/koc';
import { bildir } from '../utils/bildirim';

type KonuSatir = { anahtar: string; kayit: KonuKaydi };
type NotSatir = { anahtar: string; kayit: KisiselNot };
/** Silme onayı konu ve kişisel not için ortak çalışır. */
type SilHedefi = { tur: 'konu' | 'not'; anahtar: string; etiket: string };

const NOT_KATEGORI_META: Record<NotKategori, { etiket: string; icon: ComponentProps<typeof Ionicons>['name'] }> = {
  tercih: { etiket: 'Tercih', icon: 'heart-outline' },
  rutin: { etiket: 'Rutin', icon: 'time-outline' },
  duygu: { etiket: 'Motivasyon', icon: 'pulse-outline' },
};

function etiketOf(k: KonuKaydi): string {
  return k.ders ? `${k.ders} · ${k.ad}` : k.ad;
}

/** "2026-06-11T..." → "11 Haz" gibi kısa, okunur tarih. */
function tarihKisa(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const aylar = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const d = new Date(t);
  return `${d.getDate()} ${aylar[d.getMonth()]}`;
}

export default function KocHafiza() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hafiza } = useKocHafiza();
  const uid = auth.currentUser?.uid;

  const [silHedef, setSilHedef] = useState<SilHedefi | null>(null);
  const [tumunuSilAcik, setTumunuSilAcik] = useState(false);
  const [islemYukleniyor, setIslemYukleniyor] = useState(false);

  // hafiza null → henüz yükleniyor; {} veya {konular:{}} → boş.
  const yukleniyor = hafiza === null;

  const { zorlananlar, iyiler, notSatirlari } = useMemo(() => {
    const konular = hafiza?.konular ?? {};
    const satirlar: KonuSatir[] = Object.entries(konular).map(([anahtar, kayit]) => ({ anahtar, kayit }));
    // En son görülen üstte.
    satirlar.sort((a, b) => Date.parse(b.kayit.sonGorulme) - Date.parse(a.kayit.sonGorulme));
    const notlar: NotSatir[] = Object.entries(hafiza?.notlar ?? {}).map(([anahtar, kayit]) => ({ anahtar, kayit }));
    notlar.sort((a, b) => Date.parse(b.kayit.sonGorulme) - Date.parse(a.kayit.sonGorulme));
    return {
      zorlananlar: satirlar.filter((s) => s.kayit.durum === 'zayif'),
      iyiler: satirlar.filter((s) => s.kayit.durum === 'iyi'),
      notSatirlari: notlar,
    };
  }, [hafiza]);

  const toplam = zorlananlar.length + iyiler.length + notSatirlari.length;

  async function durumDegistir(satir: KonuSatir) {
    if (!uid) return;
    const yeni: KonuKaydi['durum'] = satir.kayit.durum === 'zayif' ? 'iyi' : 'zayif';
    await konuDurumGuncelle(uid, satir.anahtar, yeni);
  }

  function konuSilIste(satir: KonuSatir) {
    setSilHedef({ tur: 'konu', anahtar: satir.anahtar, etiket: etiketOf(satir.kayit) });
  }

  function notSilIste(satir: NotSatir) {
    setSilHedef({ tur: 'not', anahtar: satir.anahtar, etiket: satir.kayit.metin });
  }

  async function hedefiSil() {
    if (!uid || !silHedef) return;
    setIslemYukleniyor(true);
    await (silHedef.tur === 'konu' ? konuSil(uid, silHedef.anahtar) : kisiselNotSil(uid, silHedef.anahtar));
    setIslemYukleniyor(false);
    setSilHedef(null);
  }

  async function hepsiniSil() {
    if (!uid) return;
    setIslemYukleniyor(true);
    await hafizaTemizle(uid);
    setIslemYukleniyor(false);
    setTumunuSilAcik(false);
    bildir('Temizlendi', 'Koç hafızası sıfırlandı.');
  }

  return (
    <View style={s.ekran}>
      {/* Başlık */}
      <View style={[s.baslik, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.kapatBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={s.baslikMetin}>Koç Hafızam</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.icerik, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Açıklama */}
        <View style={s.bilgiKart}>
          <View style={s.bilgiIkon}>
            <Ionicons name="sparkles-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={s.bilgiMetin}>
            AI koçun; zorlandığın ve iyi olduğun konuları, ayrıca çalışma düzeninle ilgili
            paylaştığın önemli bilgileri burada not eder. Sana daha doğru yardım etmek için
            kullanır. Yanlış olanı düzeltebilir ya da silebilirsin.
          </Text>
        </View>

        {yukleniyor ? (
          <View style={s.merkez}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : toplam === 0 ? (
          <View style={s.bos}>
            <Text style={s.bosEmoji}>🧠</Text>
            <Text style={s.bosBaslik}>Henüz bir not yok</Text>
            <Text style={s.bosMetin}>
              AI Koç'la sohbet ettikçe ve soru çözdükçe; zorlandığın ve iyi olduğun konular
              ile senin hakkında aldığı notlar burada birikecek.
            </Text>
          </View>
        ) : (
          <>
            {zorlananlar.length > 0 && (
              <Bolum
                baslik="Zorlandığım Konular"
                renk={COLORS.error}
                satirlar={zorlananlar}
                onDurum={durumDegistir}
                onSil={konuSilIste}
              />
            )}
            {iyiler.length > 0 && (
              <Bolum
                baslik="İyi Olduğum Konular"
                renk={COLORS.success}
                satirlar={iyiler}
                onDurum={durumDegistir}
                onSil={konuSilIste}
              />
            )}
            {notSatirlari.length > 0 && (
              <NotBolumu satirlar={notSatirlari} onSil={notSilIste} />
            )}

            <TouchableOpacity style={s.temizleBtn} onPress={() => setTumunuSilAcik(true)} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
              <Text style={s.temizleMetin}>Tüm Hafızayı Temizle</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Tek konu sil onayı */}
      <Modal visible={!!silHedef} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={s.overlay} onPress={() => setSilHedef(null)} />
        <View style={s.dialog}>
          <Text style={s.dialogEmoji}>🗑️</Text>
          <Text style={s.dialogBaslik}>Bu notu sil</Text>
          <Text style={s.dialogMesaj}>
            "{silHedef?.etiket ?? ''}" notunu koç hafızasından silmek istiyor musun?
          </Text>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.iptalBtn} onPress={() => setSilHedef(null)} activeOpacity={0.8}>
              <Text style={s.iptalMetin}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.silOnayBtn} onPress={hedefiSil} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={s.onayMetin}>Sil</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Tümünü temizle onayı */}
      <Modal visible={tumunuSilAcik} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={s.overlay} onPress={() => setTumunuSilAcik(false)} />
        <View style={s.dialog}>
          <Text style={s.dialogEmoji}>⚠️</Text>
          <Text style={s.dialogBaslik}>Tüm hafızayı temizle</Text>
          <Text style={s.dialogMesaj}>
            Koçun senin hakkında not ettiği tüm konular silinecek. Bu işlem geri alınamaz.
          </Text>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.iptalBtn} onPress={() => setTumunuSilAcik(false)} activeOpacity={0.8}>
              <Text style={s.iptalMetin}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.silOnayBtn} onPress={hepsiniSil} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={s.onayMetin}>Temizle</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Bölüm (zorlandığım / iyi olduğum) ────────────────────────────────────────

function Bolum({
  baslik, renk, satirlar, onDurum, onSil,
}: {
  baslik: string;
  renk: string;
  satirlar: KonuSatir[];
  onDurum: (s: KonuSatir) => void;
  onSil: (s: KonuSatir) => void;
}) {
  return (
    <View style={s.bolum}>
      <View style={s.bolumBaslikRow}>
        <View style={[s.bolumNokta, { backgroundColor: renk }]} />
        <Text style={s.bolumBaslik}>{baslik}</Text>
        <Text style={s.bolumSayi}>{satirlar.length}</Text>
      </View>
      <View style={s.bolumKap}>
        {satirlar.map((satir, i) => (
          <KonuSatiri
            key={satir.anahtar}
            satir={satir}
            son={i === satirlar.length - 1}
            onDurum={onDurum}
            onSil={onSil}
          />
        ))}
      </View>
    </View>
  );
}

function KonuSatiri({
  satir, son, onDurum, onSil,
}: {
  satir: KonuSatir;
  son: boolean;
  onDurum: (s: KonuSatir) => void;
  onSil: (s: KonuSatir) => void;
}) {
  const { kayit } = satir;
  const zayif = kayit.durum === 'zayif';
  return (
    <View style={[s.satir, son ? null : s.satirBorder]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.satirAd} numberOfLines={2}>{kayit.ad}</Text>
        <Text style={s.satirAlt} numberOfLines={1}>
          {kayit.ders ? `${kayit.ders} · ` : ''}{tarihKisa(kayit.sonGorulme)}
        </Text>
      </View>

      {/* Durumu ters çevir */}
      <TouchableOpacity
        style={[s.durumBtn, { backgroundColor: zayif ? '#FEECEC' : '#E5F7F0' }]}
        onPress={() => onDurum(satir)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={zayif ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
          size={13}
          color={zayif ? COLORS.error : COLORS.success}
        />
        <Text style={[s.durumBtnMetin, { color: zayif ? COLORS.error : COLORS.success }]}>
          {zayif ? 'Artık biliyorum' : 'Zorlanıyorum'}
        </Text>
      </TouchableOpacity>

      {/* Sil */}
      <TouchableOpacity style={s.silIkonBtn} onPress={() => onSil(satir)} hitSlop={6} activeOpacity={0.6}>
        <Ionicons name="trash-outline" size={17} color={COLORS.textLight} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Hakkımdaki notlar (tercih / rutin / motivasyon) ─────────────────────────

function NotBolumu({ satirlar, onSil }: { satirlar: NotSatir[]; onSil: (s: NotSatir) => void }) {
  return (
    <View style={s.bolum}>
      <View style={s.bolumBaslikRow}>
        <View style={[s.bolumNokta, { backgroundColor: COLORS.primary }]} />
        <Text style={s.bolumBaslik}>Hakkımdaki Notlar</Text>
        <Text style={s.bolumSayi}>{satirlar.length}</Text>
      </View>
      <View style={s.bolumKap}>
        {satirlar.map((satir, i) => (
          <NotSatiri key={satir.anahtar} satir={satir} son={i === satirlar.length - 1} onSil={onSil} />
        ))}
      </View>
    </View>
  );
}

function NotSatiri({ satir, son, onSil }: { satir: NotSatir; son: boolean; onSil: (s: NotSatir) => void }) {
  const meta = NOT_KATEGORI_META[satir.kayit.kategori] ?? NOT_KATEGORI_META.tercih;
  return (
    <View style={[s.satir, son ? null : s.satirBorder]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.satirAd} numberOfLines={3}>{satir.kayit.metin}</Text>
        <View style={s.notAltRow}>
          <Ionicons name={meta.icon} size={11} color={COLORS.textLight} />
          <Text style={s.satirAlt} numberOfLines={1}>
            {meta.etiket} · {tarihKisa(satir.kayit.sonGorulme)}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={s.silIkonBtn} onPress={() => onSil(satir)} hitSlop={6} activeOpacity={0.6}>
        <Ionicons name="trash-outline" size={17} color={COLORS.textLight} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const SEP = 'rgba(60,60,67,0.1)';

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, paddingHorizontal: 14,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  kapatBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  baslikMetin: { fontSize: 16, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },

  icerik: { padding: 16 },

  // Bilgi kartı
  bilgiKart: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16, padding: 14, marginBottom: 20,
  },
  bilgiIkon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  bilgiMetin: { flex: 1, fontSize: 12.5, lineHeight: 18, color: COLORS.text, opacity: 0.85 },

  merkez: { paddingVertical: 60, alignItems: 'center' },

  // Boş durum
  bos: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  bosEmoji: { fontSize: 42, marginBottom: 12 },
  bosBaslik: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  bosMetin: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },

  // Bölüm
  bolum: { marginBottom: 18 },
  bolumBaslikRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 8 },
  bolumNokta: { width: 8, height: 8, borderRadius: 4 },
  bolumBaslik: {
    flex: 1, fontSize: 11.5, fontWeight: '700', color: COLORS.textLight,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  bolumSayi: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  bolumKap: {
    backgroundColor: COLORS.card,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    shadowColor: '#1E1B4B', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Satır
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 14 },
  satirBorder: { borderBottomWidth: 1, borderBottomColor: SEP },
  satirAd: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  satirAlt: { fontSize: 11.5, color: COLORS.textLight, marginTop: 2 },
  notAltRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },

  durumBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, flexShrink: 0,
  },
  durumBtnMetin: { fontSize: 11, fontWeight: '700' },

  silIkonBtn: { padding: 4, flexShrink: 0 },

  // Tümünü temizle
  temizleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12, marginTop: 4,
    borderWidth: 1, borderColor: '#FEECEC', backgroundColor: '#FEF5F5',
  },
  temizleMetin: { fontSize: 14, fontWeight: '700', color: COLORS.error },

  // Modaller
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: {
    position: 'absolute', alignSelf: 'center', top: '30%',
    width: '86%', backgroundColor: COLORS.card,
    borderRadius: 20, padding: 24, alignItems: 'center',
  },
  dialogEmoji: { fontSize: 34, marginBottom: 10 },
  dialogBaslik: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  dialogMesaj: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },

  btnRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  iptalBtn: {
    flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  iptalMetin: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  silOnayBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.error },
  onayMetin: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
