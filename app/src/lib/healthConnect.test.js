import { sessionToActivity, hcPermissions, sleepRange, dayRange, activityForExerciseType, DEFAULT_HC } from './healthConnectMap';
import { reducer } from '../state/reducer';
import { DEFAULT_STATE, hydrateState } from '../state/defaults';

const DAY = '2026-11-16';

describe('Health Connect import', () => {
  test('permissions follow the chosen data', () => {
    expect(hcPermissions(DEFAULT_HC).map((p) => p.recordType)).toEqual(['Steps', 'SleepSession', 'Weight', 'ExerciseSession', 'ActiveCaloriesBurned']);
    expect(hcPermissions({ ...DEFAULT_HC, sleep: false, workouts: false }).map((p) => p.recordType)).toEqual(['Steps', 'Weight']);
    expect(hcPermissions(DEFAULT_HC).every((p) => p.accessType === 'read')).toBe(true);
  });

  test('time ranges: whole local day; sleep = 6 PM before to 6 PM', () => {
    const d = dayRange(DAY);
    expect(new Date(d.endTime) - new Date(d.startTime)).toBe(24 * 3600000);
    const s = sleepRange(DAY);
    expect(new Date(s.startTime).getHours()).toBe(18);
    expect(new Date(s.startTime).getDate()).toBe(15);
    expect(new Date(s.endTime).getDate()).toBe(16);
  });

  test('a watch workout becomes an activity with its calories (or an estimate)', () => {
    const rec = { startTime: new Date(2026, 10, 16, 7, 0).toISOString(), endTime: new Date(2026, 10, 16, 7, 45).toISOString(), exerciseType: 74, metadata: { id: 'abc' } };
    const a = sessionToActivity(rec, 412.4, 90);
    expect(a).toMatchObject({ id: 'hc-abc', day: DAY, type: 'swim', minutes: 45, kcal: 412, fromHC: true });
    expect(sessionToActivity(rec, 0, 90).kcal).toBeGreaterThan(0);
    expect(activityForExerciseType(9999)).toBe('other');
  });

  test('merge: steps and sleep replace, workouts update in place, own weigh-ins win', () => {
    let s = hydrateState({ ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, onboarded: true } });
    s = reducer(s, { type: 'SET_STEPS', day: DAY, steps: 3000 });
    s = reducer(s, { type: 'ADD_EXERCISE', day: DAY, entry: { type: 'walk', minutes: 20, intensity: 'light', kcal: 60 } });
    s = reducer(s, { type: 'ADD_WEIGHT', kg: 90, date: '2026-11-15' });
    const swim = { id: 'hc-abc', day: DAY, t: 'x', type: 'swim', name: 'Swim', minutes: 45, intensity: 'moderate', kcal: 400, fromHC: true };
    const payload = {
      days: { [DAY]: { steps: 8421, sleepHours: 7.25, workouts: [swim] }, '2026-11-14': { steps: 0 } },
      weights: [
        { date: '2026-11-15', kg: 95, t: '2026-11-15T07:00:00Z', id: 'w1' }, // you already weighed in that day
        { date: DAY, kg: 89.4, t: '2026-11-16T07:00:00Z', id: 'w2' },
        { date: DAY, kg: 89.1, t: '2026-11-16T08:00:00Z', id: 'w3' }, // latest of the day wins
      ],
    };
    s = reducer(s, { type: 'HC_IMPORT', payload });
    expect(s.days[DAY].steps).toBe(8421);
    expect(s.days[DAY].sleepHours).toBe(7.25);
    expect(s.days[DAY].exercise.map((e) => e.type)).toEqual(['walk', 'swim']);
    expect(s.days['2026-11-14']).toBeUndefined(); // nothing to add, no empty day made
    expect(s.weights.map((w) => [w.date, w.kg])).toEqual([['2026-11-15', 90], [DAY, 89.1]]);
    expect(s.profile.weightKg).toBe(89.1);
    // Same import again changes nothing; the swim isn't doubled.
    const again = reducer(s, { type: 'HC_IMPORT', payload });
    expect(again.days[DAY].exercise).toHaveLength(2);
    expect(again.weights).toHaveLength(2);
    // Deleted in Health Connect → gone here; your own walk stays.
    s = reducer(s, { type: 'HC_IMPORT', payload: { days: { [DAY]: { workouts: [] } }, weights: [] } });
    expect(s.days[DAY].exercise.map((e) => e.type)).toEqual(['walk']);
  });

  test('settings survive a reload and are off until you connect', () => {
    expect(hydrateState(null).healthConnect.enabled).toBe(false);
    const s = reducer(hydrateState(null), { type: 'SET_HEALTH_CONNECT', patch: { enabled: true, sleep: false } });
    expect(hydrateState(JSON.parse(JSON.stringify(s))).healthConnect).toMatchObject({ enabled: true, sleep: false, steps: true });
  });
});
