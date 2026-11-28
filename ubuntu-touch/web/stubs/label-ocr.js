// Ubuntu Touch stand-in for app/src/lib/labelOcr.js (the Android app uses the native
// modules/label-ocr Tesseract module, which a web build can't load).
//
// Same engine and model, still fully on the phone: Tesseract compiled to WebAssembly
// (tesseract.js-core, copied to www/ocr/ by build.sh) with the same English "fast" model the
// Android module bundles. The image is prepared like LabelReader.kt does it: upright (the
// browser applies EXIF rotation when decoding), at most ~2000 px on the long side, grayscale,
// then read with automatic page segmentation.
import { Alert } from 'react-native';
import { parseNutritionLabel } from '../src/lib/label';

// react-native-web's Alert.alert does nothing, which made every scan error silent on Ubuntu
// Touch. Use the browser's dialogs instead (the Ubuntu Touch web view shows them natively).
if (typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = (buttons || []).filter(Boolean);
    if (list.length < 2) {
      window.alert(text);
      if (list[0] && list[0].onPress) list[0].onPress();
      return;
    }
    // Two or more buttons: OK runs the last non-cancel button, Cancel runs the cancel one
    const cancel = list.find((b) => b.style === 'cancel') || list[0];
    const action = [...list].reverse().find((b) => b !== cancel) || list[list.length - 1];
    const ok = window.confirm(text + '\n\n' + 'OK: ' + action.text + '   Cancel: ' + cancel.text);
    const chosen = ok ? action : cancel;
    if (chosen && chosen.onPress) chosen.onPress();
  };
}

const BASE = './ocr/';
let engine = null;   // Promise<{ M, api }>

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

// fetch() can't read file:// URLs in this web engine; XMLHttpRequest can.
function loadBytes(url) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', url);
    x.responseType = 'arraybuffer';
    x.onload = () => (x.response && x.response.byteLength ? resolve(new Uint8Array(x.response)) : reject(new Error('Empty file: ' + url)));
    x.onerror = () => reject(new Error('Could not read ' + url));
    x.send();
  });
}

function getEngine() {
  if (!engine) {
    engine = (async () => {
      if (typeof window.TesseractCore !== 'function') await loadScript(BASE + 'tesseract-core-lstm.wasm.js');
      const M = await window.TesseractCore();
      M.FS.writeFile('/eng.traineddata', await loadBytes(BASE + 'eng.traineddata'));
      const api = new M.TessBaseAPI();
      if (api.Init('/', 'eng', 1) === -1) throw new Error('Could not start the text reader');
      api.SetVariable('tessedit_pageseg_mode', '3'); // PSM_AUTO, as on Android
      return { M, api };
    })();
    engine.catch(() => { engine = null; });
  }
  return engine;
}

function loadImage(uri) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open the photo'));
    img.src = uri;
  });
}

// Upright (EXIF applied by the browser), long side <= 2000 px, grayscale, as PNG bytes
async function preparePhoto(uri) {
  const img = await loadImage(uri);
  let w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new Error('Could not open the photo');
  const scale = Math.min(1, 2000 / Math.max(w, h));
  w = Math.round(w * scale); h = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h);
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(px, 0, 0);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

async function readBytes(png) {
  const { M, api } = await getEngine();
  M.FS.writeFile('/input', png);
  if (api.SetImageFile(1, 0) === 1) throw new Error('Could not read the photo');
  const text = api.GetUTF8Text() || '';
  api.Clear();
  return text;
}

// Text read from a photo (a data:, blob: or file: URL from the picker).
export async function recognizeLabel(uri) {
  return readBytes(await preparePhoto(uri));
}

export async function selfTestScanner() {
  const text = await readBytes(await preparePhoto(BASE + 'sample-label.png'));
  return checkSelfTest(text);
}

export function checkSelfTest(text) {
  const parsed = parseNutritionLabel(text || '');
  const ok = !!parsed.found && Math.round(parsed.kcal) === 250 && Math.round(parsed.protein) === 5;
  return { ok, text: text || '', parsed };
}
