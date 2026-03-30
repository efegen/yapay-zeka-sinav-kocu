import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { kayitOl } from '../services/authService';
import { diplomaEtkisiAcikla } from '../utils/puanHesapla';

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
];

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

  // Adım 2
  const [sinif, setSinif] = useState('');
  const [okulTuru, setOkulTuru] = useState('');
  const [diplomaNotu, setDiplomaNotu] = useState('');

  // Adım 3
  const [puanTuru, setPuanTuru] = useState('');

  // Adım 4
  const [hedefUniversite, setHedefUniversite] = useState('');
  const [hedefBolum, setHedefBolum] = useState('');

  // Adım 5
  const [haftaCalisma, setHaftaCalisma] = useState(0);
  const [gunlukSoru, setGunlukSoru] = useState(0);
  const [ozelSoru, setOzelSoru] = useState('');

  const ileriValidasyon = (): boolean => {
    if (adim === 1) {
      if (!isim.trim() || !email.trim() || !sifre.trim()) {
        Alert.alert('Eksik bilgi', 'Tüm alanları doldurun.'); return false;
      }
      if (sifre.length < 6) {
        Alert.alert('Zayıf şifre', 'Şifre en az 6 karakter olmalı.'); return false;
      }
      if (!kvkk1 || !kvkk2) {
        Alert.alert('KVKK Onayı', 'Devam etmek için her iki onayı da vermelisiniz.'); return false;
      }
    }
    if (adim === 2) {
      if (!sinif || !okulTuru) {
        Alert.alert('Eksik bilgi', 'Sınıf ve okul türü seçin.'); return false;
      }
      const not = parseFloat(diplomaNotu);
      if (!diplomaNotu || isNaN(not) || not < 0 || not > 100) {
        Alert.alert('Geçersiz not', 'Diploma notunu 0-100 arası girin.'); return false;
      }
    }
    if (adim === 3 && !puanTuru) {
      Alert.alert('Eksik bilgi', 'Puan türü seçin.'); return false;
    }
    if (adim === 4 && (!hedefUniversite.trim() || !hedefBolum.trim())) {
      Alert.alert('Eksik bilgi', 'Hedef üniversite ve bölüm girin.'); return false;
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
        puanTuru,
        hedefUniversite: hedefUniversite.trim(),
        hedefBolum: hedefBolum.trim(),
        hedefProgramId: '',
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
            <TextInput style={styles.input} placeholder="Adın Soyadın"
              placeholderTextColor={COLORS.textLight}
              value={isim} onChangeText={setIsim} />

            <Text style={styles.label}>E-posta</Text>
            <TextInput style={styles.input} placeholder="ornek@mail.com"
              placeholderTextColor={COLORS.textLight}
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Şifre</Text>
            <TextInput style={styles.input} placeholder="En az 6 karakter"
              placeholderTextColor={COLORS.textLight}
              value={sifre} onChangeText={setSifre} secureTextEntry />

            <View style={styles.kvkkKutu}>
              <TouchableOpacity
                style={styles.kvkkSatir}
                onPress={() => setKvkk1(!kvkk1)}
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
                onPress={() => setKvkk2(!kvkk2)}
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
          </View>
        )}

        {/* ===== ADIM 2: Okul Bilgileri ===== */}
        {adim === 2 && (
          <View>
            <Text style={styles.bolumBaslik}>Sınıf</Text>
            {SINIFLAR.map((s) => (
              <SelectCard key={s.deger} baslik={s.baslik} alt={s.alt}
                secili={sinif === s.deger}
                onPress={() => setSinif(s.deger)} />
            ))}

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
                  💡 {diplomaEtkisiAcikla(parseFloat(diplomaNotu))}
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

        {/* ===== ADIM 4: Hedef (şimdilik serbest metin) ===== */}
        {adim === 4 && (
          <View>
            <Text style={styles.label}>Hedef Üniversite</Text>
            <TextInput
              style={styles.input}
              placeholder="ör. Boğaziçi Üniversitesi"
              placeholderTextColor={COLORS.textLight}
              value={hedefUniversite}
              onChangeText={setHedefUniversite}
            />

            <Text style={styles.label}>Hedef Bölüm</Text>
            <TextInput
              style={styles.input}
              placeholder="ör. Bilgisayar Mühendisliği"
              placeholderTextColor={COLORS.textLight}
              value={hedefBolum}
              onChangeText={setHedefBolum}
            />

            <View style={styles.infoKutu}>
              <Text style={styles.infoYazi}>
                🎯 YÖK Atlas 2025 verileriyle hedefine ne kadar yakın
                olduğunu analiz edeceğiz. Diploma notun da bu hesaba
                dahil edilir.
              </Text>
            </View>
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
});
