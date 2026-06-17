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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { useProfile } from '../../hooks/useProfile';
import { useKocHafiza } from '../../hooks/useKocHafiza';
import { useSohbetler } from '../../hooks/useSohbetler';
import { konuSinyali, zorlananKonularOzet, iyiKonularOzet, kisiselNotEkle, kisiselNotlarOzet } from '../../services/kocHafizaService';
import { denemeleriGetir } from '../../services/firestoreService';
import { denemeAiOzeti } from '../../models/deneme';
import { COLORS } from '../../constants/colors';
import { bildir } from '../../utils/bildirim';
import { kocaSor, soruyuCoz, baglamKur, AiHatasi } from '../../services/aiService';
import type { Kart, KonuSinyali } from '../../types/koc';
import { ayracEtiketi, gecmisMetinleri, mesajZamani, type Balon } from '../../services/sohbetService';
import { KocAvatar } from '../../components/koc/KocAvatar';
import { KartRenderer } from '../../components/koc/KartRenderer';
import { ZenginMetin } from '../../components/koc/ZenginMetin';
import { Press } from '../../components/koc/Press';
import { GecmisCekmecesi } from '../../components/koc/GecmisCekmecesi';

const ONERILER = [
  'Bu hafta neye odaklanmalıyım?',
  'Limit konusunu nasıl çalışırım?',
  'Motivasyonum düştü, ne yapmalıyım?',
  'Son denememi değerlendir',
];

/** Mesaj listesi satırı: mesaj baloncuğu ya da (gün değişiminde) zaman ayracı. */
type Satir =
  | { tip: 'ayrac'; key: string; etiket: string }
  | { tip: 'mesaj'; key: string; balon: Balon };

/** Mesajları, gün değiştikçe araya zaman ayracı ekleyerek liste satırlarına çevirir. */
function satirlariKur(mesajlar: Balon[]): Satir[] {
  const satirlar: Satir[] = [];
  let oncekiGun = '';
  for (const m of mesajlar) {
    const ts = mesajZamani(m);
    const gun = new Date(ts).toDateString();
    if (gun !== oncekiGun) {
      satirlar.push({ tip: 'ayrac', key: `ay-${m.id}`, etiket: ayracEtiketi(ts) });
      oncekiGun = gun;
    }
    satirlar.push({ tip: 'mesaj', key: m.id, balon: m });
  }
  return satirlar;
}

/**
 * Büyük soru fotoğrafını uzun kenarı ~1500 px olacak şekilde küçültür: soru metni bu boyutta
 * rahat okunur, görselin token maliyeti ciddi düşer. Küçük/boyutu bilinmeyen görsele dokunmaz;
 * küçültme herhangi bir nedenle başarısız olursa orijinaliyle devam eder (çözümü asla engelleme).
 */
async function fotoKucult(asset: ImagePicker.ImagePickerAsset): Promise<{ base64: string; uri: string } | null> {
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  if (Math.max(w, h) > 1600) {
    try {
      const kucuk = await manipulateAsync(asset.uri, [{ resize: w >= h ? { width: 1500 } : { height: 1500 } }], {
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (kucuk.base64) return { base64: kucuk.base64, uri: kucuk.uri };
    } catch {
      // sessizce orijinale düş
    }
  }
  return asset.base64 ? { base64: asset.base64, uri: asset.uri } : null;
}

export default function AiKoc() {
  const router = useRouter();
  const { profil } = useProfile();
  const { hafiza } = useKocHafiza();
  // Auth restorasyonu web'de asenkrondur: mount anında currentUser null olabilir. uid'i tek sefer
  // okumak yerine auth durumunu DİNLE ki sohbet geçmişi (ve hafıza yazımı) hazır olunca doğru
  // kullanıcı anahtarıyla yüklensin/kaydedilsin. (Aynı yarış useProfile/useKocHafiza'da çözülmüştü.)
  const [uid, setUid] = useState<string | undefined>(() => auth.currentUser?.uid);
  useEffect(() => onAuthStateChanged(auth, (k) => setUid(k?.uid)), []);

  // Çoklu sohbet deposu — aktif sohbetin mesajları tek doğruluk kaynağı.
  const { aktifMesajlar: mesajlar, aktifId, gecmis, mesajlariGuncelle, yeniSohbet, sohbetSec, tumunuTemizle } =
    useSohbetler(uid);

  // Son deneme özetleri — koç gerçek netleri görsün (denemeKiyasi/projeksiyon uydurma yerine
  // veriyle çalışır). Ekrana her dönüşte tazelenir: öğrenci deneme ekleyip koça sorabilir.
  const [denemeOzetleri, setDenemeOzetleri] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!uid) {
        setDenemeOzetleri([]);
        return;
      }
      let aktif = true;
      denemeleriGetir(uid)
        .then((liste) => {
          if (aktif) setDenemeOzetleri(liste.slice(0, 3).map(denemeAiOzeti));
        })
        .catch(() => {}); // özet alınamazsa koç onsuz da çalışır
      return () => {
        aktif = false;
      };
    }, [uid])
  );

  /** Güncel profil + hafıza + deneme bağlamı. */
  function suankiBaglam() {
    return baglamKur(
      profil,
      zorlananKonularOzet(hafiza),
      iyiKonularOzet(hafiza),
      denemeOzetleri,
      kisiselNotlarOzet(hafiza)
    );
  }

  const { soru: paramSoru } = useLocalSearchParams<{ soru?: string }>();
  const [girdi, setGirdi] = useState('');

  useEffect(() => {
    if (paramSoru) setGirdi(Array.isArray(paramSoru) ? paramSoru[0] : paramSoru);
  }, [paramSoru]);
  const [yaziyor, setYaziyor] = useState(false);
  const [kaynakModal, setKaynakModal] = useState(false);
  const [cekmece, setCekmece] = useState(false);
  const [bekleyenFoto, setBekleyenFoto] = useState<{ base64: string; uri: string } | null>(null);
  // Tam ekran fotoğraf önizlemesi — sohbetteki/bekleyen foto'ya dokununca açılır.
  const [onizlemeFoto, setOnizlemeFoto] = useState<string | null>(null);
  const listeRef = useRef<FlatList<Satir>>(null);
  // Yalnızca yeni mesaj eklendiğinde en alta kay. Akordeon adımı açma gibi içerik
  // boyutu değişimlerinde kaymamak için onContentSizeChange bu bayrağı tüketir.
  const kaydirSonraki = useRef(false);

  const satirlar = useMemo(() => satirlariKur(mesajlar), [mesajlar]);

  function asagiKaydir() {
    // Henüz yerleşmemiş içerik için onContentSizeChange'in de kaydırmasına izin ver.
    kaydirSonraki.current = true;
    requestAnimationFrame(() => listeRef.current?.scrollToEnd({ animated: true }));
  }

  /** Geri: önceki route'a/sekmeye dön; geçmiş yoksa ana sekmeye. */
  function geriDon() {
    if (router.canGoBack()) router.back();
    else router.navigate('/(tabs)' as any);
  }

  /** Geçmişten bir sohbeti aç ve en alta kay. */
  function sohbetiAc(id: string) {
    sohbetSec(id);
    asagiKaydir();
  }

  async function gonder(metin: string) {
    const temiz = metin.trim();
    if (!temiz || yaziyor) return;
    Keyboard.dismiss();
    setGirdi('');

    const kullaniciBalon: Balon = {
      id: `${Date.now()}-k`,
      zaman: Date.now(),
      rol: 'kullanici',
      metin: temiz,
    };
    const sonraki = [...mesajlar.filter((m) => !m.hatali), kullaniciBalon];
    mesajlariGuncelle(sonraki);
    setYaziyor(true);
    asagiKaydir();

    try {
      // Kart içeriklerini de gönder: asistanın ürettiği çözüm/konu kartları yalnızca `kartlar`'da
      // durur; metne gömülmezse model "şu adımı anlamadım"da çözümü göremez, alakasız tanım verir.
      const yanit = await kocaSor(gecmisMetinleri(sonraki), suankiBaglam());
      mesajlariGuncelle((m) => [
        ...m,
        { id: `${Date.now()}-a`, zaman: Date.now(), rol: 'asistan', metin: yanit.yanit, kartlar: yanit.kartlar },
      ]);
      // Model açık bir zorlanma/anlama sinyali verdiyse hafızaya yaz (konservatif).
      if (uid && yanit.hafiza) {
        konuSinyali(uid, { ad: yanit.hafiza.konu, ders: yanit.hafiza.ders, sinyal: yanit.hafiza.sinyal });
      }
      // Öğrenci kendisi hakkında kalıcı bir bilgi paylaştıysa kişisel not olarak sakla.
      if (uid && yanit.hafizaNot) {
        kisiselNotEkle(uid, yanit.hafizaNot);
      }
    } catch (e) {
      const mesaj = e instanceof AiHatasi ? e.message : 'Beklenmeyen bir hata oluştu.';
      mesajlariGuncelle((m) => [
        ...m,
        { id: `${Date.now()}-h`, zaman: Date.now(), rol: 'asistan', metin: mesaj, hatali: true },
      ]);
    } finally {
      setYaziyor(false);
      asagiKaydir();
    }
  }

  function tekrarDene() {
    // Son kullanıcı mesajını bulup yeniden gönder.
    const sonKullanici = [...mesajlar].reverse().find((m) => m.rol === 'kullanici');
    if (sonKullanici) {
      mesajlariGuncelle((m) => m.filter((x) => !x.hatali));
      gonder(sonKullanici.metin);
    }
  }

  /** Kart iç-state'ini günceller (checkbox/akordeon/kaydet) — kalıcı olur. */
  function kartiGuncelle(mesajId: string, kartIndex: number, yeniKart: Kart) {
    mesajlariGuncelle((m) =>
      m.map((b) =>
        b.id === mesajId && b.kartlar
          ? { ...b, kartlar: b.kartlar.map((k, i) => (i === kartIndex ? yeniKart : k)) }
          : b
      )
    );
  }

  /** Kart CTA/aksiyonu: derin bağlantı veya sohbete mesaj. */
  function aksiyonYap(aksiyon?: string, mesaj?: string) {
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
      const foto = await fotoKucult(sonuc.assets[0]);
      if (!foto) {
        bildir('Hata', 'Görsel okunamadı, lütfen tekrar dene.');
        return;
      }
      // Hemen gönderme — giriş kutusunun üstünde beklesin; öğrenci not ekleyebilir.
      setBekleyenFoto(foto);
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
      zaman: Date.now(),
      rol: 'kullanici',
      metin: not || '📷 Soru fotoğrafı',
      foto: foto.uri,
    };
    mesajlariGuncelle((m) => [...m.filter((x) => !x.hatali), fotoBalon]);
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
      mesajlariGuncelle((m) => [
        ...m,
        {
          id: `${Date.now()}-a`,
          zaman: Date.now(),
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
      mesajlariGuncelle((m) => [
        ...m,
        { id: `${Date.now()}-a`, zaman: Date.now(), rol: 'asistan', metin: mesaj },
      ]);
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

  /**
   * Çözüm sonrası onay çipi: konuyu hafızaya işle; "anlamadım"da neyi anlamadığını sorgulat.
   * adimMetni verilirse (öğrenci adım seçtiyse) koç doğrudan o adımı açıklar — gereksiz
   * "hangi adım?" turu olmaz. Adım yoksa (foto-dışı/konu kartı) tüm çözümü sade tekrar ister.
   */
  function geriBildirimVer(
    mesaj: Balon,
    sinyal: KonuSinyali,
    aksiyon?: 'sor' | 'tekrar',
    adimMetni?: string
  ) {
    if (!mesaj.konu) return;
    if (uid) konuSinyali(uid, { ad: mesaj.konu, ders: mesaj.ders, sinyal });
    mesajlariGuncelle((m) => m.map((b) => (b.id === mesaj.id ? { ...b, geriBildirim: sinyal } : b)));

    if (aksiyon === 'sor') {
      if (adimMetni) {
        gonder(
          `Çözümün "${adimMetni}" adımını tam anlamadım. Sadece bu adımı; soruyu baştan çözmeden, neden böyle yapıldığını da içeren sade ve kısa bir dille açıklar mısın?`
        );
      } else {
        gonder(
          'Bu çözümü tam anlamadım. Çözümün tamamını daha sade, adım adım ve nedenleriyle tekrar anlatır mısın?'
        );
      }
    } else if (aksiyon === 'tekrar') {
      gonder(`${mesaj.konu} konusunu daha basit, sade bir dille tekrar anlatır mısın?`);
    }
  }

  const bos = mesajlar.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.ekran}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Başlık — geri + kimlik + geçmiş/yeni sohbet */}
      <View style={styles.baslik}>
        <Press style={styles.ikonBtn} onPress={geriDon} scale={0.92}>
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </Press>
        <View style={styles.kimlik}>
          <KocAvatar size={34} radius={10} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.baslikMetin} numberOfLines={1}>AI Koç</Text>
            <View style={styles.durumSatir}>
              <View style={[styles.durumNokta, { backgroundColor: yaziyor ? COLORS.amber : COLORS.success }]} />
              <Text style={styles.baslikAlt}>{yaziyor ? 'yazıyor…' : 'çevrimiçi'}</Text>
            </View>
          </View>
        </View>
        <Press style={styles.ikonBtn} onPress={() => setCekmece(true)} scale={0.92}>
          <Ionicons name="time-outline" size={19} color={COLORS.primary} />
        </Press>
        <Press style={[styles.ikonBtn, styles.ikonBtnPrimary]} onPress={yeniSohbet} scale={0.92}>
          <Ionicons name="add" size={22} color={COLORS.primary} />
        </Press>
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
          data={satirlar}
          keyExtractor={(r) => r.key}
          contentContainerStyle={styles.liste}
          onContentSizeChange={() => {
            // Sadece yeni mesaj sonrası kay; akordeon açma vb. boyut değişiminde dokunma.
            if (!kaydirSonraki.current) return;
            kaydirSonraki.current = false;
            listeRef.current?.scrollToEnd({ animated: true });
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) =>
            item.tip === 'ayrac' ? (
              <View style={styles.ayracKap}>
                <Text style={styles.ayrac}>{item.etiket}</Text>
              </View>
            ) : (
              <Mesaj
                balon={item.balon}
                onTekrar={tekrarDene}
                onFotoAc={setOnizlemeFoto}
                onKartGuncelle={(i, yeni) => kartiGuncelle(item.balon.id, i, yeni)}
                onAksiyon={aksiyonYap}
                onGeriBildirim={(sinyal, aksiyon, adimMetni) =>
                  geriBildirimVer(item.balon, sinyal, aksiyon, adimMetni)
                }
              />
            )
          }
        />
      )}

      {/* "yazıyor" göstergesi */}
      {yaziyor && (
        <View style={styles.yaziyorSatir}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.yaziyorMetin}>Koç düşünüyor…</Text>
        </View>
      )}

      {/* Giriş alanı: (bekleyen foto önizlemesi) + giriş çubuğu (TEK alt çubuk) */}
      <View style={styles.girisAlani}>
        {bekleyenFoto && (
          <View style={styles.bekleyenSatir}>
            <TouchableOpacity onPress={() => setOnizlemeFoto(bekleyenFoto.uri)} activeOpacity={0.8}>
              <Image source={{ uri: bekleyenFoto.uri }} style={styles.bekleyenFotoImg} resizeMode="cover" />
            </TouchableOpacity>
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

      {/* Geçmiş sohbetler çekmecesi (soldan açılır) */}
      <GecmisCekmecesi
        gorunur={cekmece}
        gecmis={gecmis}
        aktifId={aktifId}
        onKapat={() => setCekmece(false)}
        onSec={sohbetiAc}
        onYeni={yeniSohbet}
        onTumunuTemizle={tumunuTemizle}
      />

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

      {/* Tam ekran fotoğraf önizlemesi — herhangi bir yere dokununca kapanır */}
      <Modal
        visible={!!onizlemeFoto}
        transparent
        animationType="fade"
        onRequestClose={() => setOnizlemeFoto(null)}
      >
        <Pressable style={styles.onizlemeArka} onPress={() => setOnizlemeFoto(null)}>
          {!!onizlemeFoto && (
            <Image source={{ uri: onizlemeFoto }} style={styles.onizlemeImg} resizeMode="contain" />
          )}
          <TouchableOpacity
            style={styles.onizlemeKapat}
            onPress={() => setOnizlemeFoto(null)}
            hitSlop={10}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Mesaj({
  balon,
  onTekrar,
  onFotoAc,
  onKartGuncelle,
  onAksiyon,
  onGeriBildirim,
}: {
  balon: Balon;
  onTekrar: () => void;
  onFotoAc: (uri: string) => void;
  onKartGuncelle: (kartIndex: number, yeniKart: Kart) => void;
  onAksiyon: (aksiyon?: string, mesaj?: string) => void;
  onGeriBildirim: (sinyal: KonuSinyali, aksiyon?: 'sor' | 'tekrar', adimMetni?: string) => void;
}) {
  const benim = balon.rol === 'kullanici';
  // "Bir yeri anlamadım"a basınca adım seçici açılır (çözüm adımları varsa).
  const [adimSecimi, setAdimSecimi] = useState(false);

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
            <TouchableOpacity onPress={() => onFotoAc(balon.foto!)} activeOpacity={0.85}>
              <Image source={{ uri: balon.foto }} style={styles.fotoOnizleme} resizeMode="cover" />
            </TouchableOpacity>
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
  // Çözüm adımları (varsa) — "anlamadım" adım seçici bunları listeler.
  const cozumKart = kartlar.find((k) => k.tip === 'cozumAdimlari');
  const cozumAdimlari =
    cozumKart && cozumKart.tip === 'cozumAdimlari' ? cozumKart.veri.adimlar ?? [] : [];
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
      {!!balon.konu && !balon.geriBildirim && (
        adimSecimi ? (
          // Adım seçici: öğrenci hangi adımı anlamadığını DOĞRUDAN seçer → koç gereksiz
          // "hangi adım?" turu atmadan yalnızca o adımı açıklar.
          <View style={styles.gbKap}>
            <View style={styles.adimSecBaslikSatir}>
              <Text style={styles.gbSoru}>Hangi adımı anlamadın?</Text>
              <TouchableOpacity onPress={() => setAdimSecimi(false)} hitSlop={8}>
                <Ionicons name="close" size={16} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
            {cozumAdimlari.map((a, i) => (
              <TouchableOpacity
                key={i}
                style={styles.adimSecSatir}
                onPress={() => onGeriBildirim('zorlaniyor', 'sor', `${i + 1}) ${a.ad}`)}
                activeOpacity={0.8}
              >
                <View style={styles.adimSecNo}>
                  <Text style={styles.adimSecNoMetin}>{i + 1}</Text>
                </View>
                <Text style={styles.adimSecMetin} numberOfLines={2}>{a.ad}</Text>
                <Ionicons name="chevron-forward" size={15} color={COLORS.textLight} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.adimSecSatir}
              onPress={() => onGeriBildirim('zorlaniyor', 'sor')}
              activeOpacity={0.8}
            >
              <View style={[styles.adimSecNo, styles.adimSecNoNotr]}>
                <Ionicons name="reload" size={13} color={COLORS.textSecondary} />
              </View>
              <Text style={[styles.adimSecMetin, { color: COLORS.textSecondary }]}>Tamamını daha sade anlat</Text>
              <Ionicons name="chevron-forward" size={15} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.gbKap}>
            <Text style={styles.gbSoru}>Bu konuyu anladın mı?</Text>
            <View style={styles.gbSatir}>
              <TouchableOpacity style={styles.gbCip} onPress={() => onGeriBildirim('anladi')} activeOpacity={0.8}>
                <Text style={styles.gbCipMetin}>Anladım ✅</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gbCip}
                onPress={() => (cozumAdimlari.length ? setAdimSecimi(true) : onGeriBildirim('zorlaniyor', 'sor'))}
                activeOpacity={0.8}
              >
                <Text style={styles.gbCipMetin}>Bir yeri anlamadım 🤔</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gbCip} onPress={() => onGeriBildirim('zorlaniyor', 'tekrar')} activeOpacity={0.8}>
                <Text style={styles.gbCipMetin}>Daha basit anlat 📌</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      )}
      {/* Sadece "Anladım"da kısa onay; "anlamadım"da konuşma akışı zaten devam ediyor. */}
      {balon.geriBildirim === 'anladi' && (
        <View style={styles.gbOnay}>
          <Ionicons name="checkmark-circle" size={15} color={COLORS.success} />
          <Text style={styles.gbOnayMetin}>Süper, not aldım 💜</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  kimlik: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  baslikMetin: { fontSize: 15.5, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  durumSatir: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  durumNokta: { width: 6, height: 6, borderRadius: 99 },
  baslikAlt: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '500' },
  ikonBtn: {
    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.cardBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  ikonBtnPrimary: { backgroundColor: COLORS.primaryLight, borderColor: `${COLORS.primary}22` },

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

  // Gün/zaman ayracı (ortalı pill)
  ayracKap: { alignItems: 'center', paddingVertical: 2 },
  ayrac: {
    fontSize: 11.5, fontWeight: '600', color: COLORS.textLight, overflow: 'hidden',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12,
  },

  // Çözüm sonrası geri bildirim çipleri (avatardan hizalı)
  gbKap: { marginLeft: 37, gap: 7 },
  gbSoru: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  gbSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gbCip: {
    backgroundColor: COLORS.primaryLight, borderRadius: 99,
    paddingVertical: 7, paddingHorizontal: 12,
  },
  gbCipMetin: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },

  // "Bir yeri anlamadım" → adım seçici
  adimSecBaslikSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adimSecSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11,
  },
  adimSecNo: {
    width: 22, height: 22, borderRadius: 7, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  adimSecNoNotr: { backgroundColor: COLORS.background },
  adimSecNoMetin: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  adimSecMetin: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },

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

  // Tam ekran foto önizlemesi
  onizlemeArka: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center',
  },
  onizlemeImg: { width: '100%', height: '100%' },
  onizlemeKapat: {
    position: 'absolute', top: 48, right: 20, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },

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

  // Giriş (TEK alt çubuk — alt sekme çubuğu gizli)
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
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 30,
  },
  giris: {
    flex: 1, maxHeight: 120, backgroundColor: COLORS.background, borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 14.5, color: COLORS.text,
  },
  gonderBtn: {
    width: 44, height: 44, borderRadius: 99, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  gonderBtnPasif: { backgroundColor: COLORS.textLight },
  ekleBtn: {
    width: 44, height: 44, borderRadius: 99, backgroundColor: COLORS.primaryLight,
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
