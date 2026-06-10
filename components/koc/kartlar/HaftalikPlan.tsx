// Haftalık Plan — tarih şeridi + gerçek tarihli gün kutucuklarıyla genişletilebilir
// program listesi + "Takvime aktar" CTA. Gün tarihleri planGunTarihleri ile atanır;
// takvime aktarma modalıyla birebir aynı eşleme (kartta görünen = eklenen).
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { HaftalikPlanVeri } from '../../../types/koc';
import { KartBaslik } from '../KartBaslik';
import { Press } from '../Press';
import { KocButon } from '../KocButon';
import { RADIUS } from '../tokens';
import { planGunTarihleri, sureEtiketi, tarihAraligiKisalt } from '../../../utils/planAktar';
import { PlaniTakvimeAktarModal } from '../PlaniTakvimeAktarModal';
import type { KartBilesenProps } from './_ortak';

const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Hesaplanan gün tarihlerinden kısa aralık etiketi ("10–19 Haziran").
function aralikEtiketi(tarihler: Date[]): string {
  if (!tarihler.length) return '';
  const a = tarihler[0];
  const b = tarihler[tarihler.length - 1];
  if (a.getTime() === b.getTime()) return `${a.getDate()} ${AYLAR[a.getMonth()]}`;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
    return `${a.getDate()}–${b.getDate()} ${AYLAR[b.getMonth()]}`;
  return `${a.getDate()} ${AYLAR[a.getMonth()]} – ${b.getDate()} ${AYLAR[b.getMonth()]}`;
}

function ayniGun(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function HaftalikPlan({ veri, onGuncelle, onAksiyon }: KartBilesenProps<HaftalikPlanVeri>) {
  const acik = veri.acikGun ?? -1;
  const gunler = veri.gunler ?? [];
  const [modalAcik, setModalAcik] = useState(false);

  const bugun = useMemo(() => new Date(), []);
  const tarihler = useMemo(() => planGunTarihleri(gunler, bugun), [gunler, bugun]);
  const tarihSerit = tarihAraligiKisalt(veri.tarihAraligi) || aralikEtiketi(tarihler);

  function toggle(i: number) {
    onGuncelle({ ...veri, acikGun: acik === i ? -1 : i });
  }

  // CTA: günler varsa takvime-aktar modalını aç; yoksa eski aksiyon davranışı.
  function ctaBas() {
    if (gunler.length > 0) {
      setModalAcik(true);
    } else {
      onAksiyon(veri.cta?.aksiyon, veri.cta?.etiket);
    }
  }

  return (
    <View>
      <KartBaslik icon="calendar" baslik={veri.baslik} alt={veri.ozet} />
      {(!!tarihSerit || gunler.length > 1) && (
        <View style={s.metaSerit}>
          <Ionicons name="calendar-clear-outline" size={12} color={COLORS.primary} />
          <Text style={s.metaMetin} numberOfLines={1}>
            {tarihSerit}
            {tarihSerit && gunler.length > 1 ? '  ·  ' : ''}
            {gunler.length > 1 ? `${gunler.length} gün` : ''}
          </Text>
        </View>
      )}
      <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 }}>
        {gunler.map((g, i) => {
          const on = acik === i;
          const renk = g.renk ?? COLORS.primary;
          const tarih = tarihler[i];
          const buMu = !!tarih && ayniGun(tarih, bugun);
          const isSayisi = (g.isler ?? []).length;
          return (
            <View key={i} style={i > 0 && s.ustCizgi}>
              <Press scale={0.99} onPress={() => toggle(i)} style={s.gunSatir}>
                <View style={[s.gunKutu, buMu && s.gunKutuBugun]}>
                  <Text style={[s.gunAd, buMu && s.gunAdBugun]}>{tarih ? GUN_KISA[tarih.getDay()] : String(g.gun ?? '').slice(0, 3)}</Text>
                  {!!tarih && <Text style={[s.gunNo, buMu && s.gunNoBugun]}>{tarih.getDate()}</Text>}
                </View>
                <View style={[s.renkCubuk, { backgroundColor: renk }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.odak} numberOfLines={1}>
                    {g.odak}
                  </Text>
                  {(!!g.sure || isSayisi > 0) && (
                    <View style={s.altSatir}>
                      {!!g.sure && <Ionicons name="timer-outline" size={11} color={COLORS.textLight} />}
                      <Text style={s.altBilgi} numberOfLines={1}>
                        {sureEtiketi(g.sure)}
                        {g.sure && isSayisi > 0 ? ' · ' : ''}
                        {isSayisi > 0 ? `${isSayisi} görev` : ''}
                      </Text>
                    </View>
                  )}
                </View>
                <Ionicons name={on ? 'chevron-down' : 'chevron-forward'} size={15} color={COLORS.textLight} />
              </Press>
              {on && isSayisi > 0 && (
                <View style={[s.isler, { borderLeftColor: renk + '33' }]}>
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
      {veri.eklendi ? (
        <View style={s.eklendiBtn}>
          <Ionicons name="checkmark-circle" size={17} color={COLORS.success} />
          <Text style={s.eklendiMetin}>Takvime eklendi</Text>
        </View>
      ) : (
        // Günler varsa CTA modelce verilmese de "Takvime ekle" butonu hep gösterilir.
        (gunler.length > 0 || !!veri.cta) && (
          <KocButon
            etiket={veri.cta?.etiket || 'Takvime ekle'}
            ikon="calendar"
            varyant="gradyan"
            onPress={ctaBas}
            style={{ marginHorizontal: 12, marginBottom: 14 }}
          />
        )
      )}

      <PlaniTakvimeAktarModal
        acik={modalAcik}
        veri={veri}
        onKapat={() => setModalAcik(false)}
        onEklendi={() => onGuncelle({ ...veri, eklendi: true })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  metaSerit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: COLORS.primaryLight + '99',
  },
  metaMetin: { flex: 1, fontSize: 11.5, fontWeight: '700', color: COLORS.primary },
  ustCizgi: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  gunSatir: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8, paddingHorizontal: 3 },
  gunKutu: {
    width: 42,
    paddingVertical: 5,
    borderRadius: RADIUS.kucukKutu,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  gunKutuBugun: { backgroundColor: COLORS.primary },
  gunAd: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  gunAdBugun: { color: 'rgba(255,255,255,0.85)' },
  gunNo: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginTop: -1 },
  gunNoBugun: { color: '#fff' },
  renkCubuk: { width: 4, height: 28, borderRadius: 99 },
  odak: { fontSize: 13.5, fontWeight: '600', color: COLORS.text },
  altSatir: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  altBilgi: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '500' },
  eklendiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 12,
    marginBottom: 14,
    paddingVertical: 12,
    borderRadius: RADIUS.buton,
    backgroundColor: COLORS.success + '14',
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  eklendiMetin: { fontSize: 13.5, fontWeight: '700', color: COLORS.success },
  isler: { marginLeft: 23, borderLeftWidth: 2, paddingLeft: 30, paddingRight: 6, paddingBottom: 10 },
  isSatir: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  nokta: { width: 5, height: 5, borderRadius: 99, marginTop: 6 },
  isMetin: { flex: 1, fontSize: 12.5, lineHeight: 18, color: COLORS.text, fontWeight: '500' },
});
