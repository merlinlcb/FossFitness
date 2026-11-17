import { documentsOf, buildPush, applyPull, emptyMeta, fingerprint, pendingCount, settingsOf } from './sync';
import { reducer } from '../state/reducer';
import { DEFAULT_STATE } from '../state/defaults';

const base = () => ({ ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, onboarded: true } });
const run = (s, ...actions) => actions.reduce(reducer, s);

// A tiny in-memory copy of the server's sync rules (newest updatedAt wins).
function fakeServer() {
  const rows = new Map();
  let rev = 0;
  let profile = null;
  return {
    sync(body) {
      const pulled = [...rows.values()].filter((r) => r.rev > (body.since || 0)).map(({ rev: _r, ...e }) => e);
      if (body.push.length) {
        rev++;
        for (const e of body.push) {
          const cur = rows.get(e.id);
          if (!cur || e.updatedAt > cur.updatedAt) rows.set(e.id, { ...e, rev });
        }
      }
      let out = null;
      if (body.profile) {
        if (!profile || body.profile.updatedAt > profile.updatedAt) profile = body.profile;
        else if (body.profile.updatedAt < profile.updatedAt) out = profile;
      }
      return { rev, entries: pulled, profile: out };
    },
    rows,
  };
}

let clock = 1000;
function syncOnce(server, state, meta) {
  const plan = buildPush(state, meta, ++clock);
  const res = server.sync({ since: meta.rev, push: plan.push, profile: plan.settings });
  return applyPull(state, meta, plan, res);
}

test('documents cover days, weigh-ins and finished fasts, not empty days', () => {
  const s = run(base(), { type: 'ADD_WATER', ml: 250, day: '2026-11-13' }, { type: 'ADD_WEIGHT', kg: 90, date: '2026-11-13' },
    { type: 'START_FAST', targetHours: 16, start: '2026-11-12T20:00:00.000Z' }, { type: 'END_FAST', end: '2026-11-13T13:00:00.000Z' });
  s.days['2026-11-01'] = { water: [], food: [], exercise: [], steps: 0 };
  const ids = Object.keys(documentsOf(s)).map((id) => id.split('-')[0]).sort();
  expect(ids).toEqual(['day', 'fast', 'wt']);
  expect(settingsOf(s).fasting.history).toBeUndefined();
});

test('first sync uploads everything; a second sync uploads nothing', () => {
  const server = fakeServer();
  let s = run(base(), { type: 'ADD_WATER', ml: 250 }, { type: 'ADD_WEIGHT', kg: 90 });
  let meta = emptyMeta();
  expect(pendingCount(s, meta)).toBe(3);
  ({ state: s, meta } = syncOnce(server, s, meta));
  expect(server.rows.size).toBe(2);
  expect(pendingCount(s, meta)).toBe(0);
  expect(buildPush(s, meta).push).toEqual([]);
});

test('a second phone restores everything, including settings', () => {
  const server = fakeServer();
  let a = run(base(), { type: 'ADD_WATER', ml: 250, day: '2026-11-10' }, { type: 'ADD_WEIGHT', kg: 90, date: '2026-11-10' },
    { type: 'SET_PROFILE', patch: { name: 'Alex', proteinGoal: 170 } },
    { type: 'START_FAST', targetHours: 16, start: '2026-11-10T01:00:00.000Z' }, { type: 'END_FAST', end: '2026-11-10T18:00:00.000Z' },
    { type: 'START_FAST', targetHours: 18, start: '2026-11-13T01:00:00.000Z' });
  let ma = emptyMeta();
  ({ state: a, meta: ma } = syncOnce(server, a, ma));

  let b = base(); // fresh install, nothing logged, older settings
  let mb = emptyMeta();
  mb.settingsAt = 1; // its defaults are older than the server's copy
  mb.settingsHash = fingerprint(settingsOf(b));
  ({ state: b, meta: mb } = syncOnce(server, b, mb));
  expect(b.days).toEqual(a.days);
  expect(b.weights).toEqual(a.weights);
  expect(b.fasting.history).toEqual(a.fasting.history);
  expect(b.fasting.active).toEqual(a.fasting.active);
  expect(b.profile.name).toBe('Alex');
  expect(b.profile.proteinGoal).toBe(170);
  expect(pendingCount(b, mb)).toBe(0);
});

test('deletions travel both ways', () => {
  const server = fakeServer();
  let a = run(base(), { type: 'ADD_WEIGHT', kg: 90, date: '2026-11-10' }, { type: 'ADD_WEIGHT', kg: 89, date: '2026-11-11' });
  let ma = emptyMeta();
  ({ state: a, meta: ma } = syncOnce(server, a, ma));
  let b = base();
  let mb = emptyMeta();
  ({ state: b, meta: mb } = syncOnce(server, b, mb));
  expect(b.weights).toHaveLength(2);

  a = run(a, { type: 'REMOVE_WEIGHT', id: a.weights[0].id });
  ({ state: a, meta: ma } = syncOnce(server, a, ma));
  ({ state: b, meta: mb } = syncOnce(server, b, mb));
  expect(b.weights.map((w) => w.kg)).toEqual([89]);
  expect(pendingCount(b, mb)).toBe(0);
});

test('an edit made on this phone is not overwritten by an older server copy', () => {
  const server = fakeServer();
  let a = run(base(), { type: 'ADD_WATER', ml: 250, day: '2026-11-13' });
  let ma = emptyMeta();
  ({ state: a, meta: ma } = syncOnce(server, a, ma));
  let b = base();
  let mb = emptyMeta();
  ({ state: b, meta: mb } = syncOnce(server, b, mb));

  // Phone A adds more water and syncs; phone B, offline, adds a meal the same day.
  a = run(a, { type: 'ADD_WATER', ml: 500, day: '2026-11-13' });
  ({ state: a, meta: ma } = syncOnce(server, a, ma));
  b = run(b, { type: 'ADD_FOOD', day: '2026-11-13', entry: { name: 'Eggs', kcal: 300 } });
  // B's pull sees A's version but B just uploaded its own newer copy: B's day stays.
  ({ state: b, meta: mb } = syncOnce(server, b, mb));
  expect(b.days['2026-11-13'].food).toHaveLength(1);
  // The server now holds B's copy (newest edit wins), and A picks it up.
  ({ state: a, meta: ma } = syncOnce(server, a, ma));
  expect(a.days['2026-11-13']).toEqual(b.days['2026-11-13']);
});

test('state edited while a sync was in flight is kept and uploaded next time', () => {
  const server = fakeServer();
  let s = run(base(), { type: 'ADD_WATER', ml: 250, day: '2026-11-13' });
  let meta = emptyMeta();
  const plan = buildPush(s, meta, ++clock);
  const res = server.sync({ since: 0, push: plan.push, profile: plan.settings });
  s = run(s, { type: 'ADD_WATER', ml: 100, day: '2026-11-13' }); // edited meanwhile
  ({ state: s, meta } = applyPull(s, meta, plan, res));
  expect(s.days['2026-11-13'].water).toHaveLength(2);
  expect(pendingCount(s, meta)).toBe(1);
});

test('fingerprint changes with content', () => {
  expect(fingerprint({ a: 1 })).toBe(fingerprint({ a: 1 }));
  expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
});
