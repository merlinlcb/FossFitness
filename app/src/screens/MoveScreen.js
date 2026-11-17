// The Train tab, top to bottom: today's activity and steps, which plan you're on,
// the day's workout and its exercises, and (on the suggested plan) the exercise
// library. The week's overview lives on Progress. Plan choices live in Settings → Training.
import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Screen, Card, Txt, Button, Sheet, Chip, Stepper, NumberField, Segmented, Empty, useNow } from '../components/ui';
import { dayMetrics } from '../lib/metrics';
import { dayKey, addDays, parseDayKey, formatDayLabel, formatClock } from '../lib/dates';
import { ACTIVITIES, INTENSITIES, activityByKey, effectiveMet } from '../lib/exercise';
import { exerciseCalories } from '../lib/calc';
import { formatWater } from '../lib/units';
import { MyExercisesSheet } from '../components/MyExercises';
import { ExerciseCard, ExerciseSheet, repText } from './WorkoutPlanView';
import {
  GROUPS,
  TRAINING_TIPS,
  SUGGESTED_PLANS,
  SUBGROUPS,
  isCustomPlan,
  suggestedKind,
  suggestedExercises,
  myExerciseIds,
  previousWorkout,
  subgroupOf,
  exerciseById,
  scheduleForDate,
  sessionFor,
  motivationFor,
} from '../lib/workoutPlan';

const DURATIONS = [10, 15, 20, 30, 45, 60, 90];

export default function MoveScreen({ sub, goTo, day: openDay }) {
  const t = useTheme();
  const { state } = useStore();
  const now = useNow(60000);
  const today = dayKey(now);
  // Opened on a given day (from the week on Progress), or today.
  const [day, setDay] = useState(openDay && openDay <= today ? openDay : today);
  const [libraryEx, setLibraryEx] = useState(null);
  const [pickOpen, setPickOpen] = useState(false);
  // Opened from Today's to-do list with sub 'steps': start with the steps sheet open.
  const [stepsOpen, setStepsOpen] = useState(sub === 'steps');

  const plan = state.workoutPlan;
  const custom = isCustomPlan(plan);
  const planLabel = custom ? 'My own' : `Suggested · ${(SUGGESTED_PLANS.find((p) => p.key === suggestedKind(plan)) || {}).label}`;

  return (
    <Screen>
      <ActivityToday stepsOpen={stepsOpen} setStepsOpen={setStepsOpen} />

      <Pressable
        onPress={() => goTo && goTo('settings', { sub: 'training' })}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 }}
      >
        <Txt dim size={14}>
          Plan: <Txt weight="700">{planLabel}</Txt>
        </Txt>
        <Txt color={t.primary} size={14} weight="600">Change ›</Txt>
      </Pressable>

      {/* Day navigator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Button small variant="ghost" title="‹" onPress={() => setDay(dayKey(addDays(parseDayKey(day), -1)))} />
        <Pressable onPress={() => setDay(today)} disabled={day === today}>
          <Txt size={16} weight="700">
            {formatDayLabel(day, today)} · {parseDayKey(day).toLocaleDateString(undefined, { weekday: 'long' })}
          </Txt>
        </Pressable>
        <Button small variant="ghost" title="›" disabled={day >= today} onPress={() => setDay(dayKey(addDays(parseDayKey(day), 1)))} />
      </View>

      <WorkoutDay day={day} today={today} onOpenExercise={setLibraryEx} onPick={() => setPickOpen(true)} />

      {!custom && <Library onOpen={setLibraryEx} />}

      {libraryEx && <ExerciseSheet ex={libraryEx} units={state.profile.units} onClose={() => setLibraryEx(null)} />}
      {pickOpen && <MyExercisesSheet onClose={() => setPickOpen(false)} />}
    </Screen>
  );
}

// The day's workout: what's planned (or what you did, on "My own"), each exercise to log, and Done.
function WorkoutDay({ day, today, onOpenExercise, onPick }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const plan = state.workoutPlan;
  const custom = isCustomPlan(plan);
  const log = (state.days[day] || {}).workout || {};
  const sched = scheduleForDate(day, plan);
  const session = sessionFor(day, log, plan);
  const items = session.items.map((id) => exerciseById(id, plan)).filter(Boolean);
  const mine = custom ? myExerciseIds(plan).map((id) => exerciseById(id, plan)).filter(Boolean) : [];
  const notYet = mine.filter((e) => !session.items.includes(e.id));
  const prev = custom ? previousWorkout(state.days, day) : null;
  const yesterdayKey = dayKey(addDays(parseDayKey(day), -1));

  const doneBadge = log.done ? <Txt color={t.good} weight="700">✓ Done</Txt> : null;

  return (
    <>
      {custom && !mine.length ? (
        <Card title="Pick your exercises">
          <Txt dim size={14} style={{ marginBottom: 10, lineHeight: 20 }}>
            Switch on the exercises you do (bench press, squats, curls, pull-ups, rowing and more, or add your own). Then
            log the ones you did each day here.
          </Txt>
          <Button title="Choose my exercises" onPress={onPick} />
        </Card>
      ) : custom ? (
        <Card title={`🏋️ ${items.length ? session.title : day === today ? 'What did you do today?' : 'What did you do?'}`} right={doneBadge}>
          {prev && !items.length && (
            <>
              <Button
                title={`↺ Use ${prev.day === yesterdayKey ? "yesterday's" : `${formatDayLabel(prev.day, today)}'s`} exercises`}
                style={{ marginBottom: 6 }}
                onPress={() => dispatch({ type: 'COPY_WORKOUT', fromDay: prev.day, toDay: day })}
              />
              <Txt faint size={12} style={{ marginBottom: 10 }}>
                Fills in {prev.workout.items.map((id) => (exerciseById(id, plan) || {}).name).filter(Boolean).join(', ')} ; last time's numbers show as hints, and "Same as last time" fills them in once you've done them.
              </Txt>
            </>
          )}
          <Txt dim size={13} style={{ marginBottom: 6 }}>{items.length ? 'Add another:' : 'Tap the exercises you did:'}</Txt>
          {SUBGROUPS.map((g) => {
            const list = notYet.filter((e) => subgroupOf(e) === g.key);
            if (!list.length) return null;
            return (
              <View key={g.key} style={{ marginBottom: 6 }}>
                <Txt faint size={11} weight="700" style={{ marginBottom: 4 }}>{g.label.toUpperCase()}</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {list.map((e) => (
                    <Chip key={e.id} label={`＋ ${e.name}`} onPress={() => dispatch({ type: 'ADD_WORKOUT_ITEM', day, exerciseId: e.id })} />
                  ))}
                </View>
              </View>
            );
          })}
          {!notYet.length && <Txt faint size={12}>All your exercises are added.</Txt>}
          <Button small variant="ghost" title="✎ My exercises" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 4 }} onPress={onPick} />
        </Card>
      ) : (
        <Card title={session.rest ? '😌 Rest day' : `🏋️ ${session.title}`} right={doneBadge}>
          {sched.options.length > 1 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {sched.options.map((o) => (
                <Chip key={o.key} label={o.title} selected={session.key === o.key} onPress={() => dispatch({ type: 'SET_WORKOUT', day, patch: { choice: o.key } })} />
              ))}
            </View>
          )}
          <Txt dim size={13}>
            {session.rest
              ? 'Recovery is part of the plan. A gentle walk is fine if you feel like it.'
              : 'Tap an exercise for its video and history. Log your sets as you go; the grey numbers are what you did last time.'}
          </Txt>
          <Txt size={13} color={t.primary} style={{ marginTop: 8, fontStyle: 'italic' }}>
            “{motivationFor(parseDayKey(day))}”
          </Txt>
        </Card>
      )}

      {items.map((ex) => (
        <ExerciseCard
          key={ex.id}
          ex={ex}
          day={day}
          log={log}
          onOpen={() => onOpenExercise(ex)}
          onRemove={
            custom
              ? () =>
                  Alert.alert(`Remove ${ex.name}?`, 'This takes it off this day, along with any sets you logged for it.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => dispatch({ type: 'REMOVE_WORKOUT_ITEM', day, exerciseId: ex.id }) },
                  ])
              : null
          }
        />
      ))}

      {!session.rest && items.length > 0 && (
        <View style={{ marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: (log.done ? t.good : t.textFaint) + '1A' }}>
          {log.done ? (
            <Txt size={14} weight="700" color={t.good}>
              ✓ Workout logged: {workoutMinutes(state, day)} active min, {workoutKcal(state, day)} kcal. Today's workout reminders are off.
            </Txt>
          ) : (
            <Txt size={14} dim>
              Log a set or some minutes and the workout counts as done. No button to press.
            </Txt>
          )}
        </View>
      )}
    </>
  );
}

// Anything else you did today (a walk, a game of basketball…) and your steps.
function ActivityToday({ stepsOpen, setStepsOpen }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const today = dayKey();
  const m = dayMetrics(state, today);
  // Workout entries are made from the Train log above; this list is everything else.
  const others = m.day.exercise.filter((e) => !e.fromPlan);
  const [addOpen, setAddOpen] = useState(false);
  const [steps, setSteps] = useState(m.steps || null);

  return (
    <Card title="🏃 Today's activity" right={<Button small color={t.exercise} title="+ Add" onPress={() => setAddOpen(true)} />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 }}>
        <Big label="active min" value={m.exMinutes} />
        <Big label="kcal burned" value={m.exKcal} />
        <Pressable
          onPress={() => {
            setSteps(m.steps || null);
            setStepsOpen(true);
          }}
        >
          <Big label="steps ✎" value={m.steps ? m.steps.toLocaleString() : '—'} />
        </Pressable>
      </View>
      {workoutMinutes(state, today) > 0 && (
        <Txt dim size={13} style={{ marginBottom: 4 }}>
          Includes your workout: {workoutMinutes(state, today)} min, {workoutKcal(state, today)} kcal (it updates as you log).
        </Txt>
      )}
      {!others.length && <Empty>No other activity logged today.</Empty>}
      {others.map((e) => {
        const a = activityByKey(e.type);
        const confirmDelete = () =>
          Alert.alert('Delete activity?', `${e.name || a.label}, ${e.minutes} min`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => dispatch({ type: 'REMOVE_EXERCISE', day: today, id: e.id }) },
          ]);
        return (
          <Pressable
            key={e.id}
            onLongPress={confirmDelete}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: t.border }}
          >
            <Text style={{ fontSize: 22, width: 36 }}>{a.icon}</Text>
            <View style={{ flex: 1 }}>
              <Txt>{e.name || a.label}</Txt>
              <Txt faint size={12}>
                {e.minutes} min · {e.intensity} · {formatClock(e.t)}
              </Txt>
            </View>
            <Txt weight="600">{e.kcal} kcal</Txt>
            <Pressable hitSlop={10} style={{ marginLeft: 12 }} onPress={confirmDelete}>
              <Txt faint>✕</Txt>
            </Pressable>
          </Pressable>
        );
      })}
      {m.exMinutes > 0 && state.profile.waterTracking !== false && (
        <Txt faint size={12} style={{ marginTop: 8 }}>
          Today's water goal went up to {formatWater(m.waterGoal, state.profile.waterUnit)} for your activity.
        </Txt>
      )}

      {addOpen && <AddActivitySheet onClose={() => setAddOpen(false)} />}
      <Sheet
        visible={stepsOpen}
        onClose={() => setStepsOpen(false)}
        title="Steps today"
        footer={
          <Button
            color={t.exercise}
            title="Save"
            onPress={() => {
              dispatch({ type: 'SET_STEPS', day: today, steps: steps || 0 });
              setStepsOpen(false);
            }}
          />
        }
      >
        <NumberField label="Steps (from your phone or watch)" value={steps} onChange={setSteps} decimals={false} autoFocus />
        <Txt faint size={12}>
          {state.healthConnect && state.healthConnect.enabled && state.healthConnect.steps
            ? 'Steps come from Health Connect and refresh when you open the app, so a number typed here is replaced at the next sync.'
            : 'Typed in by hand. To fill this in automatically from your phone or watch, connect Health Connect in Settings → App settings.'}
        </Txt>
      </Sheet>
    </Card>
  );
}

// The suggested plan's exercises, with tips. Collapsed until you want it.
function Library({ onOpen }) {
  const t = useTheme();
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const list = suggestedExercises(state.workoutPlan);
  return (
    <Card title={`📚 Exercises in this plan (${list.length})`} onPress={() => setOpen((v) => !v)} right={<Txt color={t.primary}>{open ? '▲' : '▼'}</Txt>}>
      {open && (
        <>
          {GROUPS.map((g) => {
            const rows = list.filter((e) => e.group === g.key);
            if (!rows.length) return null;
            return (
              <View key={g.key} style={{ marginBottom: 8 }}>
                <Txt faint size={11} weight="700" style={{ marginTop: 6, marginBottom: 2 }}>{g.label.toUpperCase()}</Txt>
                {rows.map((ex) => (
                  <Pressable key={ex.id} onPress={() => onOpen(ex)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
                    <View style={{ flex: 1 }}>
                      <Txt>{ex.name}</Txt>
                      <Txt faint size={12} numberOfLines={2}>{repText(ex)}{ex.notes ? ` · ${ex.notes}` : ''}</Txt>
                    </View>
                    <Txt faint>›</Txt>
                  </Pressable>
                ))}
              </View>
            );
          })}
          <Txt weight="700" style={{ marginTop: 8, marginBottom: 4 }}>Tips</Txt>
          {TRAINING_TIPS.map((r, i) => (
            <Txt key={i} dim size={13} style={{ marginTop: 3, lineHeight: 19 }}>• {r}</Txt>
          ))}
        </>
      )}
    </Card>
  );
}

function Big({ label, value }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt size={22} weight="800">{value}</Txt>
      <Txt faint size={12}>{label}</Txt>
    </View>
  );
}

function AddActivitySheet({ onClose }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const [type, setType] = useState('walk');
  const [minutes, setMinutes] = useState(30);
  const [intensity, setIntensity] = useState('moderate');
  const [kcalOverride, setKcalOverride] = useState(null);
  const est = exerciseCalories(effectiveMet(type, intensity), state.profile.weightKg, minutes);
  const kcal = kcalOverride != null ? kcalOverride : est;

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Add activity"
      footer={
        <Button
          color={t.exercise}
          title={`Add · ${kcal} kcal`}
          disabled={!minutes}
          onPress={() => {
            dispatch({ type: 'ADD_EXERCISE', entry: { type, minutes, intensity, kcal: Math.round(kcal || 0) } });
            onClose();
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ACTIVITIES.map((a) => (
          <Chip key={a.key} label={`${a.icon} ${a.label}`} selected={type === a.key} color={t.exercise} onPress={() => setType(a.key)} />
        ))}
      </View>
      <Txt dim size={13} weight="600" style={{ marginTop: 14, marginBottom: 6 }}>
        Duration
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {DURATIONS.map((d) => (
          <Chip key={d} label={`${d}m`} selected={minutes === d} color={t.exercise} onPress={() => setMinutes(d)} />
        ))}
      </View>
      <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <Stepper value={minutes} onChange={setMinutes} step={5} min={1} max={600} format={(v) => `${v} min`} />
      </View>
      <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
        Intensity
      </Txt>
      <Segmented options={INTENSITIES} value={intensity} onChange={setIntensity} />
      <View style={{ marginTop: 14 }}>
        <NumberField
          label={`Calories burned (estimated ${est}; edit if your watch says otherwise)`}
          value={kcalOverride}
          placeholder={String(est)}
          onChange={setKcalOverride}
          decimals={false}
          suffix="kcal"
        />
      </View>
    </Sheet>
  );
}

// Active minutes and calories the day's workout log adds.
const workoutEntries = (state, day) => (((state.days[day] || {}).exercise) || []).filter((e) => e.fromPlan);
const workoutMinutes = (state, day) => workoutEntries(state, day).reduce((a, e) => a + (e.minutes || 0), 0);
const workoutKcal = (state, day) => workoutEntries(state, day).reduce((a, e) => a + (e.kcal || 0), 0);
