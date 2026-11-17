import { customToFood, nutritionFor, entryMicro } from './foods';
import { reducer } from '../state/reducer';
import { DEFAULT_STATE } from '../state/defaults';

describe('custom foods with vitamins and minerals', () => {
  const base = { name: 'Protein bar', servingLabel: '1 bar', kcal: 200, protein: 20, carbs: 22, fat: 7, fiber: 3 };

  test('micronutrients scale with the portion, like the macros', () => {
    const f = customToFood({ id: 'my-1', ...base, micro: { sodium: 180, calcium: 100 } });
    const two = nutritionFor(f, f.servings[0].g * 2);
    expect(two.kcal).toBe(400);
    expect(two.micro).toEqual({ sodium: 360, calcium: 200 });
    expect(entryMicro({ foodId: 'my-1', grams: 50 }, [{ id: 'my-1', ...base, micro: { sodium: 180 } }])).toEqual({ sodium: 90 });
  });

  test('a food without them has none (the label shows dashes)', () => {
    expect(nutritionFor(customToFood({ id: 'my-2', ...base }), 100).micro).toBeUndefined();
    expect(customToFood({ id: 'my-3', ...base, micro: null }).micro).toBeNull();
  });

  test('editing adds them, and clearing them removes them', () => {
    let s = reducer(DEFAULT_STATE, { type: 'ADD_CUSTOM_FOOD', food: base });
    const id = s.customFoods[0].id;
    s = reducer(s, { type: 'UPDATE_CUSTOM_FOOD', id, patch: { ...base, micro: { vitaminC: 30 } } });
    expect(customToFood(s.customFoods[0]).micro).toEqual({ vitaminC: 30 });
    s = reducer(s, { type: 'UPDATE_CUSTOM_FOOD', id, patch: { ...base, micro: null } });
    expect(customToFood(s.customFoods[0]).micro).toBeNull();
  });
});
