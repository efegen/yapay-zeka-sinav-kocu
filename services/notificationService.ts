// Proaktif bildirim servisi — yerel (local) zamanlanmış bildirimler.
// ------------------------------------------------------------------
// Mimari notu: AI proxy (Cloudflare Worker) DURUMSUZ ve cron'suz olduğundan sunucu
// taraflı push (FCM/APNs) altyapısı yok. Bunun yerine bildirimler CİHAZDA zamanlanır.
// Öğrenci uygulamayı her açtığında "inaktiflik" hatırlatıcısı İLERİ bir tarihe yeniden
// kurulur; böylece bildirim YALNIZCA öğrenci N gün hiç uğramazsa tetiklenir
// (rapor PB-TC-01: "3 gün girmeyeni tespit → kişiselleştirilmiş motivasyon bildirimi").
// Web'de yerel zamanlama desteklenmediği için tüm fonksiyonlar sessizce no-op olur.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Sabit kimlikler → her kurulumda eskisini değiştir (çoğalmasın).
const INAKTIFLIK_ID = 'inaktiflik-hatirlatici';
const GUNLUK_ID = 'gunluk-hatirlatici';

const INAKTIFLIK_GUN = 3; // kaç gün görünmezse hatırlat (rapor: 3 gün)
const GUNLUK_SAAT = 19; // akşam motivasyon hatırlatması saati (0-23)

// Uygulama ön plandayken de bildirim banner'ı görünsün.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Yerel bildirim yalnızca native'de (iOS/Android) çalışır; web'de no-op. */
const destekli = () => Platform.OS !== 'web';

/** Adın yalnızca ilk kelimesi (bildirim hitabı için): "Ezgi Öner" → "Ezgi". */
function ilkAd(isim?: string): string | null {
  const t = isim?.trim();
  return t ? t.split(/\s+/)[0] : null;
}

/** İzin durumunu kontrol eder; gerekiyorsa (ve tekrar sorulabiliyorsa) bir kez ister. */
export async function bildirimIzniIste(): Promise<boolean> {
  if (!destekli()) return false;
  try {
    const mevcut = await Notifications.getPermissionsAsync();
    let durum = mevcut.status;
    if (durum !== 'granted' && mevcut.canAskAgain) {
      durum = (await Notifications.requestPermissionsAsync()).status;
    }
    if (durum !== 'granted') return false;
    // Android'de bildirimlerin görünmesi için bir kanal gerekir.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Hatırlatmalar',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    return true;
  } catch (e) {
    console.warn('[notification] izin hatası:', e);
    return false;
  }
}

/**
 * İnaktiflik hatırlatıcısını İLERİ tarihe (yeniden) kurar. Öğrenci uygulamaya her
 * uğradığında bu çağrılır → saat sıfırlanır; bildirim ancak öğrenci INAKTIFLIK_GUN
 * boyunca hiç uğramazsa tetiklenir.
 */
export async function inaktiflikHatirlaticisiKur(isim?: string): Promise<void> {
  if (!destekli()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(INAKTIFLIK_ID);
  } catch {
    // zaten yoksa sorun değil
  }
  const ad = ilkAd(isim);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: INAKTIFLIK_ID,
      content: {
        title: ad ? `${ad}, seni özledik 💜` : 'Seni özledik 💜',
        body: `${INAKTIFLIK_GUN} gündür mola verdin. Bugün küçük bir adım at — 25 dakikalık tek bir Pomodoro bile yeter!`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: INAKTIFLIK_GUN * 24 * 60 * 60,
        repeats: false,
      },
    });
  } catch (e) {
    console.warn('[notification] inaktiflik hatırlatıcısı kurulamadı:', e);
  }
}

/** Her akşam tekrarlayan kısa motivasyon hatırlatması. */
export async function gunlukHatirlaticiKur(): Promise<void> {
  if (!destekli()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(GUNLUK_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: GUNLUK_ID,
      content: {
        title: 'Bugünkü çalışman seni bekliyor 📚',
        body: 'Günü kapatmadan hedefine bir adım daha. Planına göz at!',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: GUNLUK_SAAT,
        minute: 0,
      },
    });
  } catch (e) {
    console.warn('[notification] günlük hatırlatıcı kurulamadı:', e);
  }
}

/** Giriş/açılış sonrası tüm proaktif bildirimleri (izin alarak) planlar. */
export async function proaktifBildirimleriPlanla(isim?: string): Promise<void> {
  if (!destekli()) return;
  const izin = await bildirimIzniIste();
  if (!izin) return; // izin yoksa sessizce vazgeç (rapor: alternatif = uygulama içi kartlar)
  await inaktiflikHatirlaticisiKur(isim);
  await gunlukHatirlaticiKur();
}

/** Çıkışta tüm zamanlanmış bildirimleri temizler. */
export async function tumBildirimleriIptalEt(): Promise<void> {
  if (!destekli()) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[notification] bildirimler iptal edilemedi:', e);
  }
}
