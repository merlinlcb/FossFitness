import { FOODS, customToFood, nutritionFor } from './foods';
import { itemFromEntry, mealTotals, mealEntries, itemNutrition } from './meals';
import { reducer } from '../state/reducer';
import { DEFAULT_STATE, hydrateState } from '../state/defaults';
import { settingsOf } from './sync';

const turkey = { id: 'my-turkey', name: 'Roast turkey', servingLabel: '1 plate', kcal: 400, protein: 50, carbs: 0, fat: 20, fiber: 0 };
const cat = FOODS.find((f) => !f.custom && !f.perServing && f.servings.length);
const byId = Object.fromEntries([customToFood(turkey), cat].map((f) => [f.id, f]));
const entryFor = (food, servingLabel, qty, grams) => ({ foodId: food.id, name: food.name, servingLabel, qty, grams, portion: `${qty} × ${servingLabel}`, ...nutritionFor(food, grams) });

const meal = {
  id: 'meal-1',
  name: 'Thanksgiving dinner',
  meal: 'dinner',
  items: [itemFromEntry(entryFor(byId['my-turkey'], '1 plate', 1, 100)), itemFromEntry(entryFor(cat, cat.servings[0].label, 2, cat.servings[0].g * 2))],
};

test('totals add up every food, and servings scale them', () => {
  const one = mealTotals(meal, byId);
  const c = nutritionFor(cat, cat.servings[0].g * 2);
  expect(one.kcal).toBe(400 + c.kcal);
  expect(mealTotals(meal, byId, 2).kcal).toBeCloseTo(800 + nutritionFor(cat, cat.servings[0].g * 4).kcal, -1);
});

test('logging a meal makes one entry per food in the chosen slot', () => {
  const entries = mealEntries(meal, byId, 'lunch', 1.5);
  expect(entries).toHaveLength(2);
  expect(entries.every((e) => e.meal === 'lunch' && e.fromMeal === 'Thanksgiving dinner')).toBe(true);
  expect(entries[0]).toMatchObject({ foodId: 'my-turkey', kcal: 600, grams: 150, portion: '1.5 × 1 plate' });
});

test('an edited food changes the meal; a deleted one falls back to saved values', () => {
  const edited = { ...byId, 'my-turkey': customToFood({ ...turkey, kcal: 500 }) };
  expect(itemNutrition(meal.items[0], edited).kcal).toBe(500);
  const gone = { [cat.id]: cat };
  const e = mealEntries(meal, gone, 'dinner')[0];
  expect(e).toMatchObject({ foodId: undefined, name: 'Roast turkey', kcal: 400 });
});

test('reducer saves, edits, deletes meals and logs them; meals sync and survive reloads', () => {
  let s = { ...DEFAULT_STATE, customFoods: [turkey] };
  s = reducer(s, { type: 'SAVE_MEAL', meal: { name: meal.name, meal: 'dinner', items: meal.items } });
  expect(s.meals).toHaveLength(1);
  const id = s.meals[0].id;
  s = reducer(s, { type: 'SAVE_MEAL', meal: { ...s.meals[0], name: 'Turkey day' } });
  expect(s.meals).toHaveLength(1);
  expect(s.meals[0]).toMatchObject({ id, name: 'Turkey day' });
  s = reducer(s, { type: 'ADD_FOODS', day: '2026-11-26', entries: mealEntries(s.meals[0], byId, 'dinner'), t: '2026-11-26T18:00:00.000Z' });
  expect(s.days['2026-11-26'].food.map((f) => f.name)).toEqual(['Roast turkey', cat.name]);
  expect(new Set(s.days['2026-11-26'].food.map((f) => f.id)).size).toBe(2);
  expect(settingsOf(s).meals).toHaveLength(1);
  expect(hydrateState(JSON.parse(JSON.stringify(s))).meals[0].name).toBe('Turkey day');
  s = reducer(s, { type: 'REMOVE_MEAL', id });
  expect(s.meals).toEqual([]);
  expect(s.days['2026-11-26'].food).toHaveLength(2);
});
