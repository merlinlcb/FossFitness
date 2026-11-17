// Core health calculations. All inputs are metric (kg, cm, ml, minutes).
// These are evidence-based estimates for general wellness, not medical advice.

export const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise', factor: 1.2 },
  { key: 'light', label: 'Lightly active', desc: 'Light exercise 1–3 days/wk', factor: 1.375 },
  { key: 'moderate', label: 'Moderately active', desc: 'Exercise 3–5 days/wk', factor: 1.55 },
  { key: 'very', label: 'Very active', desc: 'Hard exercise 6–7 days/wk', factor: 1.725 },
  { key: 'extreme', label: 'Extremely active', desc: 'Physical job + training', factor: 1.9 },
];

export const GOALS = [
  { key: 'lose', label: 'Lose weight' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'gain', label: 'Build / gain' },
];

// kg per week
export const PACES = [
  { key: 0.25, label: 'Gentle', desc: '≈0.5 lb / 0.25 kg per week' },
  { key: 0.5, label: 'Steady', desc: '≈1 lb / 0.5 kg per week' },
  { key: 0.75, label: 'Faster', desc: '≈1.5 lb / 0.75 kg per week' },
  { key: 1.0, label: 'Aggressive', desc: '≈2 lb / 1 kg per week' },
];

const KCAL_PER_KG_FAT = 7700;

export function isProfileComplete(p) {
  return !!(p && p.age > 0 && p.heightCm > 0 && p.weightKg > 0 && p.sex);
}

// Mifflin–St Jeor equation (most accurate general-population BMR estimate).
export function bmr({ weightKg, heightCm, age, sex }) {
  if (!weightKg || !heightCm || !age) return 0;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'female' ? base - 161 : base + 5);
}

export function activityFactor(level) {
  return (ACTIVITY_LEVELS.find((a) => a.key === level) || ACTIVITY_LEVELS[2]).factor;
}

export function tdee(profile) {
  return Math.round(bmr(profile) * activityFactor(profile.activityLevel));
}

export function minimumCalories(sex) {
  return sex === 'female' ? 1200 : 1500;
}

// The person's own calorie target, if they set one (profile.calorieGoal), else the suggestion.
export function hasOwnCalorieGoal(profile) {
  return Number(profile && profile.calorieGoal) > 0;
}

export function calorieTarget(profile) {
  if (hasOwnCalorieGoal(profile)) return Math.round(Number(profile.calorieGoal));
  return suggestedCalorieTarget(profile);
}

// Suggested daily calorie target based on goal and pace. Never drops below a safe floor.
export function suggestedCalorieTarget(profile) {
  const maintenance = tdee(profile);
  if (!maintenance) return 2000;
  const pace = Number(profile.paceKgPerWeek) || 0.5;
  const dailyDelta = Math.round((pace * KCAL_PER_KG_FAT) / 7);
  let target = maintenance;
  if (profile.goal === 'lose') target = maintenance - dailyDelta;
  if (profile.goal === 'gain') target = maintenance + Math.min(dailyDelta, 500);
  const floor = minimumCalories(profile.sex);
  return Math.round(Math.max(target, floor));
}

// True when the requested pace would push intake below the safe floor.
export function isPaceClamped(profile) {
  if (profile.goal !== 'lose' || hasOwnCalorieGoal(profile)) return false;
  const maintenance = tdee(profile);
  const pace = Number(profile.paceKgPerWeek) || 0.5;
  return maintenance - (pace * KCAL_PER_KG_FAT) / 7 < minimumCalories(profile.sex);
}

export function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return 0;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(value) {
  if (!value) return '';
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Healthy range';
  if (value < 30) return 'Overweight';
  return 'Obese range';
}

export function healthyWeightRange(heightCm) {
  const m = heightCm / 100;
  return { min: Math.round(18.5 * m * m * 10) / 10, max: Math.round(24.9 * m * m * 10) / 10 };
}

// Reference weight for protein: avoids huge protein targets at high body weight.
export function referenceWeight(profile) {
  const { weightKg, heightCm, goalWeightKg } = profile;
  if (!weightKg) return 70;
  let ref = weightKg;
  if (heightCm) {
    const upper = healthyWeightRange(heightCm).max;
    if (weightKg > upper) ref = (weightKg + upper) / 2; // adjusted body weight
  }
  if (goalWeightKg && profile.goal === 'lose') ref = Math.max(goalWeightKg, Math.min(ref, weightKg));
  return ref;
}

// Daily macro targets. Each one can be set by hand in Settings (proteinGoal, carbsGoal,
// fatGoal, fiberGoal); anything not set is suggested from calories and body weight.
export function macroTargets(profile, kcal = calorieTarget(profile)) {
  const own = (k) => (Number(profile[k]) > 0 ? Math.round(Number(profile[k])) : null);
  const s = suggestedMacros(profile, kcal);
  const protein = own('proteinGoal') ?? s.protein;
  const fat = own('fatGoal') ?? s.fat;
  // Carbs fill whatever calories protein and fat leave, unless set by hand.
  const carbs = own('carbsGoal') ?? Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = own('fiberGoal') ?? s.fiber;
  return { protein, fat, carbs, fiber };
}

export function suggestedMacros(profile, kcal = calorieTarget(profile)) {
  const perKg = profile.goal === 'maintain' ? 1.2 : 1.6;
  const protein = Math.round(referenceWeight(profile) * perKg);
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((kcal / 1000) * 14);
  return { protein, fat, carbs, fiber };
}

// Daily water goal in ml. ~35 ml/kg baseline, plus extra for exercise and heat.
export function waterGoal(profile, exerciseMinutes = 0) {
  const kg = profile.weightKg || 70;
  let base = Math.min(Math.max(kg * 35, 1500), 4000);
  if (profile.climate === 'hot') base += 500;
  if (profile.pregnancy === 'pregnant') base += 300;
  if (profile.pregnancy === 'breastfeeding') base += 700;
  const exerciseExtra = Math.min(exerciseMinutes, 240) * 12; // ≈350 ml per 30 min
  return Math.round((base + exerciseExtra) / 50) * 50;
}

// Calories from activity using METs: kcal = MET × kg × hours
export function exerciseCalories(met, weightKg, minutes) {
  if (!met || !weightKg || !minutes) return 0;
  return Math.round(met * weightKg * (minutes / 60));
}

// Days until goal weight at the current observed rate (kg/week, negative = losing).
export function projectGoalDate(currentKg, goalKg, ratePerWeek, from = new Date()) {
  if (!currentKg || !goalKg || !ratePerWeek) return null;
  const diff = goalKg - currentKg;
  if (Math.abs(diff) < 0.2) return null;
  if (Math.sign(diff) !== Math.sign(ratePerWeek)) return null;
  const weeks = diff / ratePerWeek;
  if (weeks > 260) return null;
  const d = new Date(from);
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d;
}

// Sum nutrition for a list of food entries.
export function sumFood(entries = []) {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
      fiber: acc.fiber + (e.fiber || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

export const sumWater = (entries = []) => entries.reduce((a, e) => a + (e.ml || 0), 0);
export const sumExerciseMinutes = (entries = []) => entries.reduce((a, e) => a + (e.minutes || 0), 0);
export const sumExerciseCalories = (entries = []) => entries.reduce((a, e) => a + (e.kcal || 0), 0);

// "If every day were like this one, in `weeks` weeks you'd weigh about X."
export function projectWeight(profile, eatenKcal, exerciseKcal, weeks = 5) {
  const burn = tdee(profile) + (exerciseKcal || 0);
  const dailyDelta = eatenKcal - burn; // kcal per day above (+) or below (−) what you burn
  const kgChange = (dailyDelta * 7 * weeks) / 7700;
  return { burn, dailyDelta, kgChange, kg: (profile.weightKg || 0) + kgChange };
}
