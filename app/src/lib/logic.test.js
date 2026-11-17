import { bmr, tdee, calorieTarget, macroTargets, waterGoal, bmi, exerciseCalories, projectGoalDate, isPaceClamped } from './calc';
import { dayKey, addDays, timeToMinutes, minutesToTime, lastNDays } from './dates';
import { lbToKg, kgToLb, formatWater, weightFromDisplay, weightToDisplay } from './units';
import { FOODS, nutritionFor, searchFoods, customToFood } from './foods';
import { eatingWindow, fastStats, stageFor, fastHoursFor } from './fasting';
import { buildSchedule } from './schedule';
import { todaySuggestions, trendInsights, loggingStreak } from './insights';
import { weightTrend, weightRate, waterPaceTarget, dayMetrics } from './metrics';
import { reducer } from '../state/reducer';
import { DEFAULT_STATE, hydrateState } from '../state/defaults';
import { applySigning } from '../../plugins/withReleaseSigning';

const profile = { ...DEFAULT_STATE.profile, sex: 'male', age: 30, heightCm: 178, weightKg: 90, activityLevel: 'light', goal: 'lose', paceKgPerWeek: 0.5 };

describe('calc', () => {
  test('Mifflin-St Jeor BMR', () => {
    // 10*90 + 6.25*178 - 5*30 + 5 = 1867.5
    expect(bmr(profile)).toBe(1868);
    expect(bmr({ ...profile, sex: 'female' })).toBe(1702);
  });

  test('TDEE and calorie target with deficit', () => {
    expect(tdee(profile)).toBe(Math.round(1868 * 1.375));
    expect(calorieTarget(profile)).toBe(Math.round(tdee(profile) - 550));
    expect(calorieTarget({ ...profile, goal: 'maintain' })).toBe(tdee(profile));
  });

  test('calorie floor is enforced', () => {
    const small = { ...profile, sex: 'female', weightKg: 50, heightCm: 155, age: 60, activityLevel: 'sedentary', paceKgPerWeek: 1 };
    expect(calorieTarget(small)).toBe(1200);
    expect(isPaceClamped(small)).toBe(true);
  });

  test('macros add up roughly to calories', () => {
    const kcal = calorieTarget(profile);
    const m = macroTargets(profile, kcal);
    const total = m.protein * 4 + m.carbs * 4 + m.fat * 9;
    expect(Math.abs(total - kcal)).toBeLessThan(15);
    expect(m.protein).toBeGreaterThan(100);
  });

  test('water goal scales with weight, exercise and heat', () => {
    const base = waterGoal(profile, 0);
    expect(base).toBe(3150);
    expect(waterGoal(profile, 30)).toBe(base + 350);
    expect(waterGoal({ ...profile, climate: 'hot' }, 0)).toBe(base + 500);
    expect(waterGoal({ ...profile, weightKg: 200 }, 0)).toBe(4000);
  });

  test('bmi, exercise calories, projection', () => {
    expect(bmi(90, 178)).toBeCloseTo(28.4, 1);
    expect(exerciseCalories(3.5, 90, 60)).toBe(315);
    const eta = projectGoalDate(90, 85, -0.5, new Date(2026, 0, 1));
    expect(eta.getTime()).toBe(new Date(2026, 0, 71).getTime());
    expect(projectGoalDate(90, 85, 0.5)).toBeNull();
  });
});

describe('units & dates', () => {
  test('round trips', () => {
    expect(kgToLb(lbToKg(200))).toBeCloseTo(200, 6);
    expect(weightToDisplay(weightFromDisplay('185', 'imperial'), 'imperial')).toBe(185);
    expect(formatWater(1500, 'ml')).toBe('1.5 L');
    expect(formatWater(236.6, 'oz')).toBe('8 oz');
    expect(minutesToTime(timeToMinutes('07:45'))).toBe('07:45');
    expect(minutesToTime(-60)).toBe('23:00');
    expect(lastNDays(3, new Date(2026, 2, 1))).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});

describe('foods', () => {
  test('database is well formed', () => {
    const ids = new Set();
    for (const f of FOODS) {
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
      expect(f.servings.length).toBeGreaterThan(f.perServing ? 0 : 1);
      // calories roughly consistent with macros (alcohol and very low-calorie, high-fiber veg excepted)
      const fromMacros = f.per100.protein * 4 + f.per100.carbs * 4 + f.per100.fat * 9;
      // Hand-typed foods only: USDA rows include alcohol, whose calories the macros don't count.
      if (f.curated && !/beer|wine|liquor/i.test(f.name) && f.per100.kcal > 50) {
        expect(Math.abs(fromMacros - f.per100.kcal) / f.per100.kcal).toBeLessThan(0.2);
      }
    }
  });

  test('USDA foods are present and sane', () => {
    const usda = FOODS.filter((f) => !f.curated && !f.chain);
    expect(usda.length).toBeGreaterThan(10000);
    for (const f of usda) {
      expect(f.id).toMatch(/^usda-\d+$/);
      expect(f.per100.kcal).toBeGreaterThanOrEqual(0);
      expect(f.per100.kcal).toBeLessThan(950);
      for (const s of f.servings) expect(s.g).toBeGreaterThan(0);
    }
  });

  test('search puts hand-picked and plain names first', () => {
    expect(searchFoods('banana', FOODS)[0].name).toBe('Banana');
    expect(searchFoods('pad thai', FOODS).length).toBeGreaterThan(0);
    const custom = customToFood({ id: 'my-9', name: 'Banana bread (mine)', kcal: 200 });
    expect(searchFoods('banana', [custom, ...FOODS])[0].id).toBe('my-9');
    expect(searchFoods('a', FOODS).length).toBeLessThanOrEqual(200);
  });

  test('portion scaling', () => {
    const banana = FOODS.find((f) => f.name === 'Banana');
    const n = nutritionFor(banana, 118);
    expect(n.kcal).toBe(105);
    expect(n.carbs).toBeCloseTo(27.1, 1);
    const custom = customToFood({ id: 'my-1', name: 'Bar', kcal: 200, protein: 20 });
    expect(nutritionFor(custom, 150).kcal).toBe(300); // 1.5 servings
  });

  test('search', () => {
    const r = searchFoods('chick', FOODS);
    expect(r[0].name.toLowerCase().startsWith('chick')).toBe(true);
    expect(searchFoods('zzzz', FOODS)).toEqual([]);
  });
});

describe('fasting', () => {
  const f = { ...DEFAULT_STATE.fasting, protocol: '16:8', windowStart: '12:00' };
  test('eating window open/closed', () => {
    const at10 = eatingWindow(f, new Date(2026, 4, 5, 10, 0));
    expect(at10.isOpen).toBe(false);
    expect(at10.open.getHours()).toBe(12);
    const at13 = eatingWindow(f, new Date(2026, 4, 5, 13, 0));
    expect(at13.isOpen).toBe(true);
    expect(at13.close.getHours()).toBe(20);
    const at21 = eatingWindow(f, new Date(2026, 4, 5, 21, 0));
    expect(at21.isOpen).toBe(false);
    expect(at21.open.getDate()).toBe(6);
  });

  test('window crossing midnight', () => {
    const late = { ...f, windowStart: '20:00' };
    const at1am = eatingWindow(late, new Date(2026, 4, 6, 1, 0));
    expect(at1am.isOpen).toBe(true);
    expect(at1am.close.getHours()).toBe(4);
  });

  test('stats and stages', () => {
    const hist = [
      { start: '2026-05-01T20:00:00Z', end: '2026-05-02T12:00:00Z', targetHours: 16 },
      { start: '2026-05-02T20:00:00Z', end: '2026-05-03T10:00:00Z', targetHours: 16 },
      { start: '2026-05-03T20:00:00Z', end: '2026-05-04T13:00:00Z', targetHours: 16 },
    ];
    const s = fastStats(hist);
    expect(s.count).toBe(3);
    expect(s.completionRate).toBeCloseTo(2 / 3);
    expect(s.streak).toBe(1);
    expect(s.longestHours).toBe(17);
    expect(stageFor(13).label).toBe('Fat burning');
    expect(fastHoursFor({ protocol: 'custom', customHours: 36 })).toBe(36);
  });
});

describe('reducer', () => {
  test('water, food, weight, fasting flows', () => {
    let s = hydrateState(null);
    s = reducer(s, { type: 'ADD_WATER', ml: 500 });
    s = reducer(s, { type: 'ADD_WATER', ml: 250 });
    const today = dayKey();
    expect(s.days[today].water).toHaveLength(2);
    s = reducer(s, { type: 'REMOVE_WATER', day: today, id: s.days[today].water[0].id });
    expect(dayMetrics(s, today).water).toBe(250);

    s = reducer(s, { type: 'ADD_FOOD', entry: { foodId: 'db-banana', name: 'Banana', meal: 'snack', kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, qty: 1, servingLabel: '1 medium' } });
    expect(s.recentFoods[0].foodId).toBe('db-banana');
    expect(dayMetrics(s, today).food.kcal).toBe(105);

    s = reducer(s, { type: 'ADD_WEIGHT', kg: 88, date: '2026-01-01' });
    s = reducer(s, { type: 'ADD_WEIGHT', kg: 87, date: '2026-01-08' });
    s = reducer(s, { type: 'ADD_WEIGHT', kg: 86.5, date: '2026-01-08' });
    expect(s.weights).toHaveLength(2);
    expect(s.profile.weightKg).toBe(86.5);

    s = reducer(s, { type: 'START_FAST', targetHours: 16, start: new Date(Date.now() - 17 * 3600000).toISOString() });
    s = reducer(s, { type: 'END_FAST' });
    expect(s.fasting.active).toBeNull();
    expect(s.fasting.history).toHaveLength(1);
  });

  test('copy meal from yesterday', () => {
    let s = hydrateState(null);
    const y = dayKey(addDays(new Date(), -1));
    s = reducer(s, { type: 'ADD_FOOD', day: y, entry: { name: 'Oats', meal: 'breakfast', kcal: 150 } });
    s = reducer(s, { type: 'COPY_MEAL', fromDay: y, toDay: dayKey(), meal: 'breakfast' });
    expect(dayMetrics(s, dayKey()).food.kcal).toBe(150);
  });

  test('hydrate fills new fields from defaults', () => {
    const s = hydrateState({ profile: { age: 40 }, reminders: { water: { enabled: false } } });
    expect(s.profile.age).toBe(40);
    expect(s.profile.wakeTime).toBe('07:00');
    expect(s.reminders.water.enabled).toBe(false);
    expect(s.reminders.water.intervalMin).toBe(90);
    expect(s.reminders.summary.enabled).toBe(true);
  });
});

describe('metrics', () => {
  test('weight trend + rate', () => {
    const weights = [];
    for (let i = 0; i < 21; i++) weights.push({ id: String(i), date: dayKey(addDays(new Date(), -20 + i)), t: '', kg: 90 - i * 0.1 });
    const tr = weightTrend(weights);
    expect(tr[tr.length - 1].trend).toBeLessThan(90);
    expect(weightRate(weights)).toBeCloseTo(-0.7, 1);
  });

  test('water pace', () => {
    const p = { wakeTime: '07:00', sleepTime: '23:00' };
    expect(waterPaceTarget(p, 3000, new Date(2026, 0, 1, 6, 0))).toBe(0);
    expect(waterPaceTarget(p, 3000, new Date(2026, 0, 1, 23, 0))).toBe(3000);
    const mid = waterPaceTarget(p, 3000, new Date(2026, 0, 1, 14, 15));
    expect(mid).toBeGreaterThan(1300);
    expect(mid).toBeLessThan(1700);
  });
});

describe('schedule', () => {
  const base = { ...hydrateState(null), profile: { ...profile, onboarded: true } };

  test('reminders stay inside waking hours and in the future', () => {
    const now = new Date(2026, 4, 5, 9, 0);
    const plan = buildSchedule(base, now);
    expect(plan.length).toBeGreaterThan(20);
    expect(plan.length).toBeLessThanOrEqual(300);
    for (const p of plan) {
      expect(p.date > now).toBe(true);
      const mins = p.date.getHours() * 60 + p.date.getMinutes();
      if (p.kind === 'water') {
        expect(mins).toBeGreaterThanOrEqual(timeToMinutes('08:00'));
        expect(mins).toBeLessThanOrEqual(timeToMinutes('22:00'));
      }
    }
    const kinds = new Set(plan.map((p) => p.kind));
    expect(kinds.has('fasting')).toBe(true);
    expect(kinds.has('weight')).toBe(true);
    expect(kinds.has('summary')).toBe(true);
  });

  test('no more water reminders today once goal is met', () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    let s = base;
    s = reducer(s, { type: 'ADD_WATER', ml: 5000, t: now.toISOString() });
    const plan = buildSchedule(s, now);
    const todayWater = plan.filter((p) => p.kind === 'water' && dayKey(p.date) === dayKey(now));
    expect(todayWater).toHaveLength(0);
  });

  test('meal reminders used when fasting disabled', () => {
    const s = { ...base, fasting: { ...base.fasting, enabled: false } };
    const plan = buildSchedule(s, new Date(2026, 4, 5, 6, 0));
    expect(plan.filter((p) => p.kind === 'meal').length).toBe(21);
    expect(plan.filter((p) => p.kind === 'fasting')).toHaveLength(0);
  });

  test('active fast milestones', () => {
    const now = new Date(2026, 4, 5, 9, 0);
    const s = { ...base, fasting: { ...base.fasting, active: { start: new Date(2026, 4, 5, 6, 0).toISOString(), targetHours: 16 } } };
    const plan = buildSchedule(s, now);
    expect(plan.some((p) => p.title.includes('Fast complete') && p.date.getHours() === 22)).toBe(true);
  });
});

describe('insights', () => {
  test('produce cards without crashing on empty and full data', () => {
    const empty = { ...hydrateState(null), profile: { ...profile } };
    expect(todaySuggestions(empty, new Date(2026, 4, 5, 15, 0)).length).toBeGreaterThan(0);
    expect(trendInsights(empty).length).toBeGreaterThan(0);

    let s = empty;
    for (let i = 0; i < 10; i++) {
      const d = addDays(new Date(), -i);
      d.setHours(12, 0, 0, 0);
      s = reducer(s, { type: 'ADD_WATER', ml: 1000, t: d.toISOString() });
      s = reducer(s, { type: 'ADD_FOOD', entry: { name: 'x', meal: 'lunch', kcal: 2600, protein: 60, carbs: 300, fat: 100, t: d.toISOString() } });
      s = reducer(s, { type: 'ADD_WEIGHT', kg: 90, date: dayKey(d) });
    }
    const ins = trendInsights(s);
    const titles = ins.map((i) => i.title);
    expect(titles).toContain('Hydration running low');
    expect(titles).toContain('Eating above target');
    expect(titles).toContain('Boost protein');
    expect(titles).toContain('Weight is holding steady');
    expect(loggingStreak(s)).toBeGreaterThanOrEqual(9);
  });
});

describe('release signing plugin', () => {
  test('patches gradle signing config', () => {
    const gradle = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}`;
    const out = applySigning(gradle);
    expect(out).toContain('storeFile file(System.getenv("HT_KEYSTORE_FILE"))');
    expect(out).toContain('signingConfig System.getenv("HT_KEYSTORE_FILE") ? signingConfigs.release : (System.getenv("FF_DISTRIBUTION") == "fdroid" ? null : signingConfigs.debug)');
    expect(out.match(/signingConfig signingConfigs\.debug/g)).toHaveLength(1);
    expect(applySigning(out)).toBe(out);
  });
});

describe('workout plan', () => {
  const { EXERCISES, WEEKLY_SCHEDULE, exerciseById, exerciseName, sessionFor, motivationFor, readyToProgress, lastSession, stepGoal, weekAdherence } = require('./workoutPlan');

  test('library and schedule are consistent', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(18);
    // No equipment: no weights, machines, cables, bands or bikes
    for (const e of EXERCISES) {
      expect(['bodyweight', 'cardio']).toContain(e.kind);
      expect(e.name.toLowerCase()).not.toMatch(/machine|cable|dumbbell|barbell|band|bike|kettlebell|pulldown/);
    }
    for (const day of WEEKLY_SCHEDULE) for (const o of day.options) for (const id of o.items) expect(exerciseById(id)).toBeTruthy();
    // The home plan stays low-impact
    const names = EXERCISES.map((e) => e.name.toLowerCase()).join(' ');
    for (const banned of ['squat', 'lunge', 'deadlift', 'leg press', 'overhead', 'crunch', 'sit-up', 'bent-over', 'jump', 'burpee']) expect(names).not.toContain(banned);
    expect(EXERCISES.some((e) => 'pt' in e)).toBe(false); // no PT flags anywhere
    expect(exerciseName('chest-press')).toBe('Seated machine chest press'); // old logs keep a name
  });

  test('day sessions and choices', () => {
    expect(sessionFor('2026-10-05').key).toBe('upper'); // Monday
    expect(sessionFor('2026-10-06').key).toBe('walk-core'); // Tuesday default
    expect(sessionFor('2026-10-06', { choice: 'pool-core' }).key).toBe('pool-core');
    expect(sessionFor('2026-10-10', { choice: 'pool' }).items).toEqual(['pool']); // Saturday
  });

  test('motivation never repeats two days in a row', () => {
    let prev = null;
    for (let i = 0; i < 60; i++) {
      const m = motivationFor(addDays(new Date(2026, 0, 1), i));
      expect(m).not.toBe(prev);
      prev = m;
    }
  });

  test('progression + history', () => {
    const ex = exerciseById('wall-pushup');
    const days = {
      '2026-10-01': { workout: { sets: { 'wall-pushup': [{ reps: 15 }, { reps: 15 }, { reps: 15 }] } } },
      '2026-10-03': { workout: { sets: { 'wall-pushup': [{ reps: 12 }, { reps: 11 }, { reps: null }] } } },
    };
    expect(readyToProgress(ex, lastSession(days, 'wall-pushup', '2026-10-02'))).toBe(true);
    const last = lastSession(days, 'wall-pushup', '2026-10-05');
    expect(last.date).toBe('2026-10-03');
    expect(last.sets).toHaveLength(2);
    expect(readyToProgress(ex, last)).toBe(false);
  });

  test('step goal grows 500 per week', () => {
    const plan = { baseline: 4000, startDate: '2026-10-01' };
    expect(stepGoal(plan, new Date(2026, 9, 1))).toBe(4000);
    expect(stepGoal(plan, new Date(2026, 9, 8))).toBe(4500);
    expect(stepGoal(plan, new Date(2026, 9, 22))).toBe(5500);
    expect(stepGoal({ baseline: null }, new Date())).toBeNull();
  });

  test('logging is enough: data makes the workout done, and its minutes follow the log', () => {
    let s = hydrateState(null);
    const day = '2026-11-16'; // Monday: suggested home plan, upper body + walk
    s = reducer(s, { type: 'SET_WORKOUT_SET', day, exerciseId: 'wall-pushup', index: 1, patch: { kg: 20 } });
    expect(s.days[day].workout.done).toBe(false); // weight but no reps is not a set yet
    expect(s.days[day].exercise).toHaveLength(0);
    s = reducer(s, { type: 'SET_WORKOUT_SET', day, exerciseId: 'wall-pushup', index: 1, patch: { reps: 12 } });
    expect(s.days[day].workout.sets['wall-pushup']).toEqual([{ kg: null, reps: null }, { kg: 20, reps: 12 }]);
    expect(s.days[day].workout.done).toBe(true);
    expect(s.days[day].exercise.map((e) => [e.type, e.minutes, e.fromPlan])).toEqual([['strength', 10, true]]);
    // More logging updates the same entry instead of adding another.
    s = reducer(s, { type: 'SET_WORKOUT_SET', day, exerciseId: 'counter-pushup', index: 0, patch: { reps: 10 } });
    s = reducer(s, { type: 'SET_WORKOUT_CARDIO', day, exerciseId: 'walk', minutes: 15 });
    expect(s.days[day].exercise.map((e) => [e.type, e.minutes])).toEqual([['strength', 10], ['walk', 15]]);
    // Taking it all away again: nothing left behind in the activity list, not done.
    s = reducer(s, { type: 'SET_WORKOUT_CARDIO', day, exerciseId: 'walk', minutes: 0 });
    s = reducer(s, { type: 'REMOVE_WORKOUT_SET', day, exerciseId: 'counter-pushup', index: 0 });
    s = reducer(s, { type: 'REMOVE_WORKOUT_SET', day, exerciseId: 'wall-pushup', index: 1 });
    expect(s.days[day].exercise).toHaveLength(0);
    expect(s.days[day].workout.done).toBe(false);
  });

  test('my own plan: removing an exercise removes its activity; other activity is untouched', () => {
    let s = reducer(hydrateState(null), { type: 'SET_WORKOUT_PLAN', patch: { mode: 'custom', myExercises: ['bench-press', 'swim-laps'] } });
    const day = '2026-11-16';
    s = reducer(s, { type: 'ADD_EXERCISE', day, entry: { type: 'walk', minutes: 20, intensity: 'light', kcal: 60 } });
    s = reducer(s, { type: 'ADD_WORKOUT_ITEM', day, exerciseId: 'swim-laps' });
    expect(s.days[day].workout.done).toBe(false); // added but nothing logged
    s = reducer(s, { type: 'SET_WORKOUT_CARDIO', day, exerciseId: 'swim-laps', minutes: 30, laps: 40 });
    expect(s.days[day].workout.done).toBe(true);
    expect(s.days[day].exercise.map((e) => e.name || e.type)).toEqual(expect.arrayContaining(['Swimming (laps) (40 laps)']));
    s = reducer(s, { type: 'REMOVE_WORKOUT_ITEM', day, exerciseId: 'swim-laps' });
    expect(s.days[day].workout.done).toBe(false);
    expect(s.days[day].exercise.map((e) => e.type)).toEqual(['walk']);
  });

  test('adherence ignores optional Sunday', () => {
    const keys = ['2026-10-04', '2026-10-05', '2026-10-06']; // Sun, Mon, Tue
    const days = { '2026-10-05': { workout: { done: true } } };
    expect(weekAdherence(days, keys)).toEqual({ planned: 2, done: 1 });
  });

  test('workout reminders: morning + evening nudge, nudge dropped once done', () => {
    const base = { ...hydrateState(null), profile: { ...profile, onboarded: true } };
    const now = new Date(2026, 9, 5, 6, 0); // Monday 6am
    const plan = buildSchedule(base, now).filter((p) => p.kind === 'workout' && dayKey(p.date) === '2026-10-05');
    expect(plan.map((p) => p.date.getHours())).toEqual([8, 18]);
    expect(plan[0].body).toContain('Wall push-up');
    const done = reducer(base, { type: 'SET_WORKOUT_SET', day: '2026-10-05', exerciseId: 'wall-pushup', index: 0, patch: { reps: 12 } });
    expect(buildSchedule(done, now).filter((p) => p.kind === 'workout' && dayKey(p.date) === '2026-10-05')).toHaveLength(0);
    // Sunday: morning only (rest is allowed)
    const sun = buildSchedule(base, new Date(2026, 9, 4, 6, 0)).filter((p) => p.kind === 'workout' && dayKey(p.date) === '2026-10-04');
    expect(sun).toHaveLength(1);
  });

  test('protein goal overrides formula', () => {
    expect(macroTargets({ ...profile, proteinGoal: 160 }).protein).toBe(160);
    expect(macroTargets({ ...profile, proteinGoal: null }).protein).toBeGreaterThan(100);
    expect(hydrateState({ profile: { age: 40 } }).profile.proteinGoal).toBe(160);
  });
});
