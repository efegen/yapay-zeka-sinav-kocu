// Formül Kartı — gradyan başlık + formüller (serif) + altın kural + kaydet butonu.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { FormulKartiVeri } from '../../../types/koc';
import { Press } from '../Press';
import { Gradyan } from '../Gradyan';
import { Formul, iceriyorMat } from '../Formul';
import { ZenginMetin } from '../ZenginMetin';
import { SERIF, RADIUS } from '../tokens';
import type { KartBilesenProps } from './_ortak';

// Formül değeri matematik mi? iceriyorMat'a ek olarak çıplak üst/alt simge ve süslü parantez de:
// tüm ifade $...$ ile sarılacağından "x^{n-1}", "a_i", "\frac{}{}" gibi değerler render olur.
const formulMat = (s?: string) => !!s && (iceriyorMat(s) || /[\^_{}]/.test(s));

export function FormulKarti({ veri, onGuncelle }: KartBilesenProps<FormulKartiVeri>) {
  const kaydedildi = !!veri.kaydedildi;
  return (
    <View>
      <Gradyan style={s.baslik}>
        <View style={s.ikonKutu}>
          <Ionicons name="sparkles" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.ust}>Formül Kartı · {veri.ders}</Text>
          <Text style={s.konu}>{veri.konu}</Text>
        </View>
      </Gradyan>

      <View style={{ paddingHorizontal: 15, paddingTop: 6, paddingBottom: 4 }}>
        {(veri.formuller ?? []).map((f, i) => (
          <View key={i} style={[s.formul, i > 0 && s.ustCizgi]}>
            {/* Formül değeri tek bir matematik ifadesi: math içeriyorsa tamamını KaTeX ile sar/render et. */}
            {formulMat(f.sol) ? (
              <View style={{ flex: 1 }}>
                <Formul icerik={f.sol} renk={COLORS.text} boyut={15} tamMat />
                {!!f.not && <Text style={s.not}>({f.not})</Text>}
              </View>
            ) : (
              <Text style={s.sol}>
                {f.sol} {!!f.not && <Text style={s.not}>({f.not})</Text>}
              </Text>
            )}
            <Ionicons name="arrow-forward" size={16} color={COLORS.textLight} />
            {formulMat(f.sag) ? (
              <View style={{ minWidth: 30 }}>
                <Formul icerik={f.sag} renk={COLORS.accent} boyut={17} kalin hizala="center" tamMat />
              </View>
            ) : (
              <Text style={s.sag}>{f.sag}</Text>
            )}
          </View>
        ))}
      </View>

      {!!veri.altinKural && (
        <View style={s.kuralKutu}>
          <View style={s.kuralBaslikSatir}>
            <Ionicons name="flash" size={13} color={COLORS.amber} />
            <Text style={s.kuralBaslik}>ALTIN KURAL</Text>
          </View>
          {iceriyorMat(veri.altinKural) ? (
            <Formul icerik={veri.altinKural} renk={COLORS.text} boyut={12.5} />
          ) : (
            <ZenginMetin style={s.kuralMetin} kalinRenk={COLORS.text}>
              {veri.altinKural}
            </ZenginMetin>
          )}
        </View>
      )}

      {veri.kaydedilebilir && (
        <Press
          onPress={() => onGuncelle({ ...veri, kaydedildi: true })}
          style={[s.kaydet, kaydedildi ? s.kaydedildi : { backgroundColor: COLORS.primary }]}
        >
          <Ionicons
            name={kaydedildi ? 'checkmark' : 'download-outline'}
            size={15}
            color={kaydedildi ? COLORS.success : '#fff'}
          />
          <Text style={[s.kaydetMetin, { color: kaydedildi ? COLORS.success : '#fff' }]}>
            {kaydedildi ? 'Kart defterine kaydedildi' : 'Kartı kaydet'}
          </Text>
        </Press>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  baslik: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  ikonKutu: { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  ust: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  konu: { fontSize: 16, fontWeight: '800', color: '#fff' },
  formul: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  ustCizgi: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  sol: { flex: 1, fontFamily: SERIF, fontSize: 15.5, color: COLORS.text },
  not: { color: COLORS.textLight, fontSize: 11 },
  sag: { minWidth: 30, textAlign: 'center', fontFamily: SERIF, fontSize: 18, fontWeight: '700', color: COLORS.accent },
  kuralKutu: { marginHorizontal: 14, marginTop: 6, paddingVertical: 10, paddingHorizontal: 13, borderRadius: RADIUS.kutu, backgroundColor: '#F59E0B14', borderWidth: 1, borderColor: '#F59E0B33' },
  kuralBaslikSatir: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  kuralBaslik: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, color: COLORS.amber },
  kuralMetin: { fontSize: 12.5, lineHeight: 18, color: COLORS.text },
  kaydet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, margin: 12, paddingVertical: 12, borderRadius: RADIUS.buton },
  kaydedildi: { backgroundColor: '#10B9811A', borderWidth: 1, borderColor: '#10B98133' },
  kaydetMetin: { fontSize: 13.5, fontWeight: '700' },
});
