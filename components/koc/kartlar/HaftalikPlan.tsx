// Haftalık Plan — 7 günlük genişletilebilir program + "Takvime aktar" CTA.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { HaftalikPlanVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { Press } from '../Press';
import { KocButon } from '../KocButon';
import { RADIUS } from '../tokens';
import type { KartBilesenProps } from './_ortak';

export function HaftalikPlan({ veri, onGuncelle, onAksiyon }: KartBilesenProps<HaftalikPlanVeri>) {
  const acik = veri.acikGun ?? -1;
  const gunler = veri.gunler ?? [];

  function toggle(i: number) {
    onGuncelle({ ...veri, acikGun: acik === i ? -1 : i });
  }

  return (
    <View>
      <KartBaslik
        icon="calendar"
        baslik={veri.baslik}
        alt={veri.ozet}
        sag={
          veri.tarihAraligi ? (
            <View style={s.tarihRozet}>
              <Text style={s.tarihMetin}>{veri.tarihAraligi}</Text>
            </View>
          ) : undefined
        }
      />
      <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 }}>
        {gunler.map((g, i) => {
          const on = acik === i;
          const renk = g.renk ?? COLORS.primary;
          return (
            <View key={i} style={i > 0 && s.ustCizgi}>
              <Press scale={0.99} onPress={() => toggle(i)} style={s.gunSatir}>
                <View style={s.gunKutu}>
                  <Text style={[s.gunMetin, g.bugun ? s.gunBugun : null]}>{g.gun}</Text>
                </View>
                <View style={[s.renkCubuk, { backgroundColor: renk }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.odak} numberOfLines={1}>
                    {g.odak}
                  </Text>
                  <Text style={s.sure}>{g.sure}</Text>
                </View>
                <Ionicons name={on ? 'chevron-down' : 'chevron-forward'} size={15} color={COLORS.textLight} />
              </Press>
              {on && (
                <View style={s.isler}>
                  {(g.isler ?? []).map((j, k) => (
                    <View key={k} style={s.isSatir}>
                      <View style={[s.nokta, { backgroundColor: renk }]} />
                      <Text style={s.isMetin}>{j}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
      {!!veri.cta && (
        <KocButon
          etiket={veri.cta.etiket}
          ikon="calendar"
          varyant="gradyan"
          onPress={() => onAksiyon(veri.cta?.aksiyon, veri.cta?.etiket)}
          style={{ marginHorizontal: 12, marginBottom: 14 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  tarihRozet: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.hap, paddingVertical: 3, paddingHorizontal: 9 },
  tarihMetin: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  ustCizgi: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  gunSatir: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, paddingHorizontal: 3 },
  gunKutu: { width: 38, alignItems: 'center' },
  gunMetin: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, borderRadius: 9, paddingVertical: 4, paddingHorizontal: 8, overflow: 'hidden' },
  gunBugun: { color: '#fff', backgroundColor: COLORS.primary },
  renkCubuk: { width: 4, height: 26, borderRadius: 99 },
  odak: { fontSize: 13.5, fontWeight: '600', color: COLORS.text },
  sure: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '500' },
  isler: { paddingLeft: 53, paddingRight: 6, paddingBottom: 10 },
  isSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  nokta: { width: 5, height: 5, borderRadius: 99 },
  isMetin: { fontSize: 12.5, color: COLORS.text, fontWeight: '500' },
});
