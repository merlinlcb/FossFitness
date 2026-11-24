import { dayKey, uid } from '../lib/dates';
import { DEFAULT_STATE, EMPTY_DAY, hydrateState } from './defaults';
import { cardioLog } from '../lib/workoutPlan';
import { workoutActivities } from '../lib/workoutLog';
import { mergeHealthConnect } from '../lib/healthConnectMap';
import { toggleDose, sortTimes, backfillDoses } from '../lib/health';

const MAX_RECENT_FOODS = 25;

const emptyWorkout = () => ({ choice: null, done: false, doneAt: null, sets: {}, cardio: {}, activityIds: [], items: [] });

function updateDay(state, key, fn) {
  const day = { ...EMPTY_DAY, ...(state.days[key] || {}) };
  return { ...state, days: { ...state.days, [key]: fn(day) } };
}

// Profile weight always follows the most recent weigh-in.
function syncProfileWeight(state) {
  if (!state.weights.length) return state;
  const latest = [...state.weights].sort((a, b) => (a.date === b.date ? a.t.localeCompare(b.t) : a.date.localeCompare(b.date)))[
    state.weights.length - 1
  ];
  return { ...state, profile: { ...state.profile, weightKg: latest.kg } };
}

// Actions that change a day's workout log; afterwards "done" and the workout's activity
// entries are worked out again from what is logged.
const WORKOUT_ACTIONS = new Set(['SET_WORKOUT', 'SET_WORKOUT_SET', 'REMOVE_WORKOUT_SET', 'SET_WORKOUT_CARDIO', 'ADD_WORKOUT_ITEM', 'REMOVE_WORKOUT_ITEM', 'COPY_WORKOUT']);

export function refreshWorkout(state, key) {
  const d = state.days[key];
  if (!d) return state;
  const w = { ...emptyWorkout(), ...(d.workout || {}) };
  const acts = workoutActivities(key, w, state.workoutPlan, state.profile.weightKg);
  const oldIds = new Set(w.activityIds || []);
  const isOld = (e) => e.fromPlan || oldIds.has(e.id);
  const prev = Object.fromEntries((d.exercise || []).filter(isOld).map((e) => [e.id, e]));
  const now = new Date().toISOString();
  const added = acts.map((a) => ({ t: (prev[a.id] || {}).t || now, ...a, fromPlan: true }));
  const done = added.length > 0;
  return {
    ...state,
    days: {
      ...state.days,
      [key]: {
        ...d,
        exercise: [...(d.exercise || []).filter((e) => !isOld(e)), ...added],
        workout: { ...w, done, doneAt: done ? w.doneAt || now : null, activityIds: added.map((a) => a.id) },
      },
    },
  };
}

export function reducer(state, action) {
  const next = baseReducer(state, action);
  if (next !== state && WORKOUT_ACTIONS.has(action.type)) return refreshWorkout(next, action.day || action.toDay);
  return next;
}

function baseReducer(state, action) {
  switch (action.type) {
    case 'LOADED':
      return hydrateState(action.state);

    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } };

    // ---- Water ----
    case 'ADD_WATER': {
      const t = action.t || new Date().toISOString();
      const key = action.day || dayKey(t);
      return updateDay(state, key, (d) => ({
        ...d,
        water: [...d.water, { id: uid(), t, ml: Math.round(action.ml), label: action.label || null }],
      }));
    }
    case 'REMOVE_WATER':
      return updateDay(state, action.day, (d) => ({ ...d, water: d.water.filter((w) => w.id !== action.id) }));
    case 'SET_WATER_PRESETS':
      return { ...state, waterPresets: action.presets };

    // ---- Food ----
    case 'ADD_FOOD': {
      const t = action.entry.t || new Date().toISOString();
      const key = action.day || dayKey(t);
      const entry = { id: uid(), ...action.entry, t };
      let next = updateDay(state, key, (d) => ({ ...d, food: [...d.food, entry] }));
      if (entry.foodId) {
        const recent = [
          { foodId: entry.foodId, servingLabel: entry.servingLabel, qty: entry.qty, meal: entry.meal },
          ...next.recentFoods.filter((r) => r.foodId !== entry.foodId),
        ].slice(0, MAX_RECENT_FOODS);
        next = { ...next, recentFoods: recent };
      }
      return next;
    }
    case 'UPDATE_FOOD':
      return updateDay(state, action.day, (d) => ({
        ...d,
        food: d.food.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)),
      }));
    case 'REMOVE_FOOD':
      return updateDay(state, action.day, (d) => ({ ...d, food: d.food.filter((f) => f.id !== action.id) }));
    case 'COPY_MEAL': {
      // Copy all entries of a meal from one day to another.
      const src = (state.days[action.fromDay] || EMPTY_DAY).food.filter((f) => f.meal === action.meal);
      if (!src.length) return state;
      const now = new Date().toISOString();
      return updateDay(state, action.toDay, (d) => ({
        ...d,
        food: [...d.food, ...src.map((f) => ({ ...f, id: uid(), t: now }))],
      }));
    }
    // ---- Saved meals ----
    case 'SAVE_MEAL': {
      const meal = { ...action.meal, id: action.meal.id || `meal-${uid()}`, updatedAt: new Date().toISOString() };
      const exists = state.meals.some((m) => m.id === meal.id);
      return { ...state, meals: exists ? state.meals.map((m) => (m.id === meal.id ? meal : m)) : [...state.meals, meal] };
    }
    case 'REMOVE_MEAL':
      return { ...state, meals: state.meals.filter((m) => m.id !== action.id) };
    // Log several entries at once (a saved meal). entries: [{ ...food entry }]
    case 'ADD_FOODS': {
      const t = action.t || new Date().toISOString();
      const key = action.day || dayKey(t);
      return updateDay(state, key, (d) => ({ ...d, food: [...d.food, ...action.entries.map((e) => ({ id: uid(), ...e, t }))] }));
    }
    case 'ADD_CUSTOM_FOOD':
      return { ...state, customFoods: [...state.customFoods, { id: `my-${uid()}`, ...action.food }] };
    case 'UPDATE_CUSTOM_FOOD':
      return { ...state, customFoods: state.customFoods.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)) };
    case 'REMOVE_CUSTOM_FOOD':
      return {
        ...state,
        customFoods: state.customFoods.filter((f) => f.id !== action.id),
        favorites: state.favorites.filter((id) => id !== action.id),
        recentFoods: state.recentFoods.filter((r) => r.foodId !== action.id),
      };
    case 'TOGGLE_FAVORITE':
      return {
        ...state,
        favorites: state.favorites.includes(action.foodId)
          ? state.favorites.filter((id) => id !== action.foodId)
          : [action.foodId, ...state.favorites],
      };

    // ---- Exercise ----
    case 'ADD_EXERCISE': {
      const t = action.entry.t || new Date().toISOString();
      const key = action.day || dayKey(t);
      return updateDay(state, key, (d) => ({ ...d, exercise: [...d.exercise, { id: uid(), ...action.entry, t }] }));
    }
    case 'REMOVE_EXERCISE':
      return updateDay(state, action.day, (d) => ({ ...d, exercise: d.exercise.filter((e) => e.id !== action.id) }));
    case 'SET_STEPS':
      return updateDay(state, action.day, (d) => ({ ...d, steps: Math.max(0, Math.round(action.steps || 0)) }));

    // ---- Workout plan ----
    case 'SET_WORKOUT': {
      // Generic patch of a day's workout log (choice, done, ...)
      return updateDay(state, action.day, (d) => ({ ...d, workout: { ...emptyWorkout(), ...(d.workout || {}), ...action.patch } }));
    }
    case 'SET_WORKOUT_SET': {
      // Update set #index of an exercise: patch = { kg?, reps? }
      return updateDay(state, action.day, (d) => {
        const w = { ...emptyWorkout(), ...(d.workout || {}) };
        const sets = [...((w.sets || {})[action.exerciseId] || [])];
        while (sets.length <= action.index) sets.push({ kg: null, reps: null });
        sets[action.index] = { ...sets[action.index], ...action.patch };
        return { ...d, workout: { ...w, sets: { ...w.sets, [action.exerciseId]: sets } } };
      });
    }
    case 'REMOVE_WORKOUT_SET':
      return updateDay(state, action.day, (d) => {
        const w = { ...emptyWorkout(), ...(d.workout || {}) };
        const sets = ((w.sets || {})[action.exerciseId] || []).filter((_, i) => i !== action.index);
        return { ...d, workout: { ...w, sets: { ...w.sets, [action.exerciseId]: sets } } };
      });
    case 'SET_WORKOUT_CARDIO':
      return updateDay(state, action.day, (d) => {
        const w = { ...emptyWorkout(), ...(d.workout || {}) };
        // Stored as { minutes, intensity, laps }; older logs hold just the minutes as a number.
        const cardio = { ...w.cardio };
        const prev = cardioLog(cardio[action.exerciseId]);
        const next = {
          minutes: action.minutes !== undefined ? Math.max(0, Math.round(action.minutes || 0)) : prev.minutes,
          intensity: action.intensity || prev.intensity,
          laps: action.laps !== undefined ? Math.max(0, Math.round(action.laps || 0)) : prev.laps,
        };
        if (next.minutes || next.laps) cardio[action.exerciseId] = next;
        else delete cardio[action.exerciseId];
        return { ...d, workout: { ...w, cardio } };
      });
    // ---- "My own plan": log the exercises you did ----
    case 'ADD_WORKOUT_ITEM':
      return updateDay(state, action.day, (d) => {
        const w = { ...emptyWorkout(), ...(d.workout || {}) };
        const items = w.items || [];
        return items.includes(action.exerciseId) ? d : { ...d, workout: { ...w, items: [...items, action.exerciseId] } };
      });
    case 'REMOVE_WORKOUT_ITEM':
      return updateDay(state, action.day, (d) => {
        const w = { ...emptyWorkout(), ...(d.workout || {}) };
        const sets = { ...(w.sets || {}) };
        const cardio = { ...(w.cardio || {}) };
        delete sets[action.exerciseId];
        delete cardio[action.exerciseId];
        return { ...d, workout: { ...w, items: (w.items || []).filter((id) => id !== action.exerciseId), sets, cardio } };
      });
    case 'COPY_WORKOUT': {
      // Fill a day with another day's exercises. Only the list: logged numbers mean "done",
      // so last time's numbers show as hints, with "Same as last time" on each exercise.
      const from = (state.days[action.fromDay] || {}).workout;
      if (!from || !(from.items || []).length) return state;
      return updateDay(state, action.toDay, (d) => {
        const w = { ...emptyWorkout(), ...(d.workout || {}) };
        const items = [...new Set([...(w.items || []), ...from.items])];
        return { ...d, workout: { ...w, items } };
      });
    }
    case 'SET_WORKOUT_PLAN':
      return { ...state, workoutPlan: { ...state.workoutPlan, ...action.patch } };
    case 'SET_SLEEP':
      return updateDay(state, action.day, (d) => ({ ...d, sleepHours: action.hours == null ? null : Math.max(0, Math.min(24, action.hours)) }));

    // ---- Weight ----
    case 'ADD_WEIGHT': {
      const date = action.date || dayKey();
      // One weigh-in per day: replace an existing entry for the same date.
      const weights = [
        ...state.weights.filter((w) => w.date !== date),
        { id: uid(), date, t: new Date().toISOString(), kg: Math.round(action.kg * 100) / 100 },
      ].sort((a, b) => a.date.localeCompare(b.date));
      return syncProfileWeight({ ...state, weights });
    }
    // ---- Health Connect ----
    case 'SET_HEALTH_CONNECT':
      return { ...state, healthConnect: { ...state.healthConnect, ...action.patch } };
    case 'HC_IMPORT':
      return syncProfileWeight(mergeHealthConnect(state, action.payload));
    // Edit a weigh-in from the history (weight and/or date). Another entry on the new date is replaced.
    case 'UPDATE_WEIGHT': {
      const old = state.weights.find((w) => w.id === action.id);
      if (!old) return state;
      const date = action.date || old.date;
      const weights = [
        ...state.weights.filter((w) => w.id !== action.id && w.date !== date),
        { ...old, date, kg: action.kg ? Math.round(action.kg * 100) / 100 : old.kg, fromHC: undefined },
      ].sort((a, b) => a.date.localeCompare(b.date));
      return syncProfileWeight({ ...state, weights });
    }
    case 'REMOVE_WEIGHT':
      return syncProfileWeight({ ...state, weights: state.weights.filter((w) => w.id !== action.id) });

    // ---- Fasting ----
    case 'SET_FASTING':
      return { ...state, fasting: { ...state.fasting, ...action.patch } };
    case 'START_FAST':
      return {
        ...state,
        fasting: {
          ...state.fasting,
          active: { start: action.start || new Date().toISOString(), targetHours: action.targetHours },
        },
      };
    case 'EDIT_ACTIVE_FAST':
      if (!state.fasting.active) return state;
      return { ...state, fasting: { ...state.fasting, active: { ...state.fasting.active, ...action.patch } } };
    case 'END_FAST': {
      const a = state.fasting.active;
      if (!a) return state;
      const end = action.end || new Date().toISOString();
      const record = { id: uid(), start: a.start, end, targetHours: a.targetHours };
      return {
        ...state,
        fasting: { ...state.fasting, active: null, history: [...state.fasting.history, record].slice(-365) },
      };
    }
    case 'CANCEL_FAST':
      return { ...state, fasting: { ...state.fasting, active: null } };
    case 'REMOVE_FAST':
      return { ...state, fasting: { ...state.fasting, history: state.fasting.history.filter((f) => f.id !== action.id) } };

    // ---- Reminders ----
    case 'SET_REMINDER':
      return {
        ...state,
        reminders: { ...state.reminders, [action.key]: { ...state.reminders[action.key], ...action.patch } },
      };

    // ---- "Complete today's log" (a review, not a lock: the day stays editable) ----
    case 'SET_DAY_COMPLETE':
      return updateDay(state, action.day, (d) => ({ ...d, completedAt: action.done ? new Date().toISOString() : null }));

    // ---- Optional health trackers (lib/health.js): never synced, never part of the game ----
    case 'SET_HEALTH':
      return { ...state, health: { ...state.health, ...action.patch } };
    case 'SAVE_MED': {
      const med = { active: true, remind: true, dose: '', ...action.med, times: sortTimes(action.med.times) };
      const id = med.id || uid();
      const meds = state.health.meds.some((m) => m.id === id)
        ? state.health.meds.map((m) => (m.id === id ? { ...med, id } : m))
        : [...state.health.meds, { ...med, id }];
      return { ...state, health: { ...state.health, meds } };
    }
    case 'REMOVE_MED': {
      const doses = {};
      for (const [day, byMed] of Object.entries(state.health.doses)) {
        const { [action.id]: _gone, ...rest } = byMed;
        if (Object.keys(rest).length) doses[day] = rest;
      }
      return { ...state, health: { ...state.health, meds: state.health.meds.filter((m) => m.id !== action.id), doses } };
    }
    case 'BACKFILL_DOSES':
      return { ...state, health: backfillDoses(state.health, action.medId, action.from, action.now) };
    case 'TOGGLE_DOSE':
      return { ...state, health: toggleDose(state.health, action.day, action.medId, action.slot, action.at) };
    case 'SAVE_METRIC': {
      const id = action.metric.id || uid();
      const metric = { ...action.metric, id };
      const metrics = state.health.metrics.some((m) => m.id === id)
        ? state.health.metrics.map((m) => (m.id === id ? metric : m))
        : [...state.health.metrics, metric];
      return { ...state, health: { ...state.health, metrics } };
    }
    case 'REMOVE_METRIC':
      return {
        ...state,
        health: {
          ...state.health,
          metrics: state.health.metrics.filter((m) => m.id !== action.id),
          readings: state.health.readings.filter((r) => r.metricId !== action.id),
        },
      };
    case 'ADD_READING': {
      const reading = { t: new Date().toISOString(), note: '', ...action.reading, id: action.reading.id || uid() };
      const readings = state.health.readings.some((r) => r.id === reading.id)
        ? state.health.readings.map((r) => (r.id === reading.id ? reading : r))
        : [...state.health.readings, reading];
      return { ...state, health: { ...state.health, readings } };
    }
    case 'REMOVE_READING':
      return { ...state, health: { ...state.health, readings: state.health.readings.filter((r) => r.id !== action.id) } };

    // ---- Sync ----
    // `apply` is a pure function (see lib/sync.js applyPull) run against the
    // latest state, so edits made while a sync was in flight are never lost.
    case 'SYNC_APPLY':
      return action.apply(state);

    // ---- Data ----
    case 'IMPORT_STATE':
      return hydrateState(action.state);
    case 'RESET_ALL':
      return { ...DEFAULT_STATE };

    default:
      return state;
  }
}
