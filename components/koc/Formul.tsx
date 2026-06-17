// Formul — LaTeX + düz metin karışık içeriği render eder.
// Native: react-native-webview + KaTeX (CDN). Web: KaTeX CDN'i DOM'a yükleyip render.
// Model "$...$" (satır içi) ve "$$...$$" (blok) ile matematik üretir.
import { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/colors';

const KATEX_VER = '0.16.11';
const CDN = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VER}/dist`;

// WebView yalnızca native'de yüklenir (web'de gerek yok).
const WebView = Platform.OS === 'web' ? null : require('react-native-webview').WebView;

interface FormulProps {
  icerik: string;
  renk?: string;
  boyut?: number;
  kalin?: boolean;
  hizala?: 'left' | 'center';
  /** İçeriğin tamamı tek bir matematik ifadesi (formül kartı sol/sağ). $ yoksa bütünü sarar. */
  tamMat?: boolean;
  style?: StyleProp<ViewStyle>;
}

// İç bileşenler: renk/boyut/hizala çözülmüş (zorunlu), kalin/tamMat opsiyonel.
interface IcFormulProps {
  icerik: string;
  renk: string;
  boyut: number;
  kalin?: boolean;
  hizala: 'left' | 'center';
  tamMat?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Metinde matematik işareti var mı? Yoksa düz Text yeterli (WebView gereksiz).
 * $ · \komut · \, \; \! \: (boşluk komutları) · JSON kaçışıyla bozulup kontrol karakterine
 * dönmüş komutlar (\f→form feed: "\frac"→"rac"; \b,\v de) → bunları da matematik say.
 */
export function iceriyorMat(s?: string): boolean {
  return !!s && /[$]|\\[a-zA-Z,;!:]|[\f\b\v]/.test(s);
}

/**
 * JSON kaçış kurtarma. Model "\frac" gibi TEK ters bölülü LaTeX yazınca "\f" geçerli bir JSON
 * kaçışı (form feed) olduğu için JSON.parse onu kontrol karakterine çevirir → ekranda "rac" kalır.
 * Aynı çakışma: \b (\beta,\begin,\binom), \v (\vec,\varphi), \t (\times,\theta), \r (\rho,\right).
 * Bu beş kontrol karakteri içerikte ASLA meşru görünmez → komuta geri çevirmek güvenlidir.
 * tamMat (tek satır saf formül) ise satır sonu da meşru değildir → \n'i de komuta çevir
 * (\neq,\nu,\nabla kurtulur). Düz metinde \n GERÇEK satır sonu olabileceği için ona dokunma.
 */
function kontrolKurtar(s: string, tamMat: boolean): string {
  const t = s
    .replace(/\f/g, '\\f')
    .replace(/\x08/g, '\\b')
    .replace(/\v/g, '\\v')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    // Geriye kalan eşlenmemiş C0 kontrol baytlarını at (satır sonu hariç). Bunlar
    // ekranda "□" kutusu olarak görünüp LaTeX komutunu (ör. \Omega) bozabiliyor.
    .replace(/[\x00-\x07\x0E-\x1F]/g, '');
  return tamMat ? t.replace(/\n/g, '\\n') : t;
}

/**
 * Model bazen gerçek satır sonu yerine literal "\n"/"\t" yazıyor → ekranda "\n" görünüyor.
 * Sadece ARDINDAN HARF GELMEYEN \n \t \r'yi çevir (\neq, \nu gibi gerçek komutlara dokunma).
 */
function kacislariDuzelt(s: string): string {
  return s
    .replace(/\\n(?![a-zA-Z])/g, '\n')
    .replace(/\\t(?![a-zA-Z])/g, ' ')
    .replace(/\\r(?![a-zA-Z])/g, '');
}

/**
 * Güvenlik ağı: model bazen LaTeX'i ($...$ olmadan) ham yazıyor → ekranda ham kalıyor.
 * Zaten $...$ / $$...$$ içinde olanları KORUR. İki tür çıplak içeriği sarar:
 *  1) `\begin{...}...\end{...}` ortamı (aligned, cases vb.) → TÜM blok $$...$$ ile sarılır.
 *     (Tek tek \begin/\end sarılırsa ortam ikiye bölünür, KaTeX hata verir → kırmızı ham metin.)
 *  2) Geriye kalan tekil çıplak \komut'lar (\frac vb.) → $...$ ile sarılır.
 */
// Tek LaTeX komutu: \harfler (\frac, \Omega…) VEYA ince boşluk komutları \, \; \: \! .
const LTX_KOMUT = '\\\\(?:[a-zA-Z]+|[,;:!])';
// Bitişik bir "matematik koşusu": opsiyonel baş sayı + komut + ardışık (komut/sayı/brace/üst-alt)
// atomları. Böylece "3\,\Omega" tek parça ($3\,\Omega$) olarak sarılır; aksi halde \, çıplak
// kalıp ekranda ham görünürdü. Salt sayı (komutsuz) ASLA sarılmaz → düz metin korunur.
const LTX_KOSU = new RegExp(
  '(?:\\d+(?:[.,]\\d+)?\\s*)?' +
    LTX_KOMUT + '(?:[\\^_])?(?:\\{[^{}]*\\}){0,2}' +
    '(?:\\s*(?:' + LTX_KOMUT + '(?:[\\^_])?(?:\\{[^{}]*\\}){0,2}|\\d+(?:[.,]\\d+)?))*',
  'g'
);
function latexGuvenli(s: string): string {
  return s
    .split(/(\$\$[^$]*\$\$|\$[^$]*\$|\\begin\{[a-zA-Z]+\*?\}[\s\S]*?\\end\{[a-zA-Z]+\*?\})/g)
    .map((p) => {
      if (p.startsWith('$')) return p; // zaten math
      if (p.startsWith('\\begin')) return `$$${p}$$`; // çıplak ortamı blok math olarak sar
      return p.replace(LTX_KOSU, (m) => `$${m}$`);
    })
    .join('');
}

/**
 * Metni HTML için güvenli hale getirir; **kalın** → <strong>, matematik $ sınırlayıcıları korunur.
 * tamMat: tüm içerik tek bir matematik ifadesi (formül kartı sol/sağ gibi) → $ yoksa bütünü tek
 * math olarak sarar; böylece "n \, x^{n-1}" gibi çıplak üst/alt simgeli ifadeler de render olur.
 */
function htmlKacis(s: string, tamMat = false): string {
  const duz = kacislariDuzelt(kontrolKurtar(s, tamMat));
  const mat = tamMat && !duz.includes('$') ? `$${duz}$` : latexGuvenli(duz);
  return mat
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
}

const SINIRLAYICILAR = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
  { left: '\\[', right: '\\]', display: true },
];

export function Formul({ icerik, renk = COLORS.text, boyut = 14, kalin, hizala = 'left', tamMat, style }: FormulProps) {
  const metin = (icerik ?? '').trim();
  if (!metin) return null;
  const ortak: IcFormulProps = { icerik: metin, renk, boyut, kalin, hizala, tamMat, style };
  return Platform.OS === 'web' ? <FormulWeb {...ortak} /> : <FormulNative {...ortak} />;
}

// ── Native: WebView içinde KaTeX ───────────────────────────────────────
function FormulNative({ icerik, renk, boyut, kalin, hizala, tamMat, style }: IcFormulProps) {
  const [yukseklik, setYukseklik] = useState(Math.round((boyut ?? 14) * 1.6));

  const html = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="${CDN}/katex.min.css">
<style>
  html,body{margin:0;padding:0;background:transparent;}
  #k{font:${kalin ? '700 ' : ''}${boyut}px -apple-system,system-ui,sans-serif;color:${renk};
     line-height:1.5;text-align:${hizala};word-wrap:break-word;overflow-x:hidden;}
  .katex{font-size:1.05em;}
  .katex-display{margin:6px 0;overflow:hidden;}
</style></head>
<body><div id="k">${htmlKacis(icerik, tamMat)}</div>
<script src="${CDN}/katex.min.js"></script>
<script src="${CDN}/contrib/auto-render.min.js"></script>
<script>
  function bildirYukseklik(){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight)); } }
  function sigdir(){ var c=document.getElementById('k'); if(!c) return; var w=c.clientWidth; if(!w) return;
    var ds=c.getElementsByClassName('katex-display');
    for(var i=0;i<ds.length;i++){ var d=ds[i], k=d.getElementsByClassName('katex')[0]; if(!k) continue;
      var mw=k.getBoundingClientRect().width;
      if(mw>w+0.5 && mw>0){ var s=w/mw; k.style.transformOrigin='left top'; k.style.transform='scale('+s+')';
        d.style.height=k.getBoundingClientRect().height+'px'; d.style.textAlign='left'; } }
    var all=c.getElementsByClassName('katex');
    for(var j=0;j<all.length;j++){ var ke=all[j];
      if(ke.closest && ke.closest('.katex-display')) continue;
      if(ke.style.transform) continue;
      var mw2=ke.getBoundingClientRect().width;
      if(mw2>w+0.5 && mw2>0){ var s2=w/mw2; ke.style.display='inline-block'; ke.style.transformOrigin='left top'; ke.style.transform='scale('+s2+')'; } } }
  function ciz(){ try{ renderMathInElement(document.getElementById('k'), { delimiters: ${JSON.stringify(SINIRLAYICILAR)}, throwOnError:false }); }catch(e){} sigdir(); bildirYukseklik(); setTimeout(function(){ sigdir(); bildirYukseklik(); }, 250); }
  if(document.readyState!=='loading') ciz(); else window.addEventListener('load', ciz);
</script></body></html>`;

  return (
    <View style={[{ height: yukseklik }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: 'transparent', flex: 1 }}
        // @ts-ignore — iOS'ta şeffaf zemin
        opaque={false}
        onMessage={(e: any) => {
          const n = Number(e.nativeEvent.data);
          if (n && Math.abs(n - yukseklik) > 1) setYukseklik(Math.ceil(n));
        }}
      />
    </View>
  );
}

// ── Web: KaTeX CDN'i DOM'a yükle, renderMathInElement çalıştır ──────────
let katexHazir: Promise<void> | null = null;
function katexYukle(): Promise<void> {
  if (katexHazir) return katexHazir;
  katexHazir = new Promise<void>((cozumle) => {
    if (typeof document === 'undefined') return cozumle();
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = `${CDN}/katex.min.css`;
      document.head.appendChild(link);
    }
    const yukle = (src: string) =>
      new Promise<void>((ok) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => ok();
        s.onerror = () => ok();
        document.head.appendChild(s);
      });
    yukle(`${CDN}/katex.min.js`)
      .then(() => yukle(`${CDN}/contrib/auto-render.min.js`))
      .then(() => cozumle());
  });
  return katexHazir;
}

/**
 * Genişliğe sığmayan matematiği ölçekleyerek küçültür (taşmayı önler).
 * 1) Blok matematik ($$...$$ → .katex-display).
 * 2) Satır içi matematik ($...$ → .katex): kabı aşan TEKİL ifadeleri de ölçekle.
 *    Koşul mw>w olduğu için yalnızca tüm kabı aşan uzun denklemler küçülür;
 *    cümle ortasındaki kısa terimlere dokunulmaz.
 */
function fitMatematik(kap: any) {
  if (!kap) return;
  const w = kap.clientWidth;
  if (!w) return;
  const ds = kap.getElementsByClassName('katex-display');
  for (let i = 0; i < ds.length; i++) {
    const d = ds[i];
    const k = d.getElementsByClassName('katex')[0];
    if (!k) continue;
    const mw = k.getBoundingClientRect().width;
    if (mw > w + 0.5 && mw > 0) {
      const s = w / mw;
      k.style.transformOrigin = 'left top';
      k.style.transform = `scale(${s})`;
      d.style.height = k.getBoundingClientRect().height + 'px';
      d.style.textAlign = 'left';
    }
  }
  const all = kap.getElementsByClassName('katex');
  for (let i = 0; i < all.length; i++) {
    const k = all[i];
    if (k.closest && k.closest('.katex-display')) continue; // blok zaten işlendi
    if (k.style.transform) continue; // tekrar ölçekleme
    const mw = k.getBoundingClientRect().width;
    if (mw > w + 0.5 && mw > 0) {
      const s = w / mw;
      k.style.display = 'inline-block';
      k.style.transformOrigin = 'left top';
      k.style.transform = `scale(${s})`;
    }
  }
}

function FormulWeb({ icerik, renk, boyut, kalin, hizala, tamMat, style }: IcFormulProps) {
  const ref = useRef<any>(null);
  useEffect(() => {
    let iptal = false;
    katexYukle().then(() => {
      const el = ref.current;
      const render = (window as any).renderMathInElement;
      if (iptal || !el) return;
      el.innerHTML = htmlKacis(icerik, tamMat);
      if (render) {
        try {
          render(el, { delimiters: SINIRLAYICILAR, throwOnError: false });
        } catch {}
      }
      fitMatematik(el);
      setTimeout(() => {
        if (!iptal) fitMatematik(el);
      }, 250);
    });
    return () => {
      iptal = true;
    };
  }, [icerik, tamMat]);

  // react-native-web ortamında gerçek bir <div> render edilir.
  const ReactWeb = require('react');
  return ReactWeb.createElement('div', {
    ref,
    style: {
      color: renk,
      fontSize: boyut,
      fontWeight: kalin ? 700 : 400,
      lineHeight: 1.5,
      textAlign: hizala,
      fontFamily: '-apple-system, system-ui, sans-serif',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      overflowX: 'hidden',
    },
  });
}

// Düz metin yedeği (gerekirse): $ sınırlayıcıları temizleyip Text döndürür.
export function FormulYedek({ icerik, renk = COLORS.text, boyut = 14 }: FormulProps) {
  return (
    <Text style={{ color: renk, fontSize: boyut, lineHeight: boyut * 1.5 }}>
      {(icerik ?? '').replace(/\$\$?/g, '')}
    </Text>
  );
}
