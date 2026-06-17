import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  hedefNetHesapla,
  findReferencePrograms,
  HedefNetBilgisi,
} from './yokatlasService';
import type { DenemeSonuc } from '../models/deneme';
import type { NedenKategori } from '../utils/hataAnalizi';

export type NetFetchStatus = 'pending' | 'done' | 'not_needed' | 'failed';

/**
 * Hedef net bilgisini lokal veri üzerinden hesaplayıp Firestore'a yazar.
 * hedefTuru === 'universite' → programId ile doğrudan hesaplar.
 * hedefTuru === 'siralama'   → referans programlar üzerinden ortalama alır.
 */
export const syncHedefNetBilgisi = async (
  uid: string,
  programId?: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const userData = snap.data() as {
      hedefTuru?: string;
      hedefSiralama?: number;
      puanTuru?: string;
    };

    let netBilgisi: HedefNetBilgisi | null = null;

    if (userData.hedefTuru === 'siralama') {
      const hedefSiralama = userData.hedefSiralama;
      const puanTuru = userData.puanTuru as 'SAY' | 'EA' | 'SOZ' | 'DIL' | undefined;

      if (!hedefSiralama || !puanTuru) {
        await updateDoc(userRef, { netFetchStatus: 'failed' as NetFetchStatus });
        return;
      }

      let referanslar = findReferencePrograms(hedefSiralama, puanTuru);
      if (referanslar.length === 0) {
        referanslar = findReferencePrograms(hedefSiralama, puanTuru, 5000);
      }
      if (referanslar.length === 0) {
        referanslar = findReferencePrograms(hedefSiralama, puanTuru, 20000);
      }
      if (referanslar.length === 0) {
        await updateDoc(userRef, { netFetchStatus: 'failed' as NetFetchStatus });
        return;
      }

      const sonuclar: HedefNetBilgisi[] = [];
      for (const ref of referanslar.slice(0, 3)) {
        const net = hedefNetHesapla(ref.programId);
        if (net) sonuclar.push(net);
      }

      if (sonuclar.length === 0) {
        await updateDoc(userRef, { netFetchStatus: 'failed' as NetFetchStatus });
        return;
      }

      // Alan bazında aritmetik ortalama
      const ortalama: Record<string, number> = {};
      const sayaclar: Record<string, number> = {};
      for (const net of sonuclar) {
        for (const [key, val] of Object.entries(net)) {
          if (key === 'kaynak_yil' || typeof val !== 'number') continue;
          ortalama[key] = (ortalama[key] ?? 0) + val;
          sayaclar[key] = (sayaclar[key] ?? 0) + 1;
        }
      }
      for (const key of Object.keys(ortalama)) {
        ortalama[key] = Math.round((ortalama[key] / sayaclar[key]) * 10) / 10;
      }

      netBilgisi = { ...ortalama, kaynak_yil: 2025 } as HedefNetBilgisi;
    } else {
      // hedefTuru === 'universite'
      netBilgisi = programId ? hedefNetHesapla(programId) : null;
    }

    if (netBilgisi) {
      await updateDoc(userRef, {
        hedefNetBilgisi: netBilgisi,
        netFetchStatus: 'done' as NetFetchStatus,
      });
    } else {
      await updateDoc(userRef, { netFetchStatus: 'failed' as NetFetchStatus });
    }
  } catch (err) {
    console.error('[firestoreService] syncHedefNetBilgisi hatası:', err);
  }
};

/**
 * Öğrencinin son giriş/açılış zamanını günceller. Proaktif bildirim ve davranışsal
 * analiz (rapor PB-TC-01: "son giriş tarihi kontrolü") bu alana dayanır. Best-effort:
 * hata olsa da akışı bozmaz.
 */
export const sonGirisGuncelle = async (uid: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), { sonGirisTarihi: Timestamp.now() });
  } catch (err) {
    console.error('[firestoreService] sonGirisGuncelle hatası:', err);
  }
};

/**
 * Status'u sıfırlayıp senkronizasyonu yeniden çalıştırır.
 */
export const manuelSyncHedefNet = async (
  uid: string,
  programId?: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { netFetchStatus: 'pending' as NetFetchStatus });
    await syncHedefNetBilgisi(uid, programId);
  } catch (err) {
    console.error('[firestoreService] manuelSyncHedefNet hatası:', err);
  }
};

/**
 * Giriş sonrası net bilgisi eksikse senkronize et.
 */
export const checkAndRetrySyncIfNeeded = async (
  uid: string,
  programId?: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data() as { netFetchStatus?: NetFetchStatus };

    if (data.netFetchStatus !== 'done') {
      await syncHedefNetBilgisi(uid, programId);
    }
  } catch (err) {
    console.error('[firestoreService] checkAndRetrySyncIfNeeded hatası:', err);
  }
};

// ─────────────────────────────────────────────
// Görev (task) types & Firestore helpers
// ─────────────────────────────────────────────

export type GorevTip = 'planned' | 'anytime';
// Görevin türü: normal çalışma planı ya da deneme sınavı.
export type GorevTur = 'plan' | 'deneme';
// Plan adımının türü: okuma/tekrar adımı, soru çözme adımı ya da mola.
export type AdimTip = 'oku' | 'soru' | 'mola';

// Bir planın içindeki küçük çalışma adımı (kendi süresi ve sayacı olur).
export interface Adim {
  tip: AdimTip;
  ad: string;
  dk: number; // adıma ayrılan süre (dakika)
  done: boolean;
  soru?: number; // yalnızca tip === 'soru' ise: soru sayısı
}

export interface Gorev {
  id: string;
  baslik: string;
  ders?: string; // ders (renk/etiket için): Matematik, Fizik, ...
  tur?: GorevTur; // plan | deneme (varsayılan: plan)
  sure: number; // minutes
  tip: GorevTip;
  tarih: Timestamp | null; // only set when tip === 'planned'
  tamamlandi: boolean;
  olusturmaTarihi: Timestamp;
  adimlar?: Adim[]; // plan adımları (adım sayaçlı çalışma akışı)
}

// Firestore, `undefined` alanları reddeder; yazmadan önce ayıkla.
function temizle<T extends Record<string, unknown>>(obj: T): T {
  const cikti = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (cikti as Record<string, unknown>)[k] = v;
  }
  return cikti;
}

export const gorevEkle = async (
  uid: string,
  gorev: Omit<Gorev, 'id' | 'olusturmaTarihi'>
): Promise<string> => {
  const kolRef = collection(db, 'users', uid, 'gorevler');
  const ref = await addDoc(kolRef, {
    ...temizle(gorev),
    olusturmaTarihi: Timestamp.now(),
  });
  return ref.id;
};

/**
 * Belirli bir takvim gününün görevlerini döndürür.
 *
 * Not: Sorgular bilinçli olarak TEK ALANLIDIR (composite index GEREKTİRMEZ);
 * `tip`/`tamamlandi` filtresi ve sıralama JS tarafında yapılır. Böylece projeye
 * Firestore'da elle index oluşturma zorunluluğu binmez.
 */
export const gunGorevleriniGetir = async (
  uid: string,
  tarih: Date
): Promise<{ planned: Gorev[]; anytime: Gorev[] }> => {
  const kolRef = collection(db, 'users', uid, 'gorevler');

  const gunBaslangic = new Date(tarih);
  gunBaslangic.setHours(0, 0, 0, 0);
  const gunBitis = new Date(tarih);
  gunBitis.setHours(23, 59, 59, 999);

  // Tek-alan tarih aralığı (anytime görevler tarih=null olduğu için kapsam dışı).
  const plannedQuery = query(
    kolRef,
    where('tarih', '>=', Timestamp.fromDate(gunBaslangic)),
    where('tarih', '<=', Timestamp.fromDate(gunBitis))
  );
  // Tek-alan eşitlik.
  const anytimeQuery = query(kolRef, where('tip', '==', 'anytime'));

  const [plannedSnap, anytimeSnap] = await Promise.all([
    getDocs(plannedQuery),
    getDocs(anytimeQuery),
  ]);

  const planned: Gorev[] = plannedSnap.docs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((d) => ({ id: d.id, ...(d.data() as any) }) as Gorev)
    .filter((g) => g.tip === 'planned')
    .sort((a, b) => (a.tarih?.toMillis() ?? 0) - (b.tarih?.toMillis() ?? 0));

  const anytime: Gorev[] = anytimeSnap.docs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((d) => ({ id: d.id, ...(d.data() as any) }) as Gorev)
    .filter((g) => !g.tamamlandi)
    .sort((a, b) => (a.olusturmaTarihi?.toMillis() ?? 0) - (b.olusturmaTarihi?.toMillis() ?? 0));

  return { planned, anytime };
};

/**
 * Bir takvim ayındaki tüm planlanmış görevleri getirir (ızgara noktaları +
 * gün ajandası için). `ay` 0-tabanlıdır (0 = Ocak).
 *
 * Tek-alan tarih aralığı sorgusu → composite index gerektirmez.
 */
export const ayGorevleriniGetir = async (
  uid: string,
  yil: number,
  ay: number
): Promise<Gorev[]> => {
  const kolRef = collection(db, 'users', uid, 'gorevler');

  const ayBaslangic = new Date(yil, ay, 1, 0, 0, 0, 0);
  const aySonu = new Date(yil, ay + 1, 0, 23, 59, 59, 999);

  const ayQuery = query(
    kolRef,
    where('tarih', '>=', Timestamp.fromDate(ayBaslangic)),
    where('tarih', '<=', Timestamp.fromDate(aySonu))
  );

  const snap = await getDocs(ayQuery);
  return (
    snap.docs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d) => ({ id: d.id, ...(d.data() as any) }) as Gorev)
      .filter((g) => g.tip === 'planned')
      .sort((a, b) => (a.tarih?.toMillis() ?? 0) - (b.tarih?.toMillis() ?? 0))
  );
};

export const gorevGetir = async (
  uid: string,
  gorevId: string
): Promise<Gorev | null> => {
  const gorevRef = doc(db, 'users', uid, 'gorevler', gorevId);
  const snap = await getDoc(gorevRef);
  if (!snap.exists()) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { id: snap.id, ...(snap.data() as any) };
};

export const gorevTamamla = async (
  uid: string,
  gorevId: string,
  tamamlandi: boolean
): Promise<void> => {
  const gorevRef = doc(db, 'users', uid, 'gorevler', gorevId);
  await updateDoc(gorevRef, { tamamlandi });
};

// Plan adımlarını (ve istenirse toplam süreyi) Firestore'a yazar.
export const adimlariGuncelle = async (
  uid: string,
  gorevId: string,
  adimlar: Adim[]
): Promise<void> => {
  const gorevRef = doc(db, 'users', uid, 'gorevler', gorevId);
  const sure = adimlar.reduce((t, a) => t + (a.dk || 0), 0);
  const tumuBitti = adimlar.length > 0 && adimlar.every((a) => a.done);
  await updateDoc(gorevRef, { adimlar, sure, tamamlandi: tumuBitti });
};

/**
 * Bir plan adımı tamamlandığında "Toplam Emek" sayaçlarını artırır.
 * - `odakSaniye`: adımda GERÇEKTEN geçen süre. Erken "Bitir"de tüm süre değil,
 *   yalnızca sayaçta geçen kadarı yazılır (mola süresi odak sayılmaz → 0 gelir).
 * - `soru`: yalnızca soru adımlarında çözülen soru sayısı.
 * Süre saniye olarak biriktirilir; gösterimde dakika/saate çevrilir.
 */
export const calismaIstatistikEkle = async (
  uid: string,
  { odakSaniye, soru }: { odakSaniye: number; soru: number }
): Promise<void> => {
  const patch: Record<string, unknown> = {};
  if (odakSaniye > 0) patch.toplamOdakSaniye = increment(odakSaniye);
  if (soru > 0) patch.toplamSoru = increment(soru);
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, 'users', uid), patch);
};

export const gorevSil = async (uid: string, gorevId: string): Promise<void> => {
  const gorevRef = doc(db, 'users', uid, 'gorevler', gorevId);
  await deleteDoc(gorevRef);
};

// AI Koç "takvimi temizle" eyleminin kapsamı: bugün / bu hafta / tüm planlar.
export type TakvimKapsam = 'bugun' | 'hafta' | 'tumu';

// Bugünü içeren takvim haftasının sınırları (Pazartesi 00:00 – Pazar 23:59:59.999).
// Takvim ızgarası Pazartesi-başlangıçlı (pazartesiIndeksi = (jsGun + 6) % 7) — onunla hizalı.
function buHaftaAraligi(ref: Date): { pazartesi: Date; pazar: Date } {
  const pazartesiyeKadar = (ref.getDay() + 6) % 7; // Pazartesi'ye kaç gün geri
  const pazartesi = new Date(ref);
  pazartesi.setHours(0, 0, 0, 0);
  pazartesi.setDate(pazartesi.getDate() - pazartesiyeKadar);
  const pazar = new Date(pazartesi);
  pazar.setDate(pazar.getDate() + 6);
  pazar.setHours(23, 59, 59, 999);
  return { pazartesi, pazar };
}

/**
 * Koçun "takvimi boşalt" eylemi için kapsamdaki PLAN görevlerini getirir.
 * Deneme (sınav) olayları HARİÇ tutulur — onlar "program" sayılmaz, kazara silinmesin.
 * - 'bugun': bugüne tarihli planlı görevler.
 * - 'hafta': bu takvim haftasının (Pzt–Paz) planlı görevleri.
 * - 'tumu' : tarihten bağımsız tüm görevler (planlı + istediğin-zaman).
 */
export const kapsamGorevleriniGetir = async (
  uid: string,
  kapsam: TakvimKapsam
): Promise<Gorev[]> => {
  if (kapsam === 'bugun') {
    const { planned } = await gunGorevleriniGetir(uid, new Date());
    return planned.filter((g) => g.tur !== 'deneme');
  }

  const kolRef = collection(db, 'users', uid, 'gorevler');

  if (kapsam === 'hafta') {
    // Tek-alan tarih aralığı (composite index gerektirmez); istediğin-zaman tarih=null → kapsam dışı.
    const { pazartesi, pazar } = buHaftaAraligi(new Date());
    const haftaQuery = query(
      kolRef,
      where('tarih', '>=', Timestamp.fromDate(pazartesi)),
      where('tarih', '<=', Timestamp.fromDate(pazar))
    );
    const snap = await getDocs(haftaQuery);
    return (
      snap.docs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as Gorev)
        .filter((g) => g.tip === 'planned' && g.tur !== 'deneme')
    );
  }

  // 'tumu' — tarih farketmez (planlı + istediğin-zaman); yalnız deneme hariç.
  const snap = await getDocs(kolRef);
  return (
    snap.docs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d) => ({ id: d.id, ...(d.data() as any) }) as Gorev)
      .filter((g) => g.tur !== 'deneme')
  );
};

/**
 * Birden çok görevi tek seferde siler (Firestore batch). Boş/yinelenen id'ler ayıklanır;
 * 500'lük batch sınırına karşı parçalanır. Silinen görev sayısını döner.
 */
export const gorevleriSil = async (uid: string, ids: string[]): Promise<number> => {
  const benzersiz = Array.from(new Set(ids.filter(Boolean)));
  if (!benzersiz.length) return 0;
  const PARCA = 400; // 500 sınırının altında güvenli pay
  for (let i = 0; i < benzersiz.length; i += PARCA) {
    const toplu = writeBatch(db);
    for (const id of benzersiz.slice(i, i + PARCA)) {
      toplu.delete(doc(db, 'users', uid, 'gorevler', id));
    }
    await toplu.commit();
  }
  return benzersiz.length;
};

// ─────────────────────────────────────────────
// Deneme sonuçları (mock exam results)
// ─────────────────────────────────────────────
// Takvimdeki "deneme" görevi (GorevTur = 'deneme') bir takvim olayıdır; buradaki
// kayıt ise ders bazlı D/Y ve net taşıyan gerçek sonuç kaydıdır. Ayrı koleksiyonda
// tutulur ki takvim sorgularını kirletmesin.

export const denemeEkle = async (
  uid: string,
  deneme: Omit<DenemeSonuc, 'id' | 'olusturmaTarihi'>
): Promise<string> => {
  const kolRef = collection(db, 'users', uid, 'denemeler');
  const ref = await addDoc(kolRef, {
    ...temizle(deneme as unknown as Record<string, unknown>),
    olusturmaTarihi: Timestamp.now(),
  });
  return ref.id;
};

// En yeni deneme önce olacak şekilde tüm denemeleri getirir (tek-alan, index gerektirmez).
export const denemeleriGetir = async (uid: string): Promise<DenemeSonuc[]> => {
  const kolRef = collection(db, 'users', uid, 'denemeler');
  const snap = await getDocs(kolRef);
  return snap.docs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((d) => ({ id: d.id, ...(d.data() as any) }) as DenemeSonuc)
    .sort((a, b) => (b.tarih?.toMillis() ?? 0) - (a.tarih?.toMillis() ?? 0));
};

export const denemeGuncelle = async (
  uid: string,
  denemeId: string,
  patch: Partial<Omit<DenemeSonuc, 'id' | 'olusturmaTarihi'>>
): Promise<void> => {
  const ref = doc(db, 'users', uid, 'denemeler', denemeId);
  await updateDoc(ref, temizle(patch as Record<string, unknown>));
};

export const denemeSil = async (uid: string, denemeId: string): Promise<void> => {
  const ref = doc(db, 'users', uid, 'denemeler', denemeId);
  await deleteDoc(ref);
};

// ─────────────────────────────────────────────
// Yanlış defteri (mistake notebook)
// ─────────────────────────────────────────────
// Öğrencinin yanlış yaptığı konu/soruları biriktirir; tekrar edip "öğrendim" deyince
// arşivlenir. Konu, koç hafızasına (zorlandığın konular) da işlenir — bağlantı ekranda kurulur.
export interface Yanlis {
  id: string;
  ders: string; // "AYT Matematik"
  konu: string; // "Türev"
  not?: string; // serbest açıklama / sorunun özeti
  kategori?: NedenKategori; // dikkatsizlik | sure | bilgi (opsiyonel)
  gorsel?: string; // ekli görsel — sıkıştırılmış JPEG data URL (opsiyonel)
  ogrenildi: boolean; // tekrar edilip öğrenildi mi
  olusturmaTarihi: Timestamp;
}

export const yanlisEkle = async (
  uid: string,
  yanlis: Omit<Yanlis, 'id' | 'olusturmaTarihi'>
): Promise<string> => {
  const kolRef = collection(db, 'users', uid, 'yanlislar');
  const ref = await addDoc(kolRef, {
    ...temizle(yanlis as unknown as Record<string, unknown>),
    olusturmaTarihi: Timestamp.now(),
  });
  return ref.id;
};

// En yeni önce (tek-alan, index gerektirmez).
export const yanlislariGetir = async (uid: string): Promise<Yanlis[]> => {
  const kolRef = collection(db, 'users', uid, 'yanlislar');
  const snap = await getDocs(kolRef);
  return snap.docs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((d) => ({ id: d.id, ...(d.data() as any) }) as Yanlis)
    .sort((a, b) => (b.olusturmaTarihi?.toMillis() ?? 0) - (a.olusturmaTarihi?.toMillis() ?? 0));
};

export const yanlisGuncelle = async (
  uid: string,
  id: string,
  patch: Partial<Omit<Yanlis, 'id' | 'olusturmaTarihi'>>
): Promise<void> => {
  await updateDoc(doc(db, 'users', uid, 'yanlislar', id), temizle(patch as Record<string, unknown>));
};

export const yanlisSil = async (uid: string, id: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid, 'yanlislar', id));
};

// ─────────────────────────────────────────────
// Profil güncelleme + KVKK veri dışa aktarımı
// ─────────────────────────────────────────────

/** Profil dokümanının verilen alanlarını günceller (undefined alanlar ayıklanır). */
export const profilGuncelle = async (
  uid: string,
  patch: Record<string, unknown>
): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), temizle(patch));
};

/** KVKK: kullanıcının tüm verisini tek bir nesnede toplar (dışa aktarım için). */
export const kullaniciVerisiniTopla = async (uid: string): Promise<Record<string, unknown>> => {
  const [profilSnap, denemeSnap, gorevSnap, yanlisSnap, hafizaSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDocs(collection(db, 'users', uid, 'denemeler')),
    getDocs(collection(db, 'users', uid, 'gorevler')),
    getDocs(collection(db, 'users', uid, 'yanlislar')),
    getDoc(doc(db, 'users', uid, 'koc', 'hafiza')),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const belgeler = (snap: any) => snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  // Yanlış görselleri (base64) dosyayı şişirmesin diye yalnızca "var mı" olarak yazılır.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yanlislar = yanlisSnap.docs.map((d: any) => {
    const { gorsel, ...digerleri } = d.data();
    return { id: d.id, ...digerleri, gorselVar: !!gorsel };
  });
  return {
    disaAktarmaTarihi: new Date().toISOString(),
    profil: profilSnap.exists() ? profilSnap.data() : null,
    denemeler: belgeler(denemeSnap),
    gorevler: belgeler(gorevSnap),
    yanlislar,
    kocHafiza: hafizaSnap.exists() ? hafizaSnap.data() : null,
  };
};
