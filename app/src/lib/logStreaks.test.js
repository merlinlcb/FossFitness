import { weekOf, foodLogged, exerciseSplit, exerciseLogged, currentRun, bestRun } from './logStreaks';
import { dayKey, addDays } from './dates';

const WED = dayKey(new Date(2026, 10, 18)); // Wednesday 18 Nov 2026
const k = (n) => dayKey(addDays(new Date(2026, 10, 18), n));
const food = { food: [{ id: 'f', kcal: 100 }], water: [], exercise: [] };

test('weekOf: Monday to Sunday, stepping a week at a time', () => {
  expect(weekOf(WED)).toEqual([k(-2), k(-1), k(0), k(1), k(2), k(3), k(4)]);
  expect(weekOf(WED, 1)[0]).toBe(k(-9));
});

test('food streak: runs through yesterday while today is open; best run', () => {
  const state = { days: { [k(-1)]: food, [k(-2)]: food, [k(-3)]: food, [k(-5)]: food, [k(-6)]: food } };
  const logged = (d) => foodLogged(state, d);
  expect(currentRun(logged, WED)).toBe(3);
  state.days[WED] = food;
  expect(currentRun(logged, WED)).toBe(4);
  expect(currentRun(logged, k(2))).toBe(0);
  expect(bestRun(state, logged)).toBe(4);
});

test('exercise split: strength is weight training, everything else cardio', () => {
  const state = {
    days: {
      [WED]: {
        exercise: [
          { id: 'wk-s', type: 'strength', minutes: 20, kcal: 120 },
          { id: 'a', type: 'run', minutes: 30, kcal: 300.4 },
          { id: 'b', type: 'swim', minutes: 20, kcal: 200 },
        ],
      },
    },
  };
  expect(exerciseSplit(state, WED)).toEqual({ strength: 120, cardio: 500, total: 620 });
  expect(exerciseSplit(state, k(1))).toEqual({ strength: 0, cardio: 0, total: 0 });
  expect(exerciseLogged(state, WED)).toBe(true);
  expect(exerciseLogged(state, k(-1))).toBe(false);
});

describe('weigh-in history edits', () => {
  const { reducer } = require('../state/reducer');
  const { DEFAULT_STATE, hydrateState } = require('../state/defaults');
  const base = () =>
    hydrateState({
      ...DEFAULT_STATE,
      profile: { ...DEFAULT_STATE.profile, onboarded: true },
      weights: [
        { id: 'a', date: '2026-11-01', t: '2026-11-01T07:00:00.000Z', kg: 90 },
        { id: 'b', date: '2026-11-08', t: '2026-11-08T07:00:00.000Z', kg: 89 },
      ],
    });

  test('change the weight; profile follows the latest', () => {
    const s = reducer(base(), { type: 'UPDATE_WEIGHT', id: 'b', kg: 88.5 });
    expect(s.weights.find((w) => w.id === 'b').kg).toBe(88.5);
    expect(s.profile.weightKg).toBe(88.5);
  });

  test('moving to a date that has a weigh-in replaces it', () => {
    const s = reducer(base(), { type: 'UPDATE_WEIGHT', id: 'a', kg: 91, date: '2026-11-08' });
    expect(s.weights).toHaveLength(1);
    expect(s.weights[0]).toMatchObject({ id: 'a', date: '2026-11-08', kg: 91 });
  });
});

test('My foods: only your own custom foods', () => {
  const { isMine } = require('./foods');
  const auth = { user: { id: 3 } };
  expect(isMine({ by: 3 }, auth)).toBe(true);
  expect(isMine({}, auth)).toBe(true); // made here, not tagged yet
  expect(isMine({ by: 7 }, auth)).toBe(false);
  expect(isMine({ by: 7 }, null)).toBe(false);
});
