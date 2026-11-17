// Micronutrients tracked per food, in the same order as scripts/build_usda_foods.py (MICROS),
// with US FDA Daily Values for adults (21 CFR 101.9). dv null = no Daily Value.

export const MICRONUTRIENTS = [
  { key: 'satFat', label: 'Saturated fat', unit: 'g', dv: 20, under: 'fat', limit: true },
  { key: 'transFat', label: 'Trans fat', unit: 'g', dv: null, under: 'fat', limit: true },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', dv: 300, limit: true },
  { key: 'sodium', label: 'Sodium', unit: 'mg', dv: 2300, limit: true },
  { key: 'sugars', label: 'Total sugars', unit: 'g', dv: null, under: 'carbs' },
  { key: 'addedSugars', label: 'Added sugars', unit: 'g', dv: 50, under: 'carbs', limit: true },
  { key: 'potassium', label: 'Potassium', unit: 'mg', dv: 4700, mineral: true },
  { key: 'calcium', label: 'Calcium', unit: 'mg', dv: 1300, mineral: true },
  { key: 'iron', label: 'Iron', unit: 'mg', dv: 18, mineral: true },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', dv: 420, mineral: true },
  { key: 'zinc', label: 'Zinc', unit: 'mg', dv: 11, mineral: true },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', dv: 1250, mineral: true },
  { key: 'selenium', label: 'Selenium', unit: 'µg', dv: 55, mineral: true },
  { key: 'copper', label: 'Copper', unit: 'mg', dv: 0.9, mineral: true },
  { key: 'manganese', label: 'Manganese', unit: 'mg', dv: 2.3, mineral: true },
  { key: 'vitaminA', label: 'Vitamin A', unit: 'µg', dv: 900, vitamin: true },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', dv: 90, vitamin: true },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'µg', dv: 20, vitamin: true },
  { key: 'vitaminE', label: 'Vitamin E', unit: 'mg', dv: 15, vitamin: true },
  { key: 'vitaminK', label: 'Vitamin K', unit: 'µg', dv: 120, vitamin: true },
  { key: 'thiamin', label: 'Thiamin (B1)', unit: 'mg', dv: 1.2, vitamin: true },
  { key: 'riboflavin', label: 'Riboflavin (B2)', unit: 'mg', dv: 1.3, vitamin: true },
  { key: 'niacin', label: 'Niacin (B3)', unit: 'mg', dv: 16, vitamin: true },
  { key: 'vitaminB6', label: 'Vitamin B6', unit: 'mg', dv: 1.7, vitamin: true },
  { key: 'folate', label: 'Folate', unit: 'µg', dv: 400, vitamin: true },
  { key: 'vitaminB12', label: 'Vitamin B12', unit: 'µg', dv: 2.4, vitamin: true },
  { key: 'choline', label: 'Choline', unit: 'mg', dv: 550, vitamin: true },
];

export const MACRO_DV = { fat: 78, carbs: 275, fiber: 28, protein: 50 };

// [values...] from the food database → { key: value } (missing values left out).
export function microFromList(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const out = {};
  MICRONUTRIENTS.forEach((n, i) => {
    if (list[i] != null) out[n.key] = list[i];
  });
  return out;
}

export function scaleMicro(micro, factor) {
  if (!micro) return null;
  const out = {};
  for (const [k, v] of Object.entries(micro)) out[k] = Math.round(v * factor * 1000) / 1000;
  return out;
}

export function addMicro(total, micro) {
  for (const [k, v] of Object.entries(micro || {})) total[k] = (total[k] || 0) + v;
  return total;
}

// Show a nutrient amount like a label: 2,300 mg · 8.5 g · 0.9 mg · 12 µg
export function formatAmount(v, unit) {
  if (v == null) return '—';
  const n = v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? (Math.round(v * 10) / 10).toString() : (Math.round(v * 100) / 100).toString();
  return `${n} ${unit}`;
}
