import { computeGame, scoreDay, summarizeDays, xpForLevel, levelForXp, titleForLevel, weekKey, publicStats, newAchievements, XP, BADGES, BADGE_FAMILIES, BADGE_VERSION, goalsFor } from './game';
import { DEFAULT_STATE } from '../state/defaults';
import { dayKey, parseDayKey, addDays } from './dates';
import { lbToKg } from './units';

const TODAY = '2026-11-13'; // a Friday
const day = (n) => dayKey(addDays(parseDayKey(TODAY), n));
const iso = (k, h = 12) => {
  const d = parseDayKey(k);
  d.setHours(h);
  return d.toISOString();
};
const PROFILE = { ...DEFAULT_STATE.profile, weightKg: 90, heightCm: 180, age: 34, goal: 'lose', goalWeightKg: 80, onboarded: true };
const G = goalsFor(PROFILE);

let n = 0;
const mk = (over = {}) => ({ ...DEFAULT_STATE, profile: PROFILE, days: {}, weights: [], fasting: { ...DEFAULT_STATE.fasting, history: [] }, ...over });
const withDay = (s, k, d) => ({ ...s, days: { ...s.days, [k]: { water: [], food: [], exercise: [], steps: 0, ...d } } });
const water = (ml) => ({ id: `w${n++}`, t: iso(TODAY), ml });
const food = (kcal, protein = 0) => ({ id: `f${n++}`, t: iso(TODAY), kcal, protein, name: 'x', meal: 'lunch' });
const weigh = (k, kg) => ({ id: `wt${n++}`, date: k, t: iso(k, 7), kg });
const fast = (endDay, hours) => ({ id: `fa${n++}`, start: new Date(new Date(iso(endDay)).getTime() - hours * 3600000).toISOString(), end: iso(endDay), targetHours: 16 });

describe('levels', () => {
  test('thresholds rise and levelForXp inverts xpForLevel', () => {
    expect(xpForLevel(2)).toBe(100);
    for (let l = 2; l < 40; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      expect(levelForXp(xpForLevel(l) - 1)).toBe(l - 1);
    }
    expect(titleForLevel(1)).toBe('Rookie');
    expect(titleForLevel(99)).toBe('Mythic');
  });
});

describe('scoreDay', () => {
  const sum = (s) => summarizeDays(s)[TODAY];

  test('water: full XP at goal, partial below', () => {
    expect(scoreDay(sum(withDay(mk(), TODAY, { water: [water(G.waterMl)] })), PROFILE).parts.water).toBe(XP.waterGoal);
    expect(scoreDay(sum(withDay(mk(), TODAY, { water: [water(G.waterMl / 2)] })), PROFILE).parts.water).toBe(12);
  });

  test('food on target, over target, and protein', () => {
    const on = scoreDay(sum(withDay(mk(), TODAY, { food: [food(G.kcal * 0.6, G.protein)] })), PROFILE);
    expect(on.parts.food).toBe(XP.foodLogged + XP.foodOnTarget);
    expect(on.parts.protein).toBe(XP.protein);
    expect(scoreDay(sum(withDay(mk(), TODAY, { food: [food(G.kcal + 100)] })), PROFILE).parts.food).toBe(XP.foodLogged);
    expect(scoreDay(sum(withDay(mk(), TODAY, { food: [food(300)] })), PROFILE).parts.food).toBe(XP.foodLogged);
  });

  test('a finished plan workout or logged activity counts as moving', () => {
    const plan = scoreDay(sum(withDay(mk(), TODAY, { workout: { done: true } })), PROFILE);
    expect(plan.flags.moved).toBe(true);
    expect(plan.parts.workout).toBe(XP.workout);
    const act = scoreDay(sum(withDay(mk(), TODAY, { exercise: [{ id: 'e', minutes: 90, kcal: 300 }] })), PROFILE);
    expect(act.parts.workout).toBe(XP.workout + XP.workoutMinutesCap);
  });

  test('fasts land on the day they end; weigh-ins on their date', () => {
    const s = mk({ weights: [weigh(TODAY, 90)], fasting: { ...DEFAULT_STATE.fasting, history: [fast(TODAY, 17)] } });
    const r = scoreDay(sum(s), PROFILE);
    expect(r.parts.fast).toBe(XP.fast16);
    expect(r.parts.weighIn).toBe(XP.weighIn);
  });

  test('perfect day', () => {
    const s = withDay(mk(), TODAY, { water: [water(G.waterMl + 500)], food: [food(G.kcal * 0.7)], workout: { done: true } });
    expect(scoreDay(sum(s), PROFILE).parts.perfect).toBe(XP.perfectDay);
  });
});

describe('computeGame', () => {
  test('no data', () => {
    const g = computeGame(mk(), TODAY);
    expect(g).toMatchObject({ xp: 0, level: 1, streak: 0, weekXp: 0, questsDone: 0 });
    expect(g.quests.map((q) => q.id)).toEqual(['water', 'food', 'protein', 'move', 'weigh', 'fast']);
    expect(g.badges.every((b) => !b.earned)).toBe(true);
  });

  test('fasting quest hidden when fasting is switched off', () => {
    const g = computeGame(mk({ fasting: { ...DEFAULT_STATE.fasting, enabled: false, history: [] } }), TODAY);
    expect(g.quests.map((q) => q.id)).not.toContain('fast');
  });

  test('streaks: alive through the next day, broken after a full missed day', () => {
    const s = mk({ weights: [weigh(day(-2), 90), weigh(day(-1), 90), weigh(TODAY, 90)] });
    expect(computeGame(s, TODAY).streak).toBe(3);
    const tomorrow = computeGame(s, day(1));
    expect(tomorrow).toMatchObject({ streak: 3, streakAtRisk: true });
    expect(computeGame(s, day(2))).toMatchObject({ streak: 0, bestStreak: 3 });
  });

  test('XP = day scores + streak bonus; week starts Monday', () => {
    const s = mk({ weights: [weigh('2026-11-08', 90), weigh('2026-11-09', 90)] });
    const g = computeGame(s, TODAY);
    expect(g.xp).toBe(15 + 2 + 15 + 4);
    expect(weekKey(TODAY)).toBe('2026-11-09');
    expect(g.weekXp).toBe(19);
  });

  test('badges from weight loss in pounds, goal weight and fasting', () => {
    const s = mk({
      weights: [weigh(day(-2), lbToKg(200)), weigh(day(-1), lbToKg(194)), weigh(TODAY, 79.9)],
      fasting: { ...DEFAULT_STATE.fasting, history: [fast(TODAY, 24.5)] },
    });
    const earned = computeGame(s, TODAY).badges.filter((b) => b.earned).map((b) => b.id);
    expect(earned).toEqual(expect.arrayContaining(['first_log', 'streak_3', 'lost_5', 'lost_10', 'goal_weight', 'fast_16', 'fast_24']));
    expect(earned).not.toContain('lost_25');
  });

  test('an active fast shows progress but is not banked', () => {
    const now = new Date(iso(TODAY, 20)).getTime();
    const s = mk({ fasting: { ...DEFAULT_STATE.fasting, history: [], active: { start: new Date(now - 6 * 3600000).toISOString(), targetHours: 16 } } });
    const q = computeGame(s, TODAY, now).quests.find((x) => x.id === 'fast');
    expect(q.progress).toBeCloseTo(0.5);
    expect(q.done).toBe(false);
  });

  test('badge ids are unique', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});

test('publicStats is a small summary', () => {
  const g = computeGame(mk({ weights: [weigh(TODAY, 90)] }), TODAY);
  const s = publicStats(g, { start: '2026-11-13T01:00:00.000Z' }, 5);
  expect(s).toMatchObject({ xp: 17, level: 1, streak: 1, weekXp: 17, badges: ['first_log', 'weigh_1'], fastingSince: Date.parse('2026-11-13T01:00:00.000Z'), updatedAt: 5 });
  expect(JSON.stringify(s).length).toBeLessThan(1000);
});

test('newAchievements celebrates once and never twice', () => {
  const g = computeGame(mk({ weights: [weigh(TODAY, 90)] }), TODAY);
  expect(newAchievements(g, null)).toEqual({ levelUp: null, badges: [], seen: { level: 1, badges: ['first_log', 'weigh_1'], v: BADGE_VERSION } });
  const r = newAchievements({ ...g, level: 3 }, { level: 2, badges: [], v: BADGE_VERSION });
  expect(r).toMatchObject({ levelUp: 3, badges: ['first_log', 'weigh_1'] });
  expect(newAchievements({ ...g, level: 3 }, r.seen)).toMatchObject({ levelUp: null, badges: [] });
});

describe('badge families', () => {
  const ex = (k, h, type = 'walk', minutes = 30) => ({ id: `e${n++}`, t: iso(k, h), type, minutes, intensity: 'moderate', kcal: 100 });

  test('every family has rising tiers and each badge knows its family', () => {
    for (const f of BADGE_FAMILIES) {
      const goals = f.tiers.map((t) => t[1]);
      expect([...goals].sort((a, b) => a - b)).toEqual(goals);
    }
    expect(BADGES.every((b) => b.family && b.tier >= 0 && b.desc && !b.desc.includes('{n}'))).toBe(true);
  });

  test('earned dates, weekends, early workouts, variety and comebacks', () => {
    // Sat 2026-11-07 and Sun 2026-11-08 moved, 6 am on Saturday. A 9-day gap before that.
    let s = mk();
    s = withDay(s, '2026-10-28', { exercise: [ex('2026-10-28', 18, 'run')] });
    s = withDay(s, '2026-11-07', { exercise: [ex('2026-11-07', 6, 'cycle')] });
    s = withDay(s, '2026-11-08', { exercise: [ex('2026-11-08', 17, 'swim')] });
    const g = computeGame(s, TODAY);
    const b = Object.fromEntries(g.badges.map((x) => [x.id, x]));
    expect(b.first_log.earnedOn).toBe('2026-10-28');
    expect(b.early_1.earnedOn).toBe('2026-11-07');
    expect(b.weekend_1.earnedOn).toBe('2026-11-08');
    expect(b.comeback_1.earned).toBe(true);
    expect(g.totals.exerciseVariety).toBe(3);
    expect(g.totals.activeMinutes).toBe(90);
    expect(b.min_60.earnedOn).toBe('2026-11-07');
    const fam = g.families.find((f) => f.key === 'train');
    expect(fam).toMatchObject({ level: 1, top: { id: 'workout_1' }, next: { id: 'workout_10' } });
    expect(fam.progress).toBeCloseTo(0.3);
  });

  test('after an update adds badges, old ones are filed quietly and today\'s still celebrate', () => {
    let s = mk();
    s = withDay(s, day(-3), { exercise: [ex(day(-3), 6)] });
    s = withDay(s, TODAY, { exercise: [ex(TODAY, 18, 'run')] });
    const g = computeGame(s, TODAY);
    const r = newAchievements(g, { level: 1, badges: ['first_log', 'workout_1'] });
    expect(r.badges).not.toContain('early_1'); // reached 3 days ago
    expect(r.seen.badges).toContain('early_1');
    expect(r.seen.v).toBe(BADGE_VERSION);
  });
});
