"""
YÖK Atlas Net Sihirbazı — Bölüm Bazında Net Çekici
---------------------------------------------------
universiteler.json dosyasındaki her program için YÖK Atlas'tan
TYT ve AYT net ortalamalarını çeker, bolumAdi+puanTuru bazında
ortalar ve assets/data/netTablosu.json dosyasına yazar.

Çalıştırmak için:
    pip install requests beautifulsoup4
    python scrape_net_tablosu.py
"""

import json
import os
import time
import logging
from collections import defaultdict

import requests
from bs4 import BeautifulSoup

# ─── Ayarlar ──────────────────────────────────────────────────────────────────

UNIVERSITE_JSON  = '../assets/data/universiteler.json'
CIKTI_JSON       = '../assets/data/netTablosu.json'
DELAY            = 2.5   # saniye — rate limit koruması
TIMEOUT          = 15    # HTTP zaman aşımı (saniye)

# YÖK Atlas dinamik içerik endpoint'i (YOP kodu bazında net tablosu)
NET_URL      = 'https://yokatlas.yok.gov.tr/content/lisans-dynamic/3020d.php?yop={yop}'
ANA_SAYFA_URL = 'https://yokatlas.yok.gov.tr/lisans.php?y={yop}'

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}

NET_HEADERS_EXTRA = {
    'Referer': 'https://yokatlas.yok.gov.tr/netler-tablo.php',
    'X-Requested-With': 'XMLHttpRequest',
}

# SAY AYT alanları
SAY_AYT_ALANLARI = ['ayt_matematik', 'ayt_fen']
EA_AYT_ALANLARI  = ['ayt_matematik', 'ayt_turkce_edebiyat', 'ayt_tarih1']
SOZ_AYT_ALANLARI = ['ayt_turkce_edebiyat', 'ayt_tarih1', 'ayt_cografya1',
                     'ayt_tarih2', 'ayt_cografya2', 'ayt_felsefe', 'ayt_din']
DIL_AYT_ALANLARI = ['ayt_dil']

# ─── Loglama ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)

# ─── Net çekme ────────────────────────────────────────────────────────────────

# Paylaşımlı session — cookie'leri oturum boyunca taşır
_session = requests.Session()
_session.headers.update(HEADERS)
_session_hazir = False


def _session_baslat(yop_kodu: str) -> None:
    """Ana sayfayı ziyaret ederek cookie al."""
    global _session_hazir
    url = ANA_SAYFA_URL.format(yop=yop_kodu)
    try:
        r = _session.get(url, timeout=TIMEOUT)
        log.info(f"  Session başlatıldı (status={r.status_code}, "
                 f"cookie sayısı={len(_session.cookies)})")
        _session_hazir = True
    except requests.RequestException as e:
        log.warning(f"  Session başlatılamadı: {e}")


def net_cek(yop_kodu: str) -> dict | None:
    """
    Belirtilen YOP koduna ait net tablosunu YÖK Atlas'tan çeker.
    Başarısız olursa None döner.
    """
    global _session_hazir
    if not _session_hazir:
        _session_baslat(yop_kodu)
        time.sleep(1.5)

    url = NET_URL.format(yop=yop_kodu)
    headers_extra = {**NET_HEADERS_EXTRA}
    try:
        r = _session.get(url, headers=headers_extra, timeout=TIMEOUT)
        log.debug(f"  [{yop_kodu}] status={r.status_code}")
        r.raise_for_status()
    except requests.RequestException as e:
        log.warning(f"  HTTP hatası [{yop_kodu}]: {e}")
        return None

    soup = BeautifulSoup(r.text, 'html.parser')
    return _parse_net_tablosu(soup, yop_kodu)


def _parse_net_tablosu(soup: BeautifulSoup, yop_kodu: str) -> dict | None:
    """
    3020d.php sayfasındaki net tablosunu ayrıştırır.

    Tablo yapısı:
        Ders Adı  |  Ortalama Net  |  ...
    Satır başlıkları Türkçe ders adları içerir.
    """
    tablo = soup.find('table')
    if not tablo:
        log.warning(f"  Tablo bulunamadı [{yop_kodu}]")
        return None

    nets = {}
    satirlar = tablo.find_all('tr')

    for satir in satirlar:
        hucreler = satir.find_all(['td', 'th'])
        if len(hucreler) < 2:
            continue

        ders_adi = hucreler[0].get_text(strip=True).lower()
        deger_str = hucreler[1].get_text(strip=True).replace(',', '.')

        # Sayısal değil ise atla
        try:
            deger = float(deger_str)
        except ValueError:
            continue

        anahtar = _ders_adi_to_anahtar(ders_adi)
        if anahtar:
            nets[anahtar] = deger

    if not nets:
        log.warning(f"  Net verisi ayrıştırılamadı [{yop_kodu}]: {satirlar[:3]}")
        return None

    return nets


def _ders_adi_to_anahtar(ders: str) -> str | None:
    """Tablo satırındaki ders adını JSON anahtar adına çevirir."""
    eslesmeler = {
        # TYT
        'türkçe':                   'tyt_turkce',
        'tyt türkçe':               'tyt_turkce',
        'matematik':                'tyt_matematik',
        'tyt matematik':            'tyt_matematik',
        'fen bilimleri':            'tyt_fen',
        'tyt fen':                  'tyt_fen',
        'sosyal bilimler':          'tyt_sosyal',
        'tyt sosyal':               'tyt_sosyal',
        # AYT SAY/EA
        'ayt matematik':            'ayt_matematik',
        'matematik (ayt)':          'ayt_matematik',
        'fizik':                    'ayt_fizik',
        'kimya':                    'ayt_kimya',
        'biyoloji':                 'ayt_biyoloji',
        'ayt fen bilimleri':        'ayt_fen',
        # AYT EA
        'türk dili ve edebiyatı':   'ayt_turkce_edebiyat',
        'ayt türkçe':               'ayt_turkce_edebiyat',
        'tarih-1':                  'ayt_tarih1',
        'tarih 1':                  'ayt_tarih1',
        'coğrafya-1':               'ayt_cografya1',
        'coğrafya 1':               'ayt_cografya1',
        # AYT SÖZ
        'tarih-2':                  'ayt_tarih2',
        'tarih 2':                  'ayt_tarih2',
        'coğrafya-2':               'ayt_cografya2',
        'coğrafya 2':               'ayt_cografya2',
        'felsefe grubu':            'ayt_felsefe',
        'felsefe':                  'ayt_felsefe',
        'din kültürü':              'ayt_din',
        # AYT DİL
        'yabancı dil':              'ayt_dil',
        'ayt yabancı dil':          'ayt_dil',
    }

    ders = ders.strip()
    # Doğrudan eşleşme
    if ders in eslesmeler:
        return eslesmeler[ders]
    # Kısmi eşleşme
    for anahtar, deger in eslesmeler.items():
        if anahtar in ders or ders in anahtar:
            return deger
    return None


# ─── Ana mantık ───────────────────────────────────────────────────────────────

def universiteler_yukle() -> list[dict]:
    dosya = os.path.join(os.path.dirname(__file__), UNIVERSITE_JSON)
    with open(dosya, 'r', encoding='utf-8') as f:
        return json.load(f)


def distinct_bolumler(programlar: list[dict]) -> dict[tuple, list[str]]:
    """
    (bolumAdi, puanTuru) → [programId, ...] eşlemesi döner.
    Aynı bolumAdi için tüm programId'leri toplar (ortalama alınacak).
    """
    esleme: dict[tuple, list[str]] = defaultdict(list)
    for p in programlar:
        bolum = (p.get('bolumAdi', '').strip(), p.get('puanTuru', '').strip().upper())
        pid   = str(p.get('programId', '')).strip()
        if bolum[0] and bolum[1] and pid:
            esleme[bolum].append(pid)
    return dict(esleme)


def netleri_ortala(net_listesi: list[dict]) -> dict:
    """Birden fazla program için net değerlerini ortalar."""
    toplam: dict[str, float] = defaultdict(float)
    sayi:   dict[str, int]   = defaultdict(int)

    for nets in net_listesi:
        for alan, deger in nets.items():
            if isinstance(deger, (int, float)):
                toplam[alan] += deger
                sayi[alan]   += 1

    return {alan: round(toplam[alan] / sayi[alan], 2)
            for alan in toplam if sayi[alan] > 0}


def main():
    log.info("universiteler.json okunuyor...")
    programlar = universiteler_yukle()
    bolum_map  = distinct_bolumler(programlar)

    log.info(f"Toplam {len(bolum_map)} benzersiz (bolum, puanTuru) kombinasyonu bulundu.")

    # Sonuç yapısı: puanTuru → bolumAdi → net dict
    sonuc: dict[str, dict] = {'SAY': {}, 'EA': {}, 'SÖZ': {}, 'DİL': {}}

    basarili = 0
    basarisiz_bolumler: list[str] = []

    toplam = len(bolum_map)
    for idx, ((bolum_adi, puan_turu), program_idler) in enumerate(bolum_map.items(), 1):
        log.info(f"[{idx}/{toplam}] {puan_turu} › {bolum_adi} "
                 f"({len(program_idler)} program)")

        # Grup başına tek istek: ilk geçerli programId'yi kullan
        nets = net_cek(program_idler[0])
        time.sleep(DELAY)

        program_netleri: list[dict] = [nets] if nets else []

        if not program_netleri:
            log.warning(f"  → ATLANDI (hiç net verisi yok): {bolum_adi}")
            basarisiz_bolumler.append(f"{puan_turu}:{bolum_adi}")
            continue

        ortalama = netleri_ortala(program_netleri)
        ortalama['kaynak_yil'] = 2025

        if puan_turu not in sonuc:
            sonuc[puan_turu] = {}
        sonuc[puan_turu][bolum_adi] = ortalama
        basarili += 1

        # Her 20 bölümde bir ara kayıt
        if basarili % 20 == 0:
            _kaydet(sonuc)
            log.info(f"  Ara kayıt yapıldı ({basarili} bölüm).")

    _kaydet(sonuc)

    toplam_bolum = basarili + len(basarisiz_bolumler)
    print("\n" + "═" * 60)
    print(f"  Tamamlandı!")
    print(f"  Başarılı  : {basarili} bölüm")
    print(f"  Başarısız : {len(basarisiz_bolumler)} bölüm")
    print(f"  Toplam    : {toplam_bolum}")
    print(f"  Çıktı     : {os.path.abspath(os.path.join(os.path.dirname(__file__), CIKTI_JSON))}")
    print("═" * 60)

    if basarisiz_bolumler:
        print("\nBaşarısız bölümler:")
        for b in basarisiz_bolumler:
            print(f"  - {b}")


def _kaydet(sonuc: dict) -> None:
    dosya = os.path.join(os.path.dirname(__file__), CIKTI_JSON)
    os.makedirs(os.path.dirname(os.path.abspath(dosya)), exist_ok=True)
    with open(dosya, 'w', encoding='utf-8') as f:
        json.dump(sonuc, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
