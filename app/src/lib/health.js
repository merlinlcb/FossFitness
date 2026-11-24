// Optional health trackers: medications and charts for any measurement the person defines
// (blood pressure, blood sugar, ...). Pure functions, no React or native imports.
//
// Privacy by design: all of this lives in state.health, outside state.days, so it is never part of
// XP, quests, medals, streaks, Compare or chat, and lib/sync.js never uploads it. It stays on the
// phone, plus in the file backup the person exports themselves.
//
// state.health = {
//   enabled: false,
//   meds:     [{ id, name, dose, times: ['08:00', ...] (empty = as needed), remind, active }],
//   doses:    { 'YYYY-MM-DD': { [medId]: { [slot]: isoTime } } }   slot = '08:00', or 'prn-<ms>' for as needed
//   metrics:  [{ id, name, unit, fields: ['Systolic', 'Diastolic'], decimals, low, high }]
//   readings: [{ id, metricId, t: isoTime, values: [number, ...], note }]
// }

import { addDays, atTime, dayKey, parseDayKey, timeToMinutes } from './dates';

export const DEFAULT_HEALTH = { enabled: false, meds: [], doses: {}, metrics: [], readings: [] };

// Starting points for a new chart; everything stays editable.
export const METRIC_PRESETS = [
  { key: 'bp', icon: '🩸', name: 'Blood pressure', unit: 'mmHg', fields: ['Systolic', 'Diastolic'], decimals: 0 },
  { key: 'glucose', icon: '🍬', name: 'Blood sugar', unit: 'mg/dL', fields: ['Blood sugar'], decimals: 0 },
  { key: 'glucoseMmol', icon: '🍬', name: 'Blood sugar', unit: 'mmol/L', fields: ['Blood sugar'], decimals: 1 },
  { key: 'hr', icon: '❤️', name: 'Resting heart rate', unit: 'bpm', fields: ['Heart rate'], decimals: 0 },
  { key: 'spo2', icon: '🫁', name: 'Oxygen saturation', unit: '%', fields: ['SpO₂'], decimals: 0 },
  { key: 'temp', icon: '🌡️', name: 'Temperature', unit: '°F', fields: ['Temperature'], decimals: 1 },
  { key: 'pain', icon: '📝', name: 'Pain level', unit: '/10', fields: ['Pain'], decimals: 0 },
];

export function hydrateHealth(saved) {
  const h = saved && typeof saved === 'object' ? saved : {};
  return {
    enabled: !!h.enabled,
    meds: Array.isArray(h.meds) ? h.meds : [],
    doses: h.doses && typeof h.doses === 'object' ? h.doses : {},
    metrics: Array.isArray(h.metrics) ? h.metrics : [],
    readings: Array.isArray(h.readings) ? h.readings : [],
  };
}

export const isScheduled = (med) => Array.isArray(med.times) && med.times.length > 0;
export const activeMeds = (health) => (health.meds || []).filter((m) => m.active !== false);

export function sortTimes(times) {
  return [...new Set((times || []).filter(Boolean))].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

// Today's (or any day's) doses: one row per scheduled time, plus the as-needed doses taken.
// [{ med, slot, time, takenAt }]
export function dosesForDay(health, day) {
  const taken = (health.doses || {})[day] || {};
  const out = [];
  for (const med of activeMeds(health)) {
    const got = taken[med.id] || {};
    if (isScheduled(med)) {
      for (const time of sortTimes(med.times)) out.push({ med, slot: time, time, takenAt: got[time] || null });
    } else {
      for (const [slot, at] of Object.entries(got)) out.push({ med, slot, time: null, takenAt: at });
    }
  }
  return out;
}

// Scheduled doses on a day: taken / due.
export function adherenceForDay(health, day) {
  const rows = dosesForDay(health, day).filter((r) => r.time);
  return { taken: rows.filter((r) => r.takenAt).length, due: rows.length };
}

// Per medication over the last n days (today included): { [medId]: { taken, due } }.
export function adherence(health, n = 7, now = new Date()) {
  const out = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    for (const r of dosesForDay(health, key)) {
      if (!r.time) continue;
      // Doses later today aren't missed yet.
      if (i === 0 && !r.takenAt && timeToMinutes(r.time) > now.getHours() * 60 + now.getMinutes()) continue;
      const a = (out[r.med.id] = out[r.med.id] || { taken: 0, due: 0 });
      a.due++;
      if (r.takenAt) a.taken++;
    }
  }
  return out;
}

// Mark a dose taken (at `at`) or, if already taken, not taken.
export function toggleDose(health, day, medId, slot, at = new Date().toISOString()) {
  const dayDoses = { ...((health.doses || {})[day] || {}) };
  const med = { ...(dayDoses[medId] || {}) };
  if (med[slot]) delete med[slot];
  else med[slot] = at;
  if (Object.keys(med).length) dayDoses[medId] = med;
  else delete dayDoses[medId];
  const doses = { ...(health.doses || {}) };
  if (Object.keys(dayDoses).length) doses[day] = dayDoses;
  else delete doses[day];
  return { ...health, doses };
}

// Local day keys from `fromDay` to `toDay`, oldest first (at most `max` days).
export function dayRange(fromDay, toDay, max = 366) {
  const out = [];
  let d = parseDayKey(fromDay);
  const end = parseDayKey(toDay);
  while (d <= end && out.length < max) {
    out.push(dayKey(d));
    d = addDays(d, 1);
  }
  return out;
}

// Whether a scheduled dose time has come yet (doses later today can't be marked taken).
export function doseDue(day, time, now = new Date()) {
  return atTime(parseDayKey(day), time) <= now;
}

// "I took it every day since ...": marks every scheduled dose from `fromDay` up to now as taken at
// its scheduled time. Doses already marked keep their time.
export function backfillDoses(health, medId, fromDay, now = new Date()) {
  const med = (health.meds || []).find((m) => m.id === medId);
  if (!med || !isScheduled(med)) return health;
  const doses = { ...(health.doses || {}) };
  for (const day of dayRange(fromDay, dayKey(now))) {
    const byMed = { ...(doses[day] || {}) };
    const got = { ...(byMed[medId] || {}) };
    for (const time of sortTimes(med.times)) {
      if (!got[time] && doseDue(day, time, now)) got[time] = atTime(parseDayKey(day), time).toISOString();
    }
    if (Object.keys(got).length) {
      byMed[medId] = got;
      doses[day] = byMed;
    }
  }
  return { ...health, doses };
}

// ---- charts ----

export function readingsFor(health, metricId) {
  return (health.readings || []).filter((r) => r.metricId === metricId).sort((a, b) => a.t.localeCompare(b.t));
}

export function latestReading(health, metricId) {
  const rs = readingsFor(health, metricId);
  return rs.length ? rs[rs.length - 1] : null;
}

// A reading is valid when every field has a finite number.
export function validValues(metric, values) {
  const n = (metric.fields || []).length || 1;
  if (!Array.isArray(values) || values.length !== n) return false;
  return values.every((v) => typeof v === 'number' && Number.isFinite(v));
}

export function formatValues(metric, values) {
  const d = metric.decimals ?? 1;
  const s = (values || []).map((v) => (v == null ? '–' : Number(v).toFixed(d).replace(/\.0+$/, ''))).join(' / ');
  return metric.unit ? `${s} ${metric.unit}` : s;
}

// Readings since `fromMs`, as chart series: one array of { x, y } per field.
export function chartSeries(health, metric, fromMs = 0) {
  const fields = (metric.fields || []).length || 1;
  const rs = readingsFor(health, metric.id).filter((r) => Date.parse(r.t) >= fromMs);
  return Array.from({ length: fields }, (_, i) =>
    rs.filter((r) => typeof r.values[i] === 'number').map((r) => ({ x: Date.parse(r.t), y: r.values[i] }))
  );
}

// Outside the person's own range, if they set one (judged on the first field, e.g. systolic).
export function outOfRange(metric, values) {
  const lo = typeof metric.low === 'number' ? metric.low : null;
  const hi = typeof metric.high === 'number' ? metric.high : null;
  const v = (values || [])[0];
  if (v == null) return null;
  if (hi != null && v > hi) return 'high';
  if (lo != null && v < lo) return 'low';
  return null;
}
