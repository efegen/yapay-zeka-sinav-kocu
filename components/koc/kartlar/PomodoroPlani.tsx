// Pomodoro Planı — dikey zaman çizelgesi (odak/mola düğümleri) + gradyan CTA.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { PomodoroPlaniVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { KocButon } from '../KocButon';
import type { KartBilesenProps } from './_ortak';

export function PomodoroPlani({ veri, onAksiyon }: KartBilesenProps<PomodoroPlaniVeri>) {
  const bloklar = veri.bloklar ?? [];
  return (
    <View>
      <KartBaslik icon="timer" baslik={veri.baslik} alt={veri.ozet} />
      <View style={{ paddingHorizontal: 15, paddingTop: 6, paddingBottom: 12 }}>
        {bloklar.map((b, i) => {
          const mola = b.tip === 'mola';
          const renk = b.renk ?? COLORS.primary;
          return (
            <View key={i} style={s.satir}>
              <Text style={[s.sure, { color: mola ? COLORS.textLight : renk }]}>{b.sure}</Text>
              <View style={s.dugumSutun}>
                {i < bloklar.length - 1 && <View style={s.cizgi} />}
                <View
                  style={[
                    s.dugum,
                    mola
                      ? { width: 7, height: 7, backgroundColor: COLORS.cardBorder }
                      : { width: 11, height: 11, backgroundColor: renk, borderWidth: 2, borderColor: '#fff' },
                  ]}
                />
              </View>
              <Text style={[s.ders, mola ? s.dersMola : s.dersOdak]}>{b.ders}</Text>
            </View>
          );
        })}
      </View>
      {!!veri.cta && (
        <KocButon
          etiket={veri.cta.etiket}
          ikon="play"
          varyant="gradyan"
          onPress={() => onAksiyon(veri.cta?.aksiyon, veri.cta?.etiket)}
          style={{ marginHorizontal: 12, marginBottom: 12 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7 },
  sure: { width: 52, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  dugumSutun: { width: 12, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  cizgi: { position: 'absolute', top: 16, bottom: -7, width: 2, backgroundColor: COLORS.cardBorder },
  dugum: { borderRadius: 99 },
  ders: { flex: 1, fontSize: 13.5 },
  dersOdak: { fontWeight: '600', color: COLORS.text },
  dersMola: { fontWeight: '500', color: COLORS.textSecondary },
});
