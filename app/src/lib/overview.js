// Numbers behind the overview parts of the Today page: today's to-do list, this week's progress,
// and a look a few weeks ahead based on how things have gone so far.
import { dayKey, parseDayKey, addDays, atTime } from './dates';
import { dayMetrics, weightTrend, weightRate } from './metrics';
import { tdee, projectGoalDate } from './calc';
import { MEALS } from './foods';
import { fastHoursFor } from './fasting';
import { summarizeDays, scoreDay, weekKey } from './game';
import { sessionFor, scheduleForDate, stepGoal, DAILY_GOALS } from './workoutPlan';
import { formatWater } from './units';
import { exerciseProgress } from './exerciseGoal';
import { weighInDueOn } from './weighIn';

export const FORECAST_WEEKS = [2, 4, 8, 12];

// ---------- Still to do today ----------
// Each item: { id, icon, label, detail, done, place, sub? }: tapping goes to goTo(place, { sub }).
// place 'sleep' is special: the sleep entry lives on Today itself, so Today opens its sheet.
export function todoList(state, now = new Date()) {
  const { profile, fasting, reminders, workoutPlan } = state;
  const key = dayKey(now);
  const m = dayMetrics(state, key);
  const day = state.days[key] || {};
  const out = [];
  const add = (item) => out.push(item);

  // Meals. With fasting on, meals happen inside the eating window, so just ask for two logs.
  if (fasting.enabled) {
    const n = m.day.food.length;
    add({ id: 'meals', icon: '🍴', label: 'Log your meals', detail: n ? `${n} logged` : 'Nothing logged yet', done: n >= 2, place: 'food' });
  } else {
    for (const meal of MEALS.filter((x) => x.key !== 'snack')) {
      const has = m.day.food.some((f) => f.meal === meal.key);
      const at = atTime(now, (reminders.meals || {})[meal.key] || '12:00');
      add({
        id: `meal-${meal.key}`,
        icon: meal.icon,
        label: `Log ${meal.label.toLowerCase()}`,
        detail: has ? 'Logged' : now >= at ? 'Not logged yet' : `Around ${(reminders.meals || {})[meal.key] || ''}`.trim(),
        done: has,
        place: 'food',
      });
    }
  }

  if (profile.waterTracking !== false) {
    const left = m.waterGoal - m.water;
    add({ id: 'water', icon: '💧', label: 'Reach your water goal', detail: left > 0 ? `${formatWater(left, profile.waterUnit)} to go` : 'Goal reached', done: left <= 0, place: 'water' });
  }

  const pMin = profile.proteinGoal || m.macros.protein;
  const pLeft = Math.round(pMin - m.food.protein);
  add({ id: 'protein', icon: '🥩', label: 'Hit your protein', detail: pLeft > 0 ? `${pLeft} g to go` : 'Goal reached', done: pLeft <= 0, place: 'food' });

  // Workout: only on days the plan has one (rest days and optional days don't nag).
  const log = day.workout || {};
  const session = sessionFor(key, log, workoutPlan);
  if (session.free) {
    const moved = !!log.done || m.exMinutes > 0;
    add({ id: 'workout', icon: '🏋️', label: 'Train or move', detail: moved ? 'Done' : 'Nothing logged yet', done: moved, place: 'move' });
  } else if (!session.rest) {
    const optional = scheduleForDate(key, workoutPlan).options.some((o) => o.rest);
    if (!optional || log.done) {
      add({ id: 'workout', icon: '🏋️', label: session.title || 'Workout', detail: log.done ? 'Done' : 'Not done yet', done: !!log.done, place: 'move' });
    }
  }

  const g = exerciseProgress(state, now);
  if (g.enabled) {
    add({ id: 'exgoal', icon: '🎯', label: 'Exercise goal', detail: `${g.value.toLocaleString()} / ${g.target.toLocaleString()} ${g.short}`, done: g.done, place: 'move' });
  }

  const sGoal = stepGoal(workoutPlan.stepPlan, now);
  if (sGoal) {
    add({ id: 'steps', icon: '👣', label: 'Step goal', detail: `${m.steps.toLocaleString()} / ${sGoal.toLocaleString()}`, done: m.steps >= sGoal, place: 'move', sub: 'steps' });
  }

  add({ id: 'sleep', icon: '😴', label: "Log last night's sleep", detail: day.sleepHours != null ? `${day.sleepHours} h` : 'Not logged', done: day.sleepHours != null, place: 'sleep' });

  if (reminders.weighIn && reminders.weighIn.enabled) {
    if (weighInDueOn(reminders.weighIn, now)) {
      const weighed = state.weights.some((w) => w.date === key);
      add({ id: 'weigh', icon: '⚖️', label: 'Weigh in', detail: weighed ? 'Done' : 'Best before breakfast', done: weighed, place: 'progress', sub: 'weigh' });
    }
  }

  if (fasting.enabled) {
    const started = !!fasting.active || (fasting.history || []).some((f) => dayKey(f.start) === key);
    add({ id: 'fast', icon: '⏱️', label: `Start your ${fastHoursFor(fasting)}h fast`, detail: started ? 'Fasting' : 'When your eating window closes', done: started, place: 'fast' });
  }

  return out;
}

// ---------- This week (Monday to Sunday) ----------
export function weekProgress(state, now = new Date()) {
  const today = dayKey(now);
  const monday = weekKey(today);
  const keys = [0, 1, 2, 3, 4, 5, 6].map((i) => dayKey(addDays(parseDayKey(monday), i)));
  const sums = summarizeDays(state);
  const waterOn = state.profile.waterTracking !== false;

  const days = keys.map((k) => {
    const future = k > today;
    const s = sums[k];
    const { flags } = scoreDay(s, state.profile);
    const log = (state.days[k] || {}).workout || {};
    const session = sessionFor(k, log, state.workoutPlan);
    const optional = !session.free && scheduleForDate(k, state.workoutPlan).options.some((o) => o.rest);
    const planned = session.free ? !!log.done : !session.rest && !optional;
    return {
      key: k,
      label: parseDayKey(k).toLocaleDateString(undefined, { weekday: 'narrow' }),
      today: k === today,
      future,
      logged: !!s && (s.meals > 0 || s.waterMl > 0 || s.activeMin > 0 || s.workoutDone),
      food: !!flags.foodOnTarget,
      protein: !!flags.proteinHit,
      water: waterOn ? !!flags.waterHit : null,
      moved: !!flags.moved,
      perfect: !!flags.perfect,
      workoutPlanned: planned,
      workoutDone: !!log.done,
      kcal: s ? s.kcal : 0,
      activeMin: s ? s.activeMin : 0,
    };
  });

  const sofar = days.filter((d) => !d.future);
  const foodDays = sofar.filter((d) => d.kcal > 0);
  const count = (f) => sofar.filter(f).length;

  // Weight change: latest weigh-in this week vs the last one before it started.
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const before = sorted.filter((w) => w.date < monday).pop();
  const thisWeek = sorted.filter((w) => w.date >= monday && w.date <= today);
  const firstThisWeek = thisWeek[0];
  const latest = thisWeek[thisWeek.length - 1];
  const startRef = before || (thisWeek.length > 1 ? firstThisWeek : null);

  return {
    keys,
    days,
    daysSoFar: sofar.length,
    daysLogged: count((d) => d.logged),
    foodOnTarget: count((d) => d.food),
    proteinDays: count((d) => d.protein),
    waterDays: waterOn ? count((d) => d.water) : null,
    perfectDays: count((d) => d.perfect),
    workoutsDone: days.filter((d) => d.workoutDone).length,
    workoutsPlanned: days.filter((d) => d.workoutPlanned || d.workoutDone).length,
    activeMinutes: sofar.reduce((a, d) => a + d.activeMin, 0),
    avgKcal: foodDays.length ? Math.round(foodDays.reduce((a, d) => a + d.kcal, 0) / foodDays.length) : null,
    weightChangeKg: startRef && latest && startRef !== latest ? latest.kg - startRef.kg : null,
  };
}

// ---------- Looking ahead ----------
// Two independent guesses, so one can sanity-check the other:
//  - trend:  your weigh-ins over the last 4 weeks, carried forward
//  - intake: what you've eaten over the last 2 weeks vs what you burn
export function forecast(state, weeks = 4, now = new Date()) {
  const { profile } = state;
  const trend = weightTrend(state.weights);
  const current = trend.length ? trend[trend.length - 1].trend : profile.weightKg;
  const target = addDays(now, weeks * 7);

  const trendRate = weightRate(state.weights, 28, now);
  const byTrend = trendRate == null ? null : { ratePerWeek: trendRate, kg: current + trendRate * weeks };

  // Intake: only days that look fully logged (at least 40% of the target) so a forgotten dinner
  // doesn't predict a crash diet.
  const target14 = [];
  for (let i = 1; i <= 14; i++) target14.push(dayKey(addDays(now, -i)));
  const logged = target14
    .map((k) => dayMetrics(state, k))
    .filter((d) => d.food.kcal >= d.baseKcalTarget * 0.4);
  let byIntake = null;
  if (logged.length >= 4) {
    const avgEaten = logged.reduce((a, d) => a + d.food.kcal, 0) / logged.length;
    const avgBurnExtra = logged.reduce((a, d) => a + d.exKcal, 0) / logged.length;
    const dailyDelta = avgEaten - (tdee(profile) + avgBurnExtra);
    const ratePerWeek = (dailyDelta * 7) / 7700;
    byIntake = { ratePerWeek, kg: current + ratePerWeek * weeks, avgEaten: Math.round(avgEaten), daysUsed: logged.length };
  }

  const rateForGoal = byTrend ? byTrend.ratePerWeek : byIntake ? byIntake.ratePerWeek : null;
  const goalDate = profile.goalWeightKg && rateForGoal ? projectGoalDate(current, profile.goalWeightKg, rateForGoal, now) : null;

  const stepsNow = stepGoal(state.workoutPlan.stepPlan, now);
  const stepsThen = stepGoal(state.workoutPlan.stepPlan, target);

  return {
    weeks,
    date: target,
    currentKg: current,
    byTrend,
    byIntake,
    goalKg: profile.goalWeightKg || null,
    goalDate,
    // Goal reached before the forecast date?
    goalBy: goalDate && goalDate <= target,
    steps: stepsNow ? { now: stepsNow, then: stepsThen, perWeek: DAILY_GOALS.stepsWeeklyIncrease } : null,
  };
}

// Pages people can choose to open the app on (Settings → App settings → Default page).
export const START_PAGES = [
  { key: 'today', label: 'Today' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'move', label: 'Train' },
  { key: 'progress', label: 'Progress' },
  { key: 'social', label: 'Social' },
];
