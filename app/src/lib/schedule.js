// Pure reminder planner: turns state into a list of local notifications to schedule.
// Kept free of native imports so it can be unit-tested.

import { addDays, atTime, dayKey, formatClock, timeToMinutes } from './dates';
import { weighInDueOn } from './weighIn';
import { dayMetrics, waterPaceTarget } from './metrics';
import { fastHoursFor } from './fasting';
import { formatWater } from './units';
import { MEALS } from './foods';
import { sessionFor, scheduleForDate, motivationFor, sessionSummary } from './workoutPlan';
import { loggingStreak } from './insights';
import { activeMeds, isScheduled, sortTimes } from './health';

const WATER_TIPS = [
  'Time for a glass of water.',
  'Quick hydration check. Take a few sips.',
  'Water break! Your body will thank you.',
  'Refill your bottle and take a drink.',
  'Staying hydrated helps energy and focus.',
  'Thirst often feels like hunger. Have some water first.',
];

const MAX_NOTIFICATIONS = 300;

export function buildSchedule(state, now = new Date(), days = 7) {
  const out = [];
  const { profile, reminders, fasting } = state;
  const todayKey = dayKey(now);
  const wu = profile.waterUnit;
  const wake = timeToMinutes(profile.wakeTime || '07:00');
  let sleep = timeToMinutes(profile.sleepTime || '23:00');
  if (sleep <= wake) sleep += 1440;

  const push = (date, title, body, kind, extra = {}) => {
    if (date > now) out.push({ date, title, body, kind, ...extra });
  };
  const waterOn = profile.waterTracking !== false;
  const streak = loggingStreak(state, now);
  const loggedOn = (k) => {
    const d = state.days[k];
    return !!(d && ((d.food && d.food.length) || (d.water && d.water.length) || (d.exercise && d.exercise.length))) || state.weights.some((w) => w.date === k);
  };

  for (let i = 0; i < days; i++) {
    const base = addDays(now, i);
    const key = dayKey(base);
    const isToday = key === todayKey;
    const m = isToday ? dayMetrics(state, key) : null;
    const midnight = atTime(base, '00:00');
    const at = (mins) => new Date(midnight.getTime() + mins * 60000);

    // ---- Medications (optional health trackers): each scheduled dose not yet marked taken ----
    if (state.health && state.health.enabled) {
      const taken = (state.health.doses || {})[key] || {};
      for (const med of activeMeds(state.health)) {
        if (med.remind === false || !isScheduled(med)) continue;
        for (const time of sortTimes(med.times)) {
          if ((taken[med.id] || {})[time]) continue;
          push(atTime(base, time), '💊 Medication', `Time for ${med.name}${med.dose ? ` (${med.dose})` : ''}.`, 'med');
        }
      }
    }

    // ---- Water: spread across waking hours ----
    if (waterOn && reminders.water.enabled) {
      const interval = Math.max(30, reminders.water.intervalMin || 90);
      let n = 0;
      for (let t = wake + 60; t <= sleep - 60; t += interval) {
        const when = at(t);
        n++;
        if (isToday) {
          if (m.water >= m.waterGoal) break;
          const expected = waterPaceTarget(profile, m.waterGoal, when);
          const deficit = Math.max(0, expected - m.water);
          const body =
            deficit > 0
              ? `Aim for ${formatWater(deficit, wu)} more to stay on pace (${formatWater(m.water, wu)} of ${formatWater(m.waterGoal, wu)} so far).`
              : WATER_TIPS[n % WATER_TIPS.length];
          push(when, '💧 Hydration', body, 'water', { category: 'water' });
        } else {
          push(when, '💧 Hydration', WATER_TIPS[(n + i) % WATER_TIPS.length], 'water', { category: 'water' });
        }
      }
    }

    // ---- Fasting window / meals ----
    if (fasting.enabled && reminders.fasting.enabled) {
      const windowHours = Math.max(1, 24 - fastHoursFor(fasting));
      const open = atTime(base, fasting.windowStart || '12:00');
      const close = new Date(open.getTime() + windowHours * 3600000);
      const activeFast = !!fasting.active;
      push(
        open,
        '🍽️ Eating window open',
        isToday && activeFast
          ? `Your ${fastHoursFor(fasting)}h fasting goal lines up now. End your fast and break it with protein and vegetables.`
          : 'Your eating window is open. Start with a protein-rich meal.',
        'fasting'
      );
      // Skip "window closing" nudges if a fast already started after today's window opened.
      const alreadyFasting = activeFast && new Date(fasting.active.start) >= open;
      if (!(isToday && alreadyFasting)) {
        push(
          new Date(close.getTime() - 60 * 60000),
          '⏳ 1 hour left to eat',
          `Your eating window closes at ${formatClock(close)}. Plan your last meal now.`,
          'fasting'
        );
        push(close, '🌙 Fasting time', `Eating window closed. Start your ${fastHoursFor(fasting)}h fast timer to stay on track.`, 'fasting', {
          category: 'fast',
        });
      }
      if (reminders.meals.enabled && windowHours >= 7) {
        const mid = new Date((open.getTime() + close.getTime()) / 2 + 30 * 60000);
        if (!isToday || m.day.food.length < 2) {
          push(mid, '🍴 Meal check', 'Time for your next meal? Log it to keep your numbers accurate.', 'meal');
        }
      }
    } else if (reminders.meals.enabled) {
      for (const meal of MEALS.filter((x) => x.key !== 'snack')) {
        const when = atTime(base, reminders.meals[meal.key] || '12:00');
        if (isToday && m.day.food.some((f) => f.meal === meal.key)) continue;
        push(when, `${meal.icon} ${meal.label}`, `Time for ${meal.label.toLowerCase()}? Log what you eat to keep your targets accurate.`, 'meal');
      }
    }

    // ---- Weigh-in ----
    if (reminders.weighIn.enabled) {
      if (weighInDueOn(reminders.weighIn, base)) {
        const loggedToday = isToday && state.weights.some((wt) => wt.date === key);
        if (!loggedToday) {
          push(atTime(base, reminders.weighIn.time || '07:30'), '⚖️ Weigh-in', 'Step on the scale before breakfast for your most consistent reading.', 'weight');
        }
      }
    }

    // ---- Workout plan: morning reminder + evening nudge if not done ----
    if (reminders.workout && reminders.workout.enabled) {
      const log = (state.days[key] || {}).workout;
      const session = sessionFor(key, log, state.workoutPlan);
      const sched = scheduleForDate(key, state.workoutPlan);
      const done = !!(log && log.done);
      const message = motivationFor(base);
      if (!done) {
        const title = session.rest || sched.options.length > 1 ? `🏋️ Today: ${sched.title}` : `🏋️ Today: ${session.title}`;
        push(atTime(base, reminders.workout.time || '08:00'), title, `${sessionSummary(session, state.workoutPlan)}\n${message}`, 'workout');
        if (reminders.workout.nudge && !session.rest && !sched.options.some((o) => o.rest)) {
          push(
            atTime(base, reminders.workout.nudgeTime || '18:00'),
            '💪 Workout not done yet',
            `${sched.title}. Even a short session counts. ${message}`,
            'workout'
          );
        }
      }
    }

    // ---- Exercise ----
    if (reminders.exercise.enabled) {
      if (!(isToday && m.exMinutes > 0)) {
        push(atTime(base, reminders.exercise.time || '17:30'), '🏃 Time to move', 'Even a 15–20 minute walk counts toward your weekly 150 active minutes.', 'exercise');
      }
    }

    // ---- Evening summary ----
    if (reminders.summary.enabled) {
      const when = atTime(base, reminders.summary.time || '20:30');
      if (isToday) {
        const left = m.kcalTarget - m.food.kcal;
        const parts = [
          ...(waterOn ? [`Water ${formatWater(m.water, wu)}/${formatWater(m.waterGoal, wu)}`] : []),
          `Food ${Math.round(m.food.kcal)}/${m.kcalTarget} kcal`,
          `Protein ${Math.round(m.food.protein)}/${m.macros.protein}g`,
        ];
        push(when, '📊 Today so far', `${parts.join(' · ')}${left > 0 ? `. ${Math.round(left)} kcal left.` : '.'}`, 'summary');
      } else {
        push(when, '📊 Daily check-in', 'Take a moment to log anything you missed today.', 'summary');
      }
    }
  }

  // ---- Nags that follow your day, not a timetable ----
  for (let i = 0; i < days; i++) {
    const base = addDays(now, i);
    const key = dayKey(base);
    const isToday = key === todayKey;
    const midnight = atTime(base, '00:00');
    const at = (mins) => new Date(midnight.getTime() + mins * 60000);

    // Don't break the streak: nothing logged yet today → evening nag, and one more before bed.
    if (reminders.streak && reminders.streak.enabled && !(isToday && loggedOn(key))) {
      const days = isToday ? streak : streak + i; // a future day only nags if the streak is still going
      const title = days > 0 ? `🔥 Don't break your ${days}-day streak` : '🔥 Start a streak today';
      const body = 'Log anything (a meal, water, a workout or a weigh-in) to keep it going.';
      push(atTime(base, reminders.streak.time || '19:30'), title, body, 'streak');
      push(at(sleep - 60), title, `Last call: ${body.charAt(0).toLowerCase()}${body.slice(1)}`, 'streak');
    }

    // Food check-in: every few hours after the last thing you logged (or after waking), while awake.
    if (reminders.foodGap && reminders.foodGap.enabled) {
      const gap = Math.max(2, Math.min(8, Number(reminders.foodGap.hours) || 4)) * 60;
      const food = isToday ? ((state.days[key] || {}).food || []) : [];
      const lastT = food.reduce((mx, f) => Math.max(mx, new Date(f.t).getTime() || 0), 0);
      const fromMin = lastT ? (lastT - midnight.getTime()) / 60000 : wake;
      for (let t = Math.max(fromMin, wake) + gap; t <= sleep - 30; t += gap) {
        const hrs = Math.round((t - Math.max(fromMin, wake)) / 60);
        push(at(t), '🍽️ Food check-in', lastT ? `Nothing logged for ${hrs} hours. Eaten anything? Log it while you remember.` : 'Nothing logged yet today. Had something to eat? Log it while you remember.', 'meal');
      }
    }
  }

  // ---- Active fast milestones ----
  if (fasting.active) {
    const start = new Date(fasting.active.start);
    const goal = new Date(start.getTime() + fasting.active.targetHours * 3600000);
    push(goal, '🎉 Fast complete!', `You reached your ${fasting.active.targetHours}h fasting goal. End your fast in the app when you eat.`, 'fasting');
    const half = new Date(start.getTime() + (fasting.active.targetHours / 2) * 3600000);
    push(half, '⏱️ Halfway there', `You're halfway through your ${fasting.active.targetHours}h fast. Stay hydrated!`, 'fasting');
  }

  return out.sort((a, b) => a.date - b.date).slice(0, MAX_NOTIFICATIONS);
}
