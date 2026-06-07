// useSohbetler — AI Koç çoklu sohbet deposu (AsyncStorage destekli).
// Tek doğruluk kaynağı: ekran aktif sohbetin mesajlarını buradan okur ve buraya yazar.
// Değişmez kural: yüklendikten sonra her zaman bir aktif sohbet vardır (boş olabilir → karşılama).
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ayristir,
  eskiSohbetAnahtari,
  kaliciSohbetler,
  sirala,
  sohbetAnahtari,
  yeniSohbetId,
  type Balon,
  type Sohbet,
} from '../services/sohbetService';

type Guncelleyici = Balon[] | ((m: Balon[]) => Balon[]);

function bosSohbet(): Sohbet {
  const t = Date.now();
  return { id: yeniSohbetId(), baslik: null, mesajlar: [], olusturuldu: t, guncellendi: t };
}

export function useSohbetler(uid?: string) {
  const [sohbetler, setSohbetler] = useState<Sohbet[]>([]);
  const [aktifId, _setAktifId] = useState<string | null>(null);
  const [yuklendi, setYuklendi] = useState(false);

  // Senkron okuma için ref aynaları (async/closure'larda güncel değer gerekir).
  const aktifIdRef = useRef<string | null>(null);
  const sohbetlerRef = useRef<Sohbet[]>([]);
  useEffect(() => {
    sohbetlerRef.current = sohbetler;
  }, [sohbetler]);

  const setAktif = useCallback((id: string | null) => {
    aktifIdRef.current = id;
    _setAktifId(id);
  }, []);

  // ── Yükle + eski tek-sohbet kaydını taşı ──
  useEffect(() => {
    let iptal = false;
    setYuklendi(false);
    if (!uid) {
      // Oturum henüz çözülmediyse: bellekte boş bir aktif sohbet — sohbet çalışır, kalıcıya yazılmaz.
      const yeni = bosSohbet();
      setSohbetler([yeni]);
      setAktif(yeni.id);
      return;
    }
    (async () => {
      let liste: Sohbet[] = [];
      try {
        const [ham, eski] = await Promise.all([
          AsyncStorage.getItem(sohbetAnahtari(uid)),
          AsyncStorage.getItem(eskiSohbetAnahtari(uid)),
        ]);
        liste = sirala(ayristir(ham, eski));
      } catch {}
      if (iptal) return;
      if (liste.length) {
        setSohbetler(liste);
        setAktif(liste[0].id); // en güncel sohbeti sürdür
      } else {
        const yeni = bosSohbet();
        setSohbetler([yeni]);
        setAktif(yeni.id); // geçmiş yok → boş aktif sohbet (karşılama ekranı)
      }
      setYuklendi(true);
    })();
    return () => {
      iptal = true;
    };
  }, [uid, setAktif]);

  // ── Her değişimde kalıcıya yaz ──
  useEffect(() => {
    if (!uid || !yuklendi) return;
    AsyncStorage.setItem(sohbetAnahtari(uid), JSON.stringify(kaliciSohbetler(sohbetler))).catch(
      () => {}
    );
  }, [sohbetler, uid, yuklendi]);

  const aktif = sohbetler.find((s) => s.id === aktifId) ?? null;
  const aktifMesajlar = aktif?.mesajlar ?? [];

  /** Aktif sohbetin mesajlarını güncelle (dizi ya da güncelleyici fonksiyon). */
  const mesajlariGuncelle = useCallback((next: Guncelleyici) => {
    const id = aktifIdRef.current;
    if (!id) return;
    setSohbetler((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              mesajlar: typeof next === 'function' ? next(s.mesajlar) : next,
              guncellendi: Date.now(),
            }
          : s
      )
    );
  }, []);

  /** Yeni boş sohbet başlat. Aktif sohbet zaten boşsa (karşılama) bir şey yapma. */
  const yeniSohbet = useCallback(() => {
    const mevcut = sohbetlerRef.current.find((s) => s.id === aktifIdRef.current);
    if (mevcut && mevcut.mesajlar.length === 0) return;
    const yeni = bosSohbet();
    setSohbetler((prev) => [yeni, ...prev]);
    setAktif(yeni.id);
  }, [setAktif]);

  /** Geçmişten bir sohbeti aç. */
  const sohbetSec = useCallback(
    (id: string) => {
      if (sohbetlerRef.current.some((s) => s.id === id)) setAktif(id);
    },
    [setAktif]
  );

  /** Tüm geçmişi sil, tek bir boş sohbetle baştan başla. */
  const tumunuTemizle = useCallback(() => {
    const yeni = bosSohbet();
    setSohbetler([yeni]);
    setAktif(yeni.id);
  }, [setAktif]);

  return {
    /** Geçmiş çekmecesi için: boşları elenmiş, en yeniden eskiye sıralı. */
    gecmis: sirala(sohbetler),
    aktifId,
    aktifMesajlar,
    yuklendi,
    mesajlariGuncelle,
    yeniSohbet,
    sohbetSec,
    tumunuTemizle,
  };
}
