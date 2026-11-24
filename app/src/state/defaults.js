import { DEFAULT_HC } from '../lib/healthConnectMap';
import { DEFAULT_HEALTH, hydrateHealth } from '../lib/health';

export const STORAGE_KEY = 'healthtracker:v2';
export const STATE_VERSION = 2;

export const DEFAULT_WATER_PRESETS = [
  { id: 'p-glass', label: 'Glass', ml: 240, icon: '🥛' },
  { id: 'p-mug', label: 'Mug', ml: 350, icon: '☕' },
  { id: 'p-bottle', label: 'Bottle', ml: 500, icon: '🧴' },
  { id: 'p-big', label: 'Big bottle', ml: 950, icon: '🍶' },
];

export const DEFAULT_STATE = {
  version: STATE_VERSION,
  profile: {
    name: '',
    sex: 'male',
    age: 30,
    heightCm: 175,
    weightKg: 80,
    goalWeightKg: null,
    activityLevel: 'light',
    goal: 'lose',
    paceKgPerWeek: 0.5,
    units: 'imperial',
    waterUnit: 'oz',
    climate: 'normal',
    pregnancy: 'none',
    wakeTime: '07:00',
    sleepTime: '23:00',
    eatBackExercise: false,
    // Daily protein goal range (g). When set, overrides the formula-based protein target.
    proteinGoal: 160,
    proteinGoalMax: 200,
    // Turn water tracking off to hide it everywhere (rings, quests, reminders, insights).
    waterTracking: true,
    // Appearance: mode 'dark' | 'light' | 'system' | 'schedule' (dark between darkFrom and darkUntil).
    appearance: { mode: 'dark', darkFrom: '20:00', darkUntil: '07:00' },
    // Own daily calorie target; null = use the suggested one.
    calorieGoal: null,
    // Page the app opens on (Settings → App settings), and the Today forecast length in weeks.
    startPage: 'today',
    forecastWeeks: 4,
    onboarded: false,
  },
  // dayKey -> { water: [], food: [], exercise: [], steps: 0, sleepHours, workout }
  // workout: { choice, done, doneAt, sets: { exerciseId: [{ kg, reps }] }, cardio: { exerciseId: minutes }, activityIds: [] }
  days: {},
  // [{ id, date: dayKey, t: iso, kg }]
  weights: [],
  fasting: {
    enabled: true,
    protocol: '16:8',
    customHours: 16,
    windowStart: '12:00',
    active: null, // { start: iso, targetHours }
    history: [], // { id, start, end, targetHours }
  },
  customFoods: [],
  health: DEFAULT_HEALTH, // optional medication + measurement trackers (lib/health.js); never synced
  meals: [], // saved meals: [{ id, name, meal, items }] (lib/meals.js)
  // Reading steps, sleep, weight and workouts from Android Health Connect (this phone only).
  healthConnect: { ...DEFAULT_HC },
  recentFoods: [], // [{ foodId, servingLabel, qty, meal }]
  favorites: [],
  waterPresets: DEFAULT_WATER_PRESETS,
  workoutPlan: {
    stepPlan: { baseline: null, startDate: null }, // steps goal = baseline + 500/day per week
    sleepGoal: 7,
    mode: 'suggested', // 'suggested' = the app's weekly plan, 'custom' = "My own" (log what you did)
    suggested: 'home', // which suggested plan: 'home' (no equipment) or 'gym'
    week: {}, // custom plan: { 0..6 (Sunday = 0): [exerciseId, ...] }
    customExercises: [], // user-made exercises (see makeCustomExercise)
  },
  reminders: {
    workout: { enabled: true, time: '08:00', nudge: true, nudgeTime: '18:00' },
    water: { enabled: true, intervalMin: 90 },
    meals: { enabled: true, breakfast: '08:00', lunch: '12:30', dinner: '18:30' },
    fasting: { enabled: true },
    weighIn: { enabled: true, time: '07:30', frequency: 'daily', day: 1 }, // day: weekday for weekly weigh-ins (0 = Sunday)
    exercise: { enabled: false, time: '17:30' },
    summary: { enabled: true, time: '20:30' },
    // Nags that don't need a schedule: keep the streak alive, and check in when food hasn't been logged for a while.
    streak: { enabled: true, time: '19:30' },
    foodGap: { enabled: false, hours: 4 },
    // Chat messages from the group as notifications (only while signed in).
    chat: { enabled: true },
  },
};

export const EMPTY_DAY = { water: [], food: [], exercise: [], steps: 0 };

const withoutKeys = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !keys.includes(k)));

// Deep-merge saved state over defaults so new fields added in updates get sane values.
export function hydrateState(saved) {
  if (!saved || typeof saved !== 'object') return DEFAULT_STATE;
  const d = DEFAULT_STATE;
  return {
    ...d,
    ...saved,
    version: STATE_VERSION,
    profile: { ...d.profile, ...(saved.profile || {}) },
    fasting: { ...d.fasting, ...(saved.fasting || {}) },
    workoutPlan: {
      ...d.workoutPlan,
      ...withoutKeys(saved.workoutPlan, ['ptCleared']),
      // Older versions called the suggested plan 'spine'.
      mode: (saved.workoutPlan || {}).mode === 'custom' ? 'custom' : 'suggested',
      stepPlan: { ...d.workoutPlan.stepPlan, ...((saved.workoutPlan || {}).stepPlan || {}) },
    },
    reminders: Object.fromEntries(
      Object.keys(d.reminders).map((k) => [k, { ...d.reminders[k], ...((saved.reminders || {})[k] || {}) }])
    ),
    days: saved.days || {},
    weights: Array.isArray(saved.weights) ? saved.weights : [],
    customFoods: Array.isArray(saved.customFoods) ? saved.customFoods : [],
    meals: Array.isArray(saved.meals) ? saved.meals : [],
    health: hydrateHealth(saved.health),
    recentFoods: Array.isArray(saved.recentFoods) ? saved.recentFoods : [],
    favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
    waterPresets: Array.isArray(saved.waterPresets) && saved.waterPresets.length ? saved.waterPresets : d.waterPresets,
    healthConnect: { ...d.healthConnect, ...(saved.healthConnect || {}) },
  };
}
