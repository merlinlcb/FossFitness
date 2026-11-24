// Settings: a menu of sections, each on its own page. The open page is the
// Settings tab's `sub` (goTo('settings', { sub: 'training' })), so other screens
// can link straight to a section and Android back returns to the menu.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Switch, Alert, Linking, Pressable, AppState } from 'react-native';
import Constants from 'expo-constants';
import { useStore } from '../state/store';
import { useHub } from '../state/hub';
import { useTheme } from '../theme';
import { Screen, Card, Txt, Button, Row, TimeRow, ChipRow, Segmented, NumberField, TextField, SectionTitle } from '../components/ui';
import { HeightField, WeightField, SexPicker, ActivityPicker, GoalPicker } from '../components/ProfileFields';
import { calorieTarget, suggestedCalorieTarget, hasOwnCalorieGoal, macroTargets, suggestedMacros, waterGoal, bmr, tdee, isPaceClamped, minimumCalories } from '../lib/calc';
import { formatWater } from '../lib/units';
import { getPermissionStatus, requestPermission, sendTestNotification, rescheduleAll, cancelAll } from '../lib/notifications';
import { exportBackup, pickBackup, exportCsv } from '../lib/backup';
import { selfTestScanner } from '../lib/labelOcr';
import { HealthSettingsPage } from '../components/HealthTrackers';
import MoveToFossFitnessCard from '../components/MoveToFossFitness';
import { IS_LEGACY } from '../lib/migration';
import { stepGoal, myExerciseIds, SUGGESTED_PLANS, suggestedKind } from '../lib/workoutPlan';
import { protocolLabel } from '../lib/insights';
import { dayKey } from '../lib/dates';
import AccountCard from '../components/AccountCard';
import InviteCard from '../components/InviteCard';
import { MyExercisesSheet } from '../components/MyExercises';
import { START_PAGES } from '../lib/overview';
import { HC_TYPES } from '../lib/healthConnectMap';
import { hcStatus, hcConnect, hcGranted, hcOpenSettings } from '../lib/healthConnect';
import { syncHealthConnect } from '../state/hcSync';
import ExerciseGoalEditor from '../components/ExerciseGoalEditor';
import { WEEKDAYS, weighInDay, isWeeklyWeighIn } from '../lib/weighIn';

// `parent`: pages nested inside another page (back goes there, not to the menu);
// they don't show in the menu.
const SECTIONS = [
  { key: 'profile', icon: '👤', label: 'Physical profile', desc: 'Name, body stats, goal and sleep' },
  { key: 'training', icon: '🏋️', label: 'Training', desc: 'Your plan, exercises and steps' },
  { key: 'nutrition', icon: '🍽️', label: 'Nutrition', desc: 'Calories, macros, water and fasting' },
  { key: 'trackers', icon: '🩺', label: 'Health trackers', desc: 'Optional: medications, and charts for blood pressure, blood sugar or anything you measure' },
  { key: 'reminders', icon: '🔔', label: 'Notifications and reminders', desc: 'Every reminder, plus chat notifications' },
  { key: 'app', icon: '📱', label: 'App settings', desc: 'Appearance, default page, units, cloud sync, Health Connect and your data' },
  { key: 'sync', icon: '☁️', label: 'Cloud sync', parent: 'app' },
  { key: 'health', icon: '📲', label: 'Health Connect', parent: 'app' },
];
// The old Health Tracker app only exists to move people to FossFitness; health trackers aren't synced,
// so they'd be left behind, and aren't offered there.
const MENU = SECTIONS.filter((s) => !s.parent && !(IS_LEGACY && s.key === 'trackers'));

// Where Android back goes from a settings page: its parent page, or the menu (null).
export const settingsParent = (sub) => (SECTIONS.find((s) => s.key === sub) || {}).parent || null;

export default function SettingsScreen({ sub, goTo }) {
  const t = useTheme();
  const section = SECTIONS.find((s) => s.key === sub);
  if (!section) return <Menu goTo={goTo} />;
  const Page = { profile: ProfilePage, training: TrainingPage, nutrition: NutritionPage, health: HealthConnectPage, sync: CloudSyncPage, reminders: RemindersPage, app: AppPage, trackers: HealthSettingsPage }[section.key];
  const parent = section.parent && SECTIONS.find((s) => s.key === section.parent);
  return (
    <Screen>
      <Pressable
        onPress={() => goTo('settings', parent ? { sub: parent.key } : {})}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 }}
      >
        <Txt size={15} weight="600" color={t.primary}>‹ {parent ? parent.label : 'Settings'}</Txt>
      </Pressable>
      <Txt size={22} weight="800" style={{ marginBottom: 10, paddingHorizontal: 4 }}>
        {section.icon} {section.label}
      </Txt>
      <Page goTo={goTo} />
    </Screen>
  );
}

function Menu({ goTo }) {
  const t = useTheme();
  const perm = usePermission();
  return (
    <Screen>
      <MoveToFossFitnessCard />
      {perm.status !== 'granted' && <PermissionBanner perm={perm} />}
      <Card>
        {MENU.map((s, i) => (
          <Pressable
            key={s.key}
            onPress={() => goTo('settings', { sub: s.key })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: i < MENU.length - 1 ? 0.5 : 0,
              borderBottomColor: t.border,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Txt size={22} style={{ width: 38 }}>{s.icon}</Txt>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Txt size={16} weight="700">{s.label}</Txt>
              <Txt faint size={12}>{s.desc}</Txt>
            </View>
            <Txt faint size={20}>›</Txt>
          </Pressable>
        ))}
      </Card>
      <InviteCard />
      <Txt faint size={12} center style={{ marginTop: 6 }}>
        FossFitness v{Constants.expoConfig?.version || '2'}
        {Constants.expoConfig?.android?.versionCode ? ` (build ${Constants.expoConfig.android.versionCode})` : ''}
        {'\n'}Estimates are for general wellness, not medical advice.
      </Txt>
    </Screen>
  );
}

// ---------- shared bits ----------

function useActions() {
  const { state, dispatch } = useStore();
  return {
    state,
    dispatch,
    setProfile: (patch) => dispatch({ type: 'SET_PROFILE', patch }),
    setReminder: (key, patch) => dispatch({ type: 'SET_REMINDER', key, patch }),
    setPlan: (patch) => dispatch({ type: 'SET_WORKOUT_PLAN', patch }),
  };
}

function usePermission() {
  const [status, setStatus] = useState('undetermined');
  useEffect(() => {
    getPermissionStatus().then(setStatus).catch(() => {});
  }, []);
  return { status, setStatus };
}

function PermissionBanner({ perm }) {
  const t = useTheme();
  const { state } = useStore();
  return (
    <Card style={{ borderColor: t.warn + '88', borderWidth: 1 }}>
      <Txt color={t.warn} size={14} style={{ marginBottom: 8 }}>
        Notifications are off, so reminders can't be shown.
      </Txt>
      <Button
        small
        title="Allow notifications"
        onPress={async () => {
          const s = await requestPermission();
          perm.setStatus(s);
          if (s === 'granted') rescheduleAll(state);
          else Linking.openSettings();
        }}
      />
    </Card>
  );
}

function ToggleRow({ label, sub, value, onChange }) {
  const t = useTheme();
  return <Row label={label} sub={sub} right={<Switch value={!!value} onValueChange={onChange} trackColor={{ true: t.primary }} />} />;
}

function Label({ children, first }) {
  return (
    <Txt dim size={13} weight="600" style={{ marginTop: first ? 0 : 12, marginBottom: 6 }}>
      {children}
    </Txt>
  );
}

// ---------- Profile ----------

function ProfilePage() {
  const t = useTheme();
  const { state, dispatch, setProfile, setPlan } = useActions();
  const { profile } = state;
  return (
    <>
      <SectionTitle>About you</SectionTitle>
      <Card>
        <TextField label="Name (optional)" value={profile.name} onChangeText={(v) => setProfile({ name: v })} placeholder="What should we call you?" />
        <SexPicker value={profile.sex} onChange={(v) => setProfile({ sex: v })} />
        <NumberField label="Age" value={profile.age} decimals={false} suffix="years" onChange={(v) => v && setProfile({ age: v })} />
        <HeightField heightCm={profile.heightCm} units={profile.units} onChange={(v) => setProfile({ heightCm: v })} />
        <WeightField
          label="Current weight (updates from weigh-ins)"
          kg={profile.weightKg}
          units={profile.units}
          onChange={(v) => v && dispatch({ type: 'ADD_WEIGHT', kg: v })}
        />
        <ActivityPicker value={profile.activityLevel} onChange={(v) => setProfile({ activityLevel: v })} />
        {profile.sex === 'female' && (
          <View style={{ marginBottom: 12 }}>
            <Label first>Pregnancy / breastfeeding</Label>
            <ChipRow
              options={[
                { key: 'none', label: 'Neither' },
                { key: 'pregnant', label: 'Pregnant' },
                { key: 'breastfeeding', label: 'Breastfeeding' },
              ]}
              value={profile.pregnancy}
              onChange={(v) => setProfile({ pregnancy: v })}
            />
            {profile.pregnancy !== 'none' && (
              <Txt color={t.warn} size={12} style={{ marginTop: 6 }}>
                Calorie deficits and fasting aren't recommended right now. Please follow your doctor's guidance.
              </Txt>
            )}
          </View>
        )}
      </Card>

      <SectionTitle>Your goal</SectionTitle>
      <Card>
        <WeightField label="Goal weight (optional)" kg={profile.goalWeightKg} units={profile.units} onChange={(v) => setProfile({ goalWeightKg: v })} />
        <GoalPicker goal={profile.goal} pace={profile.paceKgPerWeek} onGoal={(v) => setProfile({ goal: v })} onPace={(v) => setProfile({ paceKgPerWeek: v })} />
        <Txt faint size={12}>Your calorie and macro targets follow from this. Change them under Nutrition.</Txt>
      </Card>

      <SectionTitle>Sleep and your day</SectionTitle>
      <Card>
        <TimeRow label="Wake up" value={profile.wakeTime} onChange={(v) => setProfile({ wakeTime: v })} />
        <TimeRow label="Bedtime" value={profile.sleepTime} onChange={(v) => setProfile({ sleepTime: v })} />
        <NumberField
          label="Sleep goal"
          value={state.workoutPlan.sleepGoal}
          suffix="hours"
          style={{ marginTop: 10 }}
          onChange={(v) => v && setPlan({ sleepGoal: v })}
        />
        <Txt faint size={12}>Reminders only come between your wake-up time and bedtime, and your water pace is spread across those hours.</Txt>
      </Card>

    </>
  );
}

// ---------- Training ----------

function TrainingPage({ goTo }) {
  const t = useTheme();
  const { state, setPlan } = useActions();
  const { workoutPlan: plan } = state;
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const custom = plan.mode === 'custom';
  const kind = suggestedKind(plan);
  return (
    <>
      <SectionTitle>Exercise goal</SectionTitle>
      <Card>
        <ExerciseGoalEditor />
      </Card>

      <SectionTitle>Your plan</SectionTitle>
      <Card>
        <Segmented
          options={[
            { key: 'suggested', label: 'Suggested' },
            { key: 'custom', label: 'My own' },
          ]}
          value={custom ? 'custom' : 'suggested'}
          onChange={(v) => setPlan({ mode: v })}
        />
        <Txt dim size={13} style={{ marginTop: 10, lineHeight: 19 }}>
          {custom
            ? 'You choose. Each day on the Train tab, pick the exercises you did from your list and log your sets.'
            : 'The app lays out each day of the week for you: what to do, how many sets and reps, with videos. You just log your sets.'}
        </Txt>
        {!custom && (
          <>
            <Label>Where do you train?</Label>
            {SUGGESTED_PLANS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => setPlan({ suggested: p.key })}
                style={{
                  borderWidth: 1.5,
                  borderColor: kind === p.key ? t.primary : t.border,
                  backgroundColor: kind === p.key ? t.primary + '14' : 'transparent',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Txt weight="700">{kind === p.key ? '● ' : '○ '}{p.label}</Txt>
                <Txt dim size={13} style={{ marginTop: 2 }}>{p.desc}</Txt>
              </Pressable>
            ))}
          </>
        )}
        {custom && (
          <Row label="🏋️ My exercises" sub="Switch on the exercises you do, or add your own" value={`${myExerciseIds(plan).length} on ›`} onPress={() => setExercisesOpen(true)} />
        )}
        <Button small variant="ghost" title="Open the Train tab ›" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 4 }} onPress={() => goTo('move')} />
        {exercisesOpen && <MyExercisesSheet onClose={() => setExercisesOpen(false)} />}
      </Card>

      <SectionTitle>Steps</SectionTitle>
      <Card>
        <NumberField
          label="Step baseline (your typical daily steps)"
          value={plan.stepPlan.baseline}
          decimals={false}
          onChange={(v) => setPlan({ stepPlan: { baseline: v || null, startDate: plan.stepPlan.startDate || dayKey() } })}
        />
        {plan.stepPlan.baseline ? (
          <Row label="Today's step goal" sub={`Goes up by 500 each week (started ${plan.stepPlan.startDate})`} value={(stepGoal(plan.stepPlan) || 0).toLocaleString()} />
        ) : (
          <Txt faint size={12}>Leave empty for no step goal.</Txt>
        )}
      </Card>

    </>
  );
}

// ---------- Nutrition (food, water, fasting) ----------

function NutritionPage({ goTo }) {
  const t = useTheme();
  const { state, dispatch, setProfile } = useActions();
  const { profile, fasting } = state;
  const kcal = calorieTarget(profile);
  const suggested = suggestedCalorieTarget(profile);
  const ownKcal = hasOwnCalorieGoal(profile);
  const macros = macroTargets(profile, kcal);
  const sm = suggestedMacros(profile, kcal);
  const waterOn = profile.waterTracking !== false;
  const MacroField = ({ k, label }) => (
    <NumberField
      style={{ flex: 1 }}
      label={label}
      value={profile[k] > 0 ? profile[k] : null}
      placeholder={`${k === 'carbsGoal' ? macros.carbs : sm[k.replace('Goal', '')]} (sugg.)`}
      decimals={false}
      suffix="g"
      onChange={(v) => setProfile({ [k]: v && v > 0 ? v : null })}
    />
  );

  return (
    <>
      <SectionTitle>Calories</SectionTitle>
      <Card>
        <Row
          label="Daily target"
          value={`${kcal} kcal`}
          sub={ownKcal ? `Your own target · suggested ${suggested} kcal` : `Suggested for your goal · BMR ${bmr(profile)} · maintenance ${tdee(profile)}`}
        />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 10 }}>
          <NumberField
            style={{ flex: 1, marginBottom: 0 }}
            label="Set my own calorie target"
            value={ownKcal ? profile.calorieGoal : null}
            placeholder={`${suggested} (suggested)`}
            decimals={false}
            suffix="kcal"
            onChange={(v) => setProfile({ calorieGoal: v && v > 0 ? v : null })}
          />
          {ownKcal && <Button small variant="secondary" title="Use suggested" onPress={() => setProfile({ calorieGoal: null })} />}
        </View>
        {ownKcal && profile.calorieGoal < minimumCalories(profile.sex) && (
          <Txt color={t.warn} size={12} style={{ marginTop: 8 }}>
            That's below {minimumCalories(profile.sex)} kcal, the usual safe minimum without a doctor's supervision. The suggested target for your goal is {suggested} kcal.
          </Txt>
        )}
        {ownKcal && tdee(profile) > 0 && profile.calorieGoal > tdee(profile) + 1000 && (
          <Txt color={t.warn} size={12} style={{ marginTop: 8 }}>
            That's more than 1,000 kcal above your estimated maintenance ({tdee(profile)} kcal), so expect to gain weight quickly.
          </Txt>
        )}
        {isPaceClamped(profile) && (
          <Txt color={t.warn} size={12} style={{ marginTop: 8 }}>
            Your pace was limited so your target doesn't fall below {minimumCalories(profile.sex)} kcal.
          </Txt>
        )}
        <Txt faint size={12} style={{ marginTop: 6 }}>
          Leave it empty to use the suggested target, which follows your weight, goal and pace (Settings → Physical profile).
        </Txt>
        <ToggleRow
          label="Add back exercise calories"
          sub="Half the calories you burn exercising are added to that day's target. You'll see it as '+ Exercise' in the calorie sum on Food and under the ring on Today"
          value={profile.eatBackExercise}
          onChange={(v) => setProfile({ eatBackExercise: v })}
        />
      </Card>

      <SectionTitle>Macros</SectionTitle>
      <Card>
        <Txt dim size={13} style={{ marginBottom: 8 }}>Type your own, or leave empty for the suggestion.</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <MacroField k="proteinGoal" label="Protein" />
          <NumberField style={{ flex: 1 }} label="Protein max (optional)" value={profile.proteinGoalMax} decimals={false} suffix="g" onChange={(v) => setProfile({ proteinGoalMax: v })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <MacroField k="carbsGoal" label="Carbs" />
          <MacroField k="fatGoal" label="Fat" />
          <MacroField k="fiberGoal" label="Fiber" />
        </View>
        {['proteinGoal', 'carbsGoal', 'fatGoal', 'fiberGoal'].some((k) => profile[k] > 0) && (
          <Button small variant="secondary" title="Use suggested macros" style={{ alignSelf: 'flex-start', marginBottom: 6 }}
            onPress={() => setProfile({ proteinGoal: null, carbsGoal: null, fatGoal: null, fiberGoal: null })} />
        )}
        <Txt faint size={12}>
          Now: protein {macros.protein} g · carbs {macros.carbs} g · fat {macros.fat} g · fiber {macros.fiber} g
          {macros.protein * 4 + macros.carbs * 4 + macros.fat * 9 > kcal * 1.1 ? `. These add up to ${macros.protein * 4 + macros.carbs * 4 + macros.fat * 9} kcal, more than your ${kcal} kcal target.` : ''}
        </Txt>
      </Card>

      <SectionTitle>Water</SectionTitle>
      <Card>
        <ToggleRow label="I track water" sub="Off hides water everywhere: rings, quests, reminders and tips" value={waterOn} onChange={(v) => setProfile({ waterTracking: v })} />
        {waterOn && (
          <>
            <Row label="Daily goal (rest day)" value={formatWater(waterGoal(profile, 0), profile.waterUnit)} sub="Goes up on days you exercise" />
            <Label>Climate</Label>
            <Segmented
              options={[
                { key: 'normal', label: 'Normal' },
                { key: 'hot', label: 'Hot / humid' },
              ]}
              value={profile.climate}
              onChange={(v) => setProfile({ climate: v })}
            />
          </>
        )}
      </Card>

      <SectionTitle>Fasting</SectionTitle>
      <Card>
        <ToggleRow label="I practice intermittent fasting" value={fasting.enabled} onChange={(v) => dispatch({ type: 'SET_FASTING', patch: { enabled: v } })} />
        {fasting.enabled && (
          <>
            <Row label="Fasting plan and eating window" sub={protocolLabel(fasting.protocol)} value="Change ›" onPress={() => goTo('fast')} />
          </>
        )}
      </Card>
    </>
  );
}

// ---------- Health Connect ----------

function HealthConnectPage() {
  const t = useTheme();
  const { state, dispatch } = useActions();
  const hc = state.healthConnect;
  const set = (patch) => dispatch({ type: 'SET_HEALTH_CONNECT', patch });
  const [status, setStatus] = useState(null);
  const [granted, setGranted] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    const st = await hcStatus();
    setStatus(st);
    if (st === 'available') setGranted(await hcGranted().catch(() => []));
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const sync = async (st = state) => {
    setBusy(true);
    setMsg('');
    const r = await syncHealthConnect(st, dispatch);
    setBusy(false);
    setMsg(r.ok ? 'Synced.' : `Couldn't sync: ${r.message}`);
  };

  const connect = async () => {
    setBusy(true);
    setMsg('');
    try {
      const got = await hcConnect(hc);
      setGranted(got);
      if (!got.length) {
        setMsg('No access was given. Tap Connect again, or allow it in the Health Connect app.');
        setBusy(false);
        return;
      }
      set({ enabled: true });
      await sync({ ...state, healthConnect: { ...hc, enabled: true } });
    } catch (e) {
      setMsg(String((e && e.message) || e));
      setBusy(false);
    }
  };

  const when = hc.lastSync ? new Date(hc.lastSync).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never';
  const missing = HC_TYPES.filter((ty) => hc[ty.key] && !granted.includes(ty.key));

  return (
    <>
      <Card>
        <Txt dim size={14} style={{ lineHeight: 20 }}>
          Health Connect is Android's shared health store. Your phone, watch, smart scale and fitness apps put steps, sleep, weight and workouts there; this app can read them so you don't have to type them in. It only reads, it never writes, and you choose what it may see.
        </Txt>
      </Card>

      {status === 'not_installed' || status === 'update_required' ? (
        <Card style={{ borderColor: t.warn + '88', borderWidth: 1 }}>
          <Txt color={t.warn} weight="700">{status === 'update_required' ? 'Health Connect needs an update' : 'Health Connect is not on this phone'}</Txt>
          <Txt dim size={13} style={{ marginTop: 4 }}>
            It's built into Android 14 and newer. On older phones, install "Health Connect" from the Play Store, then come back here.
          </Txt>
          <Button small variant="secondary" title="Open the Play Store" style={{ marginTop: 10, alignSelf: 'flex-start' }}
            onPress={() => Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() => {})} />
        </Card>
      ) : status === 'unsupported' ? (
        <Card><Txt dim>Health Connect isn't available in this version of the app on this phone.</Txt></Card>
      ) : null}

      <SectionTitle>What to read</SectionTitle>
      <Card>
        {HC_TYPES.map((ty) => (
          <ToggleRow
            key={ty.key}
            label={`${ty.label}${hc.enabled && hc[ty.key] && !granted.includes(ty.key) ? '  ⚠️ no access' : ''}`}
            sub={ty.desc}
            value={hc[ty.key]}
            onChange={(v) => set({ [ty.key]: v })}
          />
        ))}
        <Txt faint size={12} style={{ marginTop: 8, lineHeight: 17 }}>
          Steps and sleep from Health Connect replace what you typed for those days. Weigh-ins are added only on days you haven't weighed in yourself. Workouts show up under Train → Today's activity. Food and water stay as you log them here.
        </Txt>
      </Card>

      <SectionTitle>Connection</SectionTitle>
      <Card>
        {hc.enabled ? (
          <>
            <Txt size={15} weight="700" color={t.good}>✓ Connected</Txt>
            <Txt dim size={13} style={{ marginTop: 2 }}>
              Last synced {when}. It syncs the last 7 days whenever you open the app.
            </Txt>
            {hc.lastError ? <Txt color={t.warn} size={13} style={{ marginTop: 6 }}>Last problem: {hc.lastError}</Txt> : null}
            {missing.length > 0 && (
              <Button small title={`Allow ${missing.map((m) => m.label.toLowerCase()).join(', ')}`} style={{ marginTop: 10 }} disabled={busy} onPress={connect} />
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button small style={{ flex: 1 }} title={busy ? 'Syncing…' : 'Sync now'} disabled={busy} onPress={() => sync()} />
              <Button small variant="secondary" style={{ flex: 1 }} title="Disconnect" onPress={() => set({ enabled: false })} />
            </View>
          </>
        ) : (
          <Button title={busy ? 'Connecting…' : 'Connect to Health Connect'} disabled={busy || status !== 'available'} onPress={connect} />
        )}
        {msg ? <Txt size={13} dim style={{ marginTop: 8 }}>{msg}</Txt> : null}
        <Button small variant="ghost" title="Open Health Connect (change access, see which apps share data)" style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 8 }}
          onPress={hcOpenSettings} />
        <Txt faint size={12} style={{ marginTop: 4 }}>
          Disconnecting stops reading new data; anything already imported stays. To remove the app's access completely, use Health Connect → App permissions.
        </Txt>
      </Card>
    </>
  );
}

// ---------- Cloud sync (inside App settings) ----------

function CloudSyncPage() {
  const { auth } = useHub();
  const Point = ({ icon, children }) => (
    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
      <Txt size={15} style={{ width: 28 }}>{icon}</Txt>
      <Txt dim size={14} style={{ flex: 1, lineHeight: 20 }}>{children}</Txt>
    </View>
  );
  return (
    <>
      <SectionTitle>Your account</SectionTitle>
      <AccountCard />
      <Card title={auth ? "You're syncing with the group" : 'Cloud sync is optional'}>
        <Txt dim size={14} style={{ marginBottom: 12, lineHeight: 20 }}>
          {auth
            ? 'Here is what cloud sync means. Sign out above to stop; everything you logged stays on this phone.'
            : "Without an account, everything stays on this phone and nobody else sees anything. If you sign in, this is what happens:"}
        </Txt>
        <Point icon="☁️">Your logs (food, water, weigh-ins, fasts, workouts and settings) are backed up to the group's server, so a new phone gets them back.</Point>
        <Point icon="🏆">Others in the group see your level, XP, streak, badges, today's quests and whether you're fasting right now.</Point>
        <Point icon="⚖️">The Compare view shows everyone's weigh-ins and which daily goals they hit (calories, protein, water, workouts).</Point>
        <Point icon="🍎">Foods you add to the catalogue are shared with everyone, so the whole group can log them.</Point>
        <Point icon="💬">You can chat with the group on the Social tab.</Point>
        <Point icon="✉️">You can make one-time invite codes to bring a friend in (Settings → Invite someone).</Point>
        <Point icon="🔒">Others don't see your food log or meal details. The person who runs the server can see everyone's full history.</Point>
      </Card>
    </>
  );
}

// ---------- Notifications and reminders ----------

// A group of reminders that only applies when a feature is on; greyed out otherwise.
function Gated({ on, why, children }) {
  return (
    <View pointerEvents={on ? 'auto' : 'none'} style={{ opacity: on ? 1 : 0.4 }}>
      {children}
      {!on && <Txt faint size={12} style={{ marginTop: 2, marginBottom: 6 }}>{why}</Txt>}
    </View>
  );
}

function RemindersPage({ goTo }) {
  const { state, setReminder } = useActions();
  const { reminders, profile, fasting } = state;
  const { auth } = useHub();
  const perm = usePermission();
  const waterOn = profile.waterTracking !== false;
  return (
    <>
      {perm.status !== 'granted' && <PermissionBanner perm={perm} />}

      <SectionTitle>Chat</SectionTitle>
      <Card>
        <ToggleRow
          label="💬 Chat notifications"
          sub={auth ? 'A notification when someone in the group sends a chat message' : 'Only applies once you sign in to cloud sync'}
          value={reminders.chat.enabled}
          onChange={(v) => setReminder('chat', { enabled: v })}
        />
      </Card>

      <SectionTitle>Weigh-ins</SectionTitle>
      <Card>
        <ToggleRow label="⚖️ Weigh-in reminder" value={reminders.weighIn.enabled} onChange={(v) => setReminder('weighIn', { enabled: v })} />
        {reminders.weighIn.enabled && (
          <>
            <View style={{ paddingVertical: 8 }}>
              <Segmented
                options={[
                  { key: 'daily', label: 'Daily' },
                  { key: 'weekly', label: 'Once a week' },
                ]}
                value={reminders.weighIn.frequency}
                onChange={(v) => setReminder('weighIn', { frequency: v })}
              />
            </View>
            {isWeeklyWeighIn(reminders.weighIn) && (
              <View style={{ paddingBottom: 8 }}>
                <Txt dim size={13} style={{ marginBottom: 6 }}>On</Txt>
                <ChipRow
                  options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ key: d, label: WEEKDAYS[d].slice(0, 3) }))}
                  value={weighInDay(reminders.weighIn)}
                  onChange={(v) => setReminder('weighIn', { day: v })}
                />
                <Txt faint size={12} style={{ marginTop: 6 }}>
                  The weigh-in only shows up in your reminders, Today's goals and quests on {WEEKDAYS[weighInDay(reminders.weighIn)]}s. You can still weigh in any day.
                </Txt>
              </View>
            )}
            <TimeRow label="Weigh-in time" value={reminders.weighIn.time} onChange={(v) => setReminder('weighIn', { time: v })} />
          </>
        )}
      </Card>

      <SectionTitle>Training</SectionTitle>
      <Card>
        <ToggleRow
          label="🏋️ Daily workout"
          sub="Morning reminder with today's workout and a motivational message"
          value={reminders.workout.enabled}
          onChange={(v) => setReminder('workout', { enabled: v })}
        />
        {reminders.workout.enabled && (
          <>
            <TimeRow label="Workout reminder time" value={reminders.workout.time} onChange={(v) => setReminder('workout', { time: v })} />
            <ToggleRow label="Evening nudge if not done" value={reminders.workout.nudge} onChange={(v) => setReminder('workout', { nudge: v })} />
            {reminders.workout.nudge && <TimeRow label="Nudge time" value={reminders.workout.nudgeTime} onChange={(v) => setReminder('workout', { nudgeTime: v })} />}
          </>
        )}
        <ToggleRow label="🏃 Exercise" value={reminders.exercise.enabled} onChange={(v) => setReminder('exercise', { enabled: v })} sub="Skipped on days you've already logged activity" />
        {reminders.exercise.enabled && <TimeRow label="Exercise time" value={reminders.exercise.time} onChange={(v) => setReminder('exercise', { time: v })} />}
      </Card>

      <SectionTitle>Water</SectionTitle>
      <Card>
        <Gated on={waterOn} why="Water tracking is off. Turn it on in Settings → Nutrition.">
          <ToggleRow label="💧 Water reminders" value={waterOn && reminders.water.enabled} onChange={(v) => setReminder('water', { enabled: v })} sub="Says how much you need to stay on pace, and stops once you hit your goal" />
          {waterOn && reminders.water.enabled && (
            <View style={{ paddingVertical: 8 }}>
              <Txt dim size={13} style={{ marginBottom: 6 }}>Every</Txt>
              <ChipRow
                options={[45, 60, 90, 120, 180].map((m) => ({ key: m, label: m < 60 ? `${m}m` : `${m / 60}h` }))}
                value={reminders.water.intervalMin}
                onChange={(v) => setReminder('water', { intervalMin: v })}
              />
            </View>
          )}
        </Gated>
      </Card>

      <SectionTitle>Fasting</SectionTitle>
      <Card>
        <Gated on={fasting.enabled} why="Fasting is off. Turn it on in Settings → Nutrition.">
          <ToggleRow
            label="⏱️ Fasting reminders"
            sub="Window opens, 1 hour left, fast starts, halfway and goal reached"
            value={fasting.enabled && reminders.fasting.enabled}
            onChange={(v) => setReminder('fasting', { enabled: v })}
          />
        </Gated>
      </Card>

      <SectionTitle>Meals</SectionTitle>
      <Card>
        {fasting.enabled ? (
          <ToggleRow label="🍴 Meal check-in" sub="One nudge in the middle of your eating window to log meals" value={reminders.meals.enabled} onChange={(v) => setReminder('meals', { enabled: v })} />
        ) : (
          <>
            <ToggleRow label="🍴 Meal reminders" value={reminders.meals.enabled} onChange={(v) => setReminder('meals', { enabled: v })} sub="Skipped if you've already logged that meal" />
            {reminders.meals.enabled && (
              <>
                <TimeRow label="Breakfast" value={reminders.meals.breakfast} onChange={(v) => setReminder('meals', { breakfast: v })} />
                <TimeRow label="Lunch" value={reminders.meals.lunch} onChange={(v) => setReminder('meals', { lunch: v })} />
                <TimeRow label="Dinner" value={reminders.meals.dinner} onChange={(v) => setReminder('meals', { dinner: v })} />
              </>
            )}
          </>
        )}
        <ToggleRow
          label="🍽️ Food check-in"
          sub="Nudges you when nothing has been logged for a few hours while you're awake"
          value={reminders.foodGap.enabled}
          onChange={(v) => setReminder('foodGap', { enabled: v })}
        />
        {reminders.foodGap.enabled && (
          <View style={{ paddingVertical: 8 }}>
            <Txt dim size={13} style={{ marginBottom: 6 }}>After</Txt>
            <ChipRow options={[3, 4, 5, 6].map((h) => ({ key: h, label: `${h} hours` }))} value={reminders.foodGap.hours} onChange={(v) => setReminder('foodGap', { hours: v })} />
          </View>
        )}
      </Card>

      <SectionTitle>Streak and summary</SectionTitle>
      <Card>
        <ToggleRow
          label="🔥 Streak guard"
          sub="If you haven't logged anything by this time, a nudge not to break your streak (and one more before bed)"
          value={reminders.streak.enabled}
          onChange={(v) => setReminder('streak', { enabled: v })}
        />
        {reminders.streak.enabled && <TimeRow label="Streak guard time" value={reminders.streak.time} onChange={(v) => setReminder('streak', { time: v })} />}
        <ToggleRow label="📊 Evening summary" value={reminders.summary.enabled} onChange={(v) => setReminder('summary', { enabled: v })} />
        {reminders.summary.enabled && <TimeRow label="Summary time" value={reminders.summary.time} onChange={(v) => setReminder('summary', { time: v })} />}
        {perm.status === 'granted' && <Button small variant="secondary" title="Send a test notification" style={{ marginTop: 12 }} onPress={() => sendTestNotification()} />}
      </Card>
    </>
  );
}

// ---------- App settings ----------

function AppPage({ goTo }) {
  const { state, setProfile } = useActions();
  const { auth } = useHub();
  const { profile } = state;
  const hc = state.healthConnect;
  const look = { mode: 'dark', darkFrom: '20:00', darkUntil: '07:00', ...(profile.appearance || {}) };
  const setLook = (patch) => setProfile({ appearance: { ...look, ...patch } });
  return (
    <>
      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <Segmented
          options={[
            { key: 'dark', label: 'Dark' },
            { key: 'light', label: 'Light' },
            { key: 'system', label: 'Phone' },
            { key: 'schedule', label: 'Timed' },
          ]}
          value={look.mode}
          onChange={(v) => setLook({ mode: v })}
        />
        <Txt faint size={12} style={{ marginTop: 8 }}>
          {look.mode === 'system'
            ? "Follows your phone's dark mode setting."
            : look.mode === 'schedule'
              ? 'Light during the day, dark at night, between the times below.'
              : look.mode === 'light'
                ? 'Light all the time.'
                : 'Dark all the time.'}
        </Txt>
        {look.mode === 'schedule' && (
          <>
            <TimeRow label="Dark mode from" value={look.darkFrom} onChange={(v) => setLook({ darkFrom: v })} />
            <TimeRow label="Dark mode until" value={look.darkUntil} onChange={(v) => setLook({ darkUntil: v })} />
          </>
        )}
      </Card>

      <SectionTitle>Re-enroll</SectionTitle>
      <Card>
        <Txt dim size={14} style={{ lineHeight: 20, marginBottom: 10 }}>
          Go through the setup steps again: your details, goal, exercise goal, schedule and group. Your current answers are filled in, and your history, foods, meals and account stay as they are.
        </Txt>
        <Button
          variant="secondary"
          title="Re-enroll"
          onPress={() =>
            Alert.alert('Re-enroll?', 'Setup opens with your current answers filled in. Nothing is deleted.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Re-enroll', onPress: () => setProfile({ onboarded: false, reenrolling: true }) },
            ])
          }
        />
      </Card>

      <SectionTitle>Label scanner</SectionTitle>
      <ScannerTestCard />

      <SectionTitle>Default page</SectionTitle>
      <Card>
        <ChipRow
          options={START_PAGES}
          value={START_PAGES.some((p) => p.key === profile.startPage) ? profile.startPage : 'today'}
          onChange={(v) => setProfile({ startPage: v })}
        />
        <Txt faint size={12} style={{ marginTop: 8 }}>
          The page you see when you open the app. The back button also brings you here.
        </Txt>
      </Card>

      <SectionTitle>Units</SectionTitle>
      <Card>
        <Label first>Weight and height</Label>
        <Segmented
          options={[
            { key: 'imperial', label: 'lb / ft' },
            { key: 'metric', label: 'kg / cm' },
          ]}
          value={profile.units}
          onChange={(v) => setProfile({ units: v })}
        />
        <Label>Water</Label>
        <Segmented
          options={[
            { key: 'oz', label: 'fl oz' },
            { key: 'ml', label: 'ml / L' },
          ]}
          value={profile.waterUnit}
          onChange={(v) => setProfile({ waterUnit: v })}
        />
      </Card>

      <SectionTitle>Connections</SectionTitle>
      <Card>
        <Row label="☁️ Cloud sync" sub={auth ? `Signed in as ${auth.user.displayName}` : 'Not signed in. Back up, compare, shared foods and chat'} value="›" onPress={() => goTo('settings', { sub: 'sync' })} />
        <Row label="📲 Health Connect" sub={hc.enabled ? 'Connected' : 'Steps, sleep, weight and workouts from your phone or watch'} value="›" onPress={() => goTo('settings', { sub: 'health' })} />
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <DataCard />
    </>
  );
}

// ---------- Your data (inside App settings) ----------

// Reads a label image that ships with the app, so anyone can check scanning works on their phone.
function ScannerTestCard() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await selfTestScanner();
      if (r.ok) Alert.alert('Label scanner works', `Read the sample label: ${Math.round(r.parsed.kcal)} kcal, ${Math.round(r.parsed.protein)} g protein.`);
      else Alert.alert('Label scanner read it wrong', `It ran, but read:\n\n${r.text.slice(0, 400) || '(nothing)'}\n\n(build ${buildNumber()}) Send a screenshot of this.`);
    } catch (e) {
      Alert.alert('Label scanner failed', `${String((e && e.message) || e)}\n\n(build ${buildNumber()}) Send a screenshot of this.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Txt dim size={14} style={{ lineHeight: 20, marginBottom: 10 }}>
        Reads a sample Nutrition Facts label built into the app, on this phone, to check that scanning labels works.
      </Txt>
      <Button variant="secondary" title={busy ? 'Reading…' : 'Test the label scanner'} disabled={busy} onPress={run} />
    </Card>
  );
}

function buildNumber() {
  return (Constants.expoConfig && Constants.expoConfig.android && Constants.expoConfig.android.versionCode) || '?';
}

function DataCard() {
  const t = useTheme();
  const { state, dispatch } = useActions();
  return (
    <Card>
      <Txt dim size={13} style={{ marginBottom: 10, lineHeight: 19 }}>
        🔒 Unless you turn on cloud sync (Settings → App settings → Cloud sync), everything stays on this phone. There are no analytics or ads. Without an account, back up regularly, because uninstalling the app deletes its data.
      </Txt>
      <Button small variant="secondary" title="⬇ Export backup (JSON)" onPress={() => exportBackup(state).catch((e) => Alert.alert('Export failed', String(e.message || e)))} />
      <View style={{ height: 8 }} />
      <Button
        small
        variant="secondary"
        title="⬆ Restore from backup"
        onPress={async () => {
          try {
            const imported = await pickBackup();
            if (!imported) return;
            Alert.alert('Restore backup?', 'This replaces all current data in the app with the backup.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Restore',
                style: 'destructive',
                onPress: () => dispatch({ type: 'IMPORT_STATE', state: { ...imported, profile: { ...imported.profile, onboarded: true } } }),
              },
            ]);
          } catch (e) {
            Alert.alert('Import failed', String(e.message || e));
          }
        }}
      />
      <View style={{ height: 8 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small variant="secondary" style={{ flex: 1 }} title="Daily CSV" onPress={() => exportCsv(state, 'daily').catch((e) => Alert.alert('Export failed', String(e)))} />
        <Button small variant="secondary" style={{ flex: 1 }} title="Food log CSV" onPress={() => exportCsv(state, 'food').catch((e) => Alert.alert('Export failed', String(e)))} />
      </View>
      <View style={{ height: 8 }} />
      <Button small variant="secondary" title="Workout log CSV" onPress={() => exportCsv(state, 'workouts').catch((e) => Alert.alert('Export failed', String(e)))} />
      <View style={{ height: 16 }} />
      <Button
        small
        variant="ghost"
        color={t.danger}
        title="Erase all data"
        onPress={() =>
          Alert.alert('Erase everything?', 'All logs, settings and history will be permanently deleted from this phone. Export a backup first if you want to keep anything.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Erase',
              style: 'destructive',
              onPress: async () => {
                await cancelAll().catch(() => {});
                dispatch({ type: 'RESET_ALL' });
              },
            },
          ])
        }
      />
    </Card>
  );
}
