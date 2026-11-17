// Personal suggestion engine. Runs entirely on-device from your own logs.
// Produces short, actionable cards for water, food, fasting, exercise and weight.

import { dayKey, formatTime12, minutesToTime, formatClock, lastNDays, timeToMinutes } from './dates';
import { weighInDueOn } from './weighIn';
import { dayMetrics, waterPaceTarget, weekMetrics, weightRate, weightTrend, lateEatingShare } from './metrics';
import { bmi, healthyWeightRange, isPaceClamped, projectGoalDate, minimumCalories } from './calc';
import { eatingWindow, fastHoursFor, fastStats, protocolByKey, PROTOCOLS } from './fasting';
import { WEEKLY_ACTIVE_GOAL, WEEKLY_STRENGTH_DAYS_GOAL } from './exercise';
import { weekAdherence, stepGoal } from './workoutPlan';
import { formatWater, formatWeight, formatWeightDelta } from './units';

const card = (area, level, title, body, priority = 50) => ({ id: `${area}-${title}`, area, level, title, body, priority });

// ---------- Right-now suggestions (used on Today screen) ----------
export function todaySuggestions(state, now = new Date()) {
  const out = [];
  const { profile, fasting } = state;
  const m = dayMetrics(state, dayKey(now));
  const wu = profile.waterUnit;

  // Water pace
  const pace = waterPaceTarget(profile, m.waterGoal, now);
  const behind = pace - m.water;
  if (m.water >= m.waterGoal) {
    out.push(card('water', 'good', 'Hydration goal hit', `You've reached ${formatWater(m.water, wu)} today. Nice work.`, 20));
  } else if (behind > 400) {
    out.push(
      card(
        'water',
        'warn',
        'Behind on water',
        `You're about ${formatWater(behind, wu)} behind pace. Drink a glass now and another within the hour.`,
        90
      )
    );
  } else if (behind > 0) {
    out.push(card('water', 'tip', 'Top up your water', `${formatWater(behind, wu)} more gets you back on pace.`, 60));
  }

  // Fasting window
  if (fasting.enabled) {
    const w = eatingWindow(fasting, now);
    const minsToClose = (w.close - now) / 60000;
    const minsToOpen = (w.open - now) / 60000;
    if (fasting.active) {
      const hrs = (now - new Date(fasting.active.start)) / 3600000;
      const left = fasting.active.targetHours - hrs;
      if (left <= 0) {
        out.push(card('fasting', 'good', 'Fast goal reached', `You've fasted ${hrs.toFixed(1)}h. End your fast whenever you're ready.`, 85));
      } else if (left < 2) {
        out.push(card('fasting', 'tip', 'Almost there', `${Math.round(left * 60)} minutes left in your fast. Water, black coffee or plain tea can help.`, 70));
      }
    } else if (w.isOpen && minsToClose <= 90 && minsToClose > 0) {
      out.push(
        card(
          'fasting',
          'tip',
          'Eating window closing',
          `Your window closes at ${formatClock(w.close)}. Have a protein-rich last meal, then start your fast.`,
          80
        )
      );
    } else if (!w.isOpen && minsToOpen > 0) {
      out.push(
        card(
          'fasting',
          'tip',
          'Start your fast',
          `Your eating window has closed. Tap "Start fast" so your ${fastHoursFor(fasting)}h fast is tracked. It opens again at ${formatClock(w.open)}.`,
          75
        )
      );
    }
  }

  // Food
  const hour = now.getHours();
  const remaining = m.kcalTarget - m.food.kcal;
  if (m.food.kcal > m.kcalTarget * 1.1) {
    out.push(card('food', 'warn', 'Over your calorie target', `You're ${Math.round(-remaining)} kcal over today. A walk helps, and tomorrow is a fresh start.`, 65));
  } else if (hour >= 14 && m.hasFood && m.food.protein < m.macros.protein * 0.4) {
    out.push(
      card(
        'food',
        'tip',
        'Protein is low so far',
        `${Math.round(m.food.protein)}g of ${m.macros.protein}g. Try eggs, Greek yogurt, chicken, tuna, tofu or a protein shake.`,
        55
      )
    );
  } else if (hour >= 19 && m.hasFood && remaining > 600 && !fasting.active) {
    out.push(card('food', 'tip', 'Room left today', `You have ${Math.round(remaining)} kcal left. A balanced dinner keeps your energy steady.`, 40));
  } else if (hour >= 12 && !m.hasFood && !fasting.active) {
    out.push(card('food', 'tip', 'Nothing logged yet', 'Log your meals as you go. It only takes a few seconds and makes your insights accurate.', 45));
  }

  // Exercise
  const week = weekMetrics(state, now);
  const minsLeft = WEEKLY_ACTIVE_GOAL - week.totalActiveMinutes;
  if (m.exMinutes === 0 && hour >= 16 && minsLeft > 0) {
    out.push(
      card('exercise', 'tip', 'Move a little today', `A 20-minute walk would bring you to ${Math.round(week.totalActiveMinutes + 20)} of ${WEEKLY_ACTIVE_GOAL} active minutes this week.`, 35)
    );
  }

  // Weigh-in
  const todayKey = dayKey(now);
  if (state.reminders.weighIn.enabled && weighInDueOn(state.reminders.weighIn, now) && !state.weights.some((w) => w.date === todayKey) && hour < 11) {
    out.push(card('weight', 'tip', 'Morning weigh-in', 'Weigh in after waking and using the bathroom, before you eat or drink, for consistent numbers.', 30));
  }

  return out.filter((c) => profile.waterTracking !== false || c.area !== 'water').sort((a, b) => b.priority - a.priority);
}

// ---------- Trend insights (Insights screen) ----------
export function trendInsights(state, now = new Date()) {
  const out = [];
  const { profile, fasting } = state;
  const wk = weekMetrics(state, now);
  const today = dayMetrics(state, dayKey(now));
  const wu = profile.waterUnit;
  const units = profile.units;

  // ---- Water ----
  const waterDaysLogged = wk.days.filter((d) => d.hasWater).length;
  if (waterDaysLogged >= 3) {
    const pct = Math.round((wk.avgWater / today.waterGoal) * 100);
    if (wk.waterDaysMet >= 6) {
      out.push(card('water', 'good', 'Excellent hydration', `You hit your water goal ${wk.waterDaysMet} of the last 7 days.`, 30));
    } else if (pct < 70) {
      out.push(
        card(
          'water',
          'warn',
          'Hydration running low',
          `You average ${formatWater(wk.avgWater, wu)}/day, about ${pct}% of your goal. Keep a bottle in sight and drink a glass with each meal. Shorter reminder intervals can help.`,
          80
        )
      );
    } else {
      out.push(
        card('water', 'tip', 'Close on water', `You average ${pct}% of your goal. Front-load it: aim for half your goal by early afternoon.`, 50)
      );
    }
    // Weekday vs weekend pattern
    const weekend = wk.days.filter((d) => [0, 6].includes(new Date(d.key + 'T12:00').getDay()) && d.hasWater);
    const weekday = wk.days.filter((d) => ![0, 6].includes(new Date(d.key + 'T12:00').getDay()) && d.hasWater);
    if (weekend.length && weekday.length) {
      const we = weekend.reduce((a, d) => a + d.water, 0) / weekend.length;
      const wd = weekday.reduce((a, d) => a + d.water, 0) / weekday.length;
      if (we < wd * 0.75) {
        out.push(card('water', 'tip', 'Weekend dip', `You drink ~${Math.round((1 - we / wd) * 100)}% less water on weekends. Set a bottle out the night before.`, 40));
      }
    }
  } else {
    out.push(card('water', 'tip', 'Log water for a few days', 'After about 3 days of logging, you\'ll see hydration patterns here.', 10));
  }

  // ---- Food ----
  if (wk.foodDaysLogged >= 3) {
    const target = today.baseKcalTarget;
    const diff = wk.avgKcal - target;
    if (Math.abs(diff) <= target * 0.08) {
      out.push(card('food', 'good', 'Calories on target', `You average ${Math.round(wk.avgKcal)} kcal/day against a ${target} kcal target.`, 30));
    } else if (diff > 0) {
      out.push(
        card(
          'food',
          'warn',
          'Eating above target',
          `You average ${Math.round(diff)} kcal/day over target. Easy wins: swap sugary drinks for water, add vegetables to fill half your plate, and pre-log dinner.`,
          70
        )
      );
    } else if (wk.avgKcal < minimumCalories(profile.sex)) {
      out.push(
        card(
          'food',
          'warn',
          'Intake may be too low',
          `You average ${Math.round(wk.avgKcal)} kcal/day, below the ${minimumCalories(profile.sex)} kcal minimum. Very low intake can cost muscle and slow your metabolism. If you're logging everything, try eating a bit more.`,
          85
        )
      );
    } else {
      out.push(card('food', 'tip', 'Under target', `You average ${Math.round(-diff)} kcal/day under target. Make sure you're logging snacks, drinks and cooking oils.`, 45));
    }
    const proteinPct = wk.avgProtein / today.macros.protein;
    if (proteinPct < 0.75) {
      out.push(
        card(
          'food',
          'tip',
          'Boost protein',
          `You average ${Math.round(wk.avgProtein)}g protein vs a ${today.macros.protein}g target. Protein keeps you full and protects muscle while losing fat. Aim for 25–40g per meal.`,
          65
        )
      );
    } else if (proteinPct >= 0.9) {
      out.push(card('food', 'good', 'Protein on point', `Averaging ${Math.round(wk.avgProtein)}g/day. Great for satiety and muscle.`, 25));
    }
    const late = lateEatingShare(state, 7, 20);
    if (late > 0.3) {
      out.push(card('food', 'tip', 'Lots of late eating', `${Math.round(late * 100)}% of your calories come after 8 PM. Moving them earlier often helps sleep and appetite control.`, 50));
    }
    if (wk.foodDaysLogged < 6) {
      out.push(card('food', 'tip', 'Log more consistently', `You logged food on ${wk.foodDaysLogged} of 7 days. Your numbers get more accurate with daily logs, even rough ones.`, 35));
    }
  } else {
    out.push(card('food', 'tip', 'Log meals for a few days', 'After 3 days of food logs, calorie and protein trends will appear here.', 10));
  }

  // ---- Fasting ----
  if (fasting.enabled) {
    const recent = fasting.history.filter((f) => new Date(f.end) >= new Date(now.getTime() - 14 * 86400000));
    const stats = fastStats(recent);
    const target = fastHoursFor(fasting);
    if (stats.count >= 3) {
      if (stats.completionRate < 0.5) {
        const easier = [...PROTOCOLS].reverse().find((p) => p.key !== 'custom' && p.fastHours < target);
        out.push(
          card(
            'fasting',
            'tip',
            'Try an easier fasting schedule',
            `You completed ${Math.round(stats.completionRate * 100)}% of your fasts in the last 2 weeks (average ${stats.avgHours.toFixed(1)}h).${
              easier ? ` Switching to ${easier.label} for a couple of weeks can build consistency, then step back up.` : ''
            }`,
            70
          )
        );
      } else if (stats.completionRate >= 0.85 && stats.count >= 7) {
        const harder = PROTOCOLS.find((p) => p.key !== 'custom' && p.fastHours > target && p.fastHours <= 20);
        out.push(
          card(
            'fasting',
            'good',
            'Fasting consistently',
            `${Math.round(stats.completionRate * 100)}% completion over ${stats.count} fasts (streak: ${stats.streak}).${
              harder ? ` If you feel good, you could try ${harder.label}. There's no need to, though: consistency matters more than length.` : ''
            }`,
            40
          )
        );
      } else {
        out.push(card('fasting', 'tip', 'Fasting progress', `Average fast: ${stats.avgHours.toFixed(1)}h, ${Math.round(stats.completionRate * 100)}% hit target.`, 30));
      }
    } else {
      out.push(card('fasting', 'tip', 'Track your fasts', 'Start and end fasts from the Fast tab. Reminders tell you when your eating window opens and closes.', 15));
    }
    // Window vs sleep: suggest a window that ends ≥3h before bed
    const w = eatingWindow(fasting, now);
    const closeMin = (w.startMin + w.windowHours * 60) % 1440;
    const sleepMin = timeToMinutes(profile.sleepTime || '23:00');
    const gap = (sleepMin - closeMin + 1440) % 1440;
    if (gap < 120) {
      const suggestedStart = minutesToTime(sleepMin - 180 - w.windowHours * 60);
      out.push(
        card(
          'fasting',
          'tip',
          'Finish eating earlier',
          `Your window closes within 2h of bedtime. Starting it at ${formatTime12(suggestedStart)} would end it 3h before sleep, which is better for digestion and sleep quality.`,
          45
        )
      );
    }
    if (profile.goal === 'lose' && wk.foodDaysLogged >= 3 && wk.avgKcal < minimumCalories(profile.sex) && target >= 18) {
      out.push(card('fasting', 'warn', 'Long fasts + low calories', 'Pairing long fasts with very low intake makes it hard to get enough nutrition. Consider a shorter fast or bigger meals.', 75));
    }
  }

  // ---- Exercise ----
  const mins = Math.round(wk.totalActiveMinutes);
  if (mins >= WEEKLY_ACTIVE_GOAL) {
    out.push(card('exercise', 'good', 'Activity goal met', `${mins} active minutes in the last 7 days. That meets the recommended 150.`, 30));
  } else {
    const perDay = Math.ceil((WEEKLY_ACTIVE_GOAL - mins) / 7 / 5) * 5;
    out.push(
      card(
        'exercise',
        mins < 60 ? 'warn' : 'tip',
        'More movement',
        `${mins} of ${WEEKLY_ACTIVE_GOAL} recommended active minutes this week. About ${perDay} minutes a day closes the gap. A brisk walk after meals also helps blood sugar.`,
        mins < 60 ? 60 : 45
      )
    );
  }
  if (wk.strengthDays < WEEKLY_STRENGTH_DAYS_GOAL) {
    out.push(
      card(
        'exercise',
        'tip',
        'Add strength training',
        `${wk.strengthDays} strength day${wk.strengthDays === 1 ? '' : 's'} this week (2+ recommended). Bodyweight squats, push-ups and rows for 20 minutes count and help keep muscle while losing fat.`,
        profile.goal === 'lose' ? 55 : 40
      )
    );
  }

  // ---- Workout plan, sleep, steps ----
  const adh = weekAdherence(state.days, wk.keys, state.workoutPlan);
  if (adh.planned > 0) {
    if (adh.done >= adh.planned) {
      out.push(card('exercise', 'good', 'Every planned workout done', `${adh.done} of ${adh.planned} plan sessions this week. That's how real progress is built.`, 45));
    } else if (adh.done === 0 && adh.planned >= 2) {
      out.push(card('exercise', 'warn', 'Restart the plan', `0 of ${adh.planned} planned sessions this week. Do the next one even if it's half-length. Showing up beats perfect.`, 75));
    } else {
      out.push(card('exercise', 'tip', 'Workout plan', `${adh.done} of ${adh.planned} planned sessions done this week. Open the Train tab to see today's session.`, 50));
    }
  }
  const sleepGoal = (state.workoutPlan && state.workoutPlan.sleepGoal) || 7;
  const sleeps = wk.days.map((d) => d.day.sleepHours).filter((h) => h != null);
  if (sleeps.length >= 3) {
    const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;
    if (avg < sleepGoal - 0.25) {
      out.push(
        card('general', 'warn', 'Short on sleep', `You average ${avg.toFixed(1)}h vs a ${sleepGoal}h goal. Poor sleep raises hunger and slows recovery. Try a fixed bedtime and no screens 30 minutes before.`, 65)
      );
    } else {
      out.push(card('general', 'good', 'Sleep on target', `Averaging ${avg.toFixed(1)}h per night.`, 25));
    }
  }
  const sGoal = state.workoutPlan && stepGoal(state.workoutPlan.stepPlan, now);
  const stepDays = wk.days.filter((d) => d.steps > 0);
  if (sGoal && stepDays.length >= 3) {
    const hit = stepDays.filter((d) => d.steps >= sGoal).length;
    const avg = stepDays.reduce((a, d) => a + d.steps, 0) / stepDays.length;
    out.push(
      card(
        'exercise',
        hit >= stepDays.length * 0.7 ? 'good' : 'tip',
        'Steps',
        `Average ${Math.round(avg).toLocaleString()} steps vs today's goal of ${sGoal.toLocaleString()} (hit on ${hit}/${stepDays.length} logged days). Short walks after meals add up fast.`,
        40
      )
    );
  }

  // ---- Weight ----
  const trend = weightTrend(state.weights);
  const rate = weightRate(state.weights, 28, now);
  if (trend.length >= 2 && rate != null) {
    const pctPerWeek = (rate / (profile.weightKg || 80)) * 100;
    if (profile.goal === 'lose') {
      if (pctPerWeek < -1.0) {
        out.push(
          card('weight', 'warn', 'Losing quickly', `You're losing ${formatWeightDelta(rate, units)}/week (over 1% of body weight). Faster loss risks muscle. Consider eating a bit more, especially protein.`, 75)
        );
      } else if (rate < -0.1) {
        out.push(card('weight', 'good', 'Losing steadily', `Trend: ${formatWeightDelta(rate, units)}/week. Right in the sustainable range.`, 35));
      } else {
        out.push(
          card(
            'weight',
            'tip',
            'Weight is holding steady',
            `Your trend has been flat (${formatWeightDelta(rate, units)}/week) over the last 4 weeks. Check portion sizes on calorie-dense foods (oils, nuts, sauces, drinks), add 2,000 daily steps, or lower your target by 100–150 kcal.`,
            70
          )
        );
      }
    } else if (profile.goal === 'gain' && rate < 0.05) {
      out.push(card('weight', 'tip', 'Not gaining yet', 'Your trend is flat or down. Add about 200 kcal/day, ideally from protein and complex carbs.', 60));
    } else if (profile.goal === 'maintain' && Math.abs(rate) > 0.25) {
      out.push(card('weight', 'tip', 'Drifting', `You're trending ${formatWeightDelta(rate, units)}/week. Adjust intake slightly to stay level.`, 50));
    }
    if (profile.goalWeightKg) {
      const eta = projectGoalDate(trend[trend.length - 1].trend, profile.goalWeightKg, rate, now);
      if (eta) {
        out.push(
          card(
            'weight',
            'tip',
            'Projected goal date',
            `At your current trend you'd reach ${formatWeight(profile.goalWeightKg, units)} around ${eta.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}.`,
            30
          )
        );
      }
    }
  } else {
    out.push(card('weight', 'tip', 'Weigh in regularly', 'With weigh-ins over about 1 week, you\'ll get a smoothed trend, a weekly rate and a goal projection.', 15));
  }

  // ---- Profile-level ----
  const b = bmi(profile.weightKg, profile.heightCm);
  const range = healthyWeightRange(profile.heightCm);
  if (b) {
    out.push(
      card(
        'general',
        'tip',
        `BMI ${b}`,
        `Healthy BMI range for your height: ${formatWeight(range.min, units)} – ${formatWeight(range.max, units)}. BMI doesn't account for muscle; use it as a rough guide only.`,
        12
      )
    );
  }
  if (isPaceClamped(profile)) {
    out.push(
      card(
        'general',
        'warn',
        'Pace limited for safety',
        `Your chosen pace would put you below ${minimumCalories(profile.sex)} kcal/day, so your target is held at that minimum. A slower pace is more sustainable.`,
        60
      )
    );
  }

  return out.filter((c) => state.profile.waterTracking !== false || c.area !== 'water').sort((a, b2) => b2.priority - a.priority);
}

// Last-N-days streak for "logged something" days.
export function loggingStreak(state, now = new Date()) {
  let streak = 0;
  const keys = lastNDays(365, now).reverse();
  for (let i = 0; i < keys.length; i++) {
    const d = state.days[keys[i]];
    const logged = d && ((d.food && d.food.length) || (d.water && d.water.length) || (d.exercise && d.exercise.length));
    if (logged) streak++;
    else if (i === 0) continue; // today not logged yet doesn't break the streak
    else break;
  }
  return streak;
}

export const protocolLabel = (key) => protocolByKey(key).label;
