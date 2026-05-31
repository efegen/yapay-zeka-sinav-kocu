import { Alert, AlertButton, Platform } from 'react-native';

/**
 * Platformlar arası bildirim/uyarı gösterimi.
 *
 * React Native Web'de `Alert.alert` boş bir no-op'tur (hiçbir şey göstermez),
 * bu yüzden web'de validasyon ve hata mesajları görünmez. Bu yardımcı native'de
 * normal `Alert.alert`'i, web'de ise `window.alert` / `window.confirm`'ü kullanır.
 *
 * @param baslik  Uyarı başlığı
 * @param mesaj   Açıklama metni (opsiyonel)
 * @param butonlar  Native Alert butonları. Web'de birden fazla buton varsa
 *                  onay diyaloğu (confirm) gösterilir; "cancel" olmayan buton
 *                  onaya, "cancel" butonu iptale bağlanır.
 */
export function bildir(baslik: string, mesaj?: string, butonlar?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(baslik, mesaj, butonlar);
    return;
  }

  const metin = mesaj ? `${baslik}\n\n${mesaj}` : baslik;

  // Onay gerektiren çok butonlu diyalog → confirm
  if (butonlar && butonlar.length > 1) {
    const onaylandi = window.confirm(metin);
    if (onaylandi) {
      butonlar.find((b) => b.style !== 'cancel')?.onPress?.();
    } else {
      butonlar.find((b) => b.style === 'cancel')?.onPress?.();
    }
    return;
  }

  // Tek butonlu / bilgilendirme uyarısı
  window.alert(metin);
  butonlar?.[0]?.onPress?.();
}
