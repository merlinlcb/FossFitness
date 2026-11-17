// Activity types with MET values (Compendium of Physical Activities, moderate effort).
// `strength` marks muscle-strengthening activities (WHO recommends 2+ days/week).

export const ACTIVITIES = [
  { key: 'walk', label: 'Walking', icon: '🚶', met: 3.5 },
  { key: 'brisk_walk', label: 'Brisk walk', icon: '🚶‍♂️', met: 4.3 },
  { key: 'run', label: 'Running', icon: '🏃', met: 9.8 },
  { key: 'jog', label: 'Jogging', icon: '🏃‍♀️', met: 7.0 },
  { key: 'cycle', label: 'Cycling', icon: '🚴', met: 7.5 },
  { key: 'strength', label: 'Strength training', icon: '🏋️', met: 5.0, strength: true },
  { key: 'hiit', label: 'HIIT / circuit', icon: '🔥', met: 8.0, strength: true },
  { key: 'swim', label: 'Swimming', icon: '🏊', met: 6.0 },
  { key: 'hike', label: 'Hiking', icon: '🥾', met: 6.0 },
  { key: 'elliptical', label: 'Elliptical', icon: '⚙️', met: 5.0 },
  { key: 'row', label: 'Rowing', icon: '🚣', met: 7.0 },
  { key: 'yoga', label: 'Yoga / Pilates', icon: '🧘', met: 3.0, strength: true },
  { key: 'dance', label: 'Dancing', icon: '💃', met: 5.0 },
  { key: 'sports', label: 'Sports', icon: '⚽', met: 7.0 },
  { key: 'stairs', label: 'Stair climbing', icon: '🪜', met: 8.0 },
  { key: 'chores', label: 'Yard / housework', icon: '🧹', met: 3.5 },
  { key: 'stretch', label: 'Stretching', icon: '🤸', met: 2.3 },
  { key: 'other', label: 'Other', icon: '✨', met: 4.0 },
];

export const INTENSITIES = [
  { key: 'light', label: 'Light', factor: 0.75 },
  { key: 'moderate', label: 'Moderate', factor: 1 },
  { key: 'vigorous', label: 'Vigorous', factor: 1.3 },
];

export function activityByKey(key) {
  return ACTIVITIES.find((a) => a.key === key) || ACTIVITIES[ACTIVITIES.length - 1];
}

export function effectiveMet(activityKey, intensityKey = 'moderate') {
  const a = activityByKey(activityKey);
  const i = INTENSITIES.find((x) => x.key === intensityKey) || INTENSITIES[1];
  return a.met * i.factor;
}

// WHO "moderate-equivalent" minutes: vigorous counts double, light counts half.
export function activeMinutes(entries = []) {
  return entries.reduce((sum, e) => {
    const met = effectiveMet(e.type, e.intensity);
    const mult = met >= 6 ? 2 : met >= 3 ? 1 : 0.5;
    return sum + (e.minutes || 0) * mult;
  }, 0);
}

export const WEEKLY_ACTIVE_GOAL = 150;
export const WEEKLY_STRENGTH_DAYS_GOAL = 2;

// Rough step → calorie estimate: ~0.04 kcal per step per 70 kg.
export function stepsCalories(steps, weightKg) {
  if (!steps) return 0;
  return Math.round(steps * 0.04 * ((weightKg || 70) / 70));
}
