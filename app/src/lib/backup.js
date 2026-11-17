// Manual, user-initiated backups. Files are written locally and handed to the
// Android share sheet: you choose where they go (Drive, email, Files, etc.).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { dayKey } from './dates';
import { getDay } from './metrics';
import { sumFood, sumWater, sumExerciseMinutes, sumExerciseCalories } from './calc';
import { exerciseName, cardioLog } from './workoutPlan';
import { weightToDisplay, weightUnit } from './units';

function writeAndShare(name, contents, mimeType) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  return Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

export async function exportBackup(state) {
  const payload = { app: 'health-tracker', exportedAt: new Date().toISOString(), state };
  await writeAndShare(`fossfitness-backup-${dayKey()}.json`, JSON.stringify(payload, null, 1), 'application/json');
}

export async function pickBackup() {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets || !res.assets.length) return null;
  const text = await new File(res.assets[0].uri).text();
  const parsed = JSON.parse(text);
  const state = parsed && parsed.state ? parsed.state : parsed;
  if (!state || typeof state !== 'object' || !state.profile) throw new Error('This file is not a FossFitness (or Health Tracker) backup.');
  return state;
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function dailyCsv(state) {
  const keys = new Set([...Object.keys(state.days), ...state.weights.map((w) => w.date)]);
  const weightByDay = Object.fromEntries(state.weights.map((w) => [w.date, w.kg]));
  const rows = [['date', 'water_ml', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'exercise_min', 'exercise_kcal', 'steps', 'sleep_h', 'workout_done', 'weight_kg']];
  for (const k of [...keys].sort()) {
    const d = getDay(state, k);
    const f = sumFood(d.food);
    rows.push([
      k,
      sumWater(d.water),
      Math.round(f.kcal),
      Math.round(f.protein),
      Math.round(f.carbs),
      Math.round(f.fat),
      Math.round(f.fiber),
      sumExerciseMinutes(d.exercise),
      sumExerciseCalories(d.exercise),
      d.steps || 0,
      d.sleepHours ?? '',
      d.workout && d.workout.done ? 1 : 0,
      weightByDay[k] ?? '',
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function foodCsv(state) {
  const rows = [['date', 'time', 'meal', 'food', 'portion', 'kcal', 'protein_g', 'carbs_g', 'fat_g']];
  for (const k of Object.keys(state.days).sort()) {
    for (const f of getDay(state, k).food) {
      rows.push([k, new Date(f.t).toTimeString().slice(0, 5), f.meal, f.name, f.portion || '', f.kcal, f.protein, f.carbs, f.fat]);
    }
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function workoutCsv(state) {
  const units = state.profile.units;
  const rows = [['date', 'exercise', 'set', `weight_${weightUnit(units)}`, 'reps_or_seconds', 'minutes']];
  for (const k of Object.keys(state.days).sort()) {
    const w = state.days[k].workout;
    if (!w) continue;
    for (const [id, sets] of Object.entries(w.sets || {})) {
      const name = exerciseName(id, state.workoutPlan);
      sets.forEach((s, i) => s && s.reps > 0 && rows.push([k, name, i + 1, s.kg != null ? weightToDisplay(s.kg, units) : '', s.reps, '']));
    }
    for (const [id, v] of Object.entries(w.cardio || {})) {
      rows.push([k, exerciseName(id, state.workoutPlan), '', '', '', cardioLog(v).minutes]);
    }
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export async function exportCsv(state, kind = 'daily') {
  const csv = kind === 'food' ? foodCsv(state) : kind === 'workouts' ? workoutCsv(state) : dailyCsv(state);
  await writeAndShare(`fossfitness-${kind}-${dayKey()}.csv`, csv, 'text/csv');
}
