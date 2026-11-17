// Derived numbers used across screens, computed from raw state.
import { dayKey, lastNDays, minutesSinceMidnight, timeToMinutes, parseDayKey } from './dates';
import {
  calorieTarget,
  macroTargets,
  waterGoal,
  sumFood,
  sumWater,
  sumExerciseMinutes,
  sumExerciseCalories,
  tdee,
  bmr,
} from './calc';
import { activeMinutes, activityByKey, stepsCalories } from './exercise';
import { EMPTY_DAY } from '../state/defaults';

export function getDay(state, key) {
  return { ...EMPTY_DAY, ...(state.days[key] || {}) };
}

export function dayMetrics(state, key = dayKey()) {
  const day = getDay(state, key);
  const exMinutes = sumExerciseMinutes(day.exercise);
  const exKcal = sumExerciseCalories(day.exercise) + stepsCalories(day.steps, state.profile.weightKg);
  const baseKcalTarget = calorieTarget(state.profile);
  const kcalTarget = state.profile.eatBackExercise ? baseKcalTarget + Math.round(exKcal * 0.5) : baseKcalTarget;
  const food = sumFood(day.food);
  const water = sumWater(day.water);
  const wGoal = waterGoal(state.profile, exMinutes);
  return {
    key,
    day,
    food,
    water,
    waterGoal: wGoal,
    kcalTarget,
    baseKcalTarget,
    macros: macroTargets(state.profile, kcalTarget),
    exMinutes,
    exKcal,
    activeMinutes: activeMinutes(day.exercise),
    steps: day.steps || 0,
    hasFood: day.food.length > 0,
    hasWater: day.water.length > 0,
  };
}

// How much water "should" be in by now, spreading the goal across waking hours.
export function waterPaceTarget(profile, goal, now = new Date()) {
  const wake = timeToMinutes(profile.wakeTime || '07:00');
  let sleep = timeToMinutes(profile.sleepTime || '23:00');
  if (sleep <= wake) sleep += 1440;
  let nowMin = minutesSinceMidnight(now);
  if (nowMin < wake && sleep > 1440) nowMin += 1440;
  // Aim to finish the goal ~1.5h before bed (so you aren't up all night).
  const end = Math.max(wake + 60, sleep - 90);
  const frac = Math.min(1, Math.max(0, (nowMin - wake) / (end - wake)));
  return Math.round(goal * frac);
}

export function weekMetrics(state, end = new Date()) {
  const keys = lastNDays(7, end);
  const days = keys.map((k) => dayMetrics(state, k));
  const loggedFoodDays = days.filter((d) => d.hasFood);
  const strengthDays = days.filter((d) => d.day.exercise.some((e) => activityByKey(e.type).strength)).length;
  return {
    keys,
    days,
    totalActiveMinutes: days.reduce((a, d) => a + d.activeMinutes, 0),
    strengthDays,
    avgKcal: loggedFoodDays.length ? loggedFoodDays.reduce((a, d) => a + d.food.kcal, 0) / loggedFoodDays.length : 0,
    avgProtein: loggedFoodDays.length ? loggedFoodDays.reduce((a, d) => a + d.food.protein, 0) / loggedFoodDays.length : 0,
    foodDaysLogged: loggedFoodDays.length,
    waterDaysMet: days.filter((d) => d.water >= d.waterGoal).length,
    avgWater: days.reduce((a, d) => a + d.water, 0) / days.length,
  };
}

// Sorted weigh-ins with a 7-entry exponential moving average ("trend weight"),
// which smooths out daily water-weight noise.
export function weightTrend(weights) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  let ema = null;
  const alpha = 0.25;
  return sorted.map((w) => {
    ema = ema == null ? w.kg : ema + alpha * (w.kg - ema);
    return { ...w, trend: Math.round(ema * 100) / 100 };
  });
}

// Observed rate of change in kg/week using linear regression on the last `days` days.
export function weightRate(weights, days = 28, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const pts = weights
    .filter((w) => parseDayKey(w.date) >= cutoff)
    .map((w) => ({ x: parseDayKey(w.date).getTime() / 86400000, y: w.kg }));
  if (pts.length < 3) return null;
  const span = pts[pts.length - 1].x - pts[0].x;
  if (span < 6) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (!den) return null;
  return (num / den) * 7;
}

export function energySummary(profile) {
  return { bmr: bmr(profile), tdee: tdee(profile), target: calorieTarget(profile) };
}

// Hour-of-day distribution of calories over the last N days, to spot late eating.
export function lateEatingShare(state, n = 7, lateHour = 20) {
  let total = 0;
  let late = 0;
  for (const k of lastNDays(n)) {
    for (const f of getDay(state, k).food) {
      total += f.kcal || 0;
      if (new Date(f.t).getHours() >= lateHour) late += f.kcal || 0;
    }
  }
  return total ? late / total : 0;
}
