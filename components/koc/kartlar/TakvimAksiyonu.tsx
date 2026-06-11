// Takvim Aksiyonu — koçun ÖNERDİĞİ, öğrencinin ONAYLADIĞI takvim temizleme kartı.
// Koç takvimi kendi silemez (yalnızca metin/kart üretir); bu kart gerçek görev sayısını
// Firestore'dan okur, iki adımlı onayla siler ve sonucu kalıcı olarak gösterir.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../services/firebaseConfig';
import {
  kapsamGorevleriniGetir,
  gorevleriSil,
  type Gorev,
} from '../../../services/firestoreService';
import { COLORS } from '../../../constants/colors';
import { KartBaslik } from '../KartBaslik';
import { Press } from '../Press';
import { RADIUS } from '../tokens';
import type { KartBilesenProps } from './_ortak';
import type { TakvimAksiyonuVeri } from '../../../types/koc';

// Kapsama göre ekrandaki sözler (sayım cümlesi, boş-durum, varsayılan buton).
function kapsamSozleri(kapsam: TakvimAksiyonuVeri['kapsam']) {
  switch (kapsam) {
    case 'bugun':
      return { sayim: (n: number) => `Bugün için ${n} planın var.`, bos: 'Bugün zaten planın yok 🌿', btn: 'Bugünü boşalt' };
    case 'hafta':
      return { sayim: (n: number) => `Bu hafta için ${n} planın var.`, bos: 'Bu hafta planın yok 🌿', btn: 'Bu haftayı boşalt' };
    default:
      return { sayim: (n: number) => `Takvimde toplam ${n} planın var.`, bos: 'Takvimin zaten boş 🌿', btn: 'Takvimi sıfırla' };
  }
}

function onayEtiketi(veri: TakvimAksiyonuVeri): string {
  if (veri.onayEtiket?.trim()) return veri.onayEtiket.trim();
  return kapsamSozleri(veri.kapsam).btn;
}

export function TakvimAksiyonu({ veri, onGuncelle, onAksiyon }: KartBilesenProps<TakvimAksiyonuVeri>) {
  const sozler = kapsamSozleri(veri.kapsam);

  // Web'de oturum restorasyonu asenkron: uid'i dinle ki sayım doğru kullanıcıdan okunsun.
  const [uid, setUid] = useState<string | undefined>(() => auth.currentUser?.uid);
  useEffect(() => onAuthStateChanged(auth, (k) => setUid(k?.uid)), []);

  const [yukleniyor, setYukleniyor] = useState(!veri.sonuc);
  const [gorevler, setGorevler] = useState<Gorev[]>([]);
  const [onayAcik, setOnayAcik] = useState(false);
  const [siliniyor, setSiliniyor] = useState(false);
  const [hata, setHata] = useState(false);

  // Eylem zaten uygulanmışsa (kalıcı sonuç) sayım yapma.
  useEffect(() => {
    if (veri.sonuc) return;
    if (!uid) {
      setYukleniyor(false);
      return;
    }
    let iptal = false;
    setYukleniyor(true);
    setHata(false);
    kapsamGorevleriniGetir(uid, veri.kapsam)
      .then((liste) => {
        if (!iptal) setGorevler(liste);
      })
      .catch((e) => {
        console.error('[TakvimAksiyonu] sayım hatası:', e);
        if (!iptal) setHata(true);
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [uid, veri.kapsam, veri.sonuc]);

  async function sil() {
    if (!uid || siliniyor || gorevler.length === 0) return;
    setSiliniyor(true);
    try {
      const silinen = await gorevleriSil(
        uid,
        gorevler.map((g) => g.id)
      );
      onGuncelle({ ...veri, sonuc: 'yapildi', silinen });
    } catch (e) {
      console.error('[TakvimAksiyonu] silme hatası:', e);
      setHata(true);
    } finally {
      setSiliniyor(false);
      setOnayAcik(false);
    }
  }

  // ── Uygulandı: kalıcı sonuç ekranı ──
  if (veri.sonuc === 'yapildi') {
    const n = veri.silinen ?? 0;
    return (
      <View>
        <KartBaslik icon="calendar" baslik={veri.baslik} alt={veri.aciklama} />
        <View style={s.govde}>
          <View style={s.sonucKutu}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            <Text style={s.sonucMetin}>
              {n > 0
                ? `${n} plan takvimden kaldırıldı`
                : 'Takvim zaten boştu, kaldırılacak plan yoktu'}
            </Text>
          </View>
          <Press style={s.ikincilBtn} onPress={() => onAksiyon('takvim')} scale={0.98}>
            <Ionicons name="calendar-outline" size={15} color={COLORS.primary} />
            <Text style={s.ikincilMetin}>Takvime bak</Text>
          </Press>
        </View>
      </View>
    );
  }

  const sayi = gorevler.length;

  return (
    <View>
      <KartBaslik icon="calendar" baslik={veri.baslik} alt={veri.aciklama} />
      <View style={s.govde}>
        {!uid ? (
          <Durum ikon="lock-closed-outline" metin="Bu işlem için giriş yapman gerekiyor." />
        ) : yukleniyor ? (
          <View style={s.merkez}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : hata ? (
          <Durum ikon="alert-circle-outline" metin="Takvim okunamadı, birazdan tekrar dene." />
        ) : sayi === 0 ? (
          <Durum ikon="leaf-outline" renk={COLORS.success} metin={sozler.bos} />
        ) : (
          <>
            <View style={s.sayiSatir}>
              <View style={s.sayiRozet}>
                <Text style={s.sayiRozetMetin}>{sayi}</Text>
              </View>
              <Text style={s.sayiMetin}>
                {sozler.sayim(sayi)}
                {'\n'}
                <Text style={s.sayiAlt}>Deneme/sınav günlerine dokunulmaz.</Text>
              </Text>
            </View>

            {onayAcik ? (
              <View style={s.onaySatir}>
                <Press
                  style={[s.onayBtn, s.vazgecBtn]}
                  onPress={() => setOnayAcik(false)}
                  scale={0.98}
                >
                  <Text style={s.vazgecMetin}>Vazgeç</Text>
                </Press>
                <Press
                  style={[s.onayBtn, s.silBtn, siliniyor && { opacity: 0.6 }]}
                  onPress={sil}
                  scale={0.98}
                >
                  {siliniyor ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={15} color="#fff" />
                      <Text style={s.silMetin}>Evet, kaldır</Text>
                    </>
                  )}
                </Press>
              </View>
            ) : (
              <Press style={s.tetikBtn} onPress={() => setOnayAcik(true)} scale={0.98}>
                <Ionicons name="trash-outline" size={15} color={COLORS.error} />
                <Text style={s.tetikMetin}>{onayEtiketi(veri)}</Text>
              </Press>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function Durum({ ikon, metin, renk = COLORS.textSecondary }: { ikon: any; metin: string; renk?: string }) {
  return (
    <View style={s.durum}>
      <Ionicons name={ikon} size={18} color={renk} />
      <Text style={[s.durumMetin, { color: renk }]}>{metin}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  govde: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 12 },
  merkez: { paddingVertical: 14, alignItems: 'center' },

  durum: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  durumMetin: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  sayiSatir: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sayiRozet: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 8,
    borderRadius: RADIUS.kutu,
    backgroundColor: COLORS.error + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sayiRozetMetin: { fontSize: 17, fontWeight: '800', color: COLORS.error },
  sayiMetin: { flex: 1, fontSize: 13.5, fontWeight: '600', color: COLORS.text, lineHeight: 19 },
  sayiAlt: { fontSize: 11.5, fontWeight: '500', color: COLORS.textLight },

  // Birincil tetikleyici — yıkıcı ama kırmızı zemin değil (kazara basışı caydır, ikinci adım onaylar).
  tetikBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: RADIUS.buton,
    backgroundColor: COLORS.error + '12',
    borderWidth: 1,
    borderColor: COLORS.error + '33',
  },
  tetikMetin: { fontSize: 13.5, fontWeight: '700', color: COLORS.error },

  onaySatir: { flexDirection: 'row', gap: 9 },
  onayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: RADIUS.buton,
  },
  vazgecBtn: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.cardBorder },
  vazgecMetin: { fontSize: 13.5, fontWeight: '700', color: COLORS.textSecondary },
  silBtn: { backgroundColor: COLORS.error },
  silMetin: { fontSize: 13.5, fontWeight: '800', color: '#fff' },

  sonucKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: RADIUS.kutu,
    backgroundColor: COLORS.success + '12',
    borderWidth: 1,
    borderColor: COLORS.success + '33',
  },
  sonucMetin: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text, lineHeight: 18 },
  ikincilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: RADIUS.buton,
    backgroundColor: COLORS.primaryLight,
  },
  ikincilMetin: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
