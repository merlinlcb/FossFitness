import React, { useState } from 'react';
import { View, ScrollView, Text, Pressable } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Card, Txt, Button, Segmented, NumberField, TextField, TimeRow, ChipRow, Row } from '../components/ui';
import { HeightField, WeightField, SexPicker, ActivityPicker, GoalPicker } from '../components/ProfileFields';
import { calorieTarget, macroTargets, waterGoal, isProfileComplete } from '../lib/calc';
import { PROTOCOLS } from '../lib/fasting';
import { formatWater } from '../lib/units';
import { requestPermission } from '../lib/notifications';
import { formatTime12 } from '../lib/dates';
import { useHub } from '../state/hub';
import AccountCard from '../components/AccountCard';
import ExerciseGoalEditor from '../components/ExerciseGoalEditor';
import { MyExercisesSheet } from '../components/MyExercises';
import { myExerciseIds } from '../lib/workoutPlan';

const STEPS = ['welcome', 'body', 'goal', 'move', 'schedule', 'group', 'done'];
const at = (name) => STEPS.indexOf(name);

export default function OnboardingScreen() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const { auth } = useHub();
  const [step, setStep] = useState(0);
  // Came from "I already have an account": after signing in, carry on with the rest of setup.
  const [restoring, setRestoring] = useState(false);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const look = { mode: 'dark', darkFrom: '20:00', darkUntil: '07:00', ...(state.profile.appearance || {}) };
  // Appearance applies right away so the rest of setup is shown in it.
  const setLook = (mode) => {
    set({ appearance: { ...look, mode } });
    dispatch({ type: 'SET_PROFILE', patch: { appearance: { ...look, mode } } });
  };
  const [p, setP] = useState({ ...state.profile });
  const [fast, setFast] = useState({ enabled: state.fasting.enabled, protocol: state.fasting.protocol, windowStart: state.fasting.windowStart });
  const set = (patch) => setP((x) => ({ ...x, ...patch }));
  const name = STEPS[step];

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const reenrolling = !!state.profile.reenrolling;
  const finish = async () => {
    dispatch({ type: 'SET_PROFILE', patch: { ...p, onboarded: false, reenrolling: false } });
    // Re-enrolling: only log a weigh-in if the weight was changed.
    if (!reenrolling || Math.abs((p.weightKg || 0) - (state.profile.weightKg || 0)) > 0.05) dispatch({ type: 'ADD_WEIGHT', kg: p.weightKg });
    dispatch({ type: 'SET_FASTING', patch: fast });
    try {
      await requestPermission();
    } catch {
      // ignore: user can enable later in Settings
    }
    dispatch({ type: 'SET_PROFILE', patch: { onboarded: true } });
  };

  const kcal = calorieTarget(p);
  const macros = macroTargets(p, kcal);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? t.primary : t.track }} />
        ))}
      </View>

      {name === 'welcome' && (
        <View>
          <Text style={{ fontSize: 52, marginBottom: 6 }}>💪</Text>
          <Txt size={30} weight="800">{reenrolling ? 'Re-enroll' : 'FossFitness'}</Txt>
          <Txt dim size={16} style={{ marginTop: 6, lineHeight: 23 }}>
            Food, water, workouts, fasting and weight in one place, turned into a game you play with friends.
          </Txt>
          <Card style={{ marginTop: 18 }}>
            <Feature icon="🎯" title="Clear daily targets" text="Rings for calories, protein, water and exercise, worked out from your own numbers." />
            <Feature icon="🏅" title="Level up" text="Earn XP for good days, keep streaks going and collect medals." />
            <Feature icon="💬" title="Better together" text="Chat, compare progress and race your group on weekly XP. These need a group server; everything else works on its own." />
            <Feature icon="🔒" title="Yours" text="No ads, no analytics. Data lives on this phone, and on your group's own server only if you join one." last />
          </Card>
          <TextField label="What should we call you? (optional)" value={p.name} onChangeText={(v) => set({ name: v })} placeholder="Your name" />
          <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>Look</Txt>
          <Segmented
            options={[
              { key: 'dark', label: '🌙 Dark' },
              { key: 'light', label: '☀️ Light' },
              { key: 'system', label: '📱 Phone' },
            ]}
            value={look.mode === 'schedule' ? 'system' : look.mode}
            onChange={setLook}
          />
          <Txt faint size={12} style={{ marginTop: 6 }}>You can also switch by time of day later in Settings → App settings.</Txt>
          <Button title={reenrolling ? 'Start' : 'Get started'} onPress={next} style={{ marginTop: 16 }} />
          {reenrolling ? (
            <Pressable
              onPress={() => dispatch({ type: 'SET_PROFILE', patch: { onboarded: true, reenrolling: false } })}
              style={{ paddingVertical: 14, alignItems: 'center' }}
            >
              <Txt color={t.primary} weight="700">Cancel and go back to the app</Txt>
            </Pressable>
          ) : !auth ? (
            <Pressable
              onPress={() => {
                setRestoring(true);
                setStep(at('group'));
              }}
              style={{ paddingVertical: 14, alignItems: 'center' }}
            >
              <Txt color={t.primary} weight="700">I already have an account</Txt>
            </Pressable>
          ) : null}
        </View>
      )}

      {name === 'body' && (
        <View>
          <Txt size={24} weight="800" style={{ marginBottom: 4 }}>
            About you
          </Txt>
          <Txt dim style={{ marginBottom: 16 }}>
            Used to estimate your calorie, protein and water needs.
          </Txt>
          <Segmented
            options={[
              { key: 'imperial', label: 'lb / ft / oz' },
              { key: 'metric', label: 'kg / cm / ml' },
            ]}
            value={p.units}
            onChange={(v) => set({ units: v, waterUnit: v === 'metric' ? 'ml' : 'oz' })}
          />
          <View style={{ height: 14 }} />
          <SexPicker value={p.sex} onChange={(v) => set({ sex: v })} />
          <NumberField label="Age" value={p.age} decimals={false} suffix="years" onChange={(v) => set({ age: v })} />
          <HeightField heightCm={p.heightCm} units={p.units} onChange={(v) => set({ heightCm: v })} />
          <WeightField label="Current weight" kg={p.weightKg} units={p.units} onChange={(v) => set({ weightKg: v })} />
          <Nav back={back} next={next} disabled={!isProfileComplete(p)} />
        </View>
      )}

      {name === 'goal' && (
        <View>
          <Txt size={24} weight="800" style={{ marginBottom: 16 }}>
            Your goal
          </Txt>
          <GoalPicker goal={p.goal} pace={p.paceKgPerWeek} onGoal={(v) => set({ goal: v })} onPace={(v) => set({ paceKgPerWeek: v })} />
          {p.goal !== 'maintain' && <WeightField label="Goal weight (optional)" kg={p.goalWeightKg} units={p.units} onChange={(v) => set({ goalWeightKg: v })} />}
          <ActivityPicker value={p.activityLevel} onChange={(v) => set({ activityLevel: v })} />
          <Nav back={back} next={next} />
        </View>
      )}

      {name === 'move' && (
        <View>
          <Txt size={24} weight="800" style={{ marginBottom: 4 }}>
            Moving
          </Txt>
          <Txt dim style={{ marginBottom: 12 }}>
            Set an exercise goal for the ring on Today, and pick the exercises you do so logging takes a tap.
          </Txt>
          <Card title="Exercise goal">
            <ExerciseGoalEditor />
          </Card>
          <Card title="My exercises">
            <Txt dim size={14} style={{ marginBottom: 10 }}>
              {myExerciseIds(state.workoutPlan).length
                ? `${myExerciseIds(state.workoutPlan).length} switched on.`
                : 'Gym lifts, home moves, cardio, sports and classes. Switch on the ones you do.'}
            </Txt>
            <Button variant="secondary" title="Choose exercises" onPress={() => setExercisesOpen(true)} />
          </Card>
          {exercisesOpen ? <MyExercisesSheet onClose={() => setExercisesOpen(false)} /> : null}
          <Nav back={back} next={next} />
        </View>
      )}

      {name === 'schedule' && (
        <View>
          <Txt size={24} weight="800" style={{ marginBottom: 4 }}>
            Your day
          </Txt>
          <Txt dim style={{ marginBottom: 12 }}>
            Reminders only arrive while you're awake.
          </Txt>
          <Card>
            <TimeRow label="Wake up" value={p.wakeTime} onChange={(v) => set({ wakeTime: v })} />
            <TimeRow label="Bedtime" value={p.sleepTime} onChange={(v) => set({ sleepTime: v })} />
          </Card>
          <Card title="Intermittent fasting">
            <Segmented
              options={[
                { key: true, label: 'Yes, track it' },
                { key: false, label: 'Not now' },
              ]}
              value={fast.enabled}
              onChange={(v) => setFast((f) => ({ ...f, enabled: v }))}
            />
            {fast.enabled && (
              <View style={{ marginTop: 12 }}>
                <ChipRow
                  options={PROTOCOLS.filter((x) => x.key !== 'custom').map((x) => ({ key: x.key, label: x.label }))}
                  value={fast.protocol}
                  onChange={(v) => setFast((f) => ({ ...f, protocol: v }))}
                  color={t.fasting}
                />
                <Txt faint size={12} style={{ marginTop: 6 }}>
                  New to fasting? 12:12 or 14:10 are great places to start.
                </Txt>
                <TimeRow label="Eating window starts" value={fast.windowStart} onChange={(v) => setFast((f) => ({ ...f, windowStart: v }))} />
              </View>
            )}
          </Card>
          <Nav back={back} next={next} />
        </View>
      )}

      {name === 'group' && (
        <View>
          <Txt size={24} weight="800" style={{ marginBottom: 4 }}>
            {restoring ? 'Welcome back' : 'Join your group'}
          </Txt>
          <Txt dim style={{ marginBottom: 12, lineHeight: 21 }}>
            {restoring
              ? 'Sign in and your history and settings download to this phone.'
              : 'Got an invite code? Create an account to back up your history, race each other on weekly XP and chat. You can skip this and do it later in Settings.'}
          </Txt>
          {!restoring && (
            <Card>
              <Txt weight="700" size={15} style={{ marginBottom: 6 }}>☁️ What needs a server</Txt>
              <Txt dim size={13} style={{ lineHeight: 19 }}>
                Chat, Compare, shared notes, the weekly XP race and shared custom foods only work while you're signed in to a group server.
                To use them, the app sends what you log to that server so the group can see it. Backup and restore on a new phone also use it.
              </Txt>
              <Txt weight="700" size={15} style={{ marginTop: 10, marginBottom: 6 }}>📱 What works without one</Txt>
              <Txt dim size={13} style={{ lineHeight: 19 }}>
                Everything else, on this phone only: logging, targets and rings, Quests (XP, levels, streaks, daily quests) and your medals, reminders, and backup files you export yourself.
              </Txt>
            </Card>
          )}
          <AccountCard />
          {auth ? (
            <Txt color={t.primary} weight="700" style={{ marginTop: 4 }}>
              ✓ Signed in.{restoring ? ' If you set up the app before, it opens as soon as your settings arrive.' : ''}
            </Txt>
          ) : null}
          <Nav
            back={() => {
              if (restoring) {
                setRestoring(false);
                setStep(0);
              } else back();
            }}
            next={() => {
              if (restoring) {
                setRestoring(false);
                setStep(at('body'));
              } else next();
            }}
            nextLabel={auth ? 'Continue' : restoring ? 'Set up as new instead' : 'Skip for now'}
          />
        </View>
      )}

      {name === 'done' && (
        <View>
          <Txt size={24} weight="800" style={{ marginBottom: 4 }}>
            Your plan
          </Txt>
          <Txt dim style={{ marginBottom: 12 }}>
            You can change any of this later in Settings.
          </Txt>
          <Card>
            <Row label="Daily calories" value={`${kcal} kcal`} />
            <Row label="Protein" value={`${macros.protein} g`} />
            <Row label="Carbs / fat" value={`${macros.carbs} g / ${macros.fat} g`} />
            <Row label="Water" value={formatWater(waterGoal(p, 0), p.waterUnit)} />
            {fast.enabled && <Row label="Fasting" value={`${PROTOCOLS.find((x) => x.key === fast.protocol)?.label} from ${formatTime12(fast.windowStart)}`} />}
          </Card>
          <Card title="Finding your way">
            <Feature icon="👆" title="Swipe between pages" text="Or tap the bar at the bottom: Today, Nutrition, Train, Progress, Social and Settings." />
            <Feature icon="🏠" title="Today" text="Your rings and a checklist that ticks itself off as you log." />
            <Feature icon="🏅" title="Social → Quests" text="Daily quests, XP, your level and your medal collection." last />
          </Card>
          <Txt faint size={12} style={{ marginBottom: 12, lineHeight: 18 }}>
            Next, Android will ask to allow notifications so you can get water, meal and fasting reminders. They are made on your phone.
          </Txt>
          <Nav back={back} next={finish} nextLabel="Start tracking" />
        </View>
      )}
    </ScrollView>
  );
}

function Nav({ back, next, disabled, nextLabel = 'Continue' }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
      <Button variant="secondary" title="Back" onPress={back} />
      <Button style={{ flex: 1 }} title={nextLabel} onPress={next} disabled={disabled} />
    </View>
  );
}

function Feature({ icon, title, text, last }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: last ? 0 : 12 }}>
      <Text style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Txt weight="700" size={15}>{title}</Txt>
        <Txt dim size={13} style={{ lineHeight: 19 }}>{text}</Txt>
      </View>
    </View>
  );
}
