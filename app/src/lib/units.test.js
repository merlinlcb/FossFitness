// What units.js really does with metric <-> imperial display and input: known values, round trips,
// and the awkward inputs (empty strings, missing values, negative numbers).

import {
  CM_PER_IN, LB_PER_KG, ML_PER_OZ,
  kgToLb, lbToKg, mlToOz, ozToMl, cmToIn, inToCm,
  weightToDisplay, weightFromDisplay, weightUnit, formatWeight, formatWeightDelta,
  heightFeetInches, formatHeight,
  waterToDisplay, waterFromDisplay, formatWater,
} from './units';

const ftInToCm = ({ ft, inch }) => (ft * 12 + inch) * CM_PER_IN;

test('the conversion constants are the standard ones', () => {
  expect(CM_PER_IN).toBe(2.54);
  expect(LB_PER_KG).toBeCloseTo(2.20462262, 5);
  expect(ML_PER_OZ).toBeCloseTo(29.5735296, 4);
});

test('single conversions match the known values', () => {
  expect(kgToLb(1)).toBe(2.20462);
  expect(lbToKg(2.20462)).toBe(1);
  expect(lbToKg(1)).toBeCloseTo(0.45359291, 7);
  expect(cmToIn(1)).toBeCloseTo(0.3937008, 7);
  expect(inToCm(1)).toBe(2.54);
  expect(mlToOz(240)).toBeCloseTo(8.11537, 5);
  expect(ozToMl(1)).toBe(29.5735);
});

test('round trips get back to the starting number', () => {
  for (const kg of [0, 1, 55.3, 70, 120.75]) {
    expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 6);
  }
  for (const cm of [0, 1, 160, 175.5, 180, 200]) {
    expect(inToCm(cmToIn(cm))).toBeCloseTo(cm, 6);
  }
  for (const ml of [0, 1, 240, 1000, 3550]) {
    expect(ozToMl(mlToOz(ml))).toBeCloseTo(ml, 6);
  }
});

test('cm -> ft/in -> cm is never more than half an inch off, because inches are rounded', () => {
  for (const cm of [1, 160, 175.5, 180, 195, 200]) {
    expect(Math.abs(ftInToCm(heightFeetInches(cm)) - cm)).toBeLessThanOrEqual(CM_PER_IN / 2 + 1e-9);
  }
});

test('weightToDisplay rounds to one decimal and only converts for imperial', () => {
  expect(weightToDisplay(70, 'metric')).toBe(70);
  expect(weightToDisplay(70.05, 'metric')).toBe(70.1);
  expect(weightToDisplay(70, 'imperial')).toBe(154.3);
  expect(weightToDisplay(0, 'metric')).toBe(0);
  expect(weightToDisplay(0, 'imperial')).toBe(0);
  expect(weightToDisplay(-70, 'metric')).toBe(-70);
  expect(weightToDisplay('70', 'metric')).toBe(70);
  expect(weightToDisplay(70, 'anything else')).toBe(154.3);
});

test('weightToDisplay returns null for missing or unreadable numbers', () => {
  expect(weightToDisplay(null, 'metric')).toBe(null);
  expect(weightToDisplay(undefined, 'metric')).toBe(null);
  expect(weightToDisplay('abc', 'metric')).toBe(null);
  expect(weightToDisplay(NaN, 'metric')).toBe(null);
  expect(weightToDisplay('', 'metric')).toBe(0); // an empty string reads as zero
});

test('weightFromDisplay accepts typed numbers and converts lb back to kg', () => {
  expect(weightFromDisplay('70', 'metric')).toBe(70);
  expect(weightFromDisplay(70.5, 'metric')).toBe(70.5);
  expect(weightFromDisplay('150', 'imperial')).toBeCloseTo(68.0389, 4);
  expect(weightFromDisplay('70.5 lb', 'imperial')).toBeCloseTo(31.9783, 4);
  expect(weightFromDisplay(-70, 'imperial')).toBeCloseTo(-31.7515, 4);
  expect(weightFromDisplay(0, 'imperial')).toBe(0);
  expect(weightFromDisplay('', 'metric')).toBe(null);
  expect(weightFromDisplay(null, 'metric')).toBe(null);
  expect(weightFromDisplay('abc', 'metric')).toBe(null);
});

test('weightUnit says kg for metric and lb for everything else', () => {
  expect(weightUnit('metric')).toBe('kg');
  expect(weightUnit('imperial')).toBe('lb');
  expect(weightUnit(undefined)).toBe('lb');
});

test('formatWeight puts the unit on the value, or an em dash when there is none', () => {
  expect(formatWeight(70, 'metric')).toBe('70 kg');
  expect(formatWeight(70.25, 'metric')).toBe('70.3 kg');
  expect(formatWeight(70, 'imperial')).toBe('154.3 lb');
  expect(formatWeight(0, 'imperial')).toBe('0 lb');
  expect(formatWeight(null, 'metric')).toBe('—');
  expect(formatWeight(undefined, 'imperial')).toBe('—');
  expect(formatWeight(NaN, 'metric')).toBe('—');
});

test('formatWeightDelta signs the change and rounds tiny ones to zero', () => {
  expect(formatWeightDelta(0.5, 'metric')).toBe('+0.5 kg');
  expect(formatWeightDelta(-0.5, 'metric')).toBe('−0.5 kg');
  expect(formatWeightDelta(0, 'metric')).toBe('±0 kg');
  expect(formatWeightDelta(0.00001, 'metric')).toBe('±0 kg');
  expect(formatWeightDelta(-0.00001, 'metric')).toBe('±0 kg');
  expect(formatWeightDelta(-2, 'imperial')).toBe('−4.4 lb');
  expect(formatWeightDelta(null, 'metric')).toBe('±0 kg');
  expect(formatWeightDelta(NaN, 'metric')).toBe('±null kg'); // a missing change is not handled here
});

test('heightFeetInches rounds to whole inches', () => {
  expect(heightFeetInches(180)).toEqual({ ft: 5, inch: 11 }); // 180 cm is 5 ft 10.9 in
  expect(heightFeetInches(170)).toEqual({ ft: 5, inch: 7 });
  expect(heightFeetInches(11.4)).toEqual({ ft: 0, inch: 4 });
  expect(heightFeetInches(60.96)).toEqual({ ft: 2, inch: 0 }); // exactly 24 in is 2 ft 0 in
  expect(heightFeetInches(0)).toEqual({ ft: 0, inch: 0 });
  expect(heightFeetInches('180')).toEqual({ ft: 5, inch: 11 });
  expect(heightFeetInches(-180)).toEqual({ ft: -6, inch: -11 });
  expect(Number.isNaN(heightFeetInches(undefined).inch)).toBe(true);
});

test('formatHeight prints cm, feet and inches, or an em dash for no height', () => {
  expect(formatHeight(180, 'metric')).toBe('180 cm');
  expect(formatHeight(180, 'imperial')).toBe('5′ 11″');
  expect(formatHeight(175.5, 'imperial')).toBe('5′ 9″');
  expect(formatHeight(0, 'imperial')).toBe('—');
  expect(formatHeight(null, 'metric')).toBe('—');
  expect(formatHeight(undefined, 'imperial')).toBe('—');
  expect(formatHeight('180', 'imperial')).toBe('5′ 11″');
  expect(formatHeight(-180, 'imperial')).toBe('-6′ -11″'); // negative heights are not rejected
  expect(formatHeight(180, undefined)).toBe('5′ 11″');
});

test('waterToDisplay keeps ml or rounds fluid ounces', () => {
  expect(waterToDisplay(1000, 'ml')).toBe(1000);
  expect(waterToDisplay(240, 'oz')).toBe(8);
  expect(waterToDisplay(240, 'fl oz')).toBe(8);
  expect(waterToDisplay(0, 'ml')).toBe(0);
  expect(waterToDisplay(0, 'oz')).toBe(0);
  expect(waterToDisplay(-500, 'ml')).toBe(-500);
  expect(waterToDisplay(null, 'ml')).toBe(0); // Math.round(null) is 0
  expect(Number.isNaN(waterToDisplay(undefined, 'ml'))).toBe(true);
});

test('waterFromDisplay reads typed input and converts oz back to ml', () => {
  expect(waterFromDisplay('1000', 'ml')).toBe(1000);
  expect(waterFromDisplay('8', 'oz')).toBeCloseTo(236.588, 3);
  expect(waterFromDisplay(-8, 'oz')).toBeCloseTo(-236.588, 3);
  expect(waterFromDisplay(0, 'oz')).toBe(0);
  expect(waterFromDisplay('', 'ml')).toBe(null);
  expect(waterFromDisplay(null, 'ml')).toBe(null);
  expect(waterFromDisplay('abc', 'oz')).toBe(null);
});

test('formatWater switches to litres at a full litre', () => {
  expect(formatWater(1000, 'ml')).toBe('1 L');
  expect(formatWater(1500, 'ml')).toBe('1.5 L');
  expect(formatWater(999, 'ml')).toBe('999 ml');
  expect(formatWater(240, 'oz')).toBe('8 oz');
  expect(formatWater(0, 'ml')).toBe('0 ml');
  expect(formatWater(14.78675, 'oz')).toBe('1 oz');
  expect(formatWater(-100, 'ml')).toBe('-100 ml');
  expect(formatWater(999.6, 'ml')).toBe('1000 ml'); // rounds to 1000 ml, never to 1 L
  expect(formatWater(null, 'ml')).toBe('0 ml');
});
