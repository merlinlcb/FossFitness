// Reads a nutrition label from the text the phone's text recognition found.
// Pure JavaScript so it can be tested. Handles US "Nutrition Facts" labels and
// the usual misreads (O for 0, l for 1, "8 g" split across lines, kcal/kJ).

const NUM = '(\\d{1,4}(?:[.,]\\d{1,2})?)';

// Fix characters text recognition commonly confuses inside numbers.
function cleanDigits(text) {
  return text
    .replace(/(\d)[oO](?=\s*(?:g|mg|kcal|cal)\b)/g, '$10') // "1Og" → "10g"
    .replace(/(\d)[oO](?![a-zA-Z])/g, '$10') // "19O" → "190"
    .replace(/\b[oO](?=\s*(?:g|mg)\b)/g, '0') // "Og" → "0g"
    .replace(/(\d)[lI](?=\d|\s*g\b)/g, '$11') // "1l g" → "11 g"
    .replace(/(?<=\s)[lI](?=\d)/g, '1'); // " l2g" → " 12g"
}

const toNum = (s) => (s == null ? null : parseFloat(String(s).replace(',', '.')));

function find(text, labels, { unit = 'g', max = 500 } = {}) {
  for (const label of labels) {
    // "Protein 8g", "Protein: 8 g", "Protein\n8g"; skip "% Daily Value" numbers after the amount.
    const re = new RegExp(`${label}[^\\d\\n%]{0,20}?\\s*${NUM}\\s*${unit}`, 'i');
    const m = text.match(re);
    if (m) {
      const v = toNum(m[1]);
      if (v != null && v <= max) return v;
    }
  }
  return null;
}

export function parseNutritionLabel(raw) {
  const text = cleanDigits(String(raw || '')).replace(/\r/g, '');
  const out = { servingLabel: null, kcal: null, protein: null, carbs: null, fat: null, fiber: null };

  // Calories: "Calories 230", "Calories: 230", "Energy 230 kcal", but not "Calories from Fat 72".
  let m = text.match(/calories(?!\s*from)[^\d\n]{0,12}(\d{1,4})/i) || text.match(/(\d{1,4})\s*k?cal\b/i);
  if (m) out.kcal = toNum(m[1]);
  if (out.kcal == null) {
    const kj = text.match(/(\d{2,5})\s*kJ/i);
    if (kj) out.kcal = Math.round(toNum(kj[1]) / 4.184);
  }

  out.fat = find(text, ['total\\s*fat', 'fat']);
  out.carbs = find(text, ['total\\s*carbohydrates?', 'total\\s*carbs?\\.?', 'carbohydrates?', 'carbs?']);
  out.protein = find(text, ['protein']);
  out.fiber = find(text, ['dietary\\s*fib(?:er|re)', 'fib(?:er|re)']);

  // Serving size: "Serving size 2/3 cup (55g)" or "Serv. Size 1 bar (40 g)".
  m = text.match(/serv(?:ing|\.)?\s*size\s*[:\-]?\s*([^\n]{1,50})/i);
  if (m) out.servingLabel = m[1].replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '');

  // Micronutrients printed on US labels (amounts, not % Daily Value).
  const micro = {};
  const put = (key, v) => {
    if (v != null) micro[key] = v;
  };
  put('satFat', find(text, ['saturated\\s*fat', 'sat\\.?\\s*fat'], { max: 100 }));
  put('transFat', find(text, ['trans\\s*fat'], { max: 100 }));
  put('cholesterol', find(text, ['cholesterol', 'cholest\\.?'], { unit: 'mg', max: 2000 }));
  put('sodium', find(text, ['sodium'], { unit: 'mg', max: 9000 }));
  put('sugars', find(text, ['total\\s*sugars?', '(?<!added\\s)sugars?'], { max: 300 }));
  put('addedSugars', find(text, ['added\\s*sugars?'], { max: 300 }));
  put('potassium', find(text, ['potassium', 'potas\\.?'], { unit: 'mg', max: 9000 }));
  put('calcium', find(text, ['calcium'], { unit: 'mg', max: 5000 }));
  put('iron', find(text, ['iron'], { unit: 'mg', max: 200 }));
  put('vitaminD', find(text, ['vitamin\\s*d', 'vit\\.?\\s*d'], { unit: '(?:mcg|µg|ug)', max: 500 }));
  // "Includes 10g Added Sugars": the number comes before the words.
  const added = text.match(/includes?\s*(\d{1,3}(?:[.,]\d)?)\s*g\s*added\s*sugars?/i);
  if (added) micro.addedSugars = toNum(added[1]);

  const found = ['kcal', 'protein', 'carbs', 'fat'].filter((k) => out[k] != null).length;
  return { ...out, micro, found };
}
