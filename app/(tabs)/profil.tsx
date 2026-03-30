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
  Alert,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../services/firebaseConfig';
import { cikisYap } from '../../services/authService';
import { useProfile } from '../../hooks/useProfile';
import { COLORS } from '../../constants/colors';

type AktifModal = null | 'sifre' | 'bildirim' | 'kvkk' | 'hesapSil' | 'cikis';

export default function Profil() {
  const router = useRouter();
  const { profil, yukleniyor } = useProfile();
  const [aktifModal, setAktifModal] = useState<AktifModal>(null);
  const [islemYukleniyor, setIslemYukleniyor] = useState(false);

  const [mevcutSifre, setMevcutSifre] = useState('');
  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');
  const [sifreHata, setSifreHata] = useState('');

  const [silSifre, setSilSifre] = useState('');
  const [silHata, setSilHata] = useState('');

  function modalKapat() {
    setAktifModal(null);
    setMevcutSifre(''); setYeniSifre(''); setYeniSifreTekrar(''); setSifreHata('');
    setSilSifre(''); setSilHata('');
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
      Alert.alert('Başarılı', 'Şifren güncellendi.');
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

  if (yukleniyor) {
    return (
      <View style={styles.merkezle}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.ekran}>
      <ScrollView contentContainerStyle={styles.icerik} showsVerticalScrollIndicator={false}>

        {/* Profil başlık */}
        <View style={styles.avatarAlani}>
          <View style={styles.avatar}>
            <Text style={styles.avatarHarf}>
              {profil?.isim?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.isim}>{profil?.isim ?? '—'}</Text>
          <Text style={styles.email}>{profil?.email ?? '—'}</Text>
        </View>

        {/* Bilgi kartı */}
        <View style={styles.kart}>
          <BilgiSatiri ikon="school-outline" etiket="Sınıf" deger={profil?.sinif ? `${profil.sinif}. Sınıf` : '—'} />
          <BilgiSatiri ikon="trophy-outline" etiket="Puan Türü" deger={profil?.puanTuru ?? '—'} />
          <BilgiSatiri ikon="flag-outline" etiket="Hedef Üniversite" deger={profil?.hedefUniversite ?? '—'} />
          <BilgiSatiri ikon="book-outline" etiket="Hedef Bölüm" deger={profil?.hedefBolum ?? '—'} son />
        </View>

        {/* Ayarlar & Güvenlik */}
        <Text style={styles.bolumBaslik}>Ayarlar ve Güvenlik</Text>
        <View style={styles.kart}>
          <MenuOgesi
            ikon="lock-closed-outline"
            etiket="Şifremi Değiştir"
            onPress={() => setAktifModal('sifre')}
          />
          <MenuOgesi
            ikon="notifications-outline"
            etiket="Bildirim Ayarları"
            onPress={() => setAktifModal('bildirim')}
          />
          <MenuOgesi
            ikon="download-outline"
            etiket="Verilerimi İndir (KVKK)"
            onPress={() => setAktifModal('kvkk')}
            son
          />
        </View>

        {/* Çıkış yap */}
        <TouchableOpacity style={styles.cikisBtn} onPress={() => setAktifModal('cikis')} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.cikisMetin}>Çıkış Yap</Text>
        </TouchableOpacity>

        {/* Hesabı sil */}
        <TouchableOpacity style={styles.silBtn} onPress={() => setAktifModal('hesapSil')} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          <Text style={styles.silMetin}>Hesabımı Sil</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Şifre değiştir modal ── */}
      <Modal visible={aktifModal === 'sifre'} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={modalKapat} />
        <View style={styles.altSheet}>
          <View style={styles.tutamac} />
          <Text style={styles.sheetBaslik}>Şifremi Değiştir</Text>
          <SifreGiris etiket="Mevcut Şifre" deger={mevcutSifre} onChange={setMevcutSifre} />
          <SifreGiris etiket="Yeni Şifre" deger={yeniSifre} onChange={setYeniSifre} />
          <SifreGiris etiket="Yeni Şifre (Tekrar)" deger={yeniSifreTekrar} onChange={setYeniSifreTekrar} />
          {sifreHata ? <Text style={styles.hataMetin}>{sifreHata}</Text> : null}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={styles.iptalMetin}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.onayBtn} onPress={sifreDegistir} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={styles.onayMetin}>Güncelle</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Bildirim ayarları modal ── */}
      <Modal visible={aktifModal === 'bildirim'} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={modalKapat} />
        <View style={styles.altSheet}>
          <View style={styles.tutamac} />
          <Text style={styles.sheetBaslik}>Bildirim Ayarları</Text>
          <View style={styles.bildirimBilgi}>
            <Ionicons name="notifications-outline" size={32} color={COLORS.primary} />
            <Text style={styles.bildirimMetin}>
              Bildirim tercihleri yakında bu ekrandan yönetilebilecek.
            </Text>
          </View>
          <TouchableOpacity style={[styles.onayBtn, { marginTop: 8 }]} onPress={modalKapat} activeOpacity={0.8}>
            <Text style={styles.onayMetin}>Tamam</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── KVKK modal ── */}
      <Modal visible={aktifModal === 'kvkk'} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={modalKapat} />
        <View style={styles.altSheet}>
          <View style={styles.tutamac} />
          <Text style={styles.sheetBaslik}>Verilerimi İndir (KVKK)</Text>
          <View style={styles.bildirimBilgi}>
            <Ionicons name="document-text-outline" size={32} color={COLORS.primary} />
            <Text style={styles.bildirimMetin}>
              KVKK kapsamında kişisel verilerini talep edebilirsin. İşlem tamamlandığında e-posta adresine iletilecek.
            </Text>
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={styles.iptalMetin}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.onayBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={styles.onayMetin}>Talep Gönder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Çıkış onay modal ── */}
      <Modal visible={aktifModal === 'cikis'} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={modalKapat} />
        <View style={styles.ortaDialog}>
          <Text style={styles.dialogEmoji}>👋</Text>
          <Text style={styles.dialogBaslik}>Çıkış Yap</Text>
          <Text style={styles.dialogMesaj}>Hesabından çıkmak istediğine emin misin?</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={styles.iptalMetin}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.onayBtn} onPress={cikisYapVeYonlendir} activeOpacity={0.8}>
              <Text style={styles.onayMetin}>Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Hesap sil modal ── */}
      <Modal visible={aktifModal === 'hesapSil'} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={modalKapat} />
        <View style={styles.ortaDialog}>
          <Text style={styles.dialogEmoji}>⚠️</Text>
          <Text style={styles.dialogBaslik}>Hesabı Sil</Text>
          <Text style={styles.dialogMesaj}>
            Tüm verilerini kalıcı olarak silmek üzeresin. Bu işlem geri alınamaz.{'\n'}
            Devam etmek için şifreni gir.
          </Text>
          <SifreGiris etiket="Şifre" deger={silSifre} onChange={setSilSifre} />
          {silHata ? <Text style={styles.hataMetin}>{silHata}</Text> : null}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.iptalBtn} onPress={modalKapat} activeOpacity={0.8}>
              <Text style={styles.iptalMetin}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.silOnayBtn} onPress={hesabiSil} activeOpacity={0.8} disabled={islemYukleniyor}>
              {islemYukleniyor
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={styles.onayMetin}>Hesabı Sil</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

function BilgiSatiri({ ikon, etiket, deger, son }: {
  ikon: React.ComponentProps<typeof Ionicons>['name'];
  etiket: string; deger: string; son?: boolean;
}) {
  return (
    <View style={[styles.bilgiSatir, !son && styles.bilgiSatirBorder]}>
      <Ionicons name={ikon} size={16} color={COLORS.primary} style={{ marginRight: 10 }} />
      <Text style={styles.bilgiEtiket}>{etiket}</Text>
      <Text style={styles.bilgiDeger} numberOfLines={1}>{deger}</Text>
    </View>
  );
}

function MenuOgesi({ ikon, etiket, onPress, son }: {
  ikon: React.ComponentProps<typeof Ionicons>['name'];
  etiket: string; onPress: () => void; son?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.menuSatir, !son && styles.menuSatirBorder]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIkonSarici}>
        <Ionicons name={ikon} size={17} color={COLORS.primary} />
      </View>
      <Text style={styles.menuMetin}>{etiket}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

function SifreGiris({ etiket, deger, onChange }: { etiket: string; deger: string; onChange: (v: string) => void }) {
  const [goster, setGoster] = useState(false);
  return (
    <View style={styles.sifreAlani}>
      <Text style={styles.sifreEtiket}>{etiket}</Text>
      <View style={styles.sifreInputSarici}>
        <TextInput
          style={styles.sifreInput}
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

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },
  icerik: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40 },
  merkezle: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  avatarAlani: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarHarf: { fontSize: 28, fontWeight: '700', color: COLORS.primary },
  isim: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  email: { fontSize: 13, color: COLORS.textSecondary },

  kart: {
    backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 12,
    overflow: 'hidden',
  },

  bilgiSatir: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  bilgiSatirBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  bilgiEtiket: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  bilgiDeger: { fontSize: 13, fontWeight: '600', color: COLORS.text, maxWidth: '55%', textAlign: 'right' },

  bolumBaslik: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 4 },

  menuSatir: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  menuSatirBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  menuIkonSarici: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  menuMetin: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },

  cikisBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.card, borderRadius: 14, height: 50,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 10,
  },
  cikisMetin: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },

  silBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 14, height: 50,
    borderWidth: 1, borderColor: '#FECACA',
  },
  silMetin: { fontSize: 15, fontWeight: '600', color: COLORS.error },

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

  bildirimBilgi: { alignItems: 'center', gap: 12, marginBottom: 20, paddingVertical: 8 },
  bildirimMetin: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  btnRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  iptalBtn: {
    flex: 1, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  iptalMetin: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  onayBtn: {
    flex: 1, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  onayMetin: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  silOnayBtn: {
    flex: 1, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.error,
  },
  hataMetin: { fontSize: 12, color: COLORS.error, alignSelf: 'flex-start', marginBottom: 6 },

  sifreAlani: { marginBottom: 12, alignSelf: 'stretch' },
  sifreEtiket: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  sifreInputSarici: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 12, height: 48,
  },
  sifreInput: { flex: 1, fontSize: 15, color: COLORS.text },
});
