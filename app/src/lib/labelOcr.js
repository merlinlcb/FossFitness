// On-device label reading (modules/label-ocr, Tesseract). Nothing leaves the phone.
import { parseNutritionLabel } from './label';

function native() {
  return require('expo-modules-core').requireNativeModule('LabelOcr');
}

// Text read from a photo (content:// or file:// uri).
export function recognizeLabel(uri) {
  return native().recognize(uri);
}

// Reads the sample label bundled with the app and checks the result, so anyone can confirm
// scanning works on their phone. Resolves to { ok, text, parsed }; rejects if the reader fails.
export async function selfTestScanner() {
  const text = await native().selfTest();
  return checkSelfTest(text);
}

export function checkSelfTest(text) {
  const parsed = parseNutritionLabel(text || '');
  const ok = !!parsed.found && Math.round(parsed.kcal) === 250 && Math.round(parsed.protein) === 5;
  return { ok, text: text || '', parsed };
}
