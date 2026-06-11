// KartRenderer — tip'e göre doğru kart bileşenini çizer; avatardan hizalı beyaz sarmal içinde.
// Bilinmeyen tip atlanır (ileri uyumluluk). Kart iç-state'i onKartGuncelle ile yukarı taşınır.
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import type { Kart } from '../../types/koc';
import { RADIUS, GOLGE_KART } from './tokens';

import { PomodoroPlani } from './kartlar/PomodoroPlani';
import { KonuAdimlari } from './kartlar/KonuAdimlari';
import { MiniDenemeAnalizi } from './kartlar/MiniDenemeAnalizi';
import { CozumAdimlari } from './kartlar/CozumAdimlari';
import { Ipucu } from './kartlar/Ipucu';
import { Momentum } from './kartlar/Momentum';
import { MolaRecetesi } from './kartlar/MolaRecetesi';
import { DenemeKiyasi } from './kartlar/DenemeKiyasi';
import { EnBuyukKazanc } from './kartlar/EnBuyukKazanc';
import { HaftalikPlan } from './kartlar/HaftalikPlan';
import { FormulKarti } from './kartlar/FormulKarti';
import { OturumZamanPlani } from './kartlar/OturumZamanPlani';
import { SinavCantasi } from './kartlar/SinavCantasi';
import { HedefOzeti } from './kartlar/HedefOzeti';
import { Projeksiyon } from './kartlar/Projeksiyon';
import { GunlukBrifing } from './kartlar/GunlukBrifing';
import { BaglamSeridi } from './kartlar/BaglamSeridi';
import { NiyetIzgarasi } from './kartlar/NiyetIzgarasi';
import { TakvimAksiyonu } from './kartlar/TakvimAksiyonu';

interface KartRendererProps {
  kart: Kart;
  onKartGuncelle: (yeniKart: Kart) => void;
  onAksiyon: (aksiyon?: string, mesaj?: string) => void;
  /** Avatar boşluğu olmadan tam genişlik (dev önizleme için). */
  cikti?: boolean;
}

function icerikSec(kart: Kart, onAksiyon: KartRendererProps['onAksiyon'], onKartGuncelle: KartRendererProps['onKartGuncelle']) {
  switch (kart.tip) {
    case 'pomodoroPlani':
      return <PomodoroPlani veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'konuAdimlari':
      return <KonuAdimlari veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'miniDenemeAnalizi':
      return <MiniDenemeAnalizi veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'cozumAdimlari':
      return <CozumAdimlari veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'ipucu':
      return <Ipucu veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'momentum':
      return <Momentum veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'molaRecetesi':
      return <MolaRecetesi veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'denemeKiyasi':
      return <DenemeKiyasi veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'enBuyukKazanc':
      return <EnBuyukKazanc veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'haftalikPlan':
      return <HaftalikPlan veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'formulKarti':
      return <FormulKarti veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'oturumZamanPlani':
      return <OturumZamanPlani veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'sinavCantasi':
      return <SinavCantasi veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'hedefOzeti':
      return <HedefOzeti veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'projeksiyon':
      return <Projeksiyon veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'gunlukBrifing':
      return <GunlukBrifing veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'baglamSeridi':
      return <BaglamSeridi veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'niyetIzgarasi':
      return <NiyetIzgarasi veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    case 'takvimAksiyonu':
      return <TakvimAksiyonu veri={kart.veri} onAksiyon={onAksiyon} onGuncelle={(v) => onKartGuncelle({ ...kart, veri: v })} />;
    default:
      return null;
  }
}

export function KartRenderer({ kart, onKartGuncelle, onAksiyon, cikti }: KartRendererProps) {
  const icerik = icerikSec(kart, onAksiyon, onKartGuncelle);
  if (!icerik) return null;

  return (
    <View style={s.sarmal}>
      {!cikti && <View style={s.bosluk} />}
      <View style={s.kart}>{icerik}</View>
    </View>
  );
}

const s = StyleSheet.create({
  sarmal: { flexDirection: 'row', gap: 9 },
  bosluk: { width: 28 },
  kart: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.kart,
    borderTopLeftRadius: 6,
    overflow: 'hidden',
    ...GOLGE_KART,
  },
});
