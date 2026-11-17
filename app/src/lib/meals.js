// Saved meals: named combinations of foods ("Thanksgiving dinner" = turkey + mashed potatoes +
// candied yams) that log in one tap. Stored as state.meals = [{ id, name, meal, items }], where each
// item is a portion of a catalogue or custom food: { foodId, servingLabel, qty, grams, portion, name, snap }.
// `snap` keeps the nutrition from when the item was saved, used if the food is later deleted.
import { nutritionFor, MEALS } from './foods';

const r1 = (n) => Math.round((n || 0) * 10) / 10;

// A portion picked in the portion editor → a meal item.
export function itemFromEntry(entry) {
  return {
    foodId: entry.foodId,
    name: entry.name,
    servingLabel: entry.servingLabel,
    qty: entry.qty,
    grams: entry.grams,
    portion: entry.portion,
    snap: { kcal: entry.kcal || 0, protein: entry.protein || 0, carbs: entry.carbs || 0, fat: entry.fat || 0, fiber: entry.fiber || 0 },
  };
}

// Nutrition for one item at `servings` × its saved portion, using the food's current definition.
export function itemNutrition(item, byId, servings = 1) {
  const food = byId[item.foodId];
  if (food && item.grams > 0) return { food, ...nutritionFor(food, item.grams * servings) };
  const s = item.snap || {};
  return { food: null, kcal: Math.round((s.kcal || 0) * servings), protein: r1(s.protein * servings), carbs: r1(s.carbs * servings), fat: r1(s.fat * servings), fiber: r1(s.fiber * servings) };
}

export function mealTotals(meal, byId, servings = 1) {
  const tot = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const it of meal.items || []) {
    const n = itemNutrition(it, byId, servings);
    for (const k of Object.keys(tot)) tot[k] += n[k] || 0;
  }
  return { kcal: Math.round(tot.kcal), protein: r1(tot.protein), carbs: r1(tot.carbs), fat: r1(tot.fat), fiber: r1(tot.fiber) };
}

const scalePortion = (item, servings) => {
  if (servings === 1) return item.portion;
  if (item.servingLabel === 'grams') return `${Math.round(item.grams * servings)} ${/ml$/.test(item.portion || '') ? 'ml' : 'g'}`;
  return `${Math.round(item.qty * servings * 100) / 100} × ${item.servingLabel}`;
};

// Food-log entries for logging `meal` into `slot` (breakfast/lunch/dinner/snack).
export function mealEntries(meal, byId, slot, servings = 1) {
  return (meal.items || []).map((it) => {
    const { food, ...n } = itemNutrition(it, byId, servings);
    return {
      foodId: food ? it.foodId : undefined,
      name: food ? food.name : it.name,
      meal: slot || meal.meal || 'dinner',
      servingLabel: it.servingLabel,
      qty: it.servingLabel === 'grams' ? 1 : it.qty * servings,
      grams: it.grams * servings,
      portion: scalePortion(it, servings),
      fromMeal: meal.name,
      ...n,
    };
  });
}

export const mealSlotLabel = (key) => (MEALS.find((m) => m.key === key) || MEALS[2]).label;
