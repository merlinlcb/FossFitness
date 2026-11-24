import { reducer } from '../state/reducer';
import { DEFAULT_STATE, hydrateState } from '../state/defaults';
import { adherence, adherenceForDay, chartSeries, dosesForDay, formatValues, outOfRange, validValues } from './health';
import { buildPush, documentsOf, settingsOf } from './sync';
import { computeGame } from './game';
import { buildSchedule } from './schedule';

const run = (actions, s = { ...DEFAULT_STATE }) => actions.reduce(reducer, s);

function setup() {
  let s = run([
    { type: 'SET_PROFILE', patch: { onboarded: true } },
    { type: 'SET_HEALTH', patch: { enabled: true } },
    { type: 'SAVE_MED', med: { id: 'met', name: 'Metformin', dose: '500 mg', times: ['20:00', '08:00', '08:00'] } },
    { type: 'SAVE_MED', med: { id: 'ibu', name: 'Ibuprofen', times: [] } },
    { type: 'SAVE_METRIC', metric: { id: 'bp', name: 'Blood pressure', unit: 'mmHg', fields: ['Systolic', 'Diastolic'], decimals: 0, high: 130 } },
  ]);
  return s;
}

test('medications: scheduled times are sorted and de-duplicated, doses toggle', () => {
  let s = setup();
  expect(s.health.meds[0].times).toEqual(['08:00', '20:00']);
  s = reducer(s, { type: 'TOGGLE_DOSE', day: '2026-11-20', medId: 'met', slot: '08:00', at: '2026-11-20T08:05:00.000Z' });
  s = reducer(s, { type: 'TOGGLE_DOSE', day: '2026-11-20', medId: 'ibu', slot: 'prn-1', at: '2026-11-20T13:00:00.000Z' });
  const rows = dosesForDay(s.health, '2026-11-20');
  expect(rows.map((r) => [r.med.id, r.slot, !!r.takenAt])).toEqual([
    ['met', '08:00', true],
    ['met', '20:00', false],
    ['ibu', 'prn-1', true],
  ]);
  expect(adherenceForDay(s.health, '2026-11-20')).toEqual({ taken: 1, due: 2 });
  // Toggling again un-marks it and leaves no empty records behind.
  s = reducer(s, { type: 'TOGGLE_DOSE', day: '2026-11-20', medId: 'met', slot: '08:00' });
  s = reducer(s, { type: 'TOGGLE_DOSE', day: '2026-11-20', medId: 'ibu', slot: 'prn-1' });
  expect(s.health.doses).toEqual({});
});

test('adherence does not count doses later today as missed', () => {
  let s = setup();
  s = reducer(s, { type: 'TOGGLE_DOSE', day: '2026-11-20', medId: 'met', slot: '08:00' });
  const a = adherence(s.health, 1, new Date(2026, 10, 20, 12, 0));
  expect(a.met).toEqual({ taken: 1, due: 1 });
});

test('deleting a medication deletes its dose history; paused ones hide', () => {
  let s = setup();
  s = reducer(s, { type: 'TOGGLE_DOSE', day: '2026-11-20', medId: 'met', slot: '08:00' });
  s = reducer(s, { type: 'TOGGLE_DOSE', day: '2026-11-20', medId: 'ibu', slot: 'prn-1' });
  s = reducer(s, { type: 'REMOVE_MED', id: 'met' });
  expect(Object.keys(s.health.doses['2026-11-20'])).toEqual(['ibu']);
  s = reducer(s, { type: 'SAVE_MED', med: { ...s.health.meds[0], active: false } });
  expect(dosesForDay(s.health, '2026-11-20')).toEqual([]);
});

test('readings: validation, formatting, ranges and chart series', () => {
  let s = setup();
  const bp = s.health.metrics[0];
  expect(validValues(bp, [120, 80])).toBe(true);
  expect(validValues(bp, [120, null])).toBe(false);
  expect(validValues(bp, [120])).toBe(false);
  s = reducer(s, { type: 'ADD_READING', reading: { id: 'r1', metricId: 'bp', t: '2026-11-19T08:00:00.000Z', values: [128, 84] } });
  s = reducer(s, { type: 'ADD_READING', reading: { id: 'r2', metricId: 'bp', t: '2026-11-18T08:00:00.000Z', values: [142, 91] } });
  expect(formatValues(bp, [128, 84])).toBe('128 / 84 mmHg');
  expect(outOfRange(bp, [142, 91])).toBe('high');
  expect(outOfRange(bp, [128, 84])).toBe(null);
  const series = chartSeries(s.health, bp);
  expect(series.map((x) => x.map((p) => p.y))).toEqual([
    [142, 128],
    [91, 84],
  ]);
  // Editing keeps one reading; deleting the chart deletes its readings.
  s = reducer(s, { type: 'ADD_READING', reading: { id: 'r1', metricId: 'bp', t: '2026-11-19T08:00:00.000Z', values: [126, 82] } });
  expect(s.health.readings).toHaveLength(2);
  s = reducer(s, { type: 'REMOVE_METRIC', id: 'bp' });
  expect(s.health.readings).toEqual([]);
});

test('health data never reaches the sync server or the game', () => {
  let s = setup();
  s = reducer(s, { type: 'TOGGLE_DOSE', day: '2026-11-20', medId: 'met', slot: '08:00' });
  s = reducer(s, { type: 'ADD_READING', reading: { metricId: 'bp', values: [150, 95] } });
  const withHealth = JSON.stringify([settingsOf(s), documentsOf(s), buildPush(s, { rev: 0, synced: {} })]);
  expect(withHealth).not.toMatch(/Metformin|Blood pressure|Systolic|"health"/);
  // Same game with or without health data.
  const without = { ...s, health: { ...s.health, meds: [], doses: {}, metrics: [], readings: [] } };
  expect(JSON.stringify(computeGame(s, '2026-11-20', Date.parse('2026-11-20T12:00:00')))).toBe(
    JSON.stringify(computeGame(without, '2026-11-20', Date.parse('2026-11-20T12:00:00')))
  );
});

test('older saved state gets empty, switched-off trackers; saved trackers survive a reload', () => {
  expect(hydrateState({ profile: {} }).health).toEqual({ enabled: false, meds: [], doses: {}, metrics: [], readings: [] });
  const s = setup();
  expect(hydrateState(JSON.parse(JSON.stringify(s))).health).toEqual(s.health);
});

test('medication reminders: one per scheduled dose not yet taken, only when switched on', () => {
  let s = setup();
  const now = new Date(2026, 10, 20, 6, 0);
  const meds = (st) => buildSchedule(st, now, 1).filter((p) => p.kind === 'med');
  expect(meds(s).map((p) => p.body)).toEqual(['Time for Metformin (500 mg).', 'Time for Metformin (500 mg).']);
  s = reducer(s, { type: 'TOGGLE_DOSE', day: '2026-11-20', medId: 'met', slot: '08:00' });
  expect(meds(s)).toHaveLength(1);
  s = reducer(s, { type: 'SAVE_MED', med: { ...s.health.meds[0], remind: false } });
  expect(meds(s)).toHaveLength(0);
  s = reducer(setup(), { type: 'SET_HEALTH', patch: { enabled: false } });
  expect(meds(s)).toHaveLength(0);
});
