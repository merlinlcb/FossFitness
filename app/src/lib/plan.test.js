import {
  scheduleForDate, sessionFor, weekAdherence, sessionSummary, exerciseById, exerciseName, allExercises,
  makeCustomExercise, lastSession, lastCardio, GYM_EXERCISES, EXERCISES, WEEKLY_SCHEDULE, GYM_SCHEDULE, suggestedExercises, myExerciseIds, subgroupOf, SUBGROUPS, previousWorkout,
} from './workoutPlan';
import { calorieTarget, suggestedCalorieTarget, hasOwnCalorieGoal, isPaceClamped, macroTargets } from './calc';
import { computeGame } from './game';
import { reducer } from '../state/reducer';
import { DEFAULT_STATE, hydrateState } from '../state/defaults';

const MON = '2026-11-16';
const TUE = '2026-11-17';
const SUN = '2026-11-15';

describe('exercise library', () => {
  test('has everything on the request list, with unique ids', () => {
    const names = GYM_EXERCISES.map((e) => e.name.toLowerCase());
    for (const want of ['bench press', 'squats', 'biceps curl', 'push-ups', 'assisted pull-up', 'sit-ups', 'incline bench press', 'rowing machine']) {
      expect(names).toContain(want);
    }
    const ids = [...GYM_EXERCISES, ...EXERCISES].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of GYM_EXERCISES) {
      if (e.kind === 'cardio') expect(e.maxMinutes).toBeGreaterThanOrEqual(e.minutes);
      else expect(e.repMax).toBeGreaterThanOrEqual(e.repMin);
    }
  });

  test('weight exercises log weight × reps', () => {
    expect(exerciseById('bench-press').kind).toBe('strength');
    expect(exerciseById('rowing-machine').kind).toBe('cardio');
  });
});

describe('suggested plan', () => {
  test('default is the suggested home plan', () => {
    expect(DEFAULT_STATE.workoutPlan.mode).toBe('suggested');
    expect(scheduleForDate(MON)).toBe(WEEKLY_SCHEDULE[1]);
    expect(scheduleForDate(MON, DEFAULT_STATE.workoutPlan)).toBe(WEEKLY_SCHEDULE[1]);
    expect(sessionFor(MON, {}, DEFAULT_STATE.workoutPlan).key).toBe('upper');
  });

  test('gym version: every exercise exists, two upper and two lower days', () => {
    const gym = { ...DEFAULT_STATE.workoutPlan, suggested: 'gym' };
    expect(scheduleForDate(MON, gym)).toBe(GYM_SCHEDULE[1]);
    for (const day of GYM_SCHEDULE) for (const o of day.options) for (const id of o.items) expect(exerciseById(id)).toBeTruthy();
    const titles = GYM_SCHEDULE.map((d) => d.title).join(' ');
    expect(titles.match(/Upper body/g)).toHaveLength(2);
    expect(titles.match(/Lower body/g)).toHaveLength(2);
    expect(suggestedExercises(gym).every((e) => e.gym)).toBe(true);
    expect(suggestedExercises(DEFAULT_STATE.workoutPlan).every((e) => !e.gym)).toBe(true);
  });

  test("old saves: 'spine' becomes 'suggested', PT clearances are dropped", () => {
    const s = hydrateState({ ...DEFAULT_STATE, workoutPlan: { mode: 'spine', ptCleared: { 'bird-dog': true } } });
    expect(s.workoutPlan.mode).toBe('suggested');
    expect(s.workoutPlan).not.toHaveProperty('ptCleared');
    expect(hydrateState({ ...DEFAULT_STATE, workoutPlan: { mode: 'custom' } }).workoutPlan.mode).toBe('custom');
  });
});

describe('my own plan (log what you did)', () => {
  const bench = 'bench-press';
  const fly = makeCustomExercise({ name: 'Cable fly', kind: 'strength', group: 'upper', sub: 'chest', sets: 3, repMin: 10, repMax: 15 });
  let state = reducer(DEFAULT_STATE, { type: 'SET_WORKOUT_PLAN', patch: { mode: 'custom', customExercises: [fly], myExercises: [bench, fly.id, 'rowing-machine', 'squat'] } });
  const plan = state.workoutPlan;

  test('switched-on exercises, sorted into sub-categories', () => {
    expect(myExerciseIds(plan)).toEqual([bench, fly.id, 'rowing-machine', 'squat']);
    expect(subgroupOf(exerciseById(bench))).toBe('chest');
    expect(subgroupOf(exerciseById(fly.id, plan))).toBe('chest');
    expect(subgroupOf(exerciseById('squat'))).toBe('legs');
    expect(subgroupOf(exerciseById('rowing-machine'))).toBe('cardio');
    expect(subgroupOf(exerciseById('wall-pushup'))).toBe('home');
    for (const e of allExercises(plan)) expect(SUBGROUPS.map((g) => g.key)).toContain(subgroupOf(e));
    // Before the list existed, the old weekly plan's exercises count as switched on.
    expect(myExerciseIds({ week: { 1: [bench, 'squat'], 3: [bench] } })).toEqual([bench, 'squat']);
  });

  test('nothing is prescribed: the day holds what you logged', () => {
    expect(sessionFor(MON, {}, plan)).toMatchObject({ free: true, items: [] });
    expect(sessionSummary(sessionFor(MON, {}, plan), plan)).toMatch(/Nothing logged yet/);
    let s = reducer(state, { type: 'ADD_WORKOUT_ITEM', day: MON, exerciseId: bench });
    s = reducer(s, { type: 'ADD_WORKOUT_ITEM', day: MON, exerciseId: 'rowing-machine' });
    s = reducer(s, { type: 'ADD_WORKOUT_ITEM', day: MON, exerciseId: bench }); // no duplicates
    const sess = sessionFor(MON, s.days[MON].workout, s.workoutPlan);
    expect(sess.items).toEqual([bench, 'rowing-machine']);
    expect(sess.title).toBe('Upper body + Cardio');
    s = reducer(s, { type: 'SET_WORKOUT_SET', day: MON, exerciseId: bench, index: 0, patch: { kg: 60, reps: 8 } });
    s = reducer(s, { type: 'REMOVE_WORKOUT_ITEM', day: MON, exerciseId: bench });
    expect(s.days[MON].workout.items).toEqual(['rowing-machine']);
    expect(s.days[MON].workout.sets[bench]).toBeUndefined();
  });

  test("use yesterday's exercises copies the list (numbers stay as hints, so it isn't done yet)", () => {
    let s = reducer(state, { type: 'ADD_WORKOUT_ITEM', day: MON, exerciseId: bench });
    s = reducer(s, { type: 'SET_WORKOUT_SET', day: MON, exerciseId: bench, index: 0, patch: { kg: 60, reps: 8 } });
    s = reducer(s, { type: 'ADD_WORKOUT_ITEM', day: MON, exerciseId: 'rowing-machine' });
    s = reducer(s, { type: 'SET_WORKOUT_CARDIO', day: MON, exerciseId: 'rowing-machine', minutes: 15, intensity: 'vigorous' });
    expect(previousWorkout(s.days, TUE).day).toBe(MON);
    expect(previousWorkout(s.days, MON)).toBeNull();
    s = reducer(s, { type: 'COPY_WORKOUT', fromDay: MON, toDay: TUE });
    expect(s.days[TUE].workout.items).toEqual([bench, 'rowing-machine']);
    expect(s.days[TUE].workout.sets[bench]).toBeUndefined();
    expect(s.days[TUE].workout.done).toBe(false);
    expect(lastSession(s.days, bench, TUE).sets).toEqual([{ kg: 60, reps: 8 }]); // the hint
    expect(lastCardio(s.days, 'rowing-machine', TUE)).toMatchObject({ day: MON, minutes: 15, intensity: 'vigorous' });
    // Logging today leaves Monday alone.
    s = reducer(s, { type: 'SET_WORKOUT_SET', day: TUE, exerciseId: bench, index: 0, patch: { kg: 65, reps: 8 } });
    expect(s.days[TUE].workout.done).toBe(true);
    expect(s.days[MON].workout.sets[bench][0].kg).toBe(60);
  });

  test('weekly adherence counts days you logged', () => {
    let s = reducer(state, { type: 'ADD_WORKOUT_ITEM', day: MON, exerciseId: bench });
    s = reducer(s, { type: 'SET_WORKOUT_SET', day: MON, exerciseId: bench, index: 0, patch: { kg: 60, reps: 8 } });
    s = reducer(s, { type: 'ADD_WORKOUT_ITEM', day: TUE, exerciseId: 'squat' });
    expect(weekAdherence(s.days, [SUN, MON, TUE], s.workoutPlan)).toEqual({ planned: 2, done: 1 });
  });

  test('custom exercises and the switched-on list survive a reload', () => {
    const back = hydrateState(JSON.parse(JSON.stringify(state)));
    expect(myExerciseIds(back.workoutPlan)).toHaveLength(4);
    expect(exerciseName(fly.id, back.workoutPlan)).toBe('Cable fly');
  });

  test('makeCustomExercise sanitises input', () => {
    const c = makeCustomExercise({ name: '  Erg  ', kind: 'cardio', minutes: 0 });
    expect(c).toMatchObject({ name: 'Erg', kind: 'cardio', group: 'cardio', minutes: 10 }); // empty length → 10 min
    const s2 = makeCustomExercise({ name: 'X', kind: 'strength', repMin: 12, repMax: 5, sets: 0 });
    expect(s2.repMax).toBeGreaterThanOrEqual(s2.repMin);
    expect(s2.sets).toBe(3); // empty or 0 sets → the default of 3
  });
});

describe('own calorie target', () => {
  const p = { ...DEFAULT_STATE.profile, sex: 'male', age: 34, heightCm: 180, weightKg: 110, goal: 'lose', paceKgPerWeek: 1, activityLevel: 'sedentary' };

  test('suggested target unless the person sets their own', () => {
    expect(hasOwnCalorieGoal(p)).toBe(false);
    expect(calorieTarget(p)).toBe(suggestedCalorieTarget(p));
    const own = { ...p, calorieGoal: 2650 };
    expect(hasOwnCalorieGoal(own)).toBe(true);
    expect(calorieTarget(own)).toBe(2650);
    expect(suggestedCalorieTarget(own)).toBe(suggestedCalorieTarget(p));
    expect(calorieTarget({ ...p, calorieGoal: null })).toBe(suggestedCalorieTarget(p));
    expect(calorieTarget({ ...p, calorieGoal: 0 })).toBe(suggestedCalorieTarget(p));
  });

  test('an own target turns off the pace-limited warning and drives macros and quests', () => {
    expect(isPaceClamped(p)).toBe(true);
    expect(isPaceClamped({ ...p, calorieGoal: 1400 })).toBe(false);
    expect(macroTargets({ ...p, calorieGoal: 3000 }).fat).toBe(100);
    const state = { ...DEFAULT_STATE, profile: { ...p, calorieGoal: 2650 } };
    const q = computeGame(state).quests.find((x) => x.id === 'food');
    expect(q.title).toContain('2650');
  });
});

describe('own macro targets', () => {
  const p = { ...DEFAULT_STATE.profile, sex: 'male', age: 34, heightCm: 180, weightKg: 100, goal: 'lose', proteinGoal: null, calorieGoal: 2400 };
  test('each macro can be set by hand; the rest stay suggested', () => {
    const auto = macroTargets(p);
    expect(auto.fat).toBe(80); // 30% of 2400 kcal
    const own = macroTargets({ ...p, proteinGoal: 200, fatGoal: 60, fiberGoal: 40 });
    expect(own).toMatchObject({ protein: 200, fat: 60, fiber: 40 });
    expect(own.carbs).toBe(Math.round((2400 - 200 * 4 - 60 * 9) / 4)); // carbs fill the rest
    expect(macroTargets({ ...p, carbsGoal: 150 }).carbs).toBe(150);
    expect(macroTargets({ ...p, fatGoal: null, carbsGoal: 0 }).fat).toBe(auto.fat);
  });
});

describe('misc exercises', () => {
  test('your own exercise can be Misc, listed and titled as such', () => {
    const { customDayTitle } = require('./workoutPlan');
    const ex = makeCustomExercise({ name: 'Farmer carry', kind: 'strength', group: 'other', sub: 'misc', sets: 3, repMin: 1, repMax: 1 });
    const plan = { mode: 'custom', customExercises: [ex], myExercises: [ex.id] };
    expect(subgroupOf(exerciseById(ex.id, plan))).toBe('misc');
    expect(SUBGROUPS.find((g) => g.key === 'misc')).toBeTruthy();
    expect(customDayTitle([ex.id, 'bench-press'], plan)).toBe('Upper body + Misc');
  });
});

describe('eat back exercise calories', () => {
  test('the bonus is half of what you burned, on top of the base target', () => {
    const { dayMetrics } = require('./metrics');
    const day = '2026-11-16';
    const s = hydrateState({ ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, onboarded: true, eatBackExercise: true },
      days: { [day]: { food: [], water: [], exercise: [{ id: 'e', type: 'run', minutes: 30, intensity: 'moderate', kcal: 300 }], steps: 0 } } });
    const m = dayMetrics(s, day);
    expect(m.kcalTarget - m.baseKcalTarget).toBe(150);
    const off = dayMetrics(hydrateState({ ...s, profile: { ...s.profile, eatBackExercise: false } }), day);
    expect(off.kcalTarget).toBe(off.baseKcalTarget);
  });
});
