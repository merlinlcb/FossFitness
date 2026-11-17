import { exerciseProgress, exerciseGoal, GOAL_KINDS } from './exerciseGoal';
import { todoList } from './overview';
import { DEFAULT_STATE } from '../state/defaults';

const WED = new Date(2026, 10, 18, 18, 0); // Wednesday 18 Nov 2026
const day = (minutes, kcal) => ({ water: [], food: [], exercise: minutes ? [{ id: 'x', minutes, kcal }] : [], steps: 0 });
const state = (goal, days) => ({ ...DEFAULT_STATE, workoutPlan: { ...DEFAULT_STATE.workoutPlan, goal }, days });

test('defaults: 30 active minutes a day, on', () => {
  expect(exerciseGoal(DEFAULT_STATE.workoutPlan)).toEqual({ kind: 'dayMinutes', target: 30, enabled: true });
  expect(GOAL_KINDS.map((k) => k.key)).toEqual(['dayMinutes', 'weekMinutes', 'dayKcal', 'weekWorkouts']);
});

test('daily minutes and calories count today only', () => {
  const days = { '2026-11-18': day(20, 180), '2026-11-17': day(60, 500) };
  expect(exerciseProgress(state({ kind: 'dayMinutes', target: 30 }, days), WED)).toMatchObject({ value: 20, left: 10, done: false });
  expect(exerciseProgress(state({ kind: 'dayKcal', target: 150 }, days), WED)).toMatchObject({ value: 180, done: true, left: 0 });
});

test('weekly goals count Monday to today', () => {
  const days = {
    '2026-11-15': day(90, 600), // last Sunday: previous week
    '2026-11-16': day(40, 300), // Monday
    '2026-11-18': { ...day(0), workout: { done: true } }, // Wednesday: plan workout with no activity minutes
    '2026-11-19': day(30, 200), // tomorrow: not yet
  };
  expect(exerciseProgress(state({ kind: 'weekMinutes', target: 150 }, days), WED)).toMatchObject({ value: 40, weekly: true });
  expect(exerciseProgress(state({ kind: 'weekWorkouts', target: 2 }, days), WED)).toMatchObject({ value: 2, done: true });
});

test('the goal shows on the to-do list, and can be switched off', () => {
  const days = { '2026-11-18': day(35, 250) };
  const item = todoList(state({ kind: 'dayMinutes', target: 30 }, days), WED).find((i) => i.id === 'exgoal');
  expect(item).toMatchObject({ done: true, detail: '35 / 30 min today' });
  expect(todoList(state({ kind: 'dayMinutes', target: 30, enabled: false }, days), WED).find((i) => i.id === 'exgoal')).toBeUndefined();
});
