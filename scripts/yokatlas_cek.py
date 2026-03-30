"""
YÖKAtlas Lisans Program Veri Çekici
------------------------------------
API sayfası başına en fazla 100 kayıt döndürüyor.
ucret / ogretim_turu filtreleri API tarafından görmezden geliniyor.
Bu yüzden sadece puan_turu ile paginate ediyoruz.

Çalıştırmak için:  python yokatlas_cek.py
Devam ettirmek için: tekrar çalıştır, mevcut programId'ler atlanır.
"""

import json
import os
import time
from yokatlas_py import search_lisans_programs

CIKTI_DOSYA = '../assets/data/universiteler.json'
SAYFA_BOYUTU = 100   # API'nin gerçek limiti
DELAY = 0.3          # saniye — rate limit koruması

PUAN_TURLERI = ['say', 'ea', 'söz', 'dil']


def sayfalayarak_cek(puan_turu: str) -> list:
    """Tek puan türü için tüm sayfaları çeker."""
    tum = []
    start = 0
    bos_sayfa_ust_uste = 0

    while True:
        try:
            sonuclar = search_lisans_programs({
                'puan_turu': puan_turu,
                'length': SAYFA_BOYUTU,
                'start': start,
            })
        except Exception as e:
            print(f"    ⚠ Sayfa hatası (start={start}): {e}")
            bos_sayfa_ust_uste += 1
            if bos_sayfa_ust_uste >= 3:
                break
            time.sleep(2)
            continue

        if not sonuclar or not isinstance(sonuclar, list):
            break

        bos_sayfa_ust_uste = 0
        tum.extend(sonuclar)
        print(f"    start={start} → {len(sonuclar)} kayıt (toplam: {len(tum)})")

        # Son sayfa kontrolü
        if len(sonuclar) < SAYFA_BOYUTU:
            break

        start += SAYFA_BOYUTU
        time.sleep(DELAY)

    return tum


def parse_program(s: dict, puan_label: str) -> dict:
    """Search sonucundan uygulama için gerekli alanları çıkar."""
    taban = s.get('taban') or {}
    tbs = s.get('tbs') or {}
    kontenjan = s.get('kontenjan') or {}
    yerlesen = s.get('yerlesen') or {}

    return {
        'programId':          str(s.get('yop_kodu') or ''),
        'universiteAdi':      s.get('uni_adi') or '',
        'fakulteAdi':         s.get('fakulte') or '',
        'bolumAdi':           s.get('program_adi') or '',
        'programDetay':       s.get('program_detay') or '',
        'puanTuru':           puan_label,
        'sehir':              s.get('sehir_adi') or '',
        'universiteTuru':     s.get('universite_turu') or '',
        'ucretBurs':          s.get('ucret_burs') or '',
        'ogretimTuru':        s.get('ogretim_turu') or '',

        'tabanPuan_2025':     taban.get('2025'),
        'tabanSiralama_2025': tbs.get('2025'),
        'kontenjan_2025':     kontenjan.get('2025'),
        'yerlesen_2025':      yerlesen.get('2025'),

        'tabanPuan_2024':     taban.get('2024'),
        'tabanSiralama_2024': tbs.get('2024'),
        'kontenjan_2024':     kontenjan.get('2024'),
        'yerlesen_2024':      yerlesen.get('2024'),
    }


def kaydet(tum_programlar: list) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(CIKTI_DOSYA)), exist_ok=True)
    with open(CIKTI_DOSYA, 'w', encoding='utf-8') as f:
        json.dump(tum_programlar, f, ensure_ascii=False, indent=2)


def main():
    gorulmus_idler: set[str] = set()
    tum_programlar: list[dict] = []

    if os.path.exists(CIKTI_DOSYA):
        try:
            with open(CIKTI_DOSYA, 'r', encoding='utf-8') as f:
                mevcut = json.load(f)
            if mevcut:
                tum_programlar = mevcut
                gorulmus_idler = {p['programId'] for p in tum_programlar if p.get('programId')}
                print(f"Mevcut veri: {len(tum_programlar)} program (bunlar atlanacak)\n")
        except Exception:
            print("Mevcut veri okunamadı, sıfırdan başlanıyor.\n")

    for idx, puan_turu in enumerate(PUAN_TURLERI, 1):
        puan_label = puan_turu.upper().replace('SÖZ', 'SOZ')
        print(f"\n[{idx}/{len(PUAN_TURLERI)}] {puan_label} programları çekiliyor...")

        sayfa_sonuclari = sayfalayarak_cek(puan_turu)
        yeni_sayac = 0

        for s in sayfa_sonuclari:
            program_id = str(s.get('yop_kodu') or '')
            if not program_id or program_id in gorulmus_idler:
                continue
            gorulmus_idler.add(program_id)
            yeni_sayac += 1
            tum_programlar.append(parse_program(s, puan_label))

        print(f"  → {yeni_sayac} yeni | Toplam: {len(tum_programlar)}")
        kaydet(tum_programlar)

    print(f"\n✅ Tamamlandı! Toplam {len(tum_programlar)} program → {CIKTI_DOSYA}")


main()
