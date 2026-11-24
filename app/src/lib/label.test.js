import { parseNutritionLabel } from './label';

test('a standard US Nutrition Facts label', () => {
  const text = `Nutrition Facts
8 servings per container
Serving size 2/3 cup (55g)
Amount per serving
Calories 230
% Daily Value*
Total Fat 8g 10%
Saturated Fat 1g 5%
Trans Fat 0g
Cholesterol 0mg 0%
Sodium 160mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g 14%
Total Sugars 12g
Includes 10g Added Sugars 20%
Protein 3g`;
  const r = parseNutritionLabel(text);
  expect(r).toMatchObject({ servingLabel: '2/3 cup (55g)', kcal: 230, fat: 8, carbs: 37, fiber: 4, protein: 3, found: 4 });
  expect(r.micro).toEqual({ satFat: 1, transFat: 0, cholesterol: 0, sodium: 160, sugars: 12, addedSugars: 10 });
});

test('common text-recognition misreads and layouts', () => {
  const text = `NUTRITION FACTS
Serv. Size 1 bar (40 g)
Calories: 19O  Calories from Fat 7O
Total Fat 7.5 g
Total Carb. 2l g
Dietary Fibre 1 g
Protein
1Og`;
  const r = parseNutritionLabel(text);
  expect(r).toMatchObject({ servingLabel: '1 bar (40 g)', kcal: 190, fat: 7.5, carbs: 21, fiber: 1, protein: 10 });
});

test('vitamins and minerals at the bottom of the label', () => {
  const r = parseNutritionLabel('Calories 200\nProtein 5g\nVitamin D 2mcg 10%\nCalcium 260mg 20%\nIron 8mg 45%\nPotassium 235mg 6%');
  expect(r.micro).toMatchObject({ vitaminD: 2, calcium: 260, iron: 8, potassium: 235 });
});

test('energy in kJ only is converted to kcal', () => {
  const r = parseNutritionLabel('Energy 840 kJ\nFat 3,5 g\nCarbohydrate 30 g\nProtein 6 g');
  expect(r.kcal).toBe(201);
  expect(r.fat).toBe(3.5);
  expect(r.carbs).toBe(30);
});

test('nothing recognisable', () => {
  expect(parseNutritionLabel('hello world')).toMatchObject({ kcal: null, protein: null, found: 0 });
  expect(parseNutritionLabel(null).found).toBe(0);
});

// The sample label bundled with the app (modules/label-ocr/.../labelocr/sample-label.png), as
// Tesseract reads it; Settings → "Test the label scanner" and CI rely on this check.
test('the built-in scanner self-test label', () => {
  const { checkSelfTest } = require('./labelOcr');
  const text = 'Nutrition Facts\n\nServing size 1 cup (228g)\n\nCalories 250\n\nTotal Fat 12g\n\nSodium 470mg\n\nTotal Carbohydrate 31g\n\nProtein 5g\n\nVitamin C 2mg\n';
  const r = checkSelfTest(text);
  expect(r.ok).toBe(true);
  expect(r.parsed.fat).toBe(12);
  expect(checkSelfTest('').ok).toBe(false);
  expect(checkSelfTest('Calories 25O\nProtein 3g').ok).toBe(false);
});
