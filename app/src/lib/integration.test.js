// Runs the app's sync code against a real HealthHub server. Skipped unless
//   HT_TEST_SERVER=http://127.0.0.1:8787 HT_TEST_INVITE=<code> npx jest integration
import { api } from './api';
import { buildPush, applyPull, emptyMeta, pendingCount, metaForNewAccount } from './sync';
import { computeGame, publicStats } from './game';
import { reducer } from '../state/reducer';
import { DEFAULT_STATE } from '../state/defaults';

const SERVER = process.env.HT_TEST_SERVER;
const INVITE = process.env.HT_TEST_INVITE;
const maybe = SERVER ? test : test.skip;

async function sync(token, state, meta) {
  const plan = buildPush(state, meta);
  const res = await api(SERVER, '/api/sync', {
    method: 'POST', token,
    body: { since: meta.rev, push: plan.push, profile: plan.settings, stats: publicStats(computeGame(state), state.fasting.active) },
  });
  return applyPull(state, meta, plan, res);
}

maybe('two phones stay in step through the real server', async () => {
  const name = `it${Date.now().toString(36)}`;
  let a = [
    { type: 'SET_PROFILE', patch: { onboarded: true, name: 'Tester', weightKg: 95, heightCm: 180, age: 34 } },
    { type: 'ADD_WATER', ml: 500 },
    { type: 'ADD_FOOD', entry: { name: 'Eggs 🍳', kcal: 310, protein: 24, meal: 'breakfast' } },
    { type: 'ADD_WEIGHT', kg: 95.2 },
    { type: 'START_FAST', targetHours: 16, start: new Date(Date.now() - 17 * 3600000).toISOString() },
    { type: 'END_FAST' },
  ].reduce(reducer, DEFAULT_STATE);
  const reg = await api(SERVER, '/api/register', { method: 'POST', body: { invite: INVITE, username: name, displayName: 'Tester', password: 'password1' } });
  let ma = metaForNewAccount(a, 'x|1');
  ({ state: a, meta: ma } = await sync(reg.token, a, ma));
  expect(pendingCount(a, ma)).toBe(0);

  const login = await api(SERVER, '/api/login', { method: 'POST', body: { username: name, password: 'password1' } });
  let b = DEFAULT_STATE;
  let mb = metaForNewAccount(b, 'x|1');
  ({ state: b, meta: mb } = await sync(login.token, b, mb));
  expect(b.days).toEqual(a.days);
  expect(b.weights).toEqual(a.weights);
  expect(b.fasting.history).toEqual(a.fasting.history);
  expect(b.profile.name).toBe('Tester');

  // Delete the weigh-in on B; A follows.
  b = reducer(b, { type: 'REMOVE_WEIGHT', id: b.weights[0].id });
  ({ state: b, meta: mb } = await sync(login.token, b, mb));
  ({ state: a, meta: ma } = await sync(reg.token, a, ma));
  expect(a.weights).toEqual([]);
  // The leaderboard summary lags one sync behind pulled changes; the app syncs again within a minute.
  ({ state: a, meta: ma } = await sync(reg.token, a, ma));

  const people = (await api(SERVER, '/api/friends', { token: reg.token })).people;
  expect(people.find((p) => p.isMe).stats.xp).toBe(computeGame(a).xp);
  const dash = await api(SERVER, `/api/dashboard/data?user=${reg.user.id}`, { token: reg.token });
  expect(dash.entries.map((e) => e.kind).sort()).toEqual(['day', 'fast']);
  expect(dash.profile.profile.name).toBe('Tester');
});
