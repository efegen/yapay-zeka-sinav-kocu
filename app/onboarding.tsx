import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Modal, FlatList,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { kayitOl } from '../services/authService';
import { diplomaEtkisiAcikla } from '../utils/puanHesapla';
import {
  universiteAramaYap,
  bolumListesiGetir,
  YokatlasProgram,
} from '../services/yokatlasService';

const TOPLAM_ADIM = 5;

const SINIFLAR = [
  { deger: '11', baslik: '11. Sınıf', alt: '2027 YKS' },
  { deger: '12', baslik: '12. Sınıf', alt: '2026 YKS' },
  { deger: 'mezun', baslik: 'Mezun', alt: '2026 YKS' },
];

const OKUL_TURLERI = [
  'Anadolu Lisesi',
  'Fen Lisesi',
  'Meslek Lisesi',
  'Diğer',
];

const PUAN_TURLERI = [
  { deger: 'SAY', baslik: 'SAY', alt: 'Matematik ağırlıklı' },
  { deger: 'EA', baslik: 'EA', alt: 'Eşit ağırlık' },
  { deger: 'SOZ', baslik: 'SÖZ', alt: 'Sözel ağırlıklı' },
  { deger: 'DIL', baslik: 'DİL', alt: 'Yabancı dil' },
];

// YKS 2025 katılımcı sayısına göre puan türü başına maksimum sıralama
const SIRALAMA_MAKS: Record<string, number> = {
  SAY: 750_000,
  EA: 600_000,
  SOZ: 400_000,
  DIL: 100_000,
};

const HAFTA_CALISMA = [
  { deger: 7, baslik: 'Her gün', alt: 'Maksimum tempo' },
  { deger: 6, baslik: '6 gün', alt: 'Yüksek tempo' },
  { deger: 5, baslik: '5 gün', alt: 'Dengeli tempo' },
  { deger: 4, baslik: '4 gün', alt: 'Orta tempo' },
  { deger: 3, baslik: '3 gün', alt: 'Rahat tempo' },
];

const GUNLUK_SORU_SECENEKLERI = [
  { deger: 50, baslik: '50', alt: 'soru / gün' },
  { deger: 75, baslik: '75', alt: 'soru / gün' },
  { deger: 100, baslik: '100', alt: 'soru / gün' },
];

interface SelectCardProps {
  baslik: string;
  alt?: string;
  secili: boolean;
  onPress: () => void;
}

const SelectCard = ({ baslik, alt, secili, onPress }: SelectCardProps) => (
  <TouchableOpacity
    style={[styles.kart, secili && styles.kartSecili]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.kartBaslik, secili && styles.kartBaslikSecili]}>
      {baslik}
    </Text>
    {alt && (
      <Text style={[styles.kartAlt, secili && styles.kartAltSecili]}>
        {alt}
      </Text>
    )}
  </TouchableOpacity>
);

export default function OnboardingScreen() {
  const [adim, setAdim] = useState(1);
  const [yukleniyor, setYukleniyor] = useState(false);

  // Adım 1
  const [isim, setIsim] = useState('');
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [kvkk1, setKvkk1] = useState(false);
  const [kvkk2, setKvkk2] = useState(false);
  const [adim1Hatalar, setAdim1Hatalar] = useState<Record<string, string>>({});

  // Adım 2
  const [sinif, setSinif] = useState('');
  const [okulTuru, setOkulTuru] = useState('');
  const [diplomaNotu, setDiplomaNotu] = useState('');
  const [gecenYilYerlesti, setGecenYilYerlesti] = useState<boolean | null>(null);

  // Adım 3
  const [puanTuru, setPuanTuru] = useState('');

  // Adım 4
  const [hedefTuru, setHedefTuru] = useState<'universite' | 'siralama'>('universite');
  const [hedefSiralama, setHedefSiralama] = useState('');
  const [hedefUniversite, setHedefUniversite] = useState('');
  const [secilenProgram, setSecilenProgram] = useState<YokatlasProgram | null>(null);
  const [uniModalAcik, setUniModalAcik] = useState(false);
  const [bolumModalAcik, setBolumModalAcik] = useState(false);
  const [uniArama, setUniArama] = useState('');
  const [bolumArama, setBolumArama] = useState('');

  // Adım 5
  const [haftaCalisma, setHaftaCalisma] = useState(0);
  const [gunlukSoru, setGunlukSoru] = useState(0);
  const [ozelSoru, setOzelSoru] = useState('');

  const ileriValidasyon = (): boolean => {
    if (adim === 1) {
      const hatalar: Record<string, string> = {};
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!isim.trim()) {
        hatalar.isim = 'İsim Soyisim alanını doldurun.';
      }
      if (!email.trim()) {
        hatalar.email = 'E-posta adresi gereklidir.';
      } else if (!emailRegex.test(email.trim())) {
        hatalar.email = 'Geçerli bir e-posta adresi girin.';
      }
      if (!sifre.trim()) {
        hatalar.sifre = 'Şifre gereklidir.';
      } else if (sifre.length < 6) {
        hatalar.sifre = 'Şifre en az 6 karakter olmalıdır.';
      }
      if (!kvkk1 || !kvkk2) {
        hatalar.kvkk = 'Devam etmek için her iki onayı da vermelisiniz.';
      }
      if (Object.keys(hatalar).length > 0) {
        setAdim1Hatalar(hatalar);
        return false;
      }
      setAdim1Hatalar({});
    }
    if (adim === 2) {
      if (!sinif || !okulTuru) {
        Alert.alert('Eksik bilgi', 'Sınıf ve okul türü seçin.'); return false;
      }
      const not = parseFloat(diplomaNotu);
      if (!diplomaNotu || isNaN(not) || not < 0 || not > 100) {
        Alert.alert('Geçersiz not', 'Diploma notunu 0-100 arası girin.'); return false;
      }
      if (sinif === 'mezun' && gecenYilYerlesti === null) {
        Alert.alert('Eksik bilgi', 'Geçen yıl bir programa yerleşip yerleşmediğini belirt.'); return false;
      }
    }
    if (adim === 3 && !puanTuru) {
      Alert.alert('Eksik bilgi', 'Puan türü seçin.'); return false;
    }
    if (adim === 4) {
      if (hedefTuru === 'universite' && (!hedefUniversite.trim() || !secilenProgram)) {
        Alert.alert('Eksik bilgi', 'Üniversite ve bölüm seçin.'); return false;
      }
      if (hedefTuru === 'siralama') {
        const s = parseInt(hedefSiralama);
        const maks = SIRALAMA_MAKS[puanTuru] || 2_500_000;
        if (!hedefSiralama || isNaN(s) || s < 1) {
          Alert.alert('Geçersiz sıralama', 'Geçerli bir hedef sıralaması girin.'); return false;
        }
        if (s > maks) {
          Alert.alert(
            'Gerçekçi olmayan sıralama',
            `${puanTuru || 'Seçilen'} puan türünde ${maks.toLocaleString('tr-TR')} üzeri sıralama bulunmamaktadır. Lütfen geçerli bir değer girin.`
          );
          return false;
        }
      }
    }
    return true;
  };

  const ileri = () => {
    if (!ileriValidasyon()) return;
    setAdim(adim + 1);
  };

  const geri = () => setAdim(adim - 1);

  const tamamla = async () => {
    const soruSayisi = ozelSoru ? parseInt(ozelSoru) : gunlukSoru;
    if (!haftaCalisma || !soruSayisi) {
      Alert.alert('Eksik bilgi', 'Çalışma planını tamamlayın.'); return;
    }
    setYukleniyor(true);
    try {
      await kayitOl(email.trim(), sifre, {
        isim: isim.trim(),
        sinif,
        okulTuru,
        diplomaNotu: parseFloat(diplomaNotu),
        ...(sinif === 'mezun' && { gecenYilYerlesti: gecenYilYerlesti ?? false }),
        puanTuru,
        hedefTuru,
        hedefUniversite: hedefTuru === 'universite' ? hedefUniversite.trim() : '',
        hedefBolum: hedefTuru === 'universite' ? (secilenProgram?.bolumAdi || '') : '',
        hedefProgramId: hedefTuru === 'universite' ? (secilenProgram?.programId || '') : '',
        ...(hedefTuru === 'siralama' && { hedefSiralama: parseInt(hedefSiralama) }),
        haftaCalismaSayisi: haftaCalisma,
        gunlukSoruHedefi: soruSayisi,
        kvkkOnay: true,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Kayıt başarısız', e.message || 'Bir hata oluştu.');
    } finally {
      setYukleniyor(false);
    }
  };

  const adimBilgi: Record<number, { baslik: string; emoji: string }> = {
    1: { baslik: 'Hesap Oluştur', emoji: '👋' },
    2: { baslik: 'Okul Bilgilerin', emoji: '🏫' },
    3: { baslik: 'Puan Türün', emoji: '📊' },
    4: { baslik: 'Hedefin', emoji: '🏆' },
    5: { baslik: 'Çalışma Planın', emoji: '📅' },
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerAdim}>Adım {adim}/{TOPLAM_ADIM}</Text>
        <Text style={styles.headerBaslik}>Profil Oluştur</Text>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            style={[styles.progressDolu, { width: `${(adim / TOPLAM_ADIM) * 100}%` }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
        </View>
      </View>

      <ScrollView
        style={styles.icerik}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.adimBaslik}>
          {adimBilgi[adim].emoji} {adimBilgi[adim].baslik}
        </Text>

        {/* ===== ADIM 1: Hesap + KVKK ===== */}
        {adim === 1 && (
          <View>
            <Text style={styles.label}>İsim Soyisim</Text>
            <TextInput
              style={[styles.input, adim1Hatalar.isim ? styles.inputHata : undefined]}
              placeholder="Adın Soyadın"
              placeholderTextColor={COLORS.textLight}
              value={isim}
              onChangeText={(t) => { setIsim(t); if (adim1Hatalar.isim) setAdim1Hatalar(h => ({ ...h, isim: '' })); }}
            />
            {!!adim1Hatalar.isim && <Text style={styles.hataYazi}>{adim1Hatalar.isim}</Text>}

            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={[styles.input, adim1Hatalar.email ? styles.inputHata : undefined]}
              placeholder="ornek@mail.com"
              placeholderTextColor={COLORS.textLight}
              value={email}
              onChangeText={(t) => { setEmail(t); if (adim1Hatalar.email) setAdim1Hatalar(h => ({ ...h, email: '' })); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {!!adim1Hatalar.email && <Text style={styles.hataYazi}>{adim1Hatalar.email}</Text>}

            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={[styles.input, adim1Hatalar.sifre ? styles.inputHata : undefined]}
              placeholder="En az 6 karakter"
              placeholderTextColor={COLORS.textLight}
              value={sifre}
              onChangeText={(t) => { setSifre(t); if (adim1Hatalar.sifre) setAdim1Hatalar(h => ({ ...h, sifre: '' })); }}
              secureTextEntry
            />
            {!!adim1Hatalar.sifre && <Text style={styles.hataYazi}>{adim1Hatalar.sifre}</Text>}

            <View style={[styles.kvkkKutu, adim1Hatalar.kvkk ? styles.kvkkKutuHata : undefined]}>
              <TouchableOpacity
                style={styles.kvkkSatir}
                onPress={() => { setKvkk1(!kvkk1); if (adim1Hatalar.kvkk) setAdim1Hatalar(h => ({ ...h, kvkk: '' })); }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, kvkk1 && styles.checkboxSecili]}>
                  {kvkk1 && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.kvkkYazi}>
                  <Text style={styles.kvkkLink}>Kullanıcı Sözleşmesi</Text>
                  {' ve '}
                  <Text style={styles.kvkkLink}>KVKK Aydınlatma Metni</Text>
                  {"'ni okudum ve kabul ediyorum."}
                </Text>
              </TouchableOpacity>

              <View style={styles.ayirici} />

              <TouchableOpacity
                style={styles.kvkkSatir}
                onPress={() => { setKvkk2(!kvkk2); if (adim1Hatalar.kvkk) setAdim1Hatalar(h => ({ ...h, kvkk: '' })); }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, kvkk2 && styles.checkboxSecili]}>
                  {kvkk2 && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.kvkkYazi}>
                  Yapay zeka analizleri için eğitim verilerimin işlenmesine
                  izin veriyorum.
                </Text>
              </TouchableOpacity>
            </View>
            {!!adim1Hatalar.kvkk && (
              <View style={styles.kvkkHataKutu}>
                <Text style={styles.hataYazi}>⚠ {adim1Hatalar.kvkk}</Text>
              </View>
            )}
          </View>
        )}

        {/* ===== ADIM 2: Okul Bilgileri ===== */}
        {adim === 2 && (
          <View>
            <Text style={styles.bolumBaslik}>Sınıf</Text>
            {SINIFLAR.map((s) => (
              <SelectCard key={s.deger} baslik={s.baslik} alt={s.alt}
                secili={sinif === s.deger}
                onPress={() => { setSinif(s.deger); if (s.deger !== 'mezun') setGecenYilYerlesti(null); }} />
            ))}

            {sinif === 'mezun' && (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.bolumBaslik}>Geçen yıl bir programa yerleştin mi?</Text>
                <Text style={styles.altBaslik}>Bu bilgi OBP katkısını doğrudan etkiler</Text>
                <View style={styles.ikiliButoSatir}>
                  <TouchableOpacity
                    style={[styles.ikiliButon, gecenYilYerlesti === true && styles.ikiliButonSecili]}
                    onPress={() => setGecenYilYerlesti(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.ikiliButonYazi, gecenYilYerlesti === true && styles.ikiliButonYaziSecili]}>Evet, yerleştim</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ikiliButon, gecenYilYerlesti === false && styles.ikiliButonSecili]}
                    onPress={() => setGecenYilYerlesti(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.ikiliButonYazi, gecenYilYerlesti === false && styles.ikiliButonYaziSecili]}>Hayır, yerleşmedim</Text>
                  </TouchableOpacity>
                </View>
                {gecenYilYerlesti === true && (
                  <View style={styles.uyariKutu}>
                    <Text style={styles.uyariYazi}>
                      ⚠️ Önceki yıl bir programa yerleştiğin için YÖK kuralı gereği OBP katkın %50 azaltılacak. TYT katsayısı 0.12 → 0.06, AYT katsayısı 0.06 → 0.03 olarak hesaplanacak.
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Text style={[styles.bolumBaslik, { marginTop: 24 }]}>Okul Türü</Text>
            {OKUL_TURLERI.map((o) => (
              <SelectCard key={o} baslik={o}
                secili={okulTuru === o}
                onPress={() => setOkulTuru(o)} />
            ))}

            <Text style={[styles.bolumBaslik, { marginTop: 24 }]}>
              Diploma Notu *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="85.6"
              placeholderTextColor={COLORS.textLight}
              value={diplomaNotu}
              onChangeText={setDiplomaNotu}
              keyboardType="decimal-pad"
            />

            {diplomaNotu !== '' && !isNaN(parseFloat(diplomaNotu)) && (
              <View style={styles.infoKutu}>
                <Text style={styles.infoYazi}>
                  💡 {diplomaEtkisiAcikla(parseFloat(diplomaNotu), gecenYilYerlesti === true)}
                </Text>
              </View>
            )}

            <View style={styles.infoKutu}>
              <Text style={styles.infoYazi}>
                ℹ️ Henüz kesin değil mi? Sorun değil. Tahmini notunu gir,
                dilediğin zaman profilinden güncelleyebilirsin.
              </Text>
            </View>
          </View>
        )}

        {/* ===== ADIM 3: Puan Türü ===== */}
        {adim === 3 && (
          <View>
            <Text style={styles.bolumBaslik}>Puan Türünü Seç</Text>
            {PUAN_TURLERI.map((p) => (
              <SelectCard key={p.deger} baslik={p.baslik} alt={p.alt}
                secili={puanTuru === p.deger}
                onPress={() => setPuanTuru(p.deger)} />
            ))}
            <View style={styles.infoKutu}>
              <Text style={styles.infoYazi}>
                📌 Puan türün hedef bölüm önerilerini ve AI koçunun
                sana yapacağı analizleri doğrudan etkiler.
              </Text>
            </View>
          </View>
        )}

        {/* ===== ADIM 4: Hedef (YÖKAtlas entegrasyonu) ===== */}
        {adim === 4 && (
          <View>
            {/* Hedef Türü Seçici */}
            <Text style={styles.bolumBaslik}>Hedef Türü</Text>
            <View style={styles.ikiliButoSatir}>
              <TouchableOpacity
                style={[styles.ikiliButon, hedefTuru === 'universite' && styles.ikiliButonSecili]}
                onPress={() => setHedefTuru('universite')}
                activeOpacity={0.7}
              >
                <Text style={[styles.ikiliButonYazi, hedefTuru === 'universite' && styles.ikiliButonYaziSecili]}>🎓 Üniversite / Bölüm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ikiliButon, hedefTuru === 'siralama' && styles.ikiliButonSecili]}
                onPress={() => setHedefTuru('siralama')}
                activeOpacity={0.7}
              >
                <Text style={[styles.ikiliButonYazi, hedefTuru === 'siralama' && styles.ikiliButonYaziSecili]}>📊 Sıralama Hedefi</Text>
              </TouchableOpacity>
            </View>

            {/* Sıralama Hedefi */}
            {hedefTuru === 'siralama' && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>{puanTuru || 'Alan'} sıralamasında hedefin</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: 50000"
                  placeholderTextColor={COLORS.textLight}
                  value={hedefSiralama}
                  onChangeText={setHedefSiralama}
                  keyboardType="number-pad"
                />
                {hedefSiralama !== '' && !isNaN(parseInt(hedefSiralama)) && (
                  <View style={styles.infoKutu}>
                    <Text style={styles.infoYazi}>
                      🎯 {puanTuru ? `${puanTuru} alanında` : 'Hedef'} {parseInt(hedefSiralama).toLocaleString('tr-TR')}. sıraya girmeyi hedefliyorsun.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Üniversite / Bölüm Seçici Kartlar */}
            {hedefTuru === 'universite' && (
            <>
            <TouchableOpacity
              style={styles.hedefSeciciKart}
              onPress={() => { setUniArama(''); setUniModalAcik(true); }}
              activeOpacity={0.7}
            >
              <View style={[styles.hedefSeciciIkon, hedefUniversite ? styles.hedefSeciciIkonAktif : {}]}>
                <Text style={styles.hedefSeciciIkonYazi}>🎓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hedefSeciciBaslik}>Üniversite ekle</Text>
                <Text style={[styles.hedefSeciciAlt, hedefUniversite && styles.hedefSeciciAltSecili]} numberOfLines={1}>
                  {hedefUniversite || 'Hedef üniversiteni seç'}
                </Text>
              </View>
              {hedefUniversite ? (
                <View style={styles.hedefSeciciDegistir}>
                  <Text style={styles.hedefSeciciDegistirYazi}>Değiştir</Text>
                </View>
              ) : (
                <Text style={styles.hedefSeciciEkle}>＋</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hedefSeciciKart, !hedefUniversite && styles.hedefSeciciKartPasif]}
              onPress={() => {
                if (!hedefUniversite) return;
                setBolumArama('');
                setBolumModalAcik(true);
              }}
              activeOpacity={hedefUniversite ? 0.7 : 1}
            >
              <View style={[styles.hedefSeciciIkon, secilenProgram ? styles.hedefSeciciIkonAktif : styles.hedefSeciciIkonPasif]}>
                <Text style={styles.hedefSeciciIkonYazi}>📚</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.hedefSeciciBaslik, !hedefUniversite && styles.hedefSeciciBaslikPasif]}>Bölüm ekle</Text>
                <Text style={[styles.hedefSeciciAlt, secilenProgram && styles.hedefSeciciAltSecili]} numberOfLines={1}>
                  {secilenProgram
                    ? `${secilenProgram.bolumAdi}${secilenProgram.programDetay ? ' ' + secilenProgram.programDetay : ''}`
                    : hedefUniversite ? 'Hedef bölümünü seç' : 'Önce üniversite seç'}
                </Text>
              </View>
              {!hedefUniversite ? (
                <Text style={styles.hedefSeciciKilit}>🔒</Text>
              ) : secilenProgram ? (
                <View style={styles.hedefSeciciDegistir}>
                  <Text style={styles.hedefSeciciDegistirYazi}>Değiştir</Text>
                </View>
              ) : (
                <Text style={styles.hedefSeciciEkle}>＋</Text>
              )}
            </TouchableOpacity>

            {/* Seçilen program özet kartı */}
            {secilenProgram && (
              <View style={styles.programOzetKart}>
                <View style={styles.programOzetSatir}>
                  <Text style={styles.programOzetEtiket}>Üniversite</Text>
                  <Text style={styles.programOzetDeger} numberOfLines={2}>{secilenProgram.universiteAdi}</Text>
                </View>
                <View style={styles.programOzetAyirici} />
                <View style={styles.programOzetSatir}>
                  <Text style={styles.programOzetEtiket}>Bölüm</Text>
                  <Text style={styles.programOzetDeger} numberOfLines={2}>{secilenProgram.bolumAdi}</Text>
                </View>
                {secilenProgram.tabanSiralama_2025 && (
                  <>
                    <View style={styles.programOzetAyirici} />
                    <View style={styles.programOzetSatir}>
                      <Text style={styles.programOzetEtiket}>2025 Taban Sıralama</Text>
                      <Text style={[styles.programOzetDeger, styles.programOzetVurgu]}>
                        {isNaN(Number(secilenProgram.tabanSiralama_2025))
                          ? 'Dolmadı'
                          : Number(secilenProgram.tabanSiralama_2025).toLocaleString('tr-TR')}
                      </Text>
                    </View>
                  </>
                )}
                {secilenProgram.tabanPuan_2025 && (
                  <>
                    <View style={styles.programOzetAyirici} />
                    <View style={styles.programOzetSatir}>
                      <Text style={styles.programOzetEtiket}>2025 Taban Puan</Text>
                      <Text style={[styles.programOzetDeger, styles.programOzetVurgu]}>
                        {parseFloat(secilenProgram.tabanPuan_2025).toFixed(2)}
                      </Text>
                    </View>
                  </>
                )}
                {secilenProgram.ucretBurs && (
                  <>
                    <View style={styles.programOzetAyirici} />
                    <View style={styles.programOzetSatir}>
                      <Text style={styles.programOzetEtiket}>Burs/Ücret</Text>
                      <Text style={styles.programOzetDeger}>{secilenProgram.ucretBurs}</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Üniversite Seçici Modal */}
            <Modal
              visible={uniModalAcik}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setUniModalAcik(false)}
            >
              <UniSeciciModal
                arama={uniArama}
                setArama={setUniArama}
                onSec={(uni) => {
                  setHedefUniversite(uni);
                  setSecilenProgram(null);
                  setUniModalAcik(false);
                }}
                onKapat={() => setUniModalAcik(false)}
              />
            </Modal>

            {/* Bölüm Seçici Modal */}
            <Modal
              visible={bolumModalAcik}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setBolumModalAcik(false)}
            >
              <BolumSeciciModal
                universiteAdi={hedefUniversite}
                puanTuru={puanTuru}
                arama={bolumArama}
                setArama={setBolumArama}
                secilenProgramId={secilenProgram?.programId || null}
                onSec={(program) => {
                  setSecilenProgram(program);
                  setBolumModalAcik(false);
                }}
                onKapat={() => setBolumModalAcik(false)}
              />
            </Modal>
            </>
            )}
          </View>
        )}

        {/* ===== ADIM 5: Çalışma Planı ===== */}
        {adim === 5 && (
          <View>
            <Text style={styles.bolumBaslik}>
              Haftada kaç gün çalışacaksın?
            </Text>
            {HAFTA_CALISMA.map((h) => (
              <SelectCard key={h.deger} baslik={h.baslik} alt={h.alt}
                secili={haftaCalisma === h.deger}
                onPress={() => setHaftaCalisma(h.deger)} />
            ))}

            <Text style={[styles.bolumBaslik, { marginTop: 28 }]}>
              Günlük soru hedefin
            </Text>
            <Text style={styles.altBaslik}>
              Her gün kaç soru çözmek istersin?
            </Text>
            {GUNLUK_SORU_SECENEKLERI.map((g) => (
              <SelectCard key={g.deger} baslik={g.baslik} alt={g.alt}
                secili={gunlukSoru === g.deger && ozelSoru === ''}
                onPress={() => { setGunlukSoru(g.deger); setOzelSoru(''); }} />
            ))}

            <Text style={[styles.label, { marginTop: 16 }]}>
              Veya özel hedef gir
            </Text>
            <View style={styles.ozelSoruSatir}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="20 – 1000"
                placeholderTextColor={COLORS.textLight}
                value={ozelSoru}
                onChangeText={(t) => {
                  setOzelSoru(t);
                  setGunlukSoru(0);
                }}
                keyboardType="number-pad"
              />
              {ozelSoru !== '' && (
                <LinearGradient
                  colors={[COLORS.primary, COLORS.accent]}
                  style={styles.ozelOnay}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.ozelOnayYazi}>✓</Text>
                </LinearGradient>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Alt Butonlar */}
      <View style={styles.altAlan}>
        {adim > 1 && (
          <TouchableOpacity onPress={geri} style={styles.geriButon}>
            <Text style={styles.geriButonYazi}>← Geri</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={adim === TOPLAM_ADIM ? tamamla : ileri}
          disabled={yukleniyor}
          style={{ flex: 1 }}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            style={styles.ileriButon}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            {yukleniyor ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.ileriButonYazi}>
                {adim === TOPLAM_ADIM ? 'Planımı Oluştur ✨' : 'Devam Et'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Üniversite Seçici Modal Bileşeni ─────────────────────────────────────────
interface UniSeciciModalProps {
  arama: string;
  setArama: (t: string) => void;
  onSec: (uni: string) => void;
  onKapat: () => void;
}

const UniSeciciModal = React.memo(({ arama, setArama, onSec, onKapat }: UniSeciciModalProps) => {
  const filtrelenmis = useMemo(() => universiteAramaYap(arama), [arama]);

  const renderItem = useCallback(({ item }: { item: string }) => (
    <TouchableOpacity
      style={modalStyles.listeItem}
      onPress={() => onSec(item)}
      activeOpacity={0.6}
    >
      <View style={modalStyles.listeItemIkon}>
        <Text style={{ fontSize: 16 }}>🏛️</Text>
      </View>
      <Text style={modalStyles.listeItemYazi}>{item}</Text>
      <Text style={modalStyles.listeItemOk}>›</Text>
    </TouchableOpacity>
  ), [onSec]);

  return (
    <SafeAreaView style={modalStyles.container}>
      <View style={modalStyles.header}>
        <View style={modalStyles.headerIkon}>
          <Text style={{ fontSize: 22 }}>🎓</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={modalStyles.headerBaslik}>Üniversite ekle</Text>
          <Text style={modalStyles.headerAlt}>Hedeflediğin üniversiteyi ara ve seç</Text>
        </View>
        <TouchableOpacity onPress={onKapat} style={modalStyles.kapatButon}>
          <Text style={modalStyles.kapatButonYazi}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={modalStyles.aramaKutu}>
        <Text style={modalStyles.aramaIkon}>🔍</Text>
        <TextInput
          style={modalStyles.aramaInput}
          placeholder="Üniversite adı yaz..."
          placeholderTextColor="#9CA3AF"
          value={arama}
          onChangeText={setArama}
          autoFocus
          returnKeyType="search"
        />
        {arama.length > 0 && (
          <TouchableOpacity onPress={() => setArama('')}>
            <Text style={modalStyles.aramaTemizle}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={modalStyles.sonucSayisi}>
        {filtrelenmis.length} üniversite {arama ? 'bulundu' : 'listeleniyor'}
      </Text>

      <FlatList
        data={filtrelenmis}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
      />
    </SafeAreaView>
  );
});

// ─── Bölüm Seçici Modal Bileşeni ──────────────────────────────────────────────
interface BolumSeciciModalProps {
  universiteAdi: string;
  puanTuru: string;
  arama: string;
  setArama: (t: string) => void;
  secilenProgramId: string | null;
  onSec: (program: YokatlasProgram) => void;
  onKapat: () => void;
}

const BolumSeciciModal = React.memo(({
  universiteAdi, puanTuru, arama, setArama, secilenProgramId, onSec, onKapat,
}: BolumSeciciModalProps) => {
  const tumBolumler = useMemo(
    () => bolumListesiGetir(universiteAdi, puanTuru),
    [universiteAdi, puanTuru]
  );

  const filtrelenmis = useMemo(() => {
    if (!arama) return tumBolumler;
    const k = arama.toLocaleLowerCase('tr');
    return tumBolumler.filter(b =>
      b.bolumAdi.toLocaleLowerCase('tr').includes(k) ||
      b.programDetay?.toLocaleLowerCase('tr').includes(k)
    );
  }, [tumBolumler, arama]);

  const renderItem = useCallback(({ item }: { item: YokatlasProgram }) => {
    const secili = secilenProgramId === item.programId;
    return (
      <TouchableOpacity
        style={[modalStyles.bolumItem, secili && modalStyles.bolumItemSecili]}
        onPress={() => onSec(item)}
        activeOpacity={0.6}
      >
        <View style={{ flex: 1 }}>
          <Text style={[modalStyles.bolumItemBaslik, secili && modalStyles.bolumItemBaslikSecili]}>
            {item.bolumAdi}
          </Text>
          {(item.programDetay || item.ucretBurs) ? (
            <Text style={[modalStyles.bolumItemDetay, secili && modalStyles.bolumItemDetaySecili]}>
              {[item.programDetay, item.ucretBurs].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <View style={modalStyles.bolumItemSag}>
          {item.tabanSiralama_2025 ? (
            <Text style={[modalStyles.bolumItemSiralama, secili && modalStyles.bolumItemSiralamaSecili]}>
              {isNaN(Number(item.tabanSiralama_2025))
                ? 'Dolmadı'
                : Number(item.tabanSiralama_2025).toLocaleString('tr-TR')}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }, [secilenProgramId, onSec]);

  return (
    <SafeAreaView style={modalStyles.container}>
      <View style={modalStyles.header}>
        <View style={modalStyles.headerIkon}>
          <Text style={{ fontSize: 22 }}>📚</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={modalStyles.headerBaslik}>Bölüm seç</Text>
          <Text style={modalStyles.headerAlt} numberOfLines={1}>{universiteAdi}</Text>
        </View>
        <TouchableOpacity onPress={onKapat} style={modalStyles.kapatButon}>
          <Text style={modalStyles.kapatButonYazi}>✕</Text>
        </TouchableOpacity>
      </View>

      {tumBolumler.length === 0 ? (
        <View style={modalStyles.bosEkran}>
          <Text style={modalStyles.bosEkranYazi}>
            {puanTuru} puan türünde bu üniversiteye ait bölüm bulunamadı.
          </Text>
        </View>
      ) : (
        <>
          <View style={modalStyles.aramaKutu}>
            <Text style={modalStyles.aramaIkon}>🔍</Text>
            <TextInput
              style={modalStyles.aramaInput}
              placeholder="Bölüm adı ara..."
              placeholderTextColor="#9CA3AF"
              value={arama}
              onChangeText={setArama}
              autoFocus
              returnKeyType="search"
            />
            {arama.length > 0 && (
              <TouchableOpacity onPress={() => setArama('')}>
                <Text style={modalStyles.aramaTemizle}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={modalStyles.bolumListeHeader}>
            <Text style={modalStyles.sonucSayisi}>
              {filtrelenmis.length} bölüm {arama ? 'bulundu' : `— ${puanTuru} puan türü`}
            </Text>
            <Text style={modalStyles.siralamaLabel}>Taban Sıralama</Text>
          </View>

          <FlatList
            data={filtrelenmis}
            keyExtractor={(item) => item.programId}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            getItemLayout={(_, index) => ({ length: 76, offset: 76 * index, index })}
          />
        </>
      )}
    </SafeAreaView>
  );
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerIkon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  headerBaslik: { fontSize: 17, fontWeight: '700', color: '#111827' },
  headerAlt: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  kapatButon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  kapatButonYazi: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  aramaKutu: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#F9FAFB', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    gap: 8,
  },
  aramaIkon: { fontSize: 16 },
  aramaInput: { flex: 1, fontSize: 16, color: '#111827', padding: 0 },
  aramaTemizle: { fontSize: 14, color: '#9CA3AF', paddingHorizontal: 4 },
  sonucSayisi: {
    fontSize: 12, color: '#9CA3AF', fontWeight: '500',
    paddingHorizontal: 20, marginBottom: 4,
  },
  listeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16, height: 64,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  listeItemIkon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  listeItemYazi: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  listeItemOk: { fontSize: 20, color: '#9CA3AF', fontWeight: '300' },
  bolumListeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 4,
  },
  siralamaLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  bolumItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, height: 76,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  bolumItemSecili: { backgroundColor: '#EDE9FE' },
  bolumItemBaslik: { fontSize: 14, fontWeight: '600', color: '#111827' },
  bolumItemBaslikSecili: { color: '#7C3AED' },
  bolumItemDetay: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  bolumItemDetaySecili: { color: '#7C3AED' },
  bolumItemSag: { alignItems: 'flex-end', gap: 4, minWidth: 80 },
  bolumItemSiralama: { fontSize: 13, fontWeight: '700', color: '#374151' },
  bolumItemSiralamaSecili: { color: '#7C3AED' },
  bosEkran: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  bosEkranYazi: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 24, paddingTop: 60,
    paddingBottom: 16, backgroundColor: COLORS.background,
  },
  headerAdim: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  headerBaslik: { fontSize: 18, fontWeight: '800', color: COLORS.primary, marginBottom: 12 },
  progressBar: {
    height: 5, backgroundColor: COLORS.cardBorder,
    borderRadius: 3, overflow: 'hidden',
  },
  progressDolu: { height: 5, borderRadius: 3 },
  icerik: { flex: 1, paddingHorizontal: 24 },
  adimBaslik: {
    fontSize: 22, fontWeight: '800',
    color: COLORS.text, marginTop: 24, marginBottom: 20,
  },
  bolumBaslik: {
    fontSize: 15, fontWeight: '700',
    color: COLORS.text, marginBottom: 12,
  },
  altBaslik: {
    fontSize: 13, color: COLORS.textSecondary,
    marginTop: -8, marginBottom: 12,
  },
  label: {
    fontSize: 14, fontWeight: '700',
    color: COLORS.text, marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.card, borderRadius: 14,
    padding: 16, fontSize: 16, color: COLORS.text,
    borderWidth: 1.5, borderColor: COLORS.cardBorder,
  },
  inputHata: {
    borderColor: COLORS.error,
    backgroundColor: '#FFF5F5',
  },
  hataYazi: {
    fontSize: 12, color: COLORS.error, marginTop: 5,
    marginLeft: 4, fontWeight: '500',
  },
  kvkkKutuHata: {
    borderColor: COLORS.error,
  },
  kvkkHataKutu: {
    marginTop: 8,
  },
  kart: {
    backgroundColor: COLORS.card, borderRadius: 14,
    padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.cardBorder,
  },
  kartSecili: {
    borderColor: COLORS.selectedBorder,
    backgroundColor: COLORS.selectedBackground,
  },
  kartBaslik: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  kartBaslikSecili: { color: COLORS.primary },
  kartAlt: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  kartAltSecili: { color: COLORS.primary },
  kvkkKutu: {
    marginTop: 24, backgroundColor: COLORS.card,
    borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.cardBorder,
    gap: 0,
  },
  kvkkSatir: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ayirici: {
    height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 14,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.cardBorder,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white, flexShrink: 0, marginTop: 1,
  },
  checkboxSecili: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary,
  },
  checkmark: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  kvkkYazi: {
    fontSize: 13, color: COLORS.textSecondary,
    flex: 1, lineHeight: 20,
  },
  kvkkLink: { color: COLORS.primary, fontWeight: '700' },
  infoKutu: {
    backgroundColor: COLORS.primaryLight, borderRadius: 14,
    padding: 14, marginTop: 12,
  },
  infoYazi: { fontSize: 13, color: COLORS.primary, lineHeight: 20 },
  ozelSoruSatir: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  ozelOnay: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  ozelOnayYazi: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  altAlan: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12,
    padding: 24, paddingBottom: 44,
    backgroundColor: COLORS.background,
    borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
  },
  geriButon: {
    padding: 18, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.cardBorder,
    justifyContent: 'center',
  },
  geriButonYazi: { color: COLORS.textSecondary, fontWeight: '600' },
  ileriButon: { borderRadius: 16, padding: 18, alignItems: 'center' },
  ileriButonYazi: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  // İkili buton (Evet/Hayır, Üniversite/Sıralama)
  ikiliButoSatir: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  ikiliButon: {
    flex: 1, padding: 14, borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1.5, borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  ikiliButonSecili: {
    borderColor: COLORS.selectedBorder,
    backgroundColor: COLORS.selectedBackground,
  },
  ikiliButonYazi: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  ikiliButonYaziSecili: { color: COLORS.primary },
  uyariKutu: {
    backgroundColor: '#FFF7ED', borderRadius: 14,
    padding: 14, marginTop: 4, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#FED7AA',
  },
  uyariYazi: { fontSize: 13, color: '#C2410C', lineHeight: 20 },
  // Adım 4 – Hedef seçici
  hedefSeciciKart: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.card, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: COLORS.cardBorder,
  },
  hedefSeciciKartPasif: { opacity: 0.55 },
  hedefSeciciIkon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  hedefSeciciIkonAktif: { backgroundColor: COLORS.primary + '22' },
  hedefSeciciIkonPasif: { backgroundColor: COLORS.cardBorder },
  hedefSeciciIkonYazi: { fontSize: 20 },
  hedefSeciciBaslik: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  hedefSeciciBaslikPasif: { color: COLORS.textSecondary },
  hedefSeciciAlt: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  hedefSeciciAltSecili: { color: COLORS.primary, fontWeight: '600' },
  hedefSeciciEkle: { fontSize: 22, color: COLORS.textSecondary, marginRight: 2 },
  hedefSeciciKilit: { fontSize: 18, marginRight: 2 },
  hedefSeciciDegistir: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: COLORS.primaryLight, borderRadius: 8,
  },
  hedefSeciciDegistirYazi: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  // Seçilen program özet kartı
  programOzetKart: {
    backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.primary + '44',
    overflow: 'hidden', marginTop: 4,
  },
  programOzetSatir: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 16,
  },
  programOzetAyirici: { height: 1, backgroundColor: COLORS.cardBorder },
  programOzetEtiket: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', flexShrink: 0 },
  programOzetDeger: { fontSize: 14, color: COLORS.text, fontWeight: '600', textAlign: 'right', flex: 1 },
  programOzetVurgu: { color: COLORS.primary, fontSize: 16 },
});
