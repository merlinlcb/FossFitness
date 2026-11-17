import { todoList, weekProgress, forecast, START_PAGES } from './overview';
import { DEFAULT_STATE, hydrateState } from '../state/defaults';
import { dayKey, addDays } from './dates';

const MON = new Date(2026, 10, 16); // a Monday
const at = (h, m = 0, dayOffset = 0) => {
  const d = addDays(MON, dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
};
const base = (patch = {}) =>
  hydrateState({
    ...DEFAULT_STATE,
    profile: { ...DEFAULT_STATE.profile, onboarded: true, ...patch.profile },
    fasting: { ...DEFAULT_STATE.fasting, ...patch.fasting },
    reminders: { ...DEFAULT_STATE.reminders, ...patch.reminders },
    workoutPlan: { ...DEFAULT_STATE.workoutPlan, ...patch.workoutPlan },
    days: patch.days || {},
    weights: patch.weights || [],
  });
const food = (kcal, protein = 0, meal = 'lunch') => ({ id: Math.random().toString(36), name: 'x', kcal, protein, carbs: 0, fat: 0, meal, t: at(12).toISOString() });
const ids = (list) => list.map((i) => i.id);

describe('todoList', () => {
  test('fresh day: everything open, every open item leads somewhere', () => {
    const list = todoList(base(), at(9));
    expect(list.every((i) => !i.done)).toBe(true);
    expect(list.every((i) => i.place)).toBe(true);
    expect(ids(list)).toEqual(expect.arrayContaining(['meals', 'water', 'protein', 'workout', 'sleep', 'weigh', 'fast']));
  });

  test('items tick off as things get logged', () => {
    const k = dayKey(MON);
    const s = base({
      days: { [k]: { food: [food(500, 90), food(700, 90)], water: [{ ml: 5000 }], exercise: [{ id: 'e', minutes: 45, kcal: 300 }], steps: 0, sleepHours: 8, workout: { done: true } } },
      weights: [{ id: 'w', date: k, t: at(7).toISOString(), kg: 80 }],
      fasting: { active: { start: at(20, 0, -1).toISOString(), targetHours: 16 } },
    });
    const list = todoList(s, at(21));
    expect(list.filter((i) => !i.done).map((i) => i.id)).toEqual([]);
  });

  test('without fasting, one item per main meal; water off hides water', () => {
    const list = todoList(base({ fasting: { enabled: false }, profile: { waterTracking: false } }), at(9));
    expect(ids(list)).toEqual(expect.arrayContaining(['meal-breakfast', 'meal-lunch', 'meal-dinner']));
    expect(ids(list)).not.toContain('water');
    expect(ids(list)).not.toContain('fast');
  });

  test('steps go to Train (steps sheet), weigh-in to Progress (weigh sheet), sleep opens on Today', () => {
    const s = base({ workoutPlan: { stepPlan: { baseline: 6000, startDate: dayKey(MON) } } });
    const by = Object.fromEntries(todoList(s, at(9)).map((i) => [i.id, i]));
    expect([by.steps.place, by.steps.sub]).toEqual(['move', 'steps']);
    expect([by.weigh.place, by.weigh.sub]).toEqual(['progress', 'weigh']);
    expect(by.sleep.place).toBe('sleep');
  });

  test('weekly weigh-in on a chosen day: only that day, in to-dos, quests and reminders', () => {
    const { computeGame } = require('./game');
    const { buildSchedule } = require('./schedule');
    const s = base({ reminders: { weighIn: { enabled: true, time: '07:30', frequency: 'weekly', day: 4 } } }); // Thursday
    const thu = at(6, 0, 3);
    expect(ids(todoList(s, thu))).toContain('weigh');
    expect(ids(todoList(s, at(9)))).not.toContain('weigh'); // Monday
    expect(computeGame(s, dayKey(thu)).quests.map((q) => q.id)).toContain('weigh');
    expect(computeGame(s, dayKey(MON)).quests.map((q) => q.id)).not.toContain('weigh');
    expect(buildSchedule(s, thu).some((p) => p.kind === 'weight')).toBe(true);
    expect(buildSchedule(s, at(6)).filter((p) => p.kind === 'weight').map((p) => p.date.getDay())).toEqual([4]);
    // Daily: always a quest.
    expect(computeGame(base(), dayKey(MON)).quests.map((q) => q.id)).toContain('weigh');
  });

  test('weekly weigh-in defaults to Mondays', () => {
    const s = base({ reminders: { weighIn: { enabled: true, time: '07:30', frequency: 'weekly' } } });
    expect(ids(todoList(s, at(9)))).toContain('weigh');
    expect(ids(todoList(s, at(9, 0, 1)))).not.toContain('weigh');
  });

  test('rest day has no workout item (built-in plan: Sunday is optional)', () => {
    expect(ids(todoList(base(), at(9, 0, -1)))).not.toContain('workout');
  });
});

describe('weekProgress', () => {
  test('Monday-to-Sunday, future days marked, counts only days so far', () => {
    const w = weekProgress(base(), at(12, 0, 2)); // Wednesday
    expect(w.keys[0]).toBe(dayKey(MON));
    expect(w.days.filter((d) => d.future)).toHaveLength(4);
    expect(w.daysSoFar).toBe(3);
  });

  test('averages, workouts and weight change', () => {
    const k0 = dayKey(MON);
    const k1 = dayKey(addDays(MON, 1));
    const s = base({
      days: {
        [k0]: { food: [food(1800, 170)], water: [], exercise: [], workout: { done: true } },
        [k1]: { food: [food(2000, 100)], water: [], exercise: [] },
      },
      weights: [
        { id: 'a', date: dayKey(addDays(MON, -3)), kg: 90 },
        { id: 'b', date: k1, kg: 89 },
      ],
    });
    const w = weekProgress(s, at(20, 0, 1));
    expect(w.avgKcal).toBe(1900);
    expect(w.workoutsDone).toBe(1);
    expect(w.workoutsPlanned).toBeGreaterThanOrEqual(1);
    expect(w.weightChangeKg).toBeCloseTo(-1);
    expect(w.daysLogged).toBe(2);
  });
});

describe('forecast', () => {
  test('no data, no guesses', () => {
    const f = forecast(base(), 4, at(12));
    expect(f.byTrend).toBeNull();
    expect(f.byIntake).toBeNull();
  });

  test('weigh-in trend carries forward', () => {
    // Losing 0.5 kg a week for 4 weeks.
    const weights = [];
    for (let i = 28; i >= 0; i -= 2) weights.push({ id: `w${i}`, date: dayKey(addDays(MON, -i)), kg: 90 - ((28 - i) / 7) * 0.5 });
    const f = forecast(base({ weights, profile: { goalWeightKg: 85 } }), 4, at(12));
    expect(f.byTrend.ratePerWeek).toBeCloseTo(-0.5, 1);
    expect(f.byTrend.kg).toBeLessThan(f.currentKg);
    expect(f.byTrend.kg).toBeCloseTo(f.currentKg - 2, 0);
    expect(f.goalDate).not.toBeNull();
    expect(forecast(base({ weights, profile: { goalWeightKg: 85 } }), 12, at(12)).weeks).toBe(12);
  });

  test('intake guess ignores half-logged days', () => {
    const days = {};
    for (let i = 1; i <= 6; i++) days[dayKey(addDays(MON, -i))] = { food: [food(1500)], water: [], exercise: [] };
    days[dayKey(addDays(MON, -7))] = { food: [food(200)], water: [], exercise: [] }; // forgot to log
    const f = forecast(base({ days }), 4, at(12));
    expect(f.byIntake.daysUsed).toBe(6);
    expect(f.byIntake.avgEaten).toBe(1500);
    expect(f.byIntake.ratePerWeek).toBeLessThan(0);
  });

  test('step goal a few weeks out', () => {
    const s = base({ workoutPlan: { stepPlan: { baseline: 6000, startDate: dayKey(MON) } } });
    expect(forecast(s, 4, at(12)).steps).toEqual({ now: 6000, then: 8000, perWeek: 500 });
  });
});

test('start pages exist in the app (Today keeps its name)', () => {
  expect(START_PAGES[0]).toEqual({ key: 'today', label: 'Today' });
  expect(START_PAGES.map((p) => p.key)).not.toContain('settings');
});
