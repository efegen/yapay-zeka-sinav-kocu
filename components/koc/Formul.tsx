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
  style?: StyleProp<ViewStyle>;
}

// İç bileşenler: renk/boyut/hizala çözülmüş (zorunlu), kalin opsiyonel.
interface IcFormulProps {
  icerik: string;
  renk: string;
  boyut: number;
  kalin?: boolean;
  hizala: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}

/** Metinde matematik (\, $) işareti var mı? Yoksa düz Text yeterli (WebView gereksiz). */
export function iceriyorMat(s?: string): boolean {
  return !!s && /\$|\\[a-zA-Z]/.test(s);
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
 * Güvenlik ağı: model bazen LaTeX'i (\frac{1}{3} gibi) $...$ olmadan yazıyor → ham kalıyor.
 * Zaten $...$ içinde olanları KORUR; dışarıda kalan çıplak \komut'ları $...$ ile sarar.
 */
function latexGuvenli(s: string): string {
  return s
    .split(/(\$\$[^$]*\$\$|\$[^$]*\$)/g)
    .map((p) => (p.startsWith('$') ? p : p.replace(/\\[a-zA-Z]+(?:\{[^{}]*\}){0,2}/g, (m) => `$${m}$`)))
    .join('');
}

/** Metni HTML için güvenli hale getirir; **kalın** → <strong>, matematik $ sınırlayıcıları korunur. */
function htmlKacis(s: string): string {
  return latexGuvenli(kacislariDuzelt(s))
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

export function Formul({ icerik, renk = COLORS.text, boyut = 14, kalin, hizala = 'left', style }: FormulProps) {
  const metin = (icerik ?? '').trim();
  if (!metin) return null;
  if (Platform.OS === 'web') {
    return <FormulWeb icerik={metin} renk={renk} boyut={boyut} kalin={kalin} hizala={hizala} style={style} />;
  }
  return <FormulNative icerik={metin} renk={renk} boyut={boyut} kalin={kalin} hizala={hizala} style={style} />;
}

// ── Native: WebView içinde KaTeX ───────────────────────────────────────
function FormulNative({ icerik, renk, boyut, kalin, hizala, style }: IcFormulProps) {
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
<body><div id="k">${htmlKacis(icerik)}</div>
<script src="${CDN}/katex.min.js"></script>
<script src="${CDN}/contrib/auto-render.min.js"></script>
<script>
  function bildirYukseklik(){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight)); } }
  function sigdir(){ var c=document.getElementById('k'); if(!c) return; var w=c.clientWidth;
    var ds=c.getElementsByClassName('katex-display');
    for(var i=0;i<ds.length;i++){ var d=ds[i], k=d.getElementsByClassName('katex')[0]; if(!k) continue;
      var mw=k.getBoundingClientRect().width;
      if(mw>w+0.5 && mw>0){ var s=w/mw; k.style.transformOrigin='left top'; k.style.transform='scale('+s+')';
        d.style.height=k.getBoundingClientRect().height+'px'; d.style.textAlign='left'; } } }
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

/** Genişliğe sığmayan blok matematiği ölçekleyerek küçültür (taşmayı önler). */
function fitMatematik(kap: any) {
  if (!kap) return;
  const w = kap.clientWidth;
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
}

function FormulWeb({ icerik, renk, boyut, kalin, hizala, style }: IcFormulProps) {
  const ref = useRef<any>(null);
  useEffect(() => {
    let iptal = false;
    katexYukle().then(() => {
      const el = ref.current;
      const render = (window as any).renderMathInElement;
      if (iptal || !el) return;
      el.innerHTML = htmlKacis(icerik);
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
  }, [icerik]);

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
