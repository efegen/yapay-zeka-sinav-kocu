# Yapay Zekâ Destekli Sınav Koçu (YZDSK)

YKS'ye (TYT/AYT) hazırlanan öğrenciler için yapay zekâ destekli bir mobil/web sınav koçu. Öğrenciye birebir koçluk yapar: çalışma planı kurar, deneme sonuçlarını analiz eder, soru fotoğraflarını adım adım çözer, motive eder ve öğrenciyi planlı tutar.

Uygulama; React Native (Expo) ile yazılmış olup **Android, iOS ve Web** üzerinde tek kod tabanından çalışır.

---

## İçindekiler

- [Özellikler](#özellikler)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Mimari](#mimari)
- [Proje Yapısı](#proje-yapısı)
- [Kurulum](#kurulum)
  - [Ön Koşullar](#ön-koşullar)
  - [1. Bağımlılıklar](#1-bağımlılıklar)
  - [2. Firebase](#2-firebase)
  - [3. Ortam Değişkenleri](#3-ortam-değişkenleri)
  - [4. AI Proxy (Cloudflare Worker)](#4-ai-proxy-cloudflare-worker)
  - [5. Uygulamayı Çalıştırma](#5-uygulamayı-çalıştırma)
- [Veri Betikleri](#veri-betikleri)
- [Veri Modeli](#veri-modeli)
- [Ekip](#ekip)

---

## Özellikler

### 🤖 AI Koç (sohbet)
Tam ekran, çoklu sohbet destekli bir koçluk asistanı. Yanıtlar düz metin değil **yapılandırılmış kartlar** olarak gelir — koç haftalık plan, Pomodoro programı, formül kartı, deneme kıyası, hedef özeti, projeksiyon, çözüm adımları gibi **19 farklı zengin kart tipi** üretebilir. Sohbet geçmişi cihazda saklanır ve geçmiş çekmecesinden erişilebilir.

- **Koç hafızası:** Öğrencinin zorlandığı/iyi olduğu konular ve kalıcı kişisel notlar (rutin, tercih, duygu) zamanla öğrenilir; sonraki planlar bunlara göre kişiselleştirilir.
- **Veri dürüstlüğü:** Koç elinde olmayan veriyi (taban puan, geçmiş net) uydurmaz; gerekirse öğrenciden ister.
- **Takvim aksiyonları:** Koç takvimi doğrudan değiştiremez; "takvimi boşaltayım mı?" gibi teklifleri kart olarak sunar, işlemi öğrenci onaylayınca uygulama yapar.

### 📷 Soru Çözücü (fotoğraf)
Öğrenci bir soru fotoğrafı yükler; çok aşamalı bir hatla çözülür:
1. **Triyaj** — ucuz/hızlı bir modelle soru okunabilir mi ve zorluğu ne sınıflandırılır.
2. **Yönlendirme** — zorluğa göre uygun çözücü model seçilir (kolay/orta → hızlı model, zor → en güçlü model).
3. **Çözüm** — LaTeX biçimli adım adım çözüm; geometri sorularında otomatik **SVG diyagram**.

### 📅 Takvim & Haftalık Plan
Çalışma planı oluşturma, günlük/haftalık takvim görünümü ve AI'ın ürettiği haftalık planı tek dokunuşla takvime aktarma.

### ⏱️ Pomodoro / Sayaç
Odak sayacı ve çalışma istatistikleri (toplam odak süresi, çözülen soru takibi).

### 📊 Deneme Takibi
TYT/AYT deneme sonucu ekleme. Öğrenci yalnızca **doğru + yanlış** girer; **boş** ve **net** (ÖSYM standardı `net = D − Y/4`) otomatik hesaplanır. Denemeler listelenir ve koç tarafından kıyaslanabilir.

### 🎯 Profil, Hedef & Puan Tahmini
Üniversite/bölüm ya da sıralama hedefi belirleme. YÖKAtlas verisiyle program arama; diploma notu (OBP) ve netlerden **yerleştirme puanı / sıralama tahmini**.

---

## Teknoloji Yığını

| Katman | Teknoloji |
| --- | --- |
| Uygulama | Expo `~54`, React Native `0.81`, React `19`, React Native Web |
| Dil | TypeScript |
| Navigasyon | Expo Router (dosya tabanlı) |
| Kimlik & Veri | Firebase Authentication (e-posta/şifre) + Cloud Firestore |
| Yerel depolama | AsyncStorage (sohbet geçmişi, sayaç durumu) |
| AI Proxy | Cloudflare Workers (TypeScript) → OpenAI API |
| UI | `expo-linear-gradient`, `react-native-svg`, `react-native-reanimated` |
| Veri kaynağı | YÖKAtlas (Python betikleriyle çekilen üniversite/program verisi) |

---

## Mimari

```
┌──────────────────────────┐        ┌──────────────────────────┐
│   Uygulama (Expo / RN)   │        │   Firebase               │
│  • Ekranlar (expo-router)│ ◄────► │  • Auth (e-posta/şifre)  │
│  • Koç hafızası, profil  │        │  • Firestore (users/...) │
│  • Sohbet (AsyncStorage) │        └──────────────────────────┘
└────────────┬─────────────┘
             │  POST /chat  ·  POST /soru
             ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│  Cloudflare Worker        │        │   OpenAI API             │
│  (AI Proxy)               │ ◄────► │  • Sohbet modeli         │
│  • Sistem promptu         │        │  • Vision/çözücü modeller│
│  • Kart şeması doğrulama   │        └──────────────────────────┘
│  • Model yönlendirme       │
└──────────────────────────┘
```

**Neden bir proxy var?** OpenAI API anahtarı istemciye (APK / web bundle) **hiçbir zaman girmez**. Uygulama yalnızca Cloudflare Worker'ı çağırır; anahtar Worker'da bir secret olarak saklanır. Worker ayrıca sistem promptunu, kart şeması doğrulamasını ve maliyet odaklı model yönlendirmesini barındırır — böylece prompt/model değişiklikleri uygulamayı yeniden yayınlamadan yapılabilir.

Worker'ın ürettiği kart sözleşmesi (`tip` + `veri`) hem Worker hem de istemci tarafında [types/koc.ts](types/koc.ts) ile tipli olarak tanımlıdır; istemci bilinmeyen/eksik kartları güvenle ayıklar.

---

## Proje Yapısı

```
.
├── app/                    # Ekranlar (expo-router, dosya tabanlı yönlendirme)
│   ├── (tabs)/             #   Alt sekmeler: Ana Sayfa, Takvim, AI Koç, Sayaç, Profil
│   ├── onboarding.tsx      #   Kayıt + KVKK onayı
│   ├── login.tsx           #   Giriş
│   ├── soru-yukle.tsx      #   Fotoğrafla soru çözme
│   ├── koc-hafiza.tsx      #   Koç hafızası yönetim ekranı
│   ├── deneme-ekle.tsx     #   Deneme sonucu girişi
│   └── plan-kur.tsx        #   Çalışma planı oluşturma
├── components/             # Yeniden kullanılabilir bileşenler
│   └── koc/                #   AI Koç kart sistemi (19 kart tipi + renderer)
├── services/               # Firebase, AI proxy köprüsü, hafıza, sohbet servisleri
│   └── aiService.ts        #   Worker'a /chat ve /soru istekleri
├── hooks/                  # useProfile, useKocHafiza, useSohbetler, ...
├── models/                 # Veri modelleri (deneme, kullanıcı)
├── constants/              # Renkler, dersler, sınav takvimi, metinler
├── utils/                  # Puan/sıralama hesabı, tarih, plan aktarımı
├── assets/data/            # universiteler.json (YÖKAtlas program verisi)
├── scripts/                # Python veri çekme betikleri (YÖKAtlas)
├── worker/                 # Cloudflare Worker — AI proxy (ayrı paket)
│   └── src/index.ts        #   Sistem promptu, model yönlendirme, kart doğrulama
└── firestore.rules         # Firestore güvenlik kuralları
```

---

## Kurulum

### Ön Koşullar
- Node.js 18+ ve npm
- [Expo CLI](https://docs.expo.dev/) (`npx expo` ile çalışır, ayrı kurulum gerekmez)
- Bir Firebase projesi (Authentication + Firestore)
- AI özellikleri için: bir Cloudflare hesabı ve bir OpenAI API anahtarı

### 1. Bağımlılıklar
```bash
npm install
```

### 2. Firebase
1. Firebase Console'da bir proje oluşturun.
2. **Authentication → Sign-in method → E-posta/Şifre**'yi etkinleştirin.
3. **Cloud Firestore**'u oluşturun.
4. [firestore.rules](firestore.rules) içeriğini projenize uygulayın (her kullanıcı yalnızca kendi `users/{uid}` verisine erişebilir).

### 3. Ortam Değişkenleri
Kök dizinde `.env.example` dosyasını `.env` olarak kopyalayın ve doldurun:

```bash
cp .env.example .env
```

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...

# AI proxy (Cloudflare Worker) URL'i — OpenAI anahtarı İSTEMCİDE TUTULMAZ
EXPO_PUBLIC_AI_PROXY_URL=https://yzdsk-ai.<hesabin>.workers.dev
```

> `.env` ve native yapılandırma dosyaları `.gitignore` ile dışlanmıştır; gizli bilgiler depoya girmez.

### 4. AI Proxy (Cloudflare Worker)
AI özellikleri (sohbet ve soru çözme) ayrı bir Cloudflare Worker üzerinden çalışır.

```bash
cd worker
npm install

# OpenAI anahtarını secret olarak gir (yalnızca bir kez):
npx wrangler secret put OPENAI_API_KEY

# Yerel geliştirme:
npx wrangler dev

# Yayınlama:
npx wrangler deploy
```

Kullanılacak modeller ve YKS tarihi gibi ayarlar [worker/wrangler.toml](worker/wrangler.toml) içindeki `[vars]` bloğundan kod değiştirmeden yönetilir. Yayınlanan Worker URL'sini `.env` içindeki `EXPO_PUBLIC_AI_PROXY_URL`'e yazın.

**Endpoint'ler:**
- `POST /chat` — koç sohbeti (`{ ogrenciBaglam, mesajlar }` → `{ yanit, kartlar, ... }`)
- `POST /soru` — fotoğrafla soru çözme (`{ gorsel, ogrenciBaglam, not }` → `{ durum, yanit, kartlar }`)

### 5. Uygulamayı Çalıştırma
```bash
npm run start      # Expo geliştirme sunucusu
npm run web        # Web (tarayıcı)
npm run android    # Android (emülatör/cihaz)
npm run ios        # iOS (macOS gerekir)
```

Web sürümünü Cloudflare üzerinden yayınlamak için:
```bash
npm run deploy     # expo export -p web && wrangler deploy
```

---

## Veri Betikleri

`scripts/` altındaki Python betikleri, üniversite/program verisini ([assets/data/universiteler.json](assets/data/universiteler.json)) YÖKAtlas'tan çeker.

```bash
cd scripts
pip install -r requirements.txt
python yokatlas_cek.py        # Lisans programlarını çek (devam ettirilebilir)
```

| Betik | İşlev |
| --- | --- |
| `yokatlas_cek.py` | YÖKAtlas lisans programlarını sayfalayarak çeker |
| `scrape_net_tablosu.py` | Net → sıralama tablosu verisi |
| `konular_yukle.py` | Konu verisi yükleme |

---

## Veri Modeli

Tüm kullanıcı verisi Firestore'da `users/{uid}` altında tutulur ve güvenlik kuralıyla yalnızca o kullanıcıya açıktır:

```
users/{uid}                       # Profil (hedef, sınıf, puan türü, net hedefleri, ...)
  ├── denemeler/{id}              # Deneme sonuçları (TYT/AYT netleri)
  ├── gorevler/{id}               # Takvim/plan görevleri
  └── koc/hafiza                  # Koç hafızası (zorlanılan/iyi konular + kişisel notlar)
```

Sohbet geçmişi ve sayaç durumu gibi cihaz-yerel veriler AsyncStorage'da saklanır.

---

## Ekip

Beykent Üniversitesi bitirme projesi.

- **Efe Genişoğlu**
- **Ezgi Öner**

---

> Bu depo akademik bir bitirme projesidir. YKS sınav takvimi ve model ayarları her sezon ÖSYM takvimine göre güncellenmelidir ([constants/sinav.ts](constants/sinav.ts), [worker/wrangler.toml](worker/wrangler.toml)).
</content>
</invoke>
