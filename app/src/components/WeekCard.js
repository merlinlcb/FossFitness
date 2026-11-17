// Monday to Sunday on the training plan: what's planned (or what you did), what's
// done, and the weekly activity goals. Shown on Progress; tapping a day opens it on Train.
import React, { useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Card, Txt, ProgressBar } from './ui';
import { weekMetrics } from '../lib/metrics';
import { dayKey, addDays, parseDayKey } from '../lib/dates';
import { WEEKLY_ACTIVE_GOAL, WEEKLY_STRENGTH_DAYS_GOAL } from '../lib/exercise';
import { weekKey } from '../lib/game';
import { isCustomPlan, exerciseById, scheduleForDate, sessionFor } from '../lib/workoutPlan';

// Monday to Sunday: what's planned (or what you did), what's done, and the weekly activity goals.
export default function WeekCard({ now, day, setDay }) {
  const t = useTheme();
  const { state } = useStore();
  const plan = state.workoutPlan;
  const custom = isCustomPlan(plan);
  const today = dayKey(now);
  const monday = weekKey(today);
  const keys = [0, 1, 2, 3, 4, 5, 6].map((i) => dayKey(addDays(parseDayKey(monday), i)));
  const week = useMemo(() => weekMetrics(state, now), [state, now]);

  return (
    <Card title="📅 This week">
      {keys.map((k) => {
        const w = (state.days[k] || {}).workout || {};
        const s = sessionFor(k, w, plan);
        const what = custom
          ? (w.items || []).map((id) => (exerciseById(id, plan) || {}).name).filter(Boolean).join(', ') || (k <= today ? '—' : '')
          : s.rest
            ? scheduleForDate(k, plan).title
            : s.title;
        const future = k > today;
        return (
          <Pressable
            key={k}
            disabled={future}
            onPress={() => setDay(k)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: t.border, opacity: future ? 0.6 : 1 }}
          >
            <Txt weight={k === day ? '800' : '600'} color={k === day ? t.primary : t.text} style={{ width: 92 }}>
              {parseDayKey(k).toLocaleDateString(undefined, { weekday: 'short' })}
              {k === today ? ' · today' : ''}
            </Txt>
            <Txt dim size={13} style={{ flex: 1 }} numberOfLines={1}>{what}</Txt>
            <Txt color={w.done ? t.good : t.textFaint}>{w.done ? '✓' : '·'}</Txt>
          </Pressable>
        );
      })}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 }}>
        <Txt size={14}>Active minutes (last 7 days)</Txt>
        <Txt dim size={14} weight="600">{Math.round(week.totalActiveMinutes)} / {WEEKLY_ACTIVE_GOAL}</Txt>
      </View>
      <ProgressBar value={week.totalActiveMinutes} max={WEEKLY_ACTIVE_GOAL} color={t.exercise} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 4 }}>
        <Txt size={14}>Strength days</Txt>
        <Txt dim size={14} weight="600">{week.strengthDays} / {WEEKLY_STRENGTH_DAYS_GOAL}</Txt>
      </View>
      <ProgressBar value={week.strengthDays} max={WEEKLY_STRENGTH_DAYS_GOAL} color={t.protein} />
    </Card>
  );
}
