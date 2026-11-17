// The game layer: XP, levels, streaks, daily quests and badges.
// Computed from the app state (days, weights, fasting history), so old history
// counts and nothing extra has to be stored. Pure JavaScript.

import { dayKey, parseDayKey, addDays } from './dates';
import { weighInDueOn } from './weighIn';
import { calorieTarget, macroTargets, waterGoal, sumFood, sumWater, sumExerciseMinutes } from './calc';
import { kgToLb } from './units';

export const XP = {
  waterGoal: 40,
  waterPartial: 25, // scaled by how close you got
  foodLogged: 10,
  foodOnTarget: 30,
  protein: 25,
  workout: 30,
  workoutMinutesCap: 30, // +1 XP per 2 active minutes, up to this
  weighIn: 15,
  fast16: 40,
  fast12: 25,
  perfectDay: 50,
  streakPerDay: 2, // × streak length, capped at 10 days
};

const TITLES = [
  [1, 'Rookie'], [3, 'Mover'], [5, 'Grinder'], [8, 'Athlete'], [12, 'Machine'],
  [16, 'Beast'], [20, 'Titan'], [25, 'Legend'], [30, 'Mythic'],
];

// Total XP needed to reach a level. L2 = 100, L5 ≈ 920, L10 ≈ 3,360.
export const xpForLevel = (level) => (level <= 1 ? 0 : Math.round((100 * Math.pow(level - 1, 1.6)) / 10) * 10);

export const levelForXp = (xp) => {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
};

export const titleForLevel = (level) => {
  let title = TITLES[0][1];
  for (const [min, name] of TITLES) if (level >= min) title = name;
  return title;
};

const nextDay = (k, n = 1) => dayKey(addDays(parseDayKey(k), n));

// Monday of the week containing `k`.
export const weekKey = (k) => {
  const dow = (parseDayKey(k).getDay() + 6) % 7;
  return nextDay(k, -dow);
};

const fastHours = (f) => Math.max(0, (new Date(f.end) - new Date(f.start)) / 3600000);

// Per-day roll-up of everything that earns XP.
export function summarizeDays(state) {
  const out = {};
  const get = (k) =>
    (out[k] = out[k] || { day: k, waterMl: 0, kcal: 0, protein: 0, meals: 0, activeMin: 0, workoutDone: false, weighIns: 0, fastHours: 0, early: false, exercises: [], foods: [] });
  for (const [k, d] of Object.entries(state.days || {})) {
    const s = get(k);
    s.waterMl = sumWater(d.water);
    const f = sumFood(d.food);
    s.kcal = f.kcal;
    s.protein = f.protein;
    s.meals = (d.food || []).length;
    s.activeMin = sumExerciseMinutes(d.exercise);
    s.workoutDone = !!(d.workout && d.workout.done);
    // For badges: exercise before 8 am, which exercises and foods.
    const before8 = (iso) => !!iso && new Date(iso).getHours() < 8;
    s.early = (d.exercise || []).some((e) => before8(e.t)) || !!(d.workout && d.workout.done && before8(d.workout.doneAt));
    const w = d.workout || {};
    s.exercises = [...new Set([...(w.items || []), ...Object.keys(w.sets || {}).filter((id) => (w.sets[id] || []).length), ...Object.keys(w.cardio || {}),
      ...(d.exercise || []).map((e) => e.type).filter(Boolean)])];
    s.foods = [...new Set((d.food || []).map((f) => f.foodId || (f.name && String(f.name).toLowerCase())).filter(Boolean))];
  }
  for (const w of state.weights || []) get(w.date).weighIns++;
  for (const f of (state.fasting && state.fasting.history) || []) {
    const s = get(dayKey(f.end));
    s.fastHours = Math.max(s.fastHours, fastHours(f));
  }
  return out;
}

const isActive = (s) => !!s && (s.waterMl > 0 || s.meals > 0 || s.activeMin > 0 || s.workoutDone || s.weighIns > 0 || s.fastHours > 0);

export function goalsFor(profile, activeMin = 0) {
  return {
    waterMl: waterGoal(profile, activeMin),
    kcal: calorieTarget(profile),
    protein: macroTargets(profile).protein,
  };
}

// What a day earned, before the streak bonus.
export function scoreDay(s, profile) {
  const parts = { water: 0, food: 0, protein: 0, workout: 0, weighIn: 0, fast: 0, perfect: 0 };
  if (!s) return { parts, total: 0, flags: {} };
  const g = goalsFor(profile, s.activeMin);
  const waterOn = profile.waterTracking !== false;
  const waterHit = waterOn && s.waterMl >= g.waterMl;
  if (waterOn) parts.water = waterHit ? XP.waterGoal : Math.floor(XP.waterPartial * Math.min(1, s.waterMl / g.waterMl));
  // On target = logged at least half the target (a real day of logging) without going over.
  const foodOnTarget = s.meals > 0 && s.kcal >= g.kcal * 0.5 && s.kcal <= g.kcal;
  if (s.meals > 0) parts.food = XP.foodLogged + (foodOnTarget ? XP.foodOnTarget : 0);
  const proteinHit = s.meals > 0 && s.protein >= g.protein;
  if (proteinHit) parts.protein = XP.protein;
  const moved = s.workoutDone || s.activeMin > 0;
  if (moved) parts.workout = XP.workout + Math.min(XP.workoutMinutesCap, Math.floor(s.activeMin / 2));
  if (s.weighIns > 0) parts.weighIn = XP.weighIn;
  if (s.fastHours >= 16) parts.fast = XP.fast16;
  else if (s.fastHours >= 12) parts.fast = XP.fast12;
  else if (s.fastHours > 0) parts.fast = Math.floor(s.fastHours * 1.5);
  // With water tracking off, a Perfect Day is food on target plus movement (or a 12h fast).
  const perfect = (waterHit || !waterOn) && foodOnTarget && (moved || s.fastHours >= 12);
  if (perfect) parts.perfect = XP.perfectDay;
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { parts, total, flags: { waterHit, foodOnTarget, proteinHit, moved, perfect } };
}

// Badges come in families (like Audible's): each family has tiers that level up
// bronze → silver → gold → diamond → amethyst → ruby → obsidian. Every tier is its own badge
// (ids stay stable so earned badges and celebrations carry over between versions).
// `metric` is a key of the totals in computeGame; `what` describes a tier ({n} = its goal).
export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Amethyst', 'Ruby', 'Obsidian'];
export const BADGE_FAMILIES = [
  { key: 'streak', icon: '🔥', color: '#F97316', name: 'Streaks', metric: 'bestStreak', unit: 'days', what: 'Log something {n} days in a row',
    tiers: [['streak_3', 3, 'Warming Up'], ['streak_7', 7, 'On Fire'], ['streak_14', 14, 'Two Weeks Strong'], ['streak_30', 30, 'Unstoppable'], ['streak_60', 60, 'Relentless'], ['streak_100', 100, 'Centurion'], ['streak_365', 365, 'Full Orbit']] },
  { key: 'show', icon: '👟', color: '#10B981', name: 'Showing Up', metric: 'activeDays', unit: 'days', what: 'Log something on {n} days',
    tiers: [['first_log', 1, 'First Step'], ['active_10', 10, 'Familiar Face'], ['active_50', 50, 'Regular'], ['active_100', 100, 'Committed'], ['active_365', 365, 'Year of You']] },
  { key: 'perfect', icon: '⭐', color: '#EAB308', name: 'Perfect Days', metric: 'perfectDays', unit: 'days', what: 'Have {n} Perfect Days (water, food and movement)',
    tiers: [['perfect_1', 1, 'Perfect Day'], ['perfect_7', 7, 'Perfect Week'], ['perfect_30', 30, 'Flawless'], ['perfect_100', 100, 'Perfectionist']] },
  { key: 'water', icon: '💧', color: '#0EA5E9', name: 'Hydration', metric: 'waterDays', unit: 'days', what: 'Hit your water goal on {n} days',
    tiers: [['water_1', 1, 'Topped Up'], ['water_7', 7, 'Hydrated'], ['water_30', 30, 'Aquatic'], ['water_100', 100, 'Deep Sea'], ['water_365', 365, 'Ocean']] },
  { key: 'food', icon: '🎯', color: '#22C55E', name: 'On Target', metric: 'foodDays', unit: 'days', what: 'Stay on your calorie target on {n} days',
    tiers: [['food_1', 1, 'Bullseye'], ['food_7', 7, 'Dialed In'], ['food_30', 30, 'Precision'], ['food_100', 100, 'Sharpshooter']] },
  { key: 'protein', icon: '🥩', color: '#EF4444', name: 'Protein', metric: 'proteinDays', unit: 'days', what: 'Hit your protein goal on {n} days',
    tiers: [['protein_7', 7, 'Protein Pro'], ['protein_30', 30, 'Builder'], ['protein_100', 100, 'Protein Master']] },
  { key: 'train', icon: '💪', color: '#8B5CF6', name: 'Training', metric: 'moveDays', unit: 'days', what: 'Work out or log activity on {n} days',
    tiers: [['workout_1', 1, 'Moving'], ['workout_10', 10, 'In the Groove'], ['workout_25', 25, 'Dedicated'], ['workout_50', 50, 'Iron Habit'], ['workout_100', 100, 'Hundred Club'], ['workout_250', 250, 'Lifer']] },
  { key: 'minutes', icon: '🏃', color: '#14B8A6', name: 'Active Time', metric: 'activeMinutes', unit: 'min', what: 'Log {n} active minutes in total',
    tiers: [['min_60', 60, 'First Hour'], ['min_600', 600, 'Ten Hours'], ['min_3000', 3000, 'Fifty Hours'], ['min_6000', 6000, 'Hundred Hours']] },
  { key: 'early', icon: '🌅', color: '#FB923C', name: 'Early Bird', metric: 'earlyDays', unit: 'days', what: 'Log exercise before 8 am on {n} days',
    tiers: [['early_1', 1, 'Early Bird'], ['early_10', 10, 'Sunrise Regular'], ['early_30', 30, 'Dawn Patrol']] },
  { key: 'weekend', icon: '🎉', color: '#EC4899', name: 'Weekend Warrior', metric: 'weekends', unit: 'weekends', what: 'Move on both Saturday and Sunday, {n} weekends',
    tiers: [['weekend_1', 1, 'Weekend Warrior'], ['weekend_5', 5, 'No Days Off'], ['weekend_20', 20, 'Seven-Day Athlete']] },
  { key: 'variety', icon: '🧭', color: '#6366F1', name: 'Explorer', metric: 'exerciseVariety', unit: 'exercises', what: 'Log {n} different exercises',
    tiers: [['variety_5', 5, 'Explorer'], ['variety_15', 15, 'Cross Trainer'], ['variety_30', 30, 'Jack of All Trades']] },
  { key: 'foods', icon: '🍱', color: '#F59E0B', name: 'Foodie', metric: 'foodVariety', unit: 'foods', what: 'Log {n} different foods',
    tiers: [['foods_25', 25, 'Taster'], ['foods_100', 100, 'Foodie'], ['foods_250', 250, 'Gourmet']] },
  { key: 'fastlong', icon: '⏱️', color: '#A855F7', name: 'Long Fasts', metric: 'longestFast', unit: 'hours', what: 'Finish a {n}-hour fast',
    tiers: [['fast_16', 16, 'Sixteen'], ['fast_20', 20, 'Twenty'], ['fast_24', 24, 'Full Day']] },
  { key: 'fasts', icon: '⌛', color: '#7C3AED', name: 'Fasting Habit', metric: 'longFasts', unit: 'fasts', what: 'Finish {n} fasts of 12 hours or more',
    tiers: [['fasts_1', 1, 'First Fast'], ['fasts_10', 10, 'Faster'], ['fasts_30', 30, 'Disciplined'], ['fasts_100', 100, 'Monk Mode']] },
  { key: 'weigh', icon: '⚖️', color: '#64748B', name: 'Weigh-ins', metric: 'weighDays', unit: 'days', what: 'Weigh in on {n} days',
    tiers: [['weigh_1', 1, 'Starting Point'], ['weigh_7', 7, 'Honest Scale'], ['weigh_30', 30, 'Data Driven'], ['weigh_100', 100, 'Scientist']] },
  { key: 'lost', icon: '🪶', color: '#06B6D4', name: 'Weight Lost', metric: 'lbsLost', unit: 'lb', what: 'Lose {n} lb',
    tiers: [['lost_5', 5, 'Five Down'], ['lost_10', 10, 'Ten Down'], ['lost_25', 25, 'Twenty-Five Down'], ['lost_50', 50, 'Half Century'], ['lost_100', 100, 'Transformed']] },
  { key: 'goal', icon: '🏆', color: '#D97706', name: 'Goal Weight', metric: 'atGoal', unit: '', what: 'Reach your goal weight',
    tiers: [['goal_weight', 1, 'Goal Weight']] },
  { key: 'comeback', icon: '🔁', color: '#84CC16', name: 'Comeback', metric: 'comebacks', unit: 'times', what: 'Come back after a week or more away',
    tiers: [['comeback_1', 1, 'Comeback Kid'], ['comeback_3', 3, 'Never Give Up']] },
];

const tierDesc = (f, goal) => f.what.replace('{n}', goal.toLocaleString());

// Flat list, one entry per tier. value(t) = progress toward `goal`; earned when value >= goal.
export const BADGES = BADGE_FAMILIES.flatMap((f) =>
  f.tiers.map(([id, goal, name], tier) => ({
    id, icon: f.icon, name, desc: tierDesc(f, goal), goal, family: f.key, tier, color: f.color, unit: f.unit,
    value: (t) => (typeof t[f.metric] === 'boolean' ? (t[f.metric] ? 1 : 0) : t[f.metric] || 0),
  })),
);

export const badgeById = (id) => BADGES.find((b) => b.id === id);
export const familyByKey = (key) => BADGE_FAMILIES.find((f) => f.key === key);

// One entry per family for the badge shelf: highest tier earned, the next one, and progress toward it.
export function badgeFamilies(badges) {
  return BADGE_FAMILIES.map((f) => {
    const tiers = badges.filter((b) => b.family === f.key).sort((a, b) => a.tier - b.tier);
    const earned = tiers.filter((b) => b.earned);
    const top = earned[earned.length - 1] || null;
    const next = tiers.find((b) => !b.earned) || null;
    return {
      key: f.key, icon: f.icon, color: f.color, name: f.name, unit: f.unit, tiers,
      level: earned.length, maxLevel: tiers.length, top, next,
      progress: next ? Math.min(1, next.value / next.goal) : 1,
      lastEarnedOn: earned.reduce((m, b) => (b.earnedOn && b.earnedOn > m ? b.earnedOn : m), ''),
    };
  });
}

export function computeGame(state, today = dayKey(), now = Date.now()) {
  const profile = state.profile;
  const days = summarizeDays(state);
  const keys = Object.keys(days).filter((k) => isActive(days[k]) && k <= today).sort();

  const totals = {
    activeDays: 0, bestStreak: 0, waterDays: 0, foodDays: 0, proteinDays: 0, moveDays: 0,
    longestFast: 0, longFasts: 0, weighDays: 0, perfectDays: 0, lbsLost: 0, atGoal: false,
    activeMinutes: 0, earlyDays: 0, weekends: 0, exerciseVariety: 0, foodVariety: 0, comebacks: 0,
  };
  const weights = [...(state.weights || [])].filter((w) => w.date <= today)
    .sort((a, b) => (a.date === b.date ? (a.t || '').localeCompare(b.t || '') : a.date.localeCompare(b.date)));
  const fasts = [...((state.fasting && state.fasting.history) || [])].sort((a, b) => String(a.end).localeCompare(String(b.end)));
  const goalKg = Number(profile.goalWeightKg) || 0;
  const exSeen = new Set();
  const foodSeen = new Set();
  const earnedOn = {}; // badge id → day it was first reached
  const stamp = (k) => {
    for (const b of BADGES) if (!earnedOn[b.id] && b.value(totals) >= b.goal) earnedOn[b.id] = k;
  };
  const xpByDay = {};
  let xp = 0;
  let run = 0;
  let prev = null;
  let wi = 0;
  let fi = 0;
  for (const k of keys) {
    if (prev && nextDay(prev, 8) <= k) totals.comebacks++;
    run = prev && nextDay(prev) === k ? run + 1 : 1;
    prev = k;
    totals.activeDays++;
    totals.bestStreak = Math.max(totals.bestStreak, run);
    const d = days[k];
    const s = scoreDay(d, profile);
    const streakBonus = XP.streakPerDay * Math.min(10, run);
    xpByDay[k] = { ...s, streakBonus, total: s.total + streakBonus, streak: run };
    xp += s.total + streakBonus;
    if (s.flags.waterHit) totals.waterDays++;
    if (s.flags.foodOnTarget) totals.foodDays++;
    if (s.flags.proteinHit) totals.proteinDays++;
    if (s.flags.moved) totals.moveDays++;
    if (s.flags.perfect) totals.perfectDays++;
    if (d.weighIns > 0) totals.weighDays++;
    totals.activeMinutes += d.activeMin;
    if (d.early) totals.earlyDays++;
    // Sunday with movement, and the Saturday before too.
    const sat = nextDay(k, -1);
    if (s.flags.moved && parseDayKey(k).getDay() === 0 && xpByDay[sat] && xpByDay[sat].flags.moved) totals.weekends++;
    for (const id of d.exercises) exSeen.add(id);
    for (const id of d.foods) foodSeen.add(id);
    totals.exerciseVariety = exSeen.size;
    totals.foodVariety = foodSeen.size;
    // Weigh-ins and fasts up to this day.
    while (wi < weights.length && weights[wi].date <= k) wi++;
    if (wi > 0) {
      totals.lbsLost = Math.max(0, Math.round(kgToLb(weights[0].kg - weights[wi - 1].kg) * 10) / 10);
      totals.atGoal = goalKg > 0 && profile.goal === 'lose' && weights[wi - 1].kg <= goalKg;
    }
    while (fi < fasts.length && dayKey(fasts[fi].end) <= k) {
      const h = fastHours(fasts[fi++]);
      totals.longestFast = Math.max(totals.longestFast, h);
      if (h >= 12) totals.longFasts++;
    }
    stamp(k);
  }

  let streak = 0;
  const last = keys[keys.length - 1];
  if (last && (last === today || last === nextDay(today, -1))) streak = xpByDay[last].streak;
  const streakAtRisk = streak > 0 && last !== today;

  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);

  const wk = weekKey(today);
  let weekXp = 0;
  for (let i = 0; i < 7; i++) {
    const k = nextDay(wk, i);
    if (xpByDay[k]) weekXp += xpByDay[k].total;
  }

  // ── today's quests ──
  const td = days[today] || { waterMl: 0, kcal: 0, protein: 0, meals: 0, activeMin: 0, workoutDone: false, weighIns: 0, fastHours: 0 };
  const g = goalsFor(profile, td.activeMin);
  const ts = scoreDay(days[today], profile);
  const active = state.fasting && state.fasting.active;
  const fastingNow = active ? Math.max(0, (now - new Date(active.start).getTime()) / 3600000) : 0;
  const fastBest = Math.max(td.fastHours, fastingNow);
  const quests = [
    profile.waterTracking !== false && { id: 'water', icon: '💧', area: 'water', title: 'Hit your water goal', xp: XP.waterGoal,
      progress: Math.min(1, td.waterMl / g.waterMl), done: td.waterMl >= g.waterMl, current: td.waterMl, target: g.waterMl, unit: 'water' },
    { id: 'food', icon: '🍽️', area: 'food', title: `Log your food and stay under ${g.kcal} kcal`, xp: XP.foodLogged + XP.foodOnTarget,
      progress: td.kcal > g.kcal ? 0 : Math.min(1, td.kcal / (g.kcal * 0.5)), done: !!ts.flags.foodOnTarget,
      detail: td.kcal > g.kcal ? `${Math.round(td.kcal - g.kcal)} kcal over today`
        : td.meals === 0 ? 'Nothing logged yet'
          : ts.flags.foodOnTarget ? `${Math.round(td.kcal)} kcal, on target` : `${Math.round(td.kcal)} kcal logged, keep logging` },
    { id: 'protein', icon: '🥩', area: 'food', title: `Eat ${g.protein} g of protein`, xp: XP.protein,
      progress: Math.min(1, td.protein / g.protein), done: !!ts.flags.proteinHit, detail: `${Math.round(td.protein)} / ${g.protein} g` },
    { id: 'move', icon: '🏋️', area: 'exercise', title: "Do today's workout or log activity", xp: XP.workout,
      progress: ts.flags.moved ? 1 : 0, done: !!ts.flags.moved,
      detail: td.workoutDone ? 'Workout done' : td.activeMin > 0 ? `${td.activeMin} active minutes` : 'Not yet' },
    // Weekly weigh-ins: only a quest on the chosen day (or if you weighed in anyway).
    (weighInDueOn((state.reminders || {}).weighIn, today) || td.weighIns > 0) && { id: 'weigh', icon: '⚖️', area: 'weight', title: 'Step on the scale', xp: XP.weighIn,
      progress: td.weighIns > 0 ? 1 : 0, done: td.weighIns > 0, detail: td.weighIns > 0 ? 'Weighed in' : 'Not yet today' },
  ].filter(Boolean);
  if (!state.fasting || state.fasting.enabled !== false) {
    quests.push({ id: 'fast', icon: '⏱️', area: 'fasting', title: 'Finish a 12-hour fast', xp: XP.fast12,
      progress: Math.min(1, fastBest / 12), done: td.fastHours >= 12,
      detail: td.fastHours >= 12 ? `${Math.round(td.fastHours)}h fast finished`
        : fastingNow > 0 ? `${fastingNow.toFixed(1)}h so far${fastingNow >= 12 ? ', end it to bank the XP' : ''}` : 'Not fasting' });
  }

  const badges = BADGES.map((b) => {
    const value = b.value(totals);
    const earned = value >= b.goal;
    return {
      id: b.id, icon: b.icon, name: b.name, desc: b.desc, goal: b.goal, family: b.family, tier: b.tier, color: b.color, unit: b.unit,
      value: Math.min(value, b.goal), earned, earnedOn: earned ? earnedOn[b.id] || today : null,
    };
  });
  const families = badgeFamilies(badges);

  const recent = [];
  for (let i = 6; i >= 0; i--) {
    const k = nextDay(today, -i);
    recent.push({ day: k, xp: xpByDay[k] ? xpByDay[k].total : 0 });
  }

  return {
    xp, level, title: titleForLevel(level),
    levelXp: xp - floor, levelSpan: ceil - floor, toNext: ceil - xp,
    streak, streakAtRisk, bestStreak: totals.bestStreak,
    weekKey: wk, weekXp,
    today: { day: today, xp: xpByDay[today] ? xpByDay[today].total : 0 },
    quests, questsDone: quests.filter((q) => q.done).length,
    badges, families, totals, recent,
  };
}

// The small summary shared with the server so the other person can see it.
export const publicStats = (game, fastingActive, now = Date.now()) => ({
  xp: game.xp,
  level: game.level,
  title: game.title,
  streak: game.streak,
  bestStreak: game.bestStreak,
  weekKey: game.weekKey,
  weekXp: game.weekXp,
  day: game.today.day,
  todayXp: game.today.xp,
  questsDone: game.questsDone,
  questsTotal: game.quests.length,
  badges: game.badges.filter((b) => b.earned).map((b) => b.id),
  fastingSince: fastingActive ? new Date(fastingActive.start).getTime() : null,
  updatedAt: now,
});

// Bumped when new badges are added: badges that new version adds and that were already reached
// on earlier days are filed away quietly instead of celebrated all at once.
export const BADGE_VERSION = 2;

// What is new since `seen` ({ level, badges, v }), so it is celebrated once.
export function newAchievements(game, seen) {
  const earned = game.badges.filter((b) => b.earned).map((b) => b.id);
  if (!seen) return { levelUp: null, badges: [], seen: { level: game.level, badges: earned, v: BADGE_VERSION } };
  const had = new Set(seen.badges || []);
  let fresh = earned.filter((id) => !had.has(id));
  if (seen.v !== BADGE_VERSION) {
    const today = game.today.day;
    fresh = fresh.filter((id) => {
      const b = game.badges.find((x) => x.id === id);
      return !b.earnedOn || b.earnedOn >= today;
    });
  }
  return {
    levelUp: game.level > (seen.level || 1) ? game.level : null,
    badges: fresh,
    // Never forget a celebrated badge, even if an entry is deleted later.
    seen: { level: Math.max(game.level, seen.level || 1), badges: [...new Set([...(seen.badges || []), ...earned])], v: BADGE_VERSION },
  };
}
