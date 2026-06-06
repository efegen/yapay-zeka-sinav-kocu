import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../services/firebaseConfig';
import { useProfile } from '../../hooks/useProfile';
import { useKocHafiza } from '../../hooks/useKocHafiza';
import { konuSinyali, zorlananKonularOzet } from '../../services/kocHafizaService';
import { COLORS } from '../../constants/colors';
import { bildir } from '../../utils/bildirim';
import {
  kocaSor,
  soruyuCoz,
  baglamKur,
  AiHatasi,
  type SohbetMesaji,
} from '../../services/aiService';
import type { Kart, KonuSinyali } from '../../types/koc';
import { KocAvatar } from '../../components/koc/KocAvatar';
import { KartRenderer } from '../../components/koc/KartRenderer';
import { ZenginMetin } from '../../components/koc/ZenginMetin';

interface Balon extends SohbetMesaji {
  id: string;
  hatali?: boolean;
  kartlar?: Kart[];
  foto?: string; // kullanıcının gönderdiği soru fotoğrafının yerel uri'si
  konu?: string; // çözülen sorunun konusu (onay çipleri için)
  ders?: string;
  geriBildirim?: KonuSinyali; // öğrenci "anladım/karışık" dediyse
}

const ONERILER = [
  'Bu hafta neye odaklanmalıyım?',
  'Limit konusunu nasıl çalışırım?',
  'Motivasyonum düştü, ne yapmalıyım?',
  'Bana bir Pomodoro planı kur',
];

function gecmisAnahtari(uid: string) {
  return `aikoc_gecmis_${uid}`;
}

export default function AiKoc() {
  const router = useRouter();
  const { profil } = useProfile();
  const { hafiza } = useKocHafiza();
  const uid = auth.currentUser?.uid;

  /** Güncel profil + hafıza bağlamı. */
  function suankiBaglam() {
    return baglamKur(profil, zorlananKonularOzet(hafiza));
  }

  const [mesajlar, setMesajlar] = useState<Balon[]>([]);
  const [girdi, setGirdi] = useState('');
  const [yaziyor, setYaziyor] = useState(false);
  const [kaynakModal, setKaynakModal] = useState(false);
  const [bekleyenFoto, setBekleyenFoto] = useState<{ base64: string; uri: string } | null>(null);
  const listeRef = useRef<FlatList<Balon>>(null);

  // ── Geçmişi yükle ──
  useEffect(() => {
    if (!uid) return;
    AsyncStorage.getItem(gecmisAnahtari(uid))
      .then((kayit) => {
        if (kayit) setMesajlar(JSON.parse(kayit));
      })
      .catch(() => {});
  }, [uid]);

  // ── Geçmişi kaydet (her değişimde) ──
  useEffect(() => {
    if (!uid) return;
    // Foto data:/blob: uri'leri ÇOK büyük (web'de localStorage kotasını taşırır → tüm geçmiş
    // kaydedilemez) ve sayfa yenilenince zaten geçersiz olur. Kalıcıya yazmadan önce çıkar;
    // metin + çözüm kartları korunur. Native file:// uri'leri küçük olduğu için saklanır.
    const kalici = mesajlar.map((m) =>
      m.foto && !m.foto.startsWith('file:') ? { ...m, foto: undefined } : m
    );
    AsyncStorage.setItem(gecmisAnahtari(uid), JSON.stringify(kalici)).catch(() => {});
  }, [mesajlar, uid]);

  function asagiKaydir() {
    requestAnimationFrame(() => listeRef.current?.scrollToEnd({ animated: true }));
  }

  async function gonder(metin: string) {
    const temiz = metin.trim();
    if (!temiz || yaziyor) return;
    Keyboard.dismiss();
    setGirdi('');

    const kullaniciBalon: Balon = { id: `${Date.now()}-k`, rol: 'kullanici', metin: temiz };
    const sonraki = [...mesajlar.filter((m) => !m.hatali), kullaniciBalon];
    setMesajlar(sonraki);
    setYaziyor(true);
    asagiKaydir();

    try {
      const yanit = await kocaSor(
        sonraki.map(({ rol, metin }) => ({ rol, metin })),
        suankiBaglam()
      );
      setMesajlar((m) => [
        ...m,
        { id: `${Date.now()}-a`, rol: 'asistan', metin: yanit.yanit, kartlar: yanit.kartlar },
      ]);
      // Model açık bir zorlanma/anlama sinyali verdiyse hafızaya yaz (konservatif).
      if (uid && yanit.hafiza) {
        konuSinyali(uid, { ad: yanit.hafiza.konu, ders: yanit.hafiza.ders, sinyal: yanit.hafiza.sinyal });
      }
    } catch (e) {
      const mesaj =
        e instanceof AiHatasi ? e.message : 'Beklenmeyen bir hata oluştu.';
      setMesajlar((m) => [...m, { id: `${Date.now()}-h`, rol: 'asistan', metin: mesaj, hatali: true }]);
    } finally {
      setYaziyor(false);
      asagiKaydir();
    }
  }

  function tekrarDene() {
    // Son kullanıcı mesajını bulup yeniden gönder.
    const sonKullanici = [...mesajlar].reverse().find((m) => m.rol === 'kullanici');
    if (sonKullanici) {
      setMesajlar((m) => m.filter((x) => !x.hatali));
      gonder(sonKullanici.metin);
    }
  }

  function gecmisiTemizle() {
    setMesajlar([]);
  }

  /** Kart iç-state'ini günceller (checkbox/akordeon/kaydet) — kalıcı olur. */
  function kartiGuncelle(mesajId: string, kartIndex: number, yeniKart: Kart) {
    setMesajlar((m) =>
      m.map((b) =>
        b.id === mesajId && b.kartlar
          ? { ...b, kartlar: b.kartlar.map((k, i) => (i === kartIndex ? yeniKart : k)) }
          : b
      )
    );
  }

  /** Kart CTA/aksiyonu: derin bağlantı veya sohbete mesaj. */
  function aksiyonYap(aksiyon?: string, mesaj?: string) {
    if (aksiyon === 'pomodoro') return void router.push('/(tabs)/pomodoro' as any);
    if (aksiyon === 'takvim') return void router.push('/(tabs)/takvim' as any);
    if (aksiyon === 'foto') return void setKaynakModal(true);
    if (mesaj) return void gonder(mesaj);
  }

  /** Kamera/galeriden soru fotoğrafı seç → base64 ile çözüme gönder. */
  async function fotoSec(kaynak: 'kamera' | 'galeri') {
    setKaynakModal(false);
    try {
      const izin =
        kaynak === 'kamera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!izin.granted) {
        bildir('İzin gerekli', 'Soru fotoğrafı için kamera/galeri iznine ihtiyacım var.');
        return;
      }
      const sonuc =
        kaynak === 'kamera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true, allowsEditing: true })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.6,
              base64: true,
              allowsEditing: true,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
            });
      if (sonuc.canceled) return;
      const asset = sonuc.assets[0];
      if (!asset.base64) {
        bildir('Hata', 'Görsel okunamadı, lütfen tekrar dene.');
        return;
      }
      // Hemen gönderme — giriş kutusunun üstünde beklesin; öğrenci not ekleyebilir.
      setBekleyenFoto({ base64: asset.base64, uri: asset.uri });
    } catch {
      bildir('Hata', 'Görsel seçilirken bir sorun oluştu.');
    }
  }

  /** Bekleyen fotoğrafı (varsa öğrenci notuyla) çözüp sonucu sohbete kart olarak basar. */
  async function fotoCoz(not: string) {
    if (yaziyor || !bekleyenFoto) return;
    Keyboard.dismiss();
    const foto = bekleyenFoto;
    setBekleyenFoto(null);
    setGirdi('');

    const fotoBalon: Balon = {
      id: `${Date.now()}-f`,
      rol: 'kullanici',
      metin: not || '📷 Soru fotoğrafı',
      foto: foto.uri,
    };
    setMesajlar((m) => [...m.filter((x) => !x.hatali), fotoBalon]);
    setYaziyor(true);
    asagiKaydir();

    try {
      const sonuc = await soruyuCoz(foto.base64, suankiBaglam(), not || undefined);
      const metin =
        sonuc.yanit ||
        (sonuc.durum === 'bulanik'
          ? 'Fotoğraf net değil — daha aydınlık ve yakından tekrar çeker misin?'
          : sonuc.durum === 'alakasiz'
          ? 'Bu fotoğrafta bir soru göremedim. Soruyu net çeker misin?'
          : 'İşte adım adım çözüm 👇');
      const cozuldu = sonuc.durum === 'cozuldu';
      setMesajlar((m) => [
        ...m,
        {
          id: `${Date.now()}-a`,
          rol: 'asistan',
          metin,
          kartlar: sonuc.kartlar,
          // Çözüm geldiyse onay çipleri için konuyu sakla.
          konu: cozuldu ? sonuc.konu || undefined : undefined,
          ders: cozuldu ? sonuc.ders || undefined : undefined,
        },
      ]);
    } catch (e) {
      const mesaj = e instanceof AiHatasi ? e.message : 'Soru çözülürken bir hata oluştu.';
      setMesajlar((m) => [...m, { id: `${Date.now()}-a`, rol: 'asistan', metin: mesaj }]);
    } finally {
      setYaziyor(false);
      asagiKaydir();
    }
  }

  /** Gönder butonu: bekleyen foto varsa onu (notla) çöz, yoksa metin mesajı gönder. */
  function gonderVeyaCoz() {
    if (bekleyenFoto) fotoCoz(girdi.trim());
    else gonder(girdi);
  }

  /** Çözüm sonrası onay çipi: konuyu hafızaya işle, gerekiyorsa tekrar iste. */
  function geriBildirimVer(mesaj: Balon, sinyal: KonuSinyali, tekrar?: boolean) {
    if (!mesaj.konu) return;
    if (uid) konuSinyali(uid, { ad: mesaj.konu, ders: mesaj.ders, sinyal });
    setMesajlar((m) => m.map((b) => (b.id === mesaj.id ? { ...b, geriBildirim: sinyal } : b)));
    if (tekrar) gonder(`${mesaj.konu} konusunu biraz daha açıklar mısın?`);
  }

  const bos = mesajlar.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.ekran}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Başlık */}
      <View style={styles.baslik}>
        <View style={styles.baslikSol}>
          <KocAvatar size={36} radius={11} />
          <View>
            <Text style={styles.baslikMetin}>AI Koç</Text>
            <View style={styles.durumSatir}>
              <View style={[styles.durumNokta, { backgroundColor: yaziyor ? COLORS.amber : COLORS.success }]} />
              <Text style={styles.baslikAlt}>{yaziyor ? 'yazıyor…' : 'çevrimiçi'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.baslikSag}>
          {!bos && (
            <TouchableOpacity style={styles.baslikBtn} onPress={gecmisiTemizle} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mesajlar */}
      {bos ? (
        <View style={styles.karsilama}>
          <View style={styles.karsilamaIkon}>
            <Ionicons name="sparkles" size={30} color={COLORS.primary} />
          </View>
          <Text style={styles.karsilamaBaslik}>
            Merhaba{profil?.isim ? `, ${profil.isim.split(' ')[0]}` : ''} 👋
          </Text>
          <Text style={styles.karsilamaAlt}>
            Ben senin sınav koçunum. Çalışma planı, konu anlatımı veya motivasyon — ne istersen sor.
          </Text>
          <View style={styles.cipler}>
            {ONERILER.map((o) => (
              <TouchableOpacity key={o} style={styles.cip} onPress={() => gonder(o)} activeOpacity={0.8}>
                <Text style={styles.cipMetin}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listeRef}
          data={mesajlar}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.liste}
          onContentSizeChange={asagiKaydir}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Mesaj
              balon={item}
              onTekrar={tekrarDene}
              onKartGuncelle={(i, yeni) => kartiGuncelle(item.id, i, yeni)}
              onAksiyon={aksiyonYap}
              onGeriBildirim={(sinyal, tekrar) => geriBildirimVer(item, sinyal, tekrar)}
            />
          )}
        />
      )}

      {/* "yazıyor" göstergesi */}
      {yaziyor && (
        <View style={styles.yaziyorSatir}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.yaziyorMetin}>Koç düşünüyor…</Text>
        </View>
      )}

      {/* Giriş alanı: (bekleyen foto önizlemesi) + giriş çubuğu */}
      <View style={styles.girisAlani}>
        {bekleyenFoto && (
          <View style={styles.bekleyenSatir}>
            <Image source={{ uri: bekleyenFoto.uri }} style={styles.bekleyenFotoImg} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bekleyenBaslik}>Soru fotoğrafı hazır</Text>
              <Text style={styles.bekleyenAlt}>Göndermeden önce not ekleyebilirsin (opsiyonel)</Text>
            </View>
            <TouchableOpacity onPress={() => setBekleyenFoto(null)} hitSlop={8} style={styles.bekleyenKaldir}>
              <Ionicons name="close" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.girisCubugu}>
          <TouchableOpacity
            style={styles.ekleBtn}
            onPress={() => setKaynakModal(true)}
            disabled={yaziyor}
            hitSlop={6}
          >
            <Ionicons name="camera-outline" size={22} color={yaziyor ? COLORS.textLight : COLORS.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.giris}
            placeholder={bekleyenFoto ? 'Soru hakkında not ekle…' : 'Koçuna bir şey sor…'}
            placeholderTextColor={COLORS.textLight}
            value={girdi}
            onChangeText={setGirdi}
            multiline
            editable={!yaziyor}
            onSubmitEditing={gonderVeyaCoz}
          />
          <TouchableOpacity
            style={[styles.gonderBtn, ((!girdi.trim() && !bekleyenFoto) || yaziyor) && styles.gonderBtnPasif]}
            onPress={gonderVeyaCoz}
            disabled={(!girdi.trim() && !bekleyenFoto) || yaziyor}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Foto kaynağı seçimi */}
      <Modal
        visible={kaynakModal}
        transparent
        animationType="fade"
        onRequestClose={() => setKaynakModal(false)}
      >
        <Pressable style={styles.modalArka} onPress={() => setKaynakModal(false)}>
          <Pressable style={styles.modalSheet}>
            <View style={styles.modalTutamac} />
            <Text style={styles.modalBaslik}>Soru fotoğrafı ekle</Text>
            <TouchableOpacity style={styles.modalSecenek} onPress={() => fotoSec('kamera')} activeOpacity={0.8}>
              <View style={styles.modalIkon}>
                <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.modalSecenekMetin}>Kamera ile çek</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecenek} onPress={() => fotoSec('galeri')} activeOpacity={0.8}>
              <View style={styles.modalIkon}>
                <Ionicons name="images-outline" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.modalSecenekMetin}>Galeriden seç</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Mesaj({
  balon,
  onTekrar,
  onKartGuncelle,
  onAksiyon,
  onGeriBildirim,
}: {
  balon: Balon;
  onTekrar: () => void;
  onKartGuncelle: (kartIndex: number, yeniKart: Kart) => void;
  onAksiyon: (aksiyon?: string, mesaj?: string) => void;
  onGeriBildirim: (sinyal: KonuSinyali, tekrar?: boolean) => void;
}) {
  const benim = balon.rol === 'kullanici';

  if (balon.hatali) {
    return (
      <View style={styles.hataKart}>
        <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
        <Text style={styles.hataMetin}>{balon.metin}</Text>
        <TouchableOpacity style={styles.tekrarBtn} onPress={onTekrar}>
          <Ionicons name="refresh" size={14} color={COLORS.primary} />
          <Text style={styles.tekrarMetin}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (benim) {
    return (
      <View style={[styles.balonSatir, styles.balonSatirSag]}>
        <View style={[styles.balon, styles.balonBenim, balon.foto && styles.balonFotolu]}>
          {!!balon.foto && (
            <Image source={{ uri: balon.foto }} style={styles.fotoOnizleme} resizeMode="cover" />
          )}
          {!!balon.metin && (
            <Text style={[styles.balonMetin, styles.balonMetinBenim, balon.foto && styles.balonFotoMetin]}>
              {balon.metin}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Koç: metin balonu (avatarlı) + altına kartlar (avatardan hizalı)
  const kartlar = balon.kartlar ?? [];
  return (
    <View style={styles.kocGrup}>
      {!!balon.metin && (
        <View style={styles.kocSatir}>
          <KocAvatar size={28} radius={9} glow={false} />
          <View style={[styles.balon, styles.balonKoc]}>
            <ZenginMetin style={styles.balonMetin}>{balon.metin}</ZenginMetin>
          </View>
        </View>
      )}
      {kartlar.map((k, i) => (
        <KartRenderer
          key={i}
          kart={k}
          onKartGuncelle={(yeni) => onKartGuncelle(i, yeni)}
          onAksiyon={onAksiyon}
        />
      ))}

      {/* Çözüm sonrası onay çipleri (yalnızca konu bilgisi olan çözümlerde) */}
      {!!balon.konu &&
        (balon.geriBildirim ? (
          <View style={styles.gbOnay}>
            <Ionicons name="checkmark-circle" size={15} color={COLORS.success} />
            <Text style={styles.gbOnayMetin}>
              {balon.geriBildirim === 'anladi' ? 'Süper, not aldım 💜' : 'Not aldım, bu konuya birlikte ağırlık vereceğiz 💪'}
            </Text>
          </View>
        ) : (
          <View style={styles.gbKap}>
            <Text style={styles.gbSoru}>Bu konuyu anladın mı?</Text>
            <View style={styles.gbSatir}>
              <TouchableOpacity style={styles.gbCip} onPress={() => onGeriBildirim('anladi')} activeOpacity={0.8}>
                <Text style={styles.gbCipMetin}>Anladım ✅</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gbCip} onPress={() => onGeriBildirim('zorlaniyor')} activeOpacity={0.8}>
                <Text style={styles.gbCipMetin}>Hâlâ karışık 🤔</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gbCip} onPress={() => onGeriBildirim('zorlaniyor', true)} activeOpacity={0.8}>
                <Text style={styles.gbCipMetin}>Tekrar edelim 📌</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  baslikSol: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baslikMetin: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  durumSatir: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  durumNokta: { width: 6, height: 6, borderRadius: 99 },
  baslikAlt: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '500' },
  baslikSag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  baslikBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },

  // Karşılama
  karsilama: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  karsilamaIkon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  karsilamaBaslik: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  karsilamaAlt: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  cipler: { gap: 8, alignSelf: 'stretch' },
  cip: {
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  cipMetin: { fontSize: 13.5, color: COLORS.text, fontWeight: '500' },

  // Liste
  liste: { padding: 16, gap: 12 },
  kocGrup: { gap: 12 },
  kocSatir: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },

  // Çözüm sonrası geri bildirim çipleri (avatardan hizalı)
  gbKap: { marginLeft: 37, gap: 7 },
  gbSoru: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  gbSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gbCip: {
    backgroundColor: COLORS.primaryLight, borderRadius: 99,
    paddingVertical: 7, paddingHorizontal: 12,
  },
  gbCipMetin: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
  gbOnay: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 37 },
  gbOnayMetin: { fontSize: 12.5, color: COLORS.textSecondary, fontWeight: '500' },
  balonSatir: { flexDirection: 'row' },
  balonSatirSag: { justifyContent: 'flex-end' },
  balon: { maxWidth: '82%', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 14 },
  balonBenim: { backgroundColor: COLORS.primary, borderBottomRightRadius: 5 },
  balonKoc: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderBottomLeftRadius: 5 },
  balonMetin: { fontSize: 14.5, lineHeight: 21, color: COLORS.text },
  balonMetinBenim: { color: '#fff' },
  balonFotolu: { padding: 5 },
  fotoOnizleme: { width: 200, height: 140, borderRadius: 14 },
  balonFotoMetin: { marginTop: 6, marginHorizontal: 6, marginBottom: 2, fontSize: 13 },

  // Hata kartı
  hataKart: {
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14,
    padding: 12, gap: 8, alignItems: 'flex-start',
  },
  hataMetin: { fontSize: 13, color: COLORS.error, lineHeight: 18 },
  tekrarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  tekrarMetin: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Yazıyor
  yaziyorSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  yaziyorMetin: { fontSize: 12.5, color: COLORS.textSecondary, fontStyle: 'italic' },

  // Giriş
  girisAlani: { backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  bekleyenSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10 },
  bekleyenFotoImg: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.background },
  bekleyenBaslik: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  bekleyenAlt: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 1 },
  bekleyenKaldir: {
    width: 30, height: 30, borderRadius: 99, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  girisCubugu: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 26,
  },
  giris: {
    flex: 1, maxHeight: 120, backgroundColor: COLORS.background, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 14.5, color: COLORS.text,
  },
  gonderBtn: {
    width: 42, height: 42, borderRadius: 99, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  gonderBtnPasif: { backgroundColor: COLORS.textLight },
  ekleBtn: {
    width: 42, height: 42, borderRadius: 99, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },

  // Foto kaynağı modal
  modalArka: { flex: 1, backgroundColor: 'rgba(15,18,40,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 34,
  },
  modalTutamac: { alignSelf: 'center', width: 40, height: 4, borderRadius: 99, backgroundColor: COLORS.cardBorder, marginBottom: 12 },
  modalBaslik: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  modalSecenek: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  modalIkon: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  modalSecenekMetin: { fontSize: 15, fontWeight: '600', color: COLORS.text },
});
