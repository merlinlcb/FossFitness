import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Screen, Card, Ring, ProgressBar, Txt, Button, SuggestionCard, SectionTitle, Sheet, Stepper, NumberField, useNow } from '../components/ui';
import { dayMetrics, waterPaceTarget } from '../lib/metrics';
import { todaySuggestions, loggingStreak } from '../lib/insights';
import { dayKey, formatHMS, formatClock } from '../lib/dates';
import { formatWater } from '../lib/units';
import { todoList } from '../lib/overview';
import { exerciseProgress } from '../lib/exerciseGoal';
import { eatingWindow, stageFor, fastHoursFor } from '../lib/fasting';
import { sessionFor, scheduleForDate, motivationFor, sessionSummary, stepGoal, DAILY_GOALS } from '../lib/workoutPlan';

function greeting(h) {
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen({ goTo }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const now = useNow(30000);
  const { profile, fasting } = state;
  const m = useMemo(() => dayMetrics(state, dayKey(now)), [state, now]);
  const suggestions = useMemo(() => todaySuggestions(state, now).slice(0, 2), [state, now]);
  const waterOn = profile.waterTracking !== false;
  const exGoal = useMemo(() => exerciseProgress(state, now), [state, now]);
  // Rings shrink a little when four share the row.
  const ringCount = 2 + (waterOn ? 1 : 0) + (exGoal.enabled ? 1 : 0);
  const ring = ringCount >= 4 ? 80 : 100;
  const ringStroke = ringCount >= 4 ? 8 : 10;
  const streak = useMemo(() => loggingStreak(state, now), [state, now]);
  const wu = profile.waterUnit;
  const paceTarget = waterPaceTarget(profile, m.waterGoal, now);
  const kcalLeft = m.kcalTarget - m.food.kcal;
  // The Daily goals sheet (sleep / steps / baseline) lives here so the to-do list can open it too.
  const [goalSheet, setGoalSheet] = useState(null);
  const [goalVal, setGoalVal] = useState(null);
  const openGoalSheet = (which, v) => {
    setGoalVal(v);
    setGoalSheet(which);
  };
  const todos = useMemo(() => todoList(state, now), [state, now]);
  const openTodo = (item) => {
    if (item.place === 'sleep') {
      const h = (state.days[dayKey(now)] || {}).sleepHours;
      openGoalSheet('sleep', h != null ? h : 7);
    } else if (item.place) {
      goTo(item.place, item.sub ? { sub: item.sub } : {});
    }
  };

  return (
    <Screen>
      <View style={{ marginBottom: 12, paddingHorizontal: 4 }}>
        <Txt size={20} weight="700">
          {greeting(now.getHours())}
          {profile.name ? `, ${profile.name}` : ''} 👋
        </Txt>
        <Txt dim size={14}>
          {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          {streak > 1 ? `  ·  🔥 ${streak}-day logging streak` : ''}
        </Txt>
      </View>

      {/* Rings */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Pressable onPress={() => goTo('food')} style={{ alignItems: 'center' }}>
            <Ring value={m.food.kcal} max={m.kcalTarget} color={kcalLeft < 0 ? t.warn : t.food} size={ring} stroke={ringStroke}>
              <Txt size={18} weight="800">
                {Math.abs(Math.round(kcalLeft))}
              </Txt>
              <Txt faint size={11}>
                {kcalLeft >= 0 ? 'kcal left' : 'kcal over'}
              </Txt>
            </Ring>
            <Txt dim size={12} style={{ marginTop: 6 }}>
              {Math.round(m.food.kcal)} / {m.baseKcalTarget}
            </Txt>
            {m.kcalTarget > m.baseKcalTarget ? (
              <Txt size={12} weight="700" color={t.exercise}>
                🏃 +{m.kcalTarget - m.baseKcalTarget} exercise
              </Txt>
            ) : null}
          </Pressable>
          {waterOn && (
          <Pressable onPress={() => goTo('water')} style={{ alignItems: 'center' }}>
            <Ring value={m.water} max={m.waterGoal} color={t.water} size={ring} stroke={ringStroke}>
              <Txt size={18} weight="800">
                {Math.round((m.water / m.waterGoal) * 100)}%
              </Txt>
              <Txt faint size={11}>
                water
              </Txt>
            </Ring>
            <Txt dim size={12} style={{ marginTop: 6 }}>
              {formatWater(m.water, wu)} / {formatWater(m.waterGoal, wu)}
            </Txt>
          </Pressable>
          )}
          <Pressable onPress={() => goTo('food')} style={{ alignItems: 'center' }}>
            <Ring value={m.food.protein} max={m.macros.protein} color={t.protein} size={ring} stroke={ringStroke}>
              <Txt size={18} weight="800">
                {Math.round(m.food.protein)}g
              </Txt>
              <Txt faint size={11}>
                protein
              </Txt>
            </Ring>
            <Txt dim size={12} style={{ marginTop: 6 }}>
              goal {m.macros.protein}g
            </Txt>
          </Pressable>
          {exGoal.enabled && (
            <Pressable onPress={() => goTo('move')} style={{ alignItems: 'center' }} accessibilityLabel={`Exercise goal: ${exGoal.value} of ${exGoal.target} ${exGoal.short}`}>
              <Ring value={exGoal.value} max={exGoal.target} color={exGoal.done ? t.good : t.exercise} size={ring} stroke={ringStroke}>
                <Txt size={ring < 90 ? 16 : 18} weight="800">
                  {exGoal.done ? '✓' : exGoal.left.toLocaleString()}
                </Txt>
                <Txt faint size={11}>
                  {exGoal.done ? 'goal met' : `${exGoal.unit === 'workouts' ? 'to go' : `${exGoal.unit} left`}`}
                </Txt>
              </Ring>
              <Txt dim size={12} style={{ marginTop: 6 }}>
                {exGoal.value} / {exGoal.target} {exGoal.unit === 'workouts' ? 'this wk' : exGoal.weekly ? `${exGoal.unit} wk` : exGoal.unit}
              </Txt>
            </Pressable>
          )}
        </View>
      </Card>

      <DailyGoalsCard state={state} dispatch={dispatch} m={m} now={now} sheet={goalSheet} setSheet={setGoalSheet} val={goalVal} setVal={setGoalVal} />
      <TodoCard items={todos} onOpen={openTodo} />

      {suggestions.length > 0 && (
        <>
          <SectionTitle>Suggestions for right now</SectionTitle>
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} item={s} />
          ))}
        </>
      )}

      <WorkoutTodayCard state={state} goTo={goTo} />

      {/* Quick water */}
      {waterOn && (
      <Card
        title="💧 Quick water"
        right={
          <Txt dim size={13} color={m.water >= paceTarget ? t.good : t.warn}>
            {m.water >= m.waterGoal ? 'Goal reached' : m.water >= paceTarget ? 'On pace' : `${formatWater(paceTarget - m.water, wu)} behind`}
          </Txt>
        }
      >
        <ProgressBar value={m.water} max={m.waterGoal} color={t.water} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {state.waterPresets.slice(0, 3).map((p) => (
            <Button
              key={p.id}
              small
              variant="secondary"
              color={t.water}
              style={{ flex: 1 }}
              title={`${p.icon} +${formatWater(p.ml, wu)}`}
              onPress={() => dispatch({ type: 'ADD_WATER', ml: p.ml, label: p.label })}
            />
          ))}
        </View>
      </Card>
      )}

      {/* Fasting */}
      {fasting.enabled && <FastingMini state={state} dispatch={dispatch} goTo={goTo} />}

    </Screen>
  );
}

export function FastingMini({ state, dispatch, goTo }) {
  const t = useTheme();
  const now = useNow(1000);
  const { fasting } = state;
  const active = fasting.active;
  if (active) {
    const elapsed = now - new Date(active.start);
    const hrs = elapsed / 3600000;
    const stage = stageFor(hrs);
    const endAt = new Date(new Date(active.start).getTime() + active.targetHours * 3600000);
    return (
      <Card title="⏱️ Fasting" right={<Button small variant="ghost" title="Details ›" onPress={() => goTo('fast')} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: t.fasting, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatHMS(elapsed)}</Text>
            <Txt dim size={13}>
              {stage.icon} {stage.label} · goal {active.targetHours}h at {formatClock(endAt)}
            </Txt>
          </View>
          <Button small color={t.fasting} title="End" onPress={() => dispatch({ type: 'END_FAST' })} />
        </View>
        <ProgressBar value={hrs} max={active.targetHours} color={t.fasting} style={{ marginTop: 12 }} />
      </Card>
    );
  }
  const w = eatingWindow(fasting, now);
  return (
    <Card title="⏱️ Fasting" right={<Button small variant="ghost" title="Details ›" onPress={() => goTo('fast')} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Txt size={16} weight="700">
            {w.isOpen ? 'Eating window open' : 'Eating window closed'}
          </Txt>
          <Txt dim size={13}>
            {w.isOpen ? `Closes at ${formatClock(w.close)}` : `Opens at ${formatClock(w.open)}`}
          </Txt>
        </View>
        <Button
          small
          color={t.fasting}
          title={`Start ${fastHoursFor(fasting)}h fast`}
          onPress={() => dispatch({ type: 'START_FAST', targetHours: fastHoursFor(fasting) })}
        />
      </View>
    </Card>
  );
}

function WorkoutTodayCard({ state, goTo }) {
  const t = useTheme();
  const key = dayKey();
  const log = (state.days[key] || {}).workout || {};
  const session = sessionFor(key, log, state.workoutPlan);
  const sched = scheduleForDate(key, state.workoutPlan);
  return (
    <Card
      title={`🏋️ Today: ${sched.title}`}
      onPress={() => goTo('move')}
      right={log.done ? <Txt color={t.good} weight="700">✓ Done</Txt> : <Txt color={t.primary} weight="600">Open ›</Txt>}
    >
      <Txt dim size={13}>
        {sessionSummary(session, state.workoutPlan)}
      </Txt>
      <Txt size={13} color={t.primary} style={{ marginTop: 8, fontStyle: 'italic' }}>
        “{motivationFor(new Date())}”
      </Txt>
    </Card>
  );
}

function DailyGoalsCard({ state, dispatch, m, now, sheet, setSheet, val, setVal }) {
  const t = useTheme();
  const key = dayKey(now);
  const { profile, workoutPlan } = state;
  const sGoal = stepGoal(workoutPlan.stepPlan, now);
  const sleep = (state.days[key] || {}).sleepHours;
  const pMin = profile.proteinGoal || m.macros.protein;
  const pMax = profile.proteinGoalMax || pMin;
  const sleepGoal = workoutPlan.sleepGoal || DAILY_GOALS.sleepHours;

  const GoalRow = ({ icon, label, value, goalText, pct, color, onPress, action }) => (
    <Pressable onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Txt size={14}>
          {icon} {label}
        </Txt>
        <Txt dim size={13}>
          {value} <Txt faint size={12}>{goalText}</Txt> {action ? <Txt color={t.primary} size={13}>{action}</Txt> : null}
        </Txt>
      </View>
      <ProgressBar value={pct} max={1} color={pct >= 1 ? t.good : color} height={8} />
    </Pressable>
  );

  return (
    <Card title="🎯 Daily goals">
      <GoalRow
        icon="🥩"
        label="Protein"
        value={`${Math.round(m.food.protein)} g`}
        goalText={pMax > pMin ? `/ ${pMin}–${pMax} g` : `/ ${pMin} g`}
        pct={m.food.protein / pMin}
        color={t.protein}
      />
      {sGoal ? (
        <GoalRow
          icon="👣"
          label="Steps"
          value={m.steps.toLocaleString()}
          goalText={`/ ${sGoal.toLocaleString()}`}
          pct={m.steps / sGoal}
          color={t.exercise}
          action="✎"
          onPress={() => {
            setVal(m.steps || null);
            setSheet('steps');
          }}
        />
      ) : (
        <GoalRow
          icon="👣"
          label="Steps"
          value={m.steps ? m.steps.toLocaleString() : '—'}
          goalText=""
          pct={0}
          color={t.exercise}
          action="Set baseline"
          onPress={() => {
            setVal(m.steps || null);
            setSheet('baseline');
          }}
        />
      )}
      <GoalRow
        icon="😴"
        label="Sleep last night"
        value={sleep != null ? `${sleep} h` : '—'}
        goalText={`/ ${sleepGoal}+ h`}
        pct={(sleep || 0) / sleepGoal}
        color={t.water}
        action="✎"
        onPress={() => {
          setVal(sleep != null ? sleep : 7);
          setSheet('sleep');
        }}
      />

      <Sheet
        visible={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet === 'sleep' ? 'Sleep last night' : sheet === 'baseline' ? 'Your step baseline' : 'Steps today'}
        footer={
          <Button
            title="Save"
            disabled={sheet !== 'sleep' && !val}
            onPress={() => {
              if (sheet === 'sleep') dispatch({ type: 'SET_SLEEP', day: key, hours: val });
              else if (sheet === 'steps') dispatch({ type: 'SET_STEPS', day: key, steps: val || 0 });
              else dispatch({ type: 'SET_WORKOUT_PLAN', patch: { stepPlan: { baseline: Math.round(val), startDate: key } } });
              setSheet(null);
            }}
          />
        }
      >
        {sheet === 'sleep' ? (
          <View style={{ alignItems: 'center' }}>
            <Stepper value={val || 0} onChange={setVal} step={0.5} min={0} max={14} format={(v) => `${v} h`} />
          </View>
        ) : sheet === 'baseline' ? (
          <>
            <NumberField label="How many steps do you usually get per day?" value={val} onChange={setVal} decimals={false} autoFocus />
            <Txt faint size={12}>
              Check your phone's health app or your watch for a typical day. Your goal starts here and goes up by 500 steps each week.
            </Txt>
          </>
        ) : (
          <NumberField label="Steps (from your phone or watch)" value={val} onChange={setVal} decimals={false} autoFocus />
        )}
      </Sheet>
    </Card>
  );
}

// Today's list: open items first (tap to go and do them), finished ones stay below, struck through.
function TodoCard({ items, onOpen }) {
  const t = useTheme();
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const shown = [...open, ...done];
  return (
    <Card
      title="✅ Still to do today"
      right={<Txt dim size={13}>{done.length} of {items.length} done</Txt>}
    >
      <ProgressBar value={done.length} max={items.length || 1} color={open.length ? t.primary : t.good} height={6} style={{ marginBottom: 6 }} />
      {!open.length && <Txt size={15} weight="600" color={t.good} style={{ paddingVertical: 6 }}>All done for today 🎉</Txt>}
      {shown.map((i) => (
        <Pressable
          key={i.id}
          onPress={() => onOpen(i)}
          disabled={!i.place || i.done}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: t.border, opacity: pressed ? 0.6 : 1 })}
        >
          <Txt size={18} style={{ width: 30 }}>{i.done ? '✔️' : i.icon}</Txt>
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="600" color={i.done ? t.textFaint : t.text} style={i.done ? { textDecorationLine: 'line-through' } : null}>{i.label}</Txt>
            <Txt faint size={12}>{i.detail}</Txt>
          </View>
          {!i.done && i.place ? <Txt color={t.primary} size={18}>›</Txt> : null}
        </Pressable>
      ))}
    </Card>
  );
}
