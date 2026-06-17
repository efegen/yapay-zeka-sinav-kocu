// Haftalık planı takvime aktarma — önizleme + onay modalı.
// Günleri bugünden ileri monoton tarihlere eşler (7 günü aşan planlar sonraki
// haftaya taşar), mevcut görev/duplikasyon durumlarını gösterir, kullanıcı
// onayıyla Firestore'a planlı görev olarak yazar.
import React, { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { gorevEkle, gunGorevleriniGetir } from '../../services/firestoreService';
import { COLORS } from '../../constants/colors';
import { dersRenk } from '../../constants/dersler';
import { yksSinavGunuMu } from '../../constants/sinav';
import { GunTaslak, planiTaslaklaraCevir } from '../../utils/planAktar';
import type { HaftalikPlanVeri } from '../../types/koc';

const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function tarihEtiket(d: Date): string {
  return `${GUN_KISA[d.getDay()]} · ${d.getDate()} ${AY_KISA[d.getMonth()]}`;
}

function ayniMi(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('tr') === b.trim().toLocaleLowerCase('tr');
}

interface Meta {
  mevcutSayi: number;
  zatenVar: boolean;
}

export function PlaniTakvimeAktarModal({
  acik,
  veri,
  onKapat,
  onEklendi,
}: {
  acik: boolean;
  veri: HaftalikPlanVeri;
  onKapat: () => void;
  onEklendi: () => void;
}) {
  const router = useRouter();
  // Web'de oturum restorasyonu asenkron: mount anında currentUser null olabilir.
  // uid'i dinle ki modal açıkken oturum hazır olunca "giriş gerekli" dalına takılmasın.
  const [uid, setUid] = useState<string | undefined>(() => auth.currentUser?.uid);
  useEffect(() => onAuthStateChanged(auth, (k) => setUid(k?.uid)), []);

  const [yukleniyor, setYukleniyor] = useState(true);
  const [taslaklar, setTaslaklar] = useState<GunTaslak[]>([]);
  const [meta, setMeta] = useState<Meta[]>([]);
  const [secili, setSecili] = useState<boolean[]>([]);
  const [ekleniyor, setEkleniyor] = useState(false);
  const [sonuc, setSonuc] = useState<{ eklenen: number; atlanan: number } | null>(null);

  useEffect(() => {
    if (!acik) return;
    let iptal = false;

    setYukleniyor(true);
    setSonuc(null);

    const t = planiTaslaklaraCevir(veri.gunler ?? [], new Date());
    setTaslaklar(t);

    (async () => {
      // Hedef tarihlerdeki mevcut planlı görevleri çek (çakışma/duplikasyon için).
      const benzersizTarihler = Array.from(
        new Map(
          t.filter((x) => x.tarih).map((x) => [x.tarih!.toDateString(), x.tarih!])
        ).values()
      );

      const tarihGorev = new Map<string, { baslik: string }[]>();
      if (uid) {
        try {
          await Promise.all(
            benzersizTarihler.map(async (d) => {
              const { planned } = await gunGorevleriniGetir(uid, d);
              tarihGorev.set(d.toDateString(), planned.map((p) => ({ baslik: p.baslik })));
            })
          );
        } catch (err) {
          console.error('[PlaniTakvimeAktar] mevcut görev yükleme hatası:', err);
        }
      }
      if (iptal) return;

      const m: Meta[] = t.map((x) => {
        if (!x.tarih) return { mevcutSayi: 0, zatenVar: false };
        const mevcut = tarihGorev.get(x.tarih.toDateString()) ?? [];
        return {
          mevcutSayi: mevcut.length,
          zatenVar: mevcut.some((g) => ayniMi(g.baslik, x.baslik)),
        };
      });
      setMeta(m);
      // Varsayılan seçim: tarihi çözülen, zaten eklenmemiş ve YKS günü OLMAYAN günler işaretli.
      setSecili(
        t.map((x, i) => {
          if (!x.tarih || m[i].zatenVar) return false;
          return !yksSinavGunuMu(x.tarih);
        })
      );
      setYukleniyor(false);
    })();

    return () => {
      iptal = true;
    };
    // `veri`yi bilerek bağımlılığa koymuyoruz: eklemeden sonra onEklendi → veri
    // değişince efekt yeniden çalışıp sonuç ekranını silmesin. Modal her açılışta
    // (acik=true) güncel veriyi okur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik, uid]);

  function toggle(i: number) {
    const t = taslaklar[i];
    // Tarihi çözülemeyen, o gün zaten ekli (kopya) ya da YKS sınav günü olan günler seçilemez.
    if (!t.tarih || meta[i]?.zatenVar || yksSinavGunuMu(t.tarih)) return;
    setSecili((s) => s.map((v, j) => (j === i ? !v : v)));
  }

  const secilenSayi = secili.filter(Boolean).length;

  async function ekle() {
    if (!uid || ekleniyor || secilenSayi === 0) return;
    setEkleniyor(true);
    let eklenen = 0;
    let atlanan = 0;
    for (let i = 0; i < taslaklar.length; i++) {
      const t = taslaklar[i];
      if (!secili[i] || !t.tarih) {
        atlanan++;
        continue;
      }
      try {
        // Saat yok: görev yalnızca o güne ait (gece yarısı = saf tarih).
        const tarih = new Date(t.tarih);
        tarih.setHours(0, 0, 0, 0);
        await gorevEkle(uid, {
          baslik: t.baslik,
          ders: t.ders,
          tur: t.tur,
          sure: t.dakika,
          tip: 'planned',
          tarih: Timestamp.fromDate(tarih),
          tamamlandi: false,
          adimlar: t.adimlar,
        });
        eklenen++;
      } catch (err) {
        console.error('[PlaniTakvimeAktar] görev ekleme hatası:', err);
        atlanan++;
      }
    }
    setSonuc({ eklenen, atlanan });
    setEkleniyor(false);
    if (eklenen > 0) onEklendi();
  }

  function takvimeGit() {
    onKapat();
    router.push('/(tabs)/takvim' as never);
  }

  return (
    <Modal visible={acik} animationType="slide" transparent statusBarTranslucent onRequestClose={onKapat}>
      <Pressable style={s.overlay} onPress={onKapat} />
      <View style={s.sheet}>
        <View style={s.tutamac} />

        {/* başlık */}
        <View style={s.baslikSatir}>
          <View style={s.baslikIkon}>
            <Ionicons name="calendar" size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.baslik}>Planı takvime ekle</Text>
            <Text style={s.altBaslik}>Günler bugünden başlayarak sırayla tarihlenir</Text>
          </View>
        </View>

        {!uid ? (
          <View style={s.durum}>
            <Ionicons name="lock-closed-outline" size={22} color={COLORS.textLight} />
            <Text style={s.durumMetin}>Eklemek için giriş yapman gerekiyor.</Text>
          </View>
        ) : yukleniyor ? (
          <View style={s.durum}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : sonuc ? (
          <View style={s.durum}>
            <View style={s.basariIkon}>
              <Ionicons name="checkmark" size={26} color="#fff" />
            </View>
            <Text style={s.sonucBaslik}>
              {sonuc.eklenen > 0 ? `${sonuc.eklenen} gün takvime eklendi` : 'Hiç görev eklenmedi'}
            </Text>
            {sonuc.atlanan > 0 && (
              <Text style={s.sonucAlt}>{sonuc.atlanan} gün atlandı (seçilmedi ya da zaten vardı)</Text>
            )}
            <View style={s.sonucButonlar}>
              <TouchableOpacity style={s.ikincilBtn} onPress={onKapat} activeOpacity={0.85}>
                <Text style={s.ikincilMetin}>Kapat</Text>
              </TouchableOpacity>
              {sonuc.eklenen > 0 && (
                <TouchableOpacity style={s.birincilBtn} onPress={takvimeGit} activeOpacity={0.9}>
                  <Text style={s.birincilMetin}>Takvime git</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : taslaklar.length === 0 ? (
          <View style={s.durum}>
            <Text style={s.durumMetin}>Bu planda eklenecek gün bulunamadı.</Text>
          </View>
        ) : (
          <>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {taslaklar.map((t, i) => {
                const renk = dersRenk(t.ders);
                const m = meta[i] ?? { mevcutSayi: 0, zatenVar: false };
                const sec = secili[i];
                const sinavGunu = t.tarih ? yksSinavGunuMu(t.tarih) : false;
                const eklenemez = !t.tarih || m.zatenVar || sinavGunu;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.gunSatir, eklenemez && { opacity: 0.5 }]}
                    onPress={() => toggle(i)}
                    activeOpacity={0.7}
                    disabled={eklenemez}
                  >
                    <View
                      style={[
                        s.onay,
                        sec && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                      ]}
                    >
                      {sec && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                    <View style={[s.renkCubuk, { backgroundColor: renk }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.gunOdak} numberOfLines={1}>{t.baslik}</Text>
                      <View style={s.gunMetaSatir}>
                        <Text style={s.gunTarih}>
                          {t.tarih ? tarihEtiket(t.tarih) : `${t.gunAdi} · tarih çözülemedi`}
                        </Text>
                        <Text style={s.gunNokta}>·</Text>
                        <Text style={s.gunSure}>{t.dakika} dk</Text>
                        {t.tur === 'deneme' && (
                          <View style={s.denemeRozet}>
                            <Text style={s.denemeRozetMetin}>Deneme</Text>
                          </View>
                        )}
                      </View>
                      {/* uç durum bilgisi */}
                      {sinavGunu ? (
                        <Text style={s.uyari}>YKS sınav günü — eklenemez</Text>
                      ) : m.zatenVar ? (
                        <Text style={s.uyari}>Bu plan o gün zaten ekli — tekrar eklenmez</Text>
                      ) : m.mevcutSayi > 0 ? (
                        <Text style={s.bilgi}>O gün {m.mevcutSayi} görev daha var (çakışmaz)</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={s.altCubuk}>
              <TouchableOpacity style={s.ikincilBtn} onPress={onKapat} activeOpacity={0.85} disabled={ekleniyor}>
                <Text style={s.ikincilMetin}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.birincilBtn, (secilenSayi === 0 || ekleniyor) && { opacity: 0.5 }]}
                onPress={ekle}
                activeOpacity={0.9}
                disabled={secilenSayi === 0 || ekleniyor}
              >
                {ekleniyor ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.birincilMetin}>
                    {secilenSayi > 0 ? `Ekle (${secilenSayi} gün)` : 'Gün seç'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30,
  },
  tutamac: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.cardBorder, alignSelf: 'center', marginBottom: 18 },

  baslikSatir: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  baslikIkon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  baslik: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  altBaslik: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },

  durum: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 36 },
  durumMetin: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  basariIkon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sonucBaslik: { fontSize: 16, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  sonucAlt: { fontSize: 12.5, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  sonucButonlar: { flexDirection: 'row', gap: 10, marginTop: 12, alignSelf: 'stretch' },

  gunSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  onay: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renkCubuk: { width: 4, height: 30, borderRadius: 99 },
  gunOdak: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  gunMetaSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  gunTarih: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  gunNokta: { fontSize: 12, color: COLORS.textLight },
  gunSure: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  denemeRozet: { backgroundColor: COLORS.accent + '18', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 1 },
  denemeRozetMetin: { fontSize: 10.5, fontWeight: '800', color: COLORS.accent },
  uyari: { fontSize: 11.5, fontWeight: '600', color: COLORS.amber, marginTop: 3 },
  bilgi: { fontSize: 11.5, fontWeight: '600', color: COLORS.textLight, marginTop: 3 },

  altCubuk: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ikincilBtn: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ikincilMetin: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  birincilBtn: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  birincilMetin: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
