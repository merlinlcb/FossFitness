// Reading steps, sleep, weight and workouts from Android Health Connect.
// Read-only: the app never writes to Health Connect. The native module is loaded
// lazily so the rest of the app (and the tests) work without it.
import { HC_TYPES, hcPermissions, dayRange, sleepRange, lastDays, sessionToActivity } from './healthConnectMap';
import { dayKey } from './dates';

let mod = null;
function hc() {
  if (!mod) mod = require('react-native-health-connect');
  return mod;
}

// 'available' | 'not_installed' | 'update_required' | 'unsupported'
export async function hcStatus() {
  try {
    const m = hc();
    const s = await m.getSdkStatus();
    if (s === m.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (s === m.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
    return 'not_installed';
  } catch {
    return 'unsupported';
  }
}

async function ready() {
  const ok = await hc().initialize();
  if (!ok) throw new Error('Health Connect could not be started.');
}

// Ask for read access to the chosen data. Returns the data types that were granted.
export async function hcConnect(settings) {
  await ready();
  const granted = await hc().requestPermission(hcPermissions(settings));
  return grantedTypes(granted);
}

export async function hcGranted() {
  await ready();
  return grantedTypes(await hc().getGrantedPermissions());
}

function grantedTypes(perms) {
  const have = new Set((perms || []).filter((p) => p.accessType === 'read').map((p) => p.recordType));
  return HC_TYPES.filter((ty) => ty.records.every((r) => have.has(r))).map((ty) => ty.key);
}

export function hcOpenSettings() {
  try {
    hc().openHealthConnectSettings();
  } catch {
    // not available on this phone
  }
}

// Read the last `days` days of the chosen (and granted) data → payload for mergeHealthConnect.
export async function hcRead(settings, weightKg, days = 7, now = new Date()) {
  await ready();
  const m = hc();
  const granted = new Set(await hcGranted());
  const want = (k) => settings[k] && granted.has(k);
  const keys = lastDays(days, now);
  const out = { days: {}, weights: [] };
  const day = (k) => (out.days[k] = out.days[k] || {});

  if (want('steps')) {
    for (const k of keys) {
      const r = await m.aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', ...dayRange(k) } });
      if (r && r.COUNT_TOTAL > 0) day(k).steps = Math.round(r.COUNT_TOTAL);
    }
  }
  if (want('sleep')) {
    for (const k of keys) {
      const r = await m.aggregateRecord({ recordType: 'SleepSession', timeRangeFilter: { operator: 'between', ...sleepRange(k) } });
      const secs = r && r.SLEEP_DURATION_TOTAL;
      if (secs > 0) day(k).sleepHours = Math.round((secs / 3600) * 4) / 4; // nearest quarter hour
    }
  }
  const range = { operator: 'between', startTime: dayRange(keys[keys.length - 1]).startTime, endTime: dayRange(keys[0]).endTime };
  if (want('weight')) {
    const r = await m.readRecords('Weight', { timeRangeFilter: range });
    for (const w of (r && r.records) || []) {
      const kg = w.weight && w.weight.inKilograms;
      if (kg > 0) out.weights.push({ date: dayKey(new Date(w.time)), t: new Date(w.time).toISOString(), kg, id: w.metadata && w.metadata.id });
    }
  }
  if (want('workouts')) {
    for (const k of keys) day(k).workouts = []; // so sessions deleted in Health Connect go away here too
    const r = await m.readRecords('ExerciseSession', { timeRangeFilter: range });
    for (const rec of (r && r.records) || []) {
      let kcal = 0;
      try {
        const a = await m.aggregateRecord({
          recordType: 'ActiveCaloriesBurned',
          timeRangeFilter: { operator: 'between', startTime: rec.startTime, endTime: rec.endTime },
        });
        kcal = (a && a.ACTIVE_CALORIES_TOTAL && a.ACTIVE_CALORIES_TOTAL.inKilocalories) || 0;
      } catch {
        // estimated from the activity type instead
      }
      const act = sessionToActivity(rec, kcal, weightKg);
      if (out.days[act.day]) out.days[act.day].workouts.push(act);
    }
  }
  return out;
}
