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
  Animated,
  Platform,
  Share,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  verifyBeforeUpdateEmail,
  deleteUser,
} from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../services/firebaseConfig';
import { cikisYap } from '../../services/authService';
import {
  manuelSyncHedefNet,
  denemeleriGetir,
  profilGuncelle,
  kullaniciVerisiniTopla,
} from '../../services/firestoreService';
import { useProfile, Profil as ProfilType } from '../../hooks/useProfile';
import { COLORS } from '../../constants/colors';
import { hedefYksYili } from '../../constants/sinav';
import { ALT_CUBUK_BOSLUK } from '../../components/AltCubuk';
import { bildir } from '../../utils/bildirim';

type AktifModal = null | 'sifre' | 'kvkk' | 'hesapSil' | 'cikis' | 'hedefler' | 'eposta' | 'sinif';

const SINIF_SECENEKLERI = [
  { deger: '11', baslik: '11. Sınıf' },
  { deger: '12', baslik: '12. Sınıf' },
  { deger: 'mezun', baslik: 'Mezun' },
];

const SEP = 'rgba(60,60,67,0.1)';
const ACCENT_LIGHT = '#FCE7F3';
const SUCCESS_LIGHT = '#E5F7F0';
const ERROR_LIGHT = '#FEECEC';
const SEGMENT_TRACK = '#E5E8F4';

function puanTuruTam(tur?: string) {
  const map: Record<string, string> = {
    SAY: 'Sayısal', EA: 'Eşit Ağırlık', SOZ: 'Sözel', DIL: 'Dil',
  };
  return tur ? (map[tur] ?? tur) : '';
}

function sinifTam(sinif?: string) {
  if (!sinif) return '—';
  return sinif === 'mezun' ? 'Mezun' : `${sinif}. Sınıf`;
}

// ─── Ana bileşen ────────────────────────────────────────────────────────────

export default function Profil() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profil, yukleniyor } = useProfile();
  const [aktifSekme, setAktifSekme] = useState(0);
  const [aktifModal, setAktifModal] = useState<AktifModal>(null);
  const [islemYukleniyor, setIslemYukleniyor] = useState(false);
  const [denemeSayisi, setDenemeSayisi] = useState(0);

  const [mevcutSifre, setMevcutSifre] = useState('');
  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');
  const [sifreHata, setSifreHata] = useState('');
  const [silSifre, setSilSifre] = useState('');
  const [silHata, setSilHata] = useState('');

  const [yeniEposta, setYeniEposta] = useState('');
  const [epostaSifre, setEpostaSifre] = useState('');
  const [epostaHata, setEpostaHata] = useState('');
  const [hedefSoru, setHedefSoru] = useState(0);
  const [hedefGun, setHedefGun] = useState(1);
  const [sinifSecim, setSinifSecim] = useState('');

  const [trackWidth, setTrackWidth] = useState(0);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    denemeleriGetir(uid).then(list => setDenemeSayisi(list.length));
  }, []);

  function sekmeDegistir(index: number) {
    if (index === aktifSekme) return;
    Animated.timing(tabAnim, {
      toValue: index,
      duration: 260,
      useNativeDriver: true,
    }).start();
    Animated.timing(contentOpacity, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setAktifSekme(index);
      contentTranslate.setValue(14);
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(contentTranslate, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    });
  }

  function modalKapat() {
    setAktifModal(null);
    setMevcutSifre(''); setYeniSifre(''); setYeniSifreTekrar(''); setSifreHata('');
    setSilSifre(''); setSilHata('');
    setYeniEposta(''); setEpostaSifre(''); setEpostaHata('');
  }

  function hedeflerAc() {
    setHedefSoru(profil?.gunlukSoruHedefi ?? 0);
    setHedefGun(profil?.haftaCalismaSayisi ?? 1);
    setAktifModal('hedefler');
  }

  function sinifAc() {
    setSinifSecim(profil?.sinif ?? '');
    setAktifModal('sinif');
  }

  async function sinifKaydet() {
    const uid = auth.currentUser?.uid;
    if (!uid || !sinifSecim) return;
    setIslemYukleniyor(true);
    try {
      await profilGuncelle(uid, { sinif: sinifSecim });
      modalKapat();
      bildir('Kaydedildi', 'Sınıfın güncellendi.');
    } catch (e) {
      console.error('[Profil] sinif kaydetme hatasi:', e);
      bildir('Hata', 'Sınıf kaydedilemedi, tekrar dene.');
    } finally {
      setIslemYukleniyor(false);
    }
  }

  async function hedefleriKaydet() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setIslemYukleniyor(true);
    try {
      await profilGuncelle(uid, { gunlukSoruHedefi: hedefSoru, haftaCalismaSayisi: hedefGun });
      modalKapat();
      bildir('Kaydedildi', 'Çalışma hedeflerin güncellendi.');
    } catch (e) {
      console.error('[Profil] hedef kaydetme hatası:', e);
      bildir('Hata', 'Hedefler kaydedilemedi, tekrar dene.');
    } finally {
      setIslemYukleniyor(false);
    }
  }

  async function epostaDegistir() {
    const yeni = yeniEposta.trim();
    if (!yeni.includes('@') || !yeni.includes('.')) { setEpostaHata('Geçerli bir e-posta gir.'); return; }
    if (!epostaSifre) { setEpostaHata('Mevcut şifreni gir.'); return; }
    const kullanici = auth.currentUser;
    if (!kullanici?.email) return;
    setIslemYukleniyor(true);
    try {
      const kred = EmailAuthProvider.credential(kullanici.email, epostaSifre);
      await reauthenticateWithCredential(kullanici, kred);
      // Yeni adrese doğrulama bağlantısı gönderilir; öğrenci onaylayınca e-posta güncellenir.
      await verifyBeforeUpdateEmail(kullanici, yeni);
      modalKapat();
      bildir('Doğrulama gönderildi', `${yeni} adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayınca e-postan güncellenecek.`);
    } catch (e: any) {
      const kod = e?.code;
      setEpostaHata(
        kod === 'auth/invalid-email' ? 'Geçersiz e-posta adresi.'
        : kod === 'auth/email-already-in-use' ? 'Bu e-posta zaten kullanımda.'
        : kod === 'auth/wrong-password' ? 'Mevcut şifre hatalı.'
        : 'Şifre hatalı ya da bir sorun oluştu.'
      );
    } finally {
      setIslemYukleniyor(false);
    }
  }

  async function veriIndir() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setIslemYukleniyor(true);
    try {
      const veri = await kullaniciVerisiniTopla(uid);
      const json = JSON.stringify(veri, null, 2);
      if (Platform.OS === 'web') {
        // Web'de tarayıcıdan JSON dosyası indir.
        const g = globalThis as any;
        const blob = new g.Blob([json], { type: 'application/json' });
        const url = g.URL.createObjectURL(blob);
        const a = g.document.createElement('a');
        a.href = url;
        a.download = `yzdsk-verilerim-${new Date().toISOString().slice(0, 10)}.json`;
        g.document.body.appendChild(a);
        a.click();
        a.remove();
        g.URL.revokeObjectURL(url);
        modalKapat();
        bildir('İndirildi', 'Tüm verilerin JSON dosyası olarak indirildi.');
      } else {
        // Native'de paylaşım sayfası (kaydet / gönder).
        await Share.share({ title: 'YZDSK verilerim', message: json });
        modalKapat();
      }
    } catch (e) {
      console.error('[Profil] veri dışa aktarma hatası:', e);
      bildir('Hata', 'Veriler hazırlanamadı, lütfen tekrar dene.');
    } finally {
      setIslemYukleniyor(false);
    }
  }

  async function sifreDegistir() {
    if (!yeniSifre || !mevcutSifre) { setSifreHata('Tüm alanları doldur.'); return; }
    if (yeniSifre.length < 6) { setSifreHata('Yeni şifre en az 6 karakter olmalı.'); return; }
    if (yeniSifre !== yeniSifreTekrar) { setSifreHata('Şifreler eşleşmiyor.'); return; }
    const kullanici = auth.currentUser;
    if (!kullanici?.email) return;
    setIslemYukleniyor(true);
    try {
      const kred = EmailAuthProvider.credential(kullanici.email, mevcutSifre);
      await reauthenticateWithCredential(kullanici, kred);
      await updatePassword(kullanici, yeniSifre);
      modalKapat();
      bildir('Başarılı', 'Şifren güncellendi.');
    } catch {
      setSifreHata('Mevcut şifre hatalı veya bir sorun oluştu.');
    } finally {
      setIslemYukleniyor(false);
    }
  }

  async function hesabiSil() {
    if (!silSifre) { setSilHata('Şifreni gir.'); return; }
    const kullanici = auth.currentUser;
    if (!kullanici?.email) return;
    setIslemYukleniyor(true);
    try {
      const kred = EmailAuthProvider.credential(kullanici.email, silSifre);
      await reauthenticateWithCredential(kullanici, kred);
      await deleteDoc(doc(db, 'users', kullanici.uid));
      await deleteUser(kullanici);
      router.replace('/login' as any);
    } catch {
      setSilHata('Şifre hatalı veya bir sorun oluştu.');
    } finally {
      setIslemYukleniyor(false);
    }
  }

  async function cikisYapVeYonlendir() {
    modalKapat();
    await cikisYap();
    router.replace('/login' as any);
  }

  const pillWidth = trackWidth > 0 ? (trackWidth - 8) / 2 : 0;
  const pillTranslateX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pillWidth],
  });

  if (yukleniyor) {
    return (
      <View style={s.merkezle}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={s.ekran}>
      {/* ── Sabit üst başlık ── */}
      <View style={[s.baslik, { paddingTop: insets.top + 10 }]}>
        {/* Kimlik bloğu */}
        <View style={s.kimlik}>
          <View style={s.avatarKap}>
            <LinearGradient
              colors={['#7C3AED', '#EC4899']}
              start={{ x: 0.14, y: 0 }}
              end={{ x: 0.86, y: 1 }}
              style={s.avatar}
            >
              <Text style={s.avatarHarf}>
                {profil?.isim?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </LinearGradient>
          </View>
          <Text style={s.isim}>{profil?.isim ?? '—'}</Text>
          <Text style={s.altyazi}>
            {sinifTam(profil?.sinif)}
            {profil?.puanTuru ? ` · ${puanTuruTam(profil.puanTuru)}` : ''}
          </Text>
        </View>

        {/* Segmented control */}
        <View
          style={s.segmentTrack}
          onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        >
          {trackWidth > 0 && (
            <Animated.View
              style={[
                s.segmentPill,
                { width: pillWidth, transform: [{ translateX: pillTranslateX }] },
              ]}
            />
          )}
          {['Genel', 'Ayarlar'].map((t, i) => (
            <TouchableOpacity
              key={t}
              style={s.segmentBtn}
              onPress={() => sekmeDegistir(i)}
              activeOpacity={0.85}
            >
              <Text style={[s.segmentMetin, i === aktifSekme ? s.segmentAktif : s.segmentPasif]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Kayan içerik ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.icerik, { paddingBottom: insets.bottom + ALT_CUBUK_BOSLUK }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }}
        >
          {aktifSekme === 0 ? (
            <GenelSekme
              profil={profil}
              denemeSayisi={denemeSayisi}
            />
          ) : (
            <AyarlarSekme
              profil={profil}
              onKocHafiza={() => router.push('/koc-hafiza' as any)}
              onSinif={sinifAc}
              onHedefler={hedeflerAc}
              onSifre={() => setAktifModal('sifre')}
              onEposta={() => setAktifModal('eposta')}
              onKvkk={() => setAktifModal('kvkk')}
              onCikis={() => setAktifModal('cikis')}
              onHesapSil={() => setAktifModal('hesapSil')}
            />
          )}
          <Text style={s.surum}>sürüm 2.4.0</Text>
        </Animated.View>
      </ScrollView>

      {/* ── Şifre değiştir modal ── */}
      <Modal visible={aktifModal === 'sifre'} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={s.overlay} onPress={modalKapat} />
        <View style={s.altSheet}>
          <View style={s.tutamac} />
          <Text style={s.sheetBaslik}>Şifremi Değiştir</Text>
          <SifreGiris etiket="Mevcut Şifre" deger={mevcutSifre} onChange={setMevcutSifre} />
          <SifreGiris etiket="Yeni Şifre" deger={yeniSifre} onChange={setYeniSifre} />
          <SifreGiris etiket="Yeni Şifre (Tekrar)" deger={yeniSifreTekrar} onChange={setYeniSifreTekrar} />
          {sifreHata ? <Text style={s.hataMetin}>{sifreHata}</Text> : null}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={s.iptalMetin}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.onayBtn} onPress={sifreDegistir} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={s.onayMetin}>Güncelle</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── KVKK modal ── */}
      <Modal visible={aktifModal === 'kvkk'} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={s.overlay} onPress={modalKapat} />
        <View style={s.altSheet}>
          <View style={s.tutamac} />
          <Text style={s.sheetBaslik}>Verilerimi İndir (KVKK)</Text>
          <View style={s.modalBilgi}>
            <Ionicons name="document-text-outline" size={32} color={COLORS.primary} />
            <Text style={s.modalBilgiMetin}>
              KVKK kapsamında tüm kişisel verin (profil, denemeler, görevler, yanlış defteri, koç hafızası)
              tek bir JSON dosyası olarak {Platform.OS === 'web' ? 'cihazına indirilir' : 'paylaşılır'}.
            </Text>
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={s.iptalMetin}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.onayBtn} onPress={veriIndir} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={s.onayMetin}>{Platform.OS === 'web' ? 'İndir' : 'Dışa Aktar'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Çıkış onay modal ── */}
      <Modal visible={aktifModal === 'cikis'} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={modalKapat} />
        <View style={s.ortaDialog}>
          <Text style={s.dialogEmoji}>👋</Text>
          <Text style={s.dialogBaslik}>Çıkış Yap</Text>
          <Text style={s.dialogMesaj}>Hesabından çıkmak istediğine emin misin?</Text>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={s.iptalMetin}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.onayBtn} onPress={cikisYapVeYonlendir} activeOpacity={0.8}>
              <Text style={s.onayMetin}>Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Hesap sil modal ── */}
      <Modal visible={aktifModal === 'hesapSil'} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={modalKapat} />
        <View style={s.ortaDialog}>
          <Text style={s.dialogEmoji}>⚠️</Text>
          <Text style={s.dialogBaslik}>Hesabı Sil</Text>
          <Text style={s.dialogMesaj}>
            Tüm verilerini kalıcı olarak silmek üzeresin. Bu işlem geri alınamaz.{'\n'}
            Devam etmek için şifreni gir.
          </Text>
          <SifreGiris etiket="Şifre" deger={silSifre} onChange={setSilSifre} />
          {silHata ? <Text style={s.hataMetin}>{silHata}</Text> : null}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={s.iptalMetin}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.silOnayBtn} onPress={hesabiSil} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={s.onayMetin}>Hesabı Sil</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Çalışma Hedefleri modal ── */}
      <Modal visible={aktifModal === 'hedefler'} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={s.overlay} onPress={modalKapat} />
        <View style={s.altSheet}>
          <View style={s.tutamac} />
          <Text style={s.sheetBaslik}>Çalışma Hedefleri</Text>
          <Text style={s.hedefEtiket}>Günlük soru hedefi</Text>
          <Stepper deger={hedefSoru} min={0} max={500} adim={5} birim="soru" onChange={setHedefSoru} />
          <Text style={[s.hedefEtiket, { marginTop: 16 }]}>Haftalık çalışma günü</Text>
          <Stepper deger={hedefGun} min={1} max={7} adim={1} birim="gün" onChange={setHedefGun} />
          <View style={[s.btnRow, { marginTop: 22 }]}>
            <TouchableOpacity style={s.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={s.iptalMetin}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.onayBtn} onPress={hedefleriKaydet} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={s.onayMetin}>Kaydet</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── E-posta değiştir modal ── */}
      <Modal visible={aktifModal === 'eposta'} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={s.overlay} onPress={modalKapat} />
        <View style={s.altSheet}>
          <View style={s.tutamac} />
          <Text style={s.sheetBaslik}>E-postamı Değiştir</Text>
          <View style={s.sifreAlani}>
            <Text style={s.sifreEtiket}>Yeni E-posta</Text>
            <View style={s.sifreInputSarici}>
              <TextInput
                style={s.sifreInput}
                value={yeniEposta}
                onChangeText={setYeniEposta}
                placeholder="ornek@mail.com"
                placeholderTextColor={COLORS.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
          <SifreGiris etiket="Mevcut Şifre" deger={epostaSifre} onChange={setEpostaSifre} />
          {epostaHata ? <Text style={s.hataMetin}>{epostaHata}</Text> : null}
          <Text style={s.epostaNot}>
            Yeni adresine bir doğrulama bağlantısı gönderilir; bağlantıya tıklayınca e-postan güncellenir.
          </Text>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={s.iptalMetin}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.onayBtn} onPress={epostaDegistir} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={s.onayMetin}>Doğrulama Gönder</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Sınıf modal ── */}
      <Modal visible={aktifModal === 'sinif'} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={s.overlay} onPress={modalKapat} />
        <View style={s.altSheet}>
          <View style={s.tutamac} />
          <Text style={s.sheetBaslik}>Sınıf</Text>
          {SINIF_SECENEKLERI.map((o) => {
            const secili = sinifSecim === o.deger;
            return (
              <TouchableOpacity
                key={o.deger}
                style={[s.sinifSecenek, secili && s.sinifSecenekAktif]}
                onPress={() => setSinifSecim(o.deger)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.sinifBaslik, secili && { color: COLORS.primary }]}>{o.baslik}</Text>
                  <Text style={s.sinifAlt}>{hedefYksYili(o.deger)} YKS</Text>
                </View>
                {secili && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            );
          })}
          <View style={[s.btnRow, { marginTop: 16 }]}>
            <TouchableOpacity style={s.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={s.iptalMetin}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.onayBtn} onPress={sinifKaydet} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={s.onayMetin}>Kaydet</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Genel sekmesi ───────────────────────────────────────────────────────────

function GenelSekme({
  profil, denemeSayisi,
}: {
  profil: ProfilType | null;
  denemeSayisi: number;
}) {
  const toplamSoru = profil?.toplamSoru ?? 0;
  const toplamOdakSaat = profil?.toplamOdakSaat ?? 0;
  const uyelikTarihi = profil?.uyelikTarihi ?? null;

  const statlar = [
    {
      icon: 'book-outline' as const,
      deger: toplamSoru > 0 ? toplamSoru.toLocaleString('tr-TR') : '—',
      birim: undefined,
      etiket: 'çözülen soru',
      renk: COLORS.primary,
      bg: COLORS.primaryLight,
      glow: 'rgba(124,58,237,0.16)',
    },
    {
      icon: 'timer-outline' as const,
      deger: toplamOdakSaat > 0 ? String(toplamOdakSaat) : '—',
      birim: toplamOdakSaat > 0 ? 'sa' : undefined,
      etiket: 'odak süresi',
      renk: COLORS.accent,
      bg: ACCENT_LIGHT,
      glow: 'rgba(236,72,153,0.16)',
    },
    {
      icon: 'flag-outline' as const,
      deger: String(denemeSayisi),
      birim: undefined,
      etiket: 'deneme sınavı',
      renk: COLORS.success,
      bg: SUCCESS_LIGHT,
      glow: 'rgba(16,185,129,0.16)',
    },
  ];

  const hedefTuru = profil?.hedefTuru;
  const hedefUniversite = profil?.hedefUniversite;
  const hedefBolum = profil?.hedefBolum;
  const hedefSiralama = profil?.hedefSiralama;

  const hedefimSatirlari: { icon: React.ComponentProps<typeof Ionicons>['name']; etiket: string; deger: string; son: boolean }[] = [];
  if (hedefTuru === 'universite') {
    hedefimSatirlari.push({ icon: 'flag-outline', etiket: 'Hedef Üniversite', deger: hedefUniversite || '—', son: false });
    hedefimSatirlari.push({ icon: 'book-outline', etiket: 'Hedef Bölüm', deger: hedefBolum || '—', son: true });
  } else if (hedefTuru === 'siralama') {
    hedefimSatirlari.push({
      icon: 'podium-outline',
      etiket: 'Hedef Sıralama',
      deger: hedefSiralama ? `~${hedefSiralama.toLocaleString('tr-TR')}.` : '—',
      son: true,
    });
  }

  return (
    <View>
      {/* Toplam Emek */}
      <Text style={s.bolumBaslik}>
        {uyelikTarihi ? `TOPLAM EMEK · ${uyelikTarihi.toUpperCase()}'TEN BERİ` : 'TOPLAM EMEK'}
      </Text>
      <View style={s.statRow}>
        {statlar.map((st, i) => (
          <View
            key={i}
            style={[
              s.statKart,
              { shadowColor: st.renk, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
            ]}
          >
            <View style={[s.statIkonKap, { backgroundColor: st.bg }]}>
              <Ionicons name={st.icon} size={15} color={st.renk} />
            </View>
            <Text style={s.statDeger}>
              {st.deger}
              {st.birim && <Text style={s.statBirim}> {st.birim}</Text>}
            </Text>
            <Text style={s.statEtiket}>{st.etiket}</Text>
          </View>
        ))}
      </View>

      {/* Hedefim */}
      {hedefimSatirlari.length > 0 && (
        <Group header="Hedefim">
          {hedefimSatirlari.map((r, i) => (
            <Row key={r.etiket} icon={r.icon} etiket={r.etiket} deger={r.deger} son={r.son} />
          ))}
        </Group>
      )}

      {/* Hedef Netler */}
      {profil && <HedefNetlerGrup profil={profil} />}

      {/* Hesap */}
      <Group header="Hesap">
        <Row icon="school-outline" etiket="Sınıf" deger={sinifTam(profil?.sinif)} />
        <Row
          icon="trophy-outline"
          etiket="Puan Türü"
          deger={profil?.puanTuru ? `${profil.puanTuru} · ${puanTuruTam(profil.puanTuru)}` : '—'}
        />
        <Row
          icon="time-outline"
          etiket="Üyelik"
          deger={uyelikTarihi ?? '—'}
          son
        />
      </Group>
    </View>
  );
}

// ─── Ayarlar sekmesi ─────────────────────────────────────────────────────────

function AyarlarSekme({
  profil, onKocHafiza, onSinif, onHedefler, onSifre, onEposta, onKvkk, onCikis, onHesapSil,
}: {
  profil: ProfilType | null;
  onKocHafiza: () => void;
  onSinif: () => void;
  onHedefler: () => void;
  onSifre: () => void;
  onEposta: () => void;
  onKvkk: () => void;
  onCikis: () => void;
  onHesapSil: () => void;
}) {
  return (
    <View>
      <Group header="Tercihler">
        <Row icon="school-outline" etiket="Sınıf" deger={sinifTam(profil?.sinif)} chevron onPress={onSinif} />
        <Row icon="options-outline" etiket="Çalışma Hedefleri" chevron onPress={onHedefler} />
        <Row icon="sparkles-outline" etiket="Koç Hafızam" chevron onPress={onKocHafiza} son />
      </Group>

      <Group header="Hesap ve Güvenlik">
        <Row icon="lock-closed-outline" etiket="Şifremi Değiştir" chevron onPress={onSifre} />
        <Row
          icon="mail-outline"
          etiket="E-posta"
          deger={profil?.email ?? '—'}
          chevron
          onPress={onEposta}
        />
        <Row icon="download-outline" etiket="Verilerimi İndir (KVKK)" chevron onPress={onKvkk} son />
      </Group>

      <Group>
        <Row icon="log-out-outline" etiket="Çıkış Yap" chevron onPress={onCikis} son />
      </Group>

      <Group>
        <Row icon="shield-outline" etiket="Hesabımı Sil" chevron onPress={onHesapSil} son danger />
      </Group>
    </View>
  );
}

// ─── Hedef Netler grup bileşeni ───────────────────────────────────────────────

function HedefNetlerGrup({ profil }: { profil: ProfilType }) {
  const { hedefNetBilgisi, netFetchStatus, puanTuru } = profil;
  const [yenileniyor, setYenileniyor] = useState(false);
  const otomatikDenendi = useRef(false);

  async function yenidenDene() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setYenileniyor(true);
    await manuelSyncHedefNet(
      uid,
      profil.hedefTuru === 'universite' ? profil.hedefProgramId : undefined
    );
    setYenileniyor(false);
  }

  useEffect(() => {
    if (netFetchStatus === 'done' || otomatikDenendi.current) return;
    otomatikDenendi.current = true;
    yenidenDene();
  }, []);

  if (netFetchStatus === 'not_needed') return null;

  if (netFetchStatus !== 'done' || !hedefNetBilgisi) {
    return (
      <Group header="Hedef Netler">
        <View style={s.netDurum}>
          {yenileniyor ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Text style={s.netHataMetin}>Net verisi henüz hesaplanamadı.</Text>
              <TouchableOpacity style={s.netYenileBtn} onPress={yenidenDene} activeOpacity={0.7}>
                <Text style={s.netYenileBtnMetin}>Yeniden Dene</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Group>
    );
  }

  const tytNetleri = [
    { label: 'Tür', val: hedefNetBilgisi['tyt_turkce'] },
    { label: 'Mat', val: hedefNetBilgisi['tyt_matematik'] },
    { label: 'Fen', val: hedefNetBilgisi['tyt_fen'] },
    { label: 'Sos', val: hedefNetBilgisi['tyt_sosyal'] },
  ].filter(n => n.val != null) as { label: string; val: number }[];

  const aytNetleri: { label: string; val: number }[] = [];
  if (puanTuru === 'SAY') {
    if (hedefNetBilgisi['ayt_matematik'] != null) aytNetleri.push({ label: 'Mat', val: hedefNetBilgisi['ayt_matematik'] });
    if (hedefNetBilgisi['ayt_fizik'] != null) aytNetleri.push({ label: 'Fiz', val: hedefNetBilgisi['ayt_fizik'] });
    if (hedefNetBilgisi['ayt_kimya'] != null) aytNetleri.push({ label: 'Kim', val: hedefNetBilgisi['ayt_kimya'] });
    if (hedefNetBilgisi['ayt_biyoloji'] != null) aytNetleri.push({ label: 'Biy', val: hedefNetBilgisi['ayt_biyoloji'] });
  } else if (puanTuru === 'EA') {
    if (hedefNetBilgisi['ayt_edebiyat'] != null) aytNetleri.push({ label: 'Edb', val: hedefNetBilgisi['ayt_edebiyat'] });
    if (hedefNetBilgisi['ayt_tarih1'] != null) aytNetleri.push({ label: 'Tar1', val: hedefNetBilgisi['ayt_tarih1'] });
    if (hedefNetBilgisi['ayt_cografya1'] != null) aytNetleri.push({ label: 'Coğ1', val: hedefNetBilgisi['ayt_cografya1'] });
    if (hedefNetBilgisi['ayt_matematik'] != null) aytNetleri.push({ label: 'Mat', val: hedefNetBilgisi['ayt_matematik'] });
  } else if (puanTuru === 'SOZ') {
    if (hedefNetBilgisi['ayt_edebiyat'] != null) aytNetleri.push({ label: 'Edb', val: hedefNetBilgisi['ayt_edebiyat'] });
    if (hedefNetBilgisi['ayt_tarih1'] != null) aytNetleri.push({ label: 'Tar1', val: hedefNetBilgisi['ayt_tarih1'] });
    if (hedefNetBilgisi['ayt_tarih2'] != null) aytNetleri.push({ label: 'Tar2', val: hedefNetBilgisi['ayt_tarih2'] });
    if (hedefNetBilgisi['ayt_cografya1'] != null) aytNetleri.push({ label: 'Coğ1', val: hedefNetBilgisi['ayt_cografya1'] });
    if (hedefNetBilgisi['ayt_cografya2'] != null) aytNetleri.push({ label: 'Coğ2', val: hedefNetBilgisi['ayt_cografya2'] });
    if (hedefNetBilgisi['ayt_felsefe'] != null) aytNetleri.push({ label: 'Fels', val: hedefNetBilgisi['ayt_felsefe'] });
    if (hedefNetBilgisi['ayt_din'] != null) aytNetleri.push({ label: 'Din', val: hedefNetBilgisi['ayt_din'] });
  } else if (puanTuru === 'DIL') {
    if (hedefNetBilgisi['ayt_yabancidil'] != null) aytNetleri.push({ label: 'Yab.Dil', val: hedefNetBilgisi['ayt_yabancidil'] });
  }

  return (
    <Group header="Hedef Netler">
      <View style={s.netIcerik}>
        {hedefNetBilgisi['kaynak_yil'] ? (
          <Text style={s.netYilMetin}>{hedefNetBilgisi['kaynak_yil']} verisi</Text>
        ) : null}
        {tytNetleri.length > 0 && (
          <NetSatiri
            bolum="TYT"
            netler={tytNetleri}
            renk={COLORS.primary}
            bg={COLORS.primaryLight}
          />
        )}
        {aytNetleri.length > 0 && (
          <NetSatiri
            bolum={`AYT · ${puanTuru ?? ''}`}
            netler={aytNetleri}
            renk={COLORS.accent}
            bg={ACCENT_LIGHT}
            son
          />
        )}
      </View>
    </Group>
  );
}

// ─── Ortak alt bileşenler ────────────────────────────────────────────────────

function Group({ header, children }: { header?: string; children: React.ReactNode }) {
  return (
    <View style={s.grup}>
      {header && <Text style={s.grupBaslik}>{header}</Text>}
      <View style={s.grupKap}>{children}</View>
    </View>
  );
}

function Row({
  icon, etiket, deger, chevron, son, danger, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  etiket: string;
  deger?: string;
  chevron?: boolean;
  son?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  const inner = (
    <View style={[s.row, son ? null : s.rowBorder]}>
      <View style={[s.rowIkon, { backgroundColor: danger ? ERROR_LIGHT : COLORS.primaryLight }]}>
        <Ionicons name={icon} size={16} color={danger ? COLORS.error : COLORS.primary} />
      </View>
      <Text numberOfLines={1} style={[s.rowEtiket, deger != null && s.rowEtiketAuto, danger && { color: COLORS.error }]}>{etiket}</Text>
      {deger && <Text style={s.rowDeger}>{deger}</Text>}
      {chevron && <Ionicons name="chevron-forward" size={15} color={COLORS.textLight} />}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

function NetSatiri({
  bolum, netler, renk, bg, son,
}: {
  bolum: string;
  netler: { label: string; val: number }[];
  renk: string;
  bg: string;
  son?: boolean;
}) {
  return (
    <View style={[s.netSatir, son ? null : { marginBottom: 10 }]}>
      <Text style={s.netBolumEtiket}>{bolum}</Text>
      <View style={s.netChipRow}>
        {netler.map(({ label, val }) => (
          <View key={label} style={[s.netChip, { backgroundColor: bg }]}>
            <Text style={s.netChipEtiket}>{label}</Text>
            <Text style={[s.netChipDeger, { color: renk }]}>{val}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SifreGiris({
  etiket, deger, onChange,
}: {
  etiket: string;
  deger: string;
  onChange: (v: string) => void;
}) {
  const [goster, setGoster] = useState(false);
  return (
    <View style={s.sifreAlani}>
      <Text style={s.sifreEtiket}>{etiket}</Text>
      <View style={s.sifreInputSarici}>
        <TextInput
          style={s.sifreInput}
          value={deger}
          onChangeText={onChange}
          secureTextEntry={!goster}
          placeholder="••••••"
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setGoster(!goster)} hitSlop={8}>
          <Ionicons name={goster ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Stepper({
  deger, min, max, adim, birim, onChange,
}: {
  deger: number;
  min: number;
  max: number;
  adim: number;
  birim: string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={s.stepperRow}>
      <TouchableOpacity
        style={s.stepperBtn}
        onPress={() => onChange(Math.max(min, deger - adim))}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={20} color={COLORS.text} />
      </TouchableOpacity>
      <View style={s.stepperOrta}>
        <Text style={s.stepperSayi}>{deger}</Text>
        <Text style={s.stepperBirim}>{birim}</Text>
      </View>
      <TouchableOpacity
        style={[s.stepperBtn, s.stepperArti]}
        onPress={() => onChange(Math.min(max, deger + adim))}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },
  merkezle: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  // Başlık
  baslik: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  kimlik: { alignItems: 'center', marginBottom: 16 },
  avatarKap: { position: 'relative', marginBottom: 10 },
  avatar: {
    width: 70, height: 70, borderRadius: 35,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#7C3AED', shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  avatarHarf: { fontSize: 29, fontWeight: '700', color: '#fff' },
  editRozet: {
    position: 'absolute', right: -2, bottom: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.cardBorder,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  isim: { fontSize: 19, fontWeight: '700', color: COLORS.text, letterSpacing: -0.3 },
  altyazi: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Segmented control
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: SEGMENT_TRACK,
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  segmentPill: {
    position: 'absolute',
    top: 4, bottom: 4, left: 4,
    borderRadius: 9,
    backgroundColor: '#fff',
    shadowColor: '#1E1B4B', shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', zIndex: 1 },
  segmentMetin: { fontSize: 13 },
  segmentAktif: { fontWeight: '700', color: COLORS.primary },
  segmentPasif: { fontWeight: '600', color: COLORS.textSecondary },

  // İçerik
  icerik: { paddingTop: 16, paddingHorizontal: 16 },
  surum: { textAlign: 'center', fontSize: 11.5, color: COLORS.textLight, fontWeight: '500', marginTop: 10 },

  // Stat kartları
  bolumBaslik: {
    fontSize: 11.5, fontWeight: '700', color: COLORS.textLight,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 6, paddingBottom: 8,
  },
  statRow: { flexDirection: 'row', gap: 9, marginBottom: 18 },
  statKart: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingTop: 13, paddingBottom: 12, paddingHorizontal: 6,
    alignItems: 'center',
  },
  statIkonKap: {
    width: 28, height: 28, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 9,
  },
  statDeger: {
    fontSize: 19, fontWeight: '800', letterSpacing: -0.5,
    color: COLORS.text, lineHeight: 22,
  },
  statBirim: { fontSize: 11.5, fontWeight: '700', color: COLORS.textSecondary },
  statEtiket: {
    fontSize: 10.5, color: COLORS.textSecondary, fontWeight: '500',
    marginTop: 5, lineHeight: 13, textAlign: 'center',
  },

  // Gruplar
  grup: { marginBottom: 16 },
  grupBaslik: {
    fontSize: 11.5, fontWeight: '700', color: COLORS.textLight,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 6, paddingBottom: 7,
  },
  grupKap: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    shadowColor: '#1E1B4B', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Satırlar
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: SEP },
  rowIkon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  rowEtiket: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  // Değer içeren satırda etiket içerik genişliğinde kalır; değer esner ve sarar.
  rowEtiketAuto: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  rowDeger: {
    flex: 1,
    fontSize: 13, color: COLORS.textSecondary, fontWeight: '500',
    textAlign: 'right',
  },

  // Hedef netler
  netIcerik: { padding: 12, paddingHorizontal: 14 },
  netYilMetin: { fontSize: 11, color: COLORS.textLight, marginBottom: 8 },
  netSatir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  netBolumEtiket: { fontSize: 10.5, fontWeight: '700', color: COLORS.textLight, width: 54, flexShrink: 0 },
  netChipRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  netChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
  },
  netChipEtiket: { fontSize: 10.5, color: COLORS.textSecondary },
  netChipDeger: { fontSize: 12, fontWeight: '700' },
  netDurum: { padding: 14 },
  netHataMetin: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  netYenileBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center',
  },
  netYenileBtnMetin: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  // Modaller
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  altSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  tutamac: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.cardBorder, alignSelf: 'center', marginBottom: 20,
  },
  sheetBaslik: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  ortaDialog: {
    position: 'absolute', alignSelf: 'center', top: '28%',
    width: '86%', backgroundColor: COLORS.card,
    borderRadius: 20, padding: 24, alignItems: 'center',
  },
  dialogEmoji: { fontSize: 36, marginBottom: 10 },
  dialogBaslik: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  dialogMesaj: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  modalBilgi: { alignItems: 'center', gap: 12, marginBottom: 20, paddingVertical: 8 },
  modalBilgiMetin: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  btnRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  iptalBtn: {
    flex: 1, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  iptalMetin: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  onayBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary },
  onayMetin: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  silOnayBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.error },
  hataMetin: { fontSize: 12, color: COLORS.error, alignSelf: 'flex-start', marginBottom: 6 },

  sifreAlani: { marginBottom: 12, alignSelf: 'stretch' },
  sifreEtiket: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  epostaNot: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginBottom: 14, marginTop: -2 },

  // Sınıf seçenekleri
  sinifSecenek: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.cardBorder,
  },
  sinifSecenekAktif: { borderColor: COLORS.primary, backgroundColor: COLORS.selectedBackground },
  sinifBaslik: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sinifAlt: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },

  // Çalışma hedefleri stepper
  hedefEtiket: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 10 },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.background, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 5,
  },
  stepperBtn: {
    width: 46, height: 46, borderRadius: 11, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  stepperArti: { backgroundColor: COLORS.primary, borderWidth: 0 },
  stepperOrta: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  stepperSayi: { fontSize: 24, fontWeight: '800', color: COLORS.text, fontVariant: ['tabular-nums'] },
  stepperBirim: { fontSize: 13, fontWeight: '700', color: COLORS.textLight },
  sifreInputSarici: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 12, height: 48,
  },
  sifreInput: { flex: 1, fontSize: 15, color: COLORS.text },
});
