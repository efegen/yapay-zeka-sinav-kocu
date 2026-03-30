import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { COLORS } from '../../constants/colors';
import { usePlanlar } from '../../contexts/PlanContext';
import { tarihFormatla } from '../../utils/tarih';

const BOŞ_FORM = { tarih: '', ders: '', konu: '', sure: '' };

export default function Takvim() {
  const { planlar, planEkle, planSil } = usePlanlar();
  const [modalAcik, setModalAcik] = useState(false);
  const [form, setForm] = useState(BOŞ_FORM);
  const [hatalar, setHatalar] = useState<Partial<typeof BOŞ_FORM>>({});
  const [secilenTarih, setSecilenTarih] = useState(new Date());
  const [tarihPickerAcik, setTarihPickerAcik] = useState(false);

  function dogrula() {
    const yeni: Partial<typeof BOŞ_FORM> = {};
    if (!form.tarih.trim()) yeni.tarih = 'Tarih gerekli';
    if (!form.ders.trim()) yeni.ders = 'Ders gerekli';
    if (!form.konu.trim()) yeni.konu = 'Konu gerekli';
    if (!form.sure.trim()) yeni.sure = 'Süre gerekli';
    setHatalar(yeni);
    return Object.keys(yeni).length === 0;
  }

  function kaydet() {
    if (!dogrula()) return;
    planEkle(form);
    setForm(BOŞ_FORM);
    setHatalar({});
    setModalAcik(false);
  }

  function iptal() {
    setForm(BOŞ_FORM);
    setHatalar({});
    setSecilenTarih(new Date());
    setTarihPickerAcik(false);
    setModalAcik(false);
  }

  function tarihDegisti(_: DateTimePickerEvent, tarih?: Date) {
    if (Platform.OS === 'android') setTarihPickerAcik(false);
    if (tarih) {
      setSecilenTarih(tarih);
      setForm((prev) => ({ ...prev, tarih: tarihFormatla(tarih) }));
      if (hatalar.tarih) setHatalar((prev) => ({ ...prev, tarih: undefined }));
    }
  }

  function sil(id: string) {
    planSil(id);
  }

  return (
    <View style={styles.ekran}>
      {/* Başlık */}
      <View style={styles.baslik}>
        <Text style={styles.baslikMetin}>Çalışma Planım</Text>
        <TouchableOpacity style={styles.ekleButon} onPress={() => setModalAcik(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Liste */}
      {planlar.length === 0 ? (
        <View style={styles.bos}>
          <Ionicons name="calendar-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.bosMetin}>Henüz plan eklenmedi</Text>
          <Text style={styles.bosAlt}>Sağ üstteki + butonuna tıkla</Text>
        </View>
      ) : (
        <FlatList
          data={planlar}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.liste}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.kart}>
              <View style={styles.kartSol}>
                <View style={styles.dersRozetSarici}>
                  <Text style={styles.dersRozet}>{item.ders.slice(0, 2).toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.kartOrta}>
                <Text style={styles.dersAdi}>{item.ders}</Text>
                <Text style={styles.konuAdi}>{item.konu}</Text>
                <View style={styles.altBilgi}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.textLight} />
                  <Text style={styles.altMetin}>{item.tarih}</Text>
                  <Ionicons name="time-outline" size={12} color={COLORS.textLight} style={{ marginLeft: 8 }} />
                  <Text style={styles.altMetin}>{item.sure} dk</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => sil(item.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Bottom Sheet Modal */}
      <Modal visible={modalAcik} animationType="slide" transparent statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={iptal} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheet}>
          <View style={styles.sheetTutamac} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetBaslik}>Yeni Plan Ekle</Text>

            {/* Tarih seçici */}
            <View style={styles.alan}>
              <Text style={styles.alanEtiket}>Tarih</Text>
              <TouchableOpacity
                style={[styles.inputSarici, hatalar.tarih ? styles.inputHatali : null]}
                onPress={() => setTarihPickerAcik(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={16} color={COLORS.textLight} style={styles.inputIkon} />
                <Text style={[styles.input, !form.tarih && { color: COLORS.textLight }]}>
                  {form.tarih || 'Tarih seç'}
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color={COLORS.textLight} />
              </TouchableOpacity>
              {hatalar.tarih ? <Text style={styles.hataMetin}>{hatalar.tarih}</Text> : null}
            </View>

            {/* iOS: inline picker */}
            {tarihPickerAcik && Platform.OS === 'ios' && (
              <View style={styles.iosPickerSarici}>
                <DateTimePicker
                  value={secilenTarih}
                  mode="date"
                  display="spinner"
                  onChange={tarihDegisti}
                  locale="tr-TR"
                  minimumDate={new Date(2020, 0, 1)}
                  maximumDate={new Date(2030, 11, 31)}
                  themeVariant="light"
                />
                <TouchableOpacity
                  style={styles.iosPickerTamam}
                  onPress={() => setTarihPickerAcik(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.iosPickerTamamMetin}>Tamam</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Android: native dialog */}
            {tarihPickerAcik && Platform.OS === 'android' && (
              <DateTimePicker
                value={secilenTarih}
                mode="date"
                display="default"
                onChange={tarihDegisti}
                minimumDate={new Date(2020, 0, 1)}
                maximumDate={new Date(2030, 11, 31)}
              />
            )}
            <Alan
              etiket="Ders"
              ikon="book-outline"
              deger={form.ders}
              onChange={(v) => setForm({ ...form, ders: v })}
              placeholder="örn. Matematik"
              hata={hatalar.ders}
            />
            <Alan
              etiket="Konu"
              ikon="document-text-outline"
              deger={form.konu}
              onChange={(v) => setForm({ ...form, konu: v })}
              placeholder="örn. Türev"
              hata={hatalar.konu}
            />
            <Alan
              etiket="Süre (dakika)"
              ikon="time-outline"
              deger={form.sure}
              onChange={(v) => setForm({ ...form, sure: v })}
              placeholder="örn. 45"
              hata={hatalar.sure}
              keyboardType="numeric"
            />

            <View style={styles.butonlar}>
              <TouchableOpacity style={styles.iptalButon} onPress={iptal} activeOpacity={0.8}>
                <Text style={styles.iptalMetin}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.kaydetButon} onPress={kaydet} activeOpacity={0.8}>
                <Text style={styles.kaydetMetin}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Alan({
  etiket,
  ikon,
  deger,
  onChange,
  placeholder,
  hata,
  keyboardType,
}: {
  etiket: string;
  ikon: React.ComponentProps<typeof Ionicons>['name'];
  deger: string;
  onChange: (v: string) => void;
  placeholder: string;
  hata?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.alan}>
      <Text style={styles.alanEtiket}>{etiket}</Text>
      <View style={[styles.inputSarici, hata ? styles.inputHatali : null]}>
        <Ionicons name={ikon} size={16} color={COLORS.textLight} style={styles.inputIkon} />
        <TextInput
          style={styles.input}
          value={deger}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          keyboardType={keyboardType ?? 'default'}
          returnKeyType="next"
        />
      </View>
      {hata ? <Text style={styles.hataMetin}>{hata}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: COLORS.background },

  baslik: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  baslikMetin: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  ekleButon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  liste: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },

  bos: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  bosMetin: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  bosAlt: { fontSize: 13, color: COLORS.textLight },

  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 12,
  },
  kartSol: { justifyContent: 'center' },
  dersRozetSarici: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dersRozet: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  kartOrta: { flex: 1, gap: 2 },
  dersAdi: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  konuAdi: { fontSize: 13, color: COLORS.textSecondary },
  altBilgi: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 3 },
  altMetin: { fontSize: 12, color: COLORS.textLight },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  sheetTutamac: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetBaslik: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 20 },

  alan: { marginBottom: 14 },
  alanEtiket: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  inputSarici: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    height: 48,
  },
  inputHatali: { borderColor: COLORS.error },
  inputIkon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  hataMetin: { fontSize: 12, color: COLORS.error, marginTop: 4, marginLeft: 4 },

  butonlar: { flexDirection: 'row', gap: 10, marginTop: 8 },
  iptalButon: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  iptalMetin: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  kaydetButon: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  kaydetMetin: { fontSize: 15, fontWeight: '600', color: COLORS.white },

  iosPickerSarici: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 14,
    overflow: 'hidden',
  },
  iosPickerTamam: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  iosPickerTamamMetin: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
});
