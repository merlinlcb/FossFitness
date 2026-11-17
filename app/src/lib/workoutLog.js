// A day's workout log → whether it counts as done and the activity entries it adds
// (active minutes, calories burned, water goal). Worked out from what's logged, so
// there is no "mark done" button: a set with reps or cardio minutes is enough, and
// removing them takes the minutes away again.
import { sessionFor, exerciseById, cardioLog } from './workoutPlan';
import { exerciseCalories } from './calc';
import { effectiveMet } from './exercise';

const hasReps = (sets) => (sets || []).some((s) => s && s.reps > 0);

// Exercises of the day's session that have data logged.
export function loggedExercises(day, log, plan) {
  const w = log || {};
  const session = sessionFor(day, w, plan);
  return session.items
    .map((id) => exerciseById(id, plan))
    .filter(Boolean)
    .filter((ex) => (ex.kind === 'cardio' ? cardioLog((w.cardio || {})[ex.id]).minutes > 0 : hasReps((w.sets || {})[ex.id])));
}

// Activity entries for the day (stable ids, so edits update them instead of piling up).
export function workoutActivities(day, log, plan, weightKg) {
  const done = loggedExercises(day, log, plan);
  const out = [];
  const strength = done.filter((e) => e.kind !== 'cardio');
  if (strength.length) {
    const minutes = Math.max(10, strength.length * 5);
    const session = sessionFor(day, log || {}, plan);
    out.push({
      id: `wk-${day}-strength`,
      type: 'strength',
      name: `${session.title.replace(/ \+ .*/, '')} (${strength.length} exercise${strength.length === 1 ? '' : 's'})`,
      minutes,
      intensity: 'moderate',
      kcal: exerciseCalories(effectiveMet('strength', 'moderate'), weightKg, minutes),
    });
  }
  for (const ex of done.filter((e) => e.kind === 'cardio')) {
    const c = cardioLog(((log || {}).cardio || {})[ex.id]);
    out.push({
      id: `wk-${day}-${ex.id}`,
      type: ex.activity || 'other',
      name: c.laps ? `${ex.name} (${c.laps} laps)` : ex.name,
      minutes: c.minutes,
      intensity: c.intensity,
      kcal: exerciseCalories(effectiveMet(ex.activity || 'other', c.intensity), weightKg, c.minutes),
    });
  }
  return out;
}
