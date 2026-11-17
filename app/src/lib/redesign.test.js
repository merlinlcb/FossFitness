import { buildSchedule } from './schedule';
import { computeGame } from './game';
import { todaySuggestions } from './insights';
import { projectWeight, tdee } from './calc';
import { cardioLog } from './workoutPlan';
import { reducer } from '../state/reducer';
import { DEFAULT_STATE, hydrateState } from '../state/defaults';
import { dayKey, addDays } from './dates';

const at = (h, m = 0, dayOffset = 0) => {
  const d = addDays(new Date(2026, 10, 16), dayOffset); // a Monday
  d.setHours(h, m, 0, 0);
  return d;
};
const base = (patch = {}) => hydrateState({
  ...DEFAULT_STATE,
  profile: { ...DEFAULT_STATE.profile, onboarded: true, wakeTime: '07:00', sleepTime: '23:00', ...patch.profile },
  reminders: { ...DEFAULT_STATE.reminders, ...patch.reminders },
  days: patch.days || {},
  weights: patch.weights || [],
});
const kinds = (plan, kind) => plan.filter((p) => p.kind === kind);

describe('water tracking off', () => {
  const s = base({ profile: { waterTracking: false } });
  test('no water quest, no water reminders, no water tips', () => {
    expect(computeGame(s).quests.map((q) => q.id)).not.toContain('water');
    expect(kinds(buildSchedule(s, at(8)), 'water')).toEqual([]);
    expect(todaySuggestions(s, at(15)).some((c) => c.area === 'water')).toBe(false);
  });
  test('defaults keep water on', () => {
    expect(computeGame(base()).quests.map((q) => q.id)).toContain('water');
    expect(kinds(buildSchedule(base(), at(8)), 'water').length).toBeGreaterThan(0);
  });
  test('a perfect day without water is food on target plus a workout', () => {
    const k = dayKey(new Date());
    let st = reducer(s, { type: 'ADD_FOOD', day: k, entry: { name: 'x', kcal: 1400, meal: 'lunch' } });
    st = reducer(st, { type: 'ADD_EXERCISE', day: k, entry: { type: 'walk', minutes: 20, intensity: 'moderate', kcal: 80 } });
    st = { ...st, profile: { ...st.profile, calorieGoal: 2000 } };
    expect(computeGame(st).badges.find((b) => b.id === 'perfect_1').earned).toBe(true);
  });
});

describe('streak guard', () => {
  const k = dayKey(at(8));
  const prev = dayKey(at(8, 0, -1));
  const s = base({ days: { [prev]: { water: [], food: [{ id: 'a', name: 'x', kcal: 100, t: at(12, 0, -1).toISOString() }], exercise: [], steps: 0 } } });
  test('nags in the evening and before bed when nothing is logged today', () => {
    const nags = kinds(buildSchedule(s, at(8), 1), 'streak');
    expect(nags.map((n) => n.date.getHours())).toEqual([19, 22]);
    expect(nags[0].title).toMatch(/1-day streak/);
  });
  test('stays quiet once something is logged today', () => {
    const logged = reducer(s, { type: 'ADD_WATER', ml: 250, day: k });
    expect(kinds(buildSchedule(logged, at(8), 1), 'streak')).toEqual([]);
  });
  test('can be switched off', () => {
    const off = base({ reminders: { streak: { enabled: false, time: '19:30' } } });
    expect(kinds(buildSchedule(off, at(8), 1), 'streak')).toEqual([]);
  });
});

describe('food check-in', () => {
  const on = { foodGap: { enabled: true, hours: 4 }, meals: { ...DEFAULT_STATE.reminders.meals, enabled: false } };
  test('every N hours after the last thing you ate, while awake', () => {
    const k = dayKey(at(8));
    const s = base({ reminders: on, days: { [k]: { water: [], food: [{ id: 'a', name: 'x', kcal: 300, meal: 'lunch', t: at(12, 30).toISOString() }], exercise: [], steps: 0 } } });
    const times = kinds(buildSchedule(s, at(13), 1), 'meal').map((n) => `${n.date.getHours()}:${String(n.date.getMinutes()).padStart(2, '0')}`);
    expect(times).toEqual(['16:30', '20:30']);
  });
  test('counts from waking when nothing is logged yet, and is off by default', () => {
    const s = base({ reminders: on });
    expect(kinds(buildSchedule(s, at(6), 1), 'meal').map((n) => n.date.getHours())).toEqual([11, 15, 19]);
    expect(kinds(buildSchedule(base({ reminders: { meals: { ...DEFAULT_STATE.reminders.meals, enabled: false } } }), at(6), 1), 'meal')).toEqual([]);
  });
});

describe('cardio logging', () => {
  test('time, intensity and laps; old minute-only logs still read', () => {
    expect(cardioLog(25)).toEqual({ minutes: 25, intensity: 'moderate', laps: 0 });
    const k = '2026-11-16';
    let s = reducer(DEFAULT_STATE, { type: 'SET_WORKOUT_CARDIO', day: k, exerciseId: 'swim-laps', minutes: 30 });
    s = reducer(s, { type: 'SET_WORKOUT_CARDIO', day: k, exerciseId: 'swim-laps', intensity: 'vigorous' });
    s = reducer(s, { type: 'SET_WORKOUT_CARDIO', day: k, exerciseId: 'swim-laps', laps: 40 });
    expect(s.days[k].workout.cardio['swim-laps']).toEqual({ minutes: 30, intensity: 'vigorous', laps: 40 });
    s = reducer(s, { type: 'SET_WORKOUT_CARDIO', day: k, exerciseId: 'swim-laps', minutes: 0, laps: 0 });
    expect(s.days[k].workout.cardio['swim-laps']).toBeUndefined();
  });
});

test('complete-day outlook: eating 500 under your burn for 5 weeks ≈ −2.3 kg', () => {
  const p = { ...DEFAULT_STATE.profile, sex: 'male', age: 34, heightCm: 180, weightKg: 100, activityLevel: 'light' };
  const r = projectWeight(p, tdee(p) - 500, 0);
  expect(r.dailyDelta).toBe(-500);
  expect(r.kgChange).toBeCloseTo(-2.27, 2);
  expect(projectWeight(p, tdee(p), 300).kgChange).toBeCloseTo(-1.36, 2); // exercise counts as burn
  const done = reducer(DEFAULT_STATE, { type: 'SET_DAY_COMPLETE', day: '2026-11-16', done: true });
  expect(done.days['2026-11-16'].completedAt).toBeTruthy();
});

describe('appearance', () => {
  const { pickTheme, isNight, DARK, LIGHT } = require('./themes');
  test('dark by default; light, phone and timed modes', () => {
    expect(pickTheme(undefined, 'light')).toBe(DARK);
    expect(pickTheme({ mode: 'light' }, 'dark')).toBe(LIGHT);
    expect(pickTheme({ mode: 'system' }, 'light')).toBe(LIGHT);
    expect(pickTheme({ mode: 'system' }, 'dark')).toBe(DARK);
    const at = (h, m = 0) => { const d = new Date(2026, 10, 15); d.setHours(h, m); return d; };
    const timed = { mode: 'schedule', darkFrom: '20:00', darkUntil: '07:00' };
    expect(pickTheme(timed, 'light', at(21))).toBe(DARK);
    expect(pickTheme(timed, 'light', at(6, 59))).toBe(DARK);
    expect(pickTheme(timed, 'light', at(7))).toBe(LIGHT);
    expect(pickTheme(timed, 'light', at(12))).toBe(LIGHT);
    expect(isNight(at(13), '12:00', '14:00')).toBe(true); // a window that doesn't cross midnight
    expect(isNight(at(15), '12:00', '14:00')).toBe(false);
    expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort());
  });
});
