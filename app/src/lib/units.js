// Everything is stored in metric (kg, cm, ml). Conversion happens only for display/input.

export const LB_PER_KG = 2.20462;
export const ML_PER_OZ = 29.5735;
export const CM_PER_IN = 2.54;

export const kgToLb = (kg) => kg * LB_PER_KG;
export const lbToKg = (lb) => lb / LB_PER_KG;
export const mlToOz = (ml) => ml / ML_PER_OZ;
export const ozToMl = (oz) => oz * ML_PER_OZ;
export const cmToIn = (cm) => cm / CM_PER_IN;
export const inToCm = (inch) => inch * CM_PER_IN;

const round1 = (n) => Math.round(n * 10) / 10;

export function weightToDisplay(kg, units) {
  if (kg == null || isNaN(kg)) return null;
  return units === 'metric' ? round1(kg) : round1(kgToLb(kg));
}

export function weightFromDisplay(value, units) {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return units === 'metric' ? n : lbToKg(n);
}

export const weightUnit = (units) => (units === 'metric' ? 'kg' : 'lb');

export function formatWeight(kg, units) {
  const v = weightToDisplay(kg, units);
  return v == null ? '—' : `${v} ${weightUnit(units)}`;
}

export function formatWeightDelta(kg, units) {
  const v = weightToDisplay(Math.abs(kg), units);
  const sign = kg > 0.0001 ? '+' : kg < -0.0001 ? '−' : '±';
  return `${sign}${v} ${weightUnit(units)}`;
}

export function heightFeetInches(cm) {
  const totalIn = Math.round(cmToIn(cm));
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}

export function formatHeight(cm, units) {
  if (!cm) return '—';
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const { ft, inch } = heightFeetInches(cm);
  return `${ft}′ ${inch}″`;
}

export function waterToDisplay(ml, waterUnit) {
  return waterUnit === 'ml' ? Math.round(ml) : Math.round(mlToOz(ml));
}

export function waterFromDisplay(value, waterUnit) {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return waterUnit === 'ml' ? n : ozToMl(n);
}

export function formatWater(ml, waterUnit) {
  if (waterUnit === 'ml') {
    return ml >= 1000 ? `${round1(ml / 1000)} L` : `${Math.round(ml)} ml`;
  }
  return `${Math.round(mlToOz(ml))} oz`;
}
