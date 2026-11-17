// Sync between the app state and the HealthHub server. Pure JavaScript.
//
// The state is cut into documents the server stores and versions:
//   day-YYYY-MM-DD  one per logged day (water, food, exercise, steps, sleep, workout)
//   wt-<id>         one per weigh-in
//   fast-<id>       one per finished fast
// Everything else (profile, plan, custom foods, reminders, the running fast…)
// travels as one "settings" document in the server's profile slot.
//
// The phone remembers a fingerprint of every document as last synced. Anything
// whose fingerprint changed is uploaded; anything that disappeared is uploaded
// as deleted. The newest edit of a document wins.

import { dayKey } from './dates';

const SETTINGS_KEYS = ['profile', 'fasting', 'workoutPlan', 'customFoods', 'meals', 'recentFoods', 'favorites', 'waterPresets', 'reminders'];

// Small, stable string hash (FNV-1a 32-bit) — only used to notice changes.
export function fingerprint(value) {
  const s = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(36)}.${s.length.toString(36)}`;
}

const EMPTY = (d) => !d || ((!d.water || !d.water.length) && (!d.food || !d.food.length) && (!d.exercise || !d.exercise.length) && !d.steps && d.sleepHours == null && !d.workout);

export function settingsOf(state) {
  const out = {};
  for (const k of SETTINGS_KEYS) out[k] = state[k];
  // Fasting history travels as its own documents.
  out.fasting = { ...state.fasting, history: undefined };
  delete out.fasting.history;
  return out;
}

export function documentsOf(state) {
  const docs = {};
  for (const [k, d] of Object.entries(state.days || {})) {
    if (EMPTY(d)) continue;
    docs[`day-${k}`] = { id: `day-${k}`, kind: 'day', day: k, ts: new Date(`${k}T12:00:00`).getTime(), data: d };
  }
  for (const w of state.weights || []) {
    docs[`wt-${w.id}`] = { id: `wt-${w.id}`, kind: 'weight', day: w.date, ts: new Date(w.t || `${w.date}T12:00:00`).getTime(), data: w };
  }
  for (const f of (state.fasting && state.fasting.history) || []) {
    docs[`fast-${f.id}`] = { id: `fast-${f.id}`, kind: 'fast', day: dayKey(f.end), ts: new Date(f.end).getTime(), data: f };
  }
  return docs;
}

export const emptyMeta = () => ({ rev: 0, synced: {}, settingsHash: null, settingsAt: 0, lastSyncAt: 0, userKey: null });

// Sync record for an account this phone has not synced with before. A phone
// with nothing logged (a reinstall, a new phone) takes the server's settings
// instead of overwriting them with fresh defaults.
export function metaForNewAccount(state, userKey) {
  const meta = { ...emptyMeta(), userKey };
  if (Object.keys(documentsOf(state)).length === 0) {
    meta.settingsAt = 1;
    meta.settingsHash = fingerprint(settingsOf(state));
  }
  return meta;
}

// What to send. `meta.synced` maps id -> fingerprint as last agreed with the server.
export function buildPush(state, meta, now = Date.now()) {
  const docs = documentsOf(state);
  const push = [];
  const sent = {};
  for (const [id, doc] of Object.entries(docs)) {
    const fp = fingerprint(doc.data);
    if (meta.synced[id] !== fp) {
      push.push({ ...doc, updatedAt: now, deleted: false });
      sent[id] = fp;
    }
  }
  for (const id of Object.keys(meta.synced)) {
    if (!docs[id]) {
      const kind = id.startsWith('day-') ? 'day' : id.startsWith('wt-') ? 'weight' : 'fast';
      const day = id.startsWith('day-') ? id.slice(4) : dayKey(now);
      push.push({ id, kind, day, ts: now, data: {}, updatedAt: now, deleted: true });
      sent[id] = null;
    }
  }
  const settings = settingsOf(state);
  const settingsHash = fingerprint(settings);
  const settingsChanged = settingsHash !== meta.settingsHash;
  return {
    push,
    sent,
    settings: { data: settings, updatedAt: settingsChanged ? now : meta.settingsAt },
    settingsHash,
    settingsChanged,
  };
}

// Number of unsent changes, for the UI.
export function pendingCount(state, meta) {
  const { push, settingsChanged } = buildPush(state, meta, 0);
  return push.length + (settingsChanged ? 1 : 0);
}

// Apply the server's reply. Returns { state, meta } — state is unchanged
// (same object) when nothing came down, so React does not re-render needlessly.
export function applyPull(state, meta, plan, res) {
  const synced = { ...meta.synced };
  for (const [id, fp] of Object.entries(plan.sent)) {
    if (fp === null) delete synced[id];
    else synced[id] = fp;
  }
  let next = state;
  const localNow = documentsOf(state);
  const pulled = res.entries || [];
  if (pulled.length) {
    const days = { ...state.days };
    const weights = new Map((state.weights || []).map((w) => [w.id, w]));
    const fasts = new Map(((state.fasting && state.fasting.history) || []).map((f) => [f.id, f]));
    for (const e of pulled) {
      // We just uploaded this one, so our copy is the newest on the server.
      if (e.id in plan.sent) continue;
      // Edited on this phone since the last sync: keep ours, it goes up next time.
      const local = localNow[e.id];
      if ((local ? fingerprint(local.data) : undefined) !== meta.synced[e.id]) continue;
      if (e.kind === 'day') {
        if (e.deleted) delete days[e.day];
        else days[e.day] = e.data;
      } else if (e.kind === 'weight') {
        const id = e.id.slice(3);
        if (e.deleted) weights.delete(id);
        else weights.set(id, e.data);
      } else if (e.kind === 'fast') {
        const id = e.id.slice(5);
        if (e.deleted) fasts.delete(id);
        else fasts.set(id, e.data);
      }
      if (e.deleted) delete synced[e.id];
      else synced[e.id] = fingerprint(e.data);
    }
    next = {
      ...state,
      days,
      weights: [...weights.values()].sort((a, b) => a.date.localeCompare(b.date)),
      fasting: { ...state.fasting, history: [...fasts.values()].sort((a, b) => String(a.end).localeCompare(String(b.end))) },
    };
  }

  let settingsHash = plan.settingsHash;
  let settingsAt = plan.settings.updatedAt;
  if (res.profile && res.profile.data && res.profile.updatedAt > plan.settings.updatedAt) {
    const s = res.profile.data;
    const history = next.fasting.history;
    next = { ...next };
    for (const k of SETTINGS_KEYS) if (k !== 'fasting' && s[k] !== undefined) next[k] = s[k];
    next.fasting = { ...next.fasting, ...(s.fasting || {}), history };
    settingsHash = fingerprint(settingsOf(next));
    settingsAt = res.profile.updatedAt;
  }
  return {
    state: next,
    meta: { ...meta, rev: res.rev, synced, settingsHash, settingsAt, lastSyncAt: Date.now() },
  };
}
