// The week-at-a-time logs on Progress: which days had food logged, how many calories
// went to weight training vs cardio, and the current and best run of logged days.
import { dayKey, addDays, parseDayKey } from './dates';
import { weekKey } from './game';

// Monday to Sunday of the week `offset` weeks back from the one holding `today`.
export function weekOf(today, offset = 0) {
  const monday = addDays(parseDayKey(weekKey(today)), -7 * offset);
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)));
}

export const foodLogged = (state, k) => ((state.days[k] || {}).food || []).length > 0;

// Calories burned, split: strength workouts (blue) and everything else, i.e. cardio (red).
export function exerciseSplit(state, k) {
  let strength = 0;
  let cardio = 0;
  for (const e of (state.days[k] || {}).exercise || []) {
    const kcal = Math.max(0, Math.round(e.kcal || 0));
    if (e.type === 'strength') strength += kcal;
    else cardio += kcal;
  }
  return { strength, cardio, total: strength + cardio };
}

export const exerciseLogged = (state, k) => ((state.days[k] || {}).exercise || []).some((e) => (e.minutes || 0) > 0 || (e.kcal || 0) > 0);

// Days in a row with `logged(k)` true, ending today, or yesterday while today is still open.
export function currentRun(logged, today) {
  let k = logged(today) ? today : dayKey(addDays(parseDayKey(today), -1));
  let n = 0;
  while (logged(k)) {
    n++;
    k = dayKey(addDays(parseDayKey(k), -1));
  }
  return n;
}

// Longest run of logged days anywhere in the history.
export function bestRun(state, logged) {
  const keys = Object.keys(state.days).filter(logged).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = prev && dayKey(addDays(parseDayKey(prev), 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}
