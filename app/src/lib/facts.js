// Full "Nutrition facts" for a day (or the average of several days): macros from the
// log, micronutrients from each entry's food, and how complete the picture is.
import { entryMicro } from './foods';
import { addMicro } from './nutrients';

export function nutritionFacts(state, dayKeys) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const micro = {};
  let entries = 0;
  let known = 0; // entries with micronutrient data
  let kcalKnown = 0;
  const daysWithFood = [];
  for (const k of dayKeys) {
    const food = (state.days[k] || {}).food || [];
    if (food.length) daysWithFood.push(k);
    for (const e of food) {
      entries++;
      totals.kcal += e.kcal || 0;
      totals.protein += e.protein || 0;
      totals.carbs += e.carbs || 0;
      totals.fat += e.fat || 0;
      totals.fiber += e.fiber || 0;
      const m = entryMicro(e, state.customFoods);
      if (m && Object.keys(m).length) {
        known++;
        kcalKnown += e.kcal || 0;
        addMicro(micro, m);
      }
    }
  }
  // Averages are over days that have food logged, so empty days don't drag them down.
  const n = Math.max(1, daysWithFood.length);
  const div = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / n]));
  return {
    days: daysWithFood.length,
    totals: div(totals),
    micro: div(micro),
    entries,
    known,
    coverage: totals.kcal > 0 ? kcalKnown / totals.kcal : entries ? known / entries : 0,
  };
}
