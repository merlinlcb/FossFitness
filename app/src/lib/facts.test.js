import { nutritionFacts } from './facts';
import { FOODS, nutritionFor, entryMicro, customToFood } from './foods';
import { microFromList, MICRONUTRIENTS } from './nutrients';
import { DEFAULT_STATE } from '../state/defaults';

const banana = FOODS.find((f) => f.name === 'Banana');
const usda = FOODS.find((f) => !f.curated && f.micro && f.micro.sodium > 100 && f.micro.calcium > 50);

test('every USDA food and nearly all hand-picked foods carry micronutrients', () => {
  expect(FOODS.filter((f) => f.id.startsWith('usda-') && !f.micro)).toEqual([]);
  expect(FOODS.filter((f) => f.curated && f.micro).length).toBeGreaterThan(130);
  expect(banana.micro.potassium).toBeGreaterThan(300); // per 100 g
  expect(Object.keys(banana.micro).every((k) => MICRONUTRIENTS.some((n) => n.key === k))).toBe(true);
});

test('portions scale micronutrients and logged entries keep them', () => {
  const n = nutritionFor(banana, 118);
  expect(n.micro.potassium).toBeCloseTo(banana.micro.potassium * 1.18, 1);
  expect(microFromList([1, null, 3]).cholesterol).toBe(3);
});

test('older entries (no stored micronutrients) are worked out from their food and grams', () => {
  const old = { foodId: usda.id, grams: 200, kcal: Math.round(usda.per100.kcal * 2) };
  expect(entryMicro(old).sodium).toBeCloseTo(usda.micro.sodium * 2, 1);
  expect(entryMicro({ name: 'Quick add', kcal: 300 })).toBeNull();
  const custom = { id: 'my-1', name: 'Bar', kcal: 200, micro: { sodium: 150 } };
  expect(customToFood(custom).micro).toEqual({ sodium: 150 });
  expect(entryMicro({ foodId: 'my-1', grams: 200 }, [custom]).sodium).toBe(300); // 2 servings
});

test('day totals, 7-day averages and coverage', () => {
  const d1 = '2026-11-16';
  const d2 = '2026-11-17';
  const state = {
    ...DEFAULT_STATE,
    days: {
      [d1]: { food: [
        { id: 'a', foodId: banana.id, grams: 100, ...nutritionFor(banana, 100) },
        { id: 'b', name: 'Quick add', kcal: banana.per100.kcal, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      ], water: [], exercise: [] },
      [d2]: { food: [{ id: 'c', foodId: banana.id, grams: 300, kcal: banana.per100.kcal * 3, protein: 0, carbs: 0, fat: 0, fiber: 0 }], water: [], exercise: [] },
    },
  };
  const one = nutritionFacts(state, [d1]);
  expect(one.entries).toBe(2);
  expect(one.known).toBe(1);
  expect(one.coverage).toBeCloseTo(0.5, 2);
  expect(one.micro.potassium).toBeCloseTo(banana.micro.potassium, 1);
  const avg = nutritionFacts(state, ['2026-11-15', d1, d2]); // the empty day doesn't count
  expect(avg.days).toBe(2);
  expect(avg.micro.potassium).toBeCloseTo((banana.micro.potassium * 4) / 2, 1);
  expect(nutritionFacts(state, ['2026-11-01']).entries).toBe(0);
});

describe('restaurant menu items', () => {
  const { searchFoods } = require('./foods');
  test('are loaded with per-serving nutrition', () => {
    const r = FOODS.filter((f) => f.category === 'Restaurants');
    expect(r.length).toBeGreaterThan(20000);
    const bigMac = r.find((f) => f.name === "McDonald's: Big Mac");
    expect(bigMac.perServing).toBe(true);
    expect(nutritionFor(bigMac, bigMac.servings[0].g)).toMatchObject({ kcal: 540, protein: 25 });
    expect(nutritionFor(bigMac, bigMac.servings[0].g).micro.sodium).toBe(950);
    const weighed = r.find((f) => !f.perServing);
    expect(weighed.servings.length).toBeGreaterThan(1);
  });
  test('search finds chains without apostrophes, and keeps general foods first otherwise', () => {
    expect(searchFoods('mcdonalds big mac', FOODS)[0].name).toBe("McDonald's: Big Mac");
    expect(searchFoods('big mac', FOODS).some((f) => f.name === "McDonald's: Big Mac")).toBe(true);
    expect(searchFoods('banana', FOODS)[0].name).toBe('Banana');
    expect(searchFoods('taco bell', FOODS)[0].chain).toBe('Taco Bell');
  });
});
