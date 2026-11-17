// Turning Health Connect data into the app's own: which time ranges to ask for, how a
// watch workout becomes an activity, and how an import merges into the state.
// Pure JavaScript (no native module), so it can be unit-tested.
import { dayKey, parseDayKey, addDays } from './dates';
import { exerciseCalories } from './calc';
import { effectiveMet, activityByKey } from './exercise';

// Data the app can read from Health Connect. `records` are the Health Connect record
// types each one needs read access to.
export const HC_TYPES = [
  { key: 'steps', label: 'Steps', desc: 'Daily step count', records: ['Steps'] },
  { key: 'sleep', label: 'Sleep', desc: 'Hours slept each night', records: ['SleepSession'] },
  { key: 'weight', label: 'Weight', desc: 'Weigh-ins from a smart scale or another app', records: ['Weight'] },
  { key: 'workouts', label: 'Workouts', desc: 'Exercise sessions from a watch or fitness app, with calories', records: ['ExerciseSession', 'ActiveCaloriesBurned'] },
];

export const DEFAULT_HC = { enabled: false, steps: true, sleep: true, weight: true, workouts: true, lastSync: null, lastError: null };

export const hcPermissions = (settings) =>
  HC_TYPES.filter((ty) => settings[ty.key]).flatMap((ty) => ty.records.map((recordType) => ({ accessType: 'read', recordType })));

// Health Connect ExerciseType numbers → the app's activity types.
const EXERCISE_MAP = {
  79: 'walk', 56: 'run', 57: 'run', 8: 'cycle', 9: 'cycle', 74: 'swim', 73: 'swim', 37: 'hike', 25: 'elliptical',
  53: 'row', 54: 'row', 83: 'yoga', 48: 'yoga', 16: 'dance', 68: 'stairs', 70: 'strength', 81: 'strength', 13: 'strength',
  36: 'hiit', 5: 'sports', 64: 'sports', 76: 'sports', 75: 'sports', 32: 'sports',
};
export const activityForExerciseType = (n) => EXERCISE_MAP[n] || 'other';

// Local midnight to midnight for a day.
export function dayRange(key) {
  const start = parseDayKey(key);
  return { startTime: start.toISOString(), endTime: addDays(start, 1).toISOString() };
}

// "Sleep last night" for a day: sleep that ended between 6 PM the evening before and 6 PM that day.
export function sleepRange(key) {
  const d = parseDayKey(key);
  const start = addDays(d, -1);
  start.setHours(18, 0, 0, 0);
  const end = new Date(d);
  end.setHours(18, 0, 0, 0);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

export const lastDays = (n, now = new Date()) => Array.from({ length: n }, (_, i) => dayKey(addDays(now, -i)));

// A Health Connect exercise session → an activity entry for its day.
export function sessionToActivity(rec, kcalBurned, weightKg) {
  const start = new Date(rec.startTime);
  const minutes = Math.max(1, Math.round((new Date(rec.endTime) - start) / 60000));
  const type = activityForExerciseType(rec.exerciseType);
  const kcal = kcalBurned > 0 ? Math.round(kcalBurned) : exerciseCalories(effectiveMet(type, 'moderate'), weightKg, minutes);
  const id = (rec.metadata && rec.metadata.id) || `${rec.startTime}-${rec.exerciseType}`;
  return {
    id: `hc-${id}`,
    day: dayKey(start),
    t: start.toISOString(),
    type,
    name: rec.title || activityByKey(type).label,
    minutes,
    intensity: 'moderate',
    kcal,
    fromHC: true,
  };
}

// Merge an import into the state.
// payload: { days: { [key]: { steps?, sleepHours?, workouts?: [activity] } }, weights: [{ date, kg, t, id }] }
// - steps and sleep from Health Connect replace that day's numbers (only when it has some)
// - workouts replace the day's earlier Health Connect activities (manual and Train ones stay)
// - weigh-ins are only added for days without one, so your own weigh-ins win
export function mergeHealthConnect(state, payload) {
  const days = { ...state.days };
  let changed = false;
  for (const [key, inc] of Object.entries((payload && payload.days) || {})) {
    const cur = days[key];
    const day = { water: [], food: [], exercise: [], steps: 0, ...(cur || {}) };
    let touched = false;
    if (inc.steps > 0 && day.steps !== inc.steps) {
      day.steps = inc.steps;
      touched = true;
    }
    if (inc.sleepHours > 0 && day.sleepHours !== inc.sleepHours) {
      day.sleepHours = inc.sleepHours;
      touched = true;
    }
    if (Array.isArray(inc.workouts)) {
      const kept = (day.exercise || []).filter((e) => !e.fromHC);
      const next = [...kept, ...inc.workouts.map(({ day: _d, ...a }) => a)];
      const before = JSON.stringify((day.exercise || []).filter((e) => e.fromHC));
      if (before !== JSON.stringify(inc.workouts.map(({ day: _d, ...a }) => a))) {
        day.exercise = next;
        touched = true;
      }
    }
    if (touched) {
      days[key] = day;
      changed = true;
    }
  }
  let weights = state.weights;
  const have = new Set(weights.map((w) => w.date));
  const add = ((payload && payload.weights) || []).filter((w) => w.kg > 0 && !have.has(w.date));
  if (add.length) {
    // One per day: the latest reading of each day.
    const byDay = {};
    for (const w of add) if (!byDay[w.date] || w.t > byDay[w.date].t) byDay[w.date] = w;
    weights = [...weights, ...Object.values(byDay).map((w) => ({ id: `hc-${w.id || w.t}`, date: w.date, t: w.t, kg: Math.round(w.kg * 100) / 100, fromHC: true }))].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    changed = true;
  }
  return changed ? { ...state, days, weights } : state;
}
