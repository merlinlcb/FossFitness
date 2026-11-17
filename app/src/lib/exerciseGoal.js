// Exercise goals: what counts, the target, and how far along you are.
// Stored as workoutPlan.goal = { kind, target } (Settings → Training → Exercise goal).
import { dayKey, parseDayKey, addDays } from './dates';
import { sumExerciseMinutes, sumExerciseCalories } from './calc';

export const GOAL_KINDS = [
  { key: 'dayMinutes', label: 'Active minutes a day', short: 'min today', unit: 'min', default: 30, min: 5, max: 300, step: 5 },
  { key: 'weekMinutes', label: 'Active minutes a week', short: 'min this week', unit: 'min', default: 150, min: 30, max: 1500, step: 10 },
  { key: 'dayKcal', label: 'Calories burned a day', short: 'kcal today', unit: 'kcal', default: 300, min: 50, max: 3000, step: 25 },
  { key: 'weekWorkouts', label: 'Workouts a week', short: 'workouts this week', unit: 'workouts', default: 4, min: 1, max: 14, step: 1 },
];

export const goalKind = (key) => GOAL_KINDS.find((k) => k.key === key) || GOAL_KINDS[0];

export function exerciseGoal(plan) {
  const g = (plan && plan.goal) || {};
  const kind = goalKind(g.kind);
  const target = Number(g.target) > 0 ? Number(g.target) : kind.default;
  return { kind: kind.key, target, enabled: g.enabled !== false };
}

// A day "has a workout" when anything was logged: exercise entries or a workout marked done.
const workedOut = (d) => !!d && ((d.exercise && d.exercise.length > 0) || !!(d.workout && d.workout.done));

// Monday of the week containing `date`.
function weekStart(date) {
  const d = parseDayKey(dayKey(date));
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function exerciseProgress(state, now = new Date()) {
  const goal = exerciseGoal(state.workoutPlan);
  const kind = goalKind(goal.kind);
  const today = dayKey(now);
  const day = state.days[today] || {};
  let value = 0;
  if (goal.kind === 'dayMinutes') value = sumExerciseMinutes(day.exercise);
  else if (goal.kind === 'dayKcal') value = sumExerciseCalories(day.exercise);
  else {
    const start = weekStart(now);
    for (let i = 0; i < 7; i++) {
      const k = dayKey(addDays(start, i));
      if (k > today) break;
      const d = state.days[k];
      if (goal.kind === 'weekMinutes') value += sumExerciseMinutes((d && d.exercise) || []);
      else if (workedOut(d)) value += 1;
    }
  }
  value = Math.round(value);
  return {
    ...goal,
    label: kind.label,
    short: kind.short,
    unit: kind.unit,
    value,
    left: Math.max(0, goal.target - value),
    done: value >= goal.target,
    weekly: goal.kind.startsWith('week'),
  };
}
