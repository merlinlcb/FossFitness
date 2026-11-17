// Progress, top to bottom: weight (chart, history, weigh in), the food log streak and
// the exercise log streak (a calendar week at a time), and this week's training plan.
import React, { useMemo, useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Screen, Card, Txt, Button, Sheet, Segmented, Empty, Row } from '../components/ui';
import LineChart from '../components/LineChart';
import WeekCard from '../components/WeekCard';
import { WeightField } from '../components/ProfileFields';
import { weightTrend, weightRate } from '../lib/metrics';
import { bmi, bmiCategory, projectGoalDate } from '../lib/calc';
import { dayKey, addDays, parseDayKey, formatShortDate, formatClock } from '../lib/dates';
import { formatWeight, formatWeightDelta, weightToDisplay } from '../lib/units';
import { weekOf, foodLogged, exerciseSplit, exerciseLogged, currentRun, bestRun } from '../lib/logStreaks';

const RANGES = [
  { key: 7, label: '1w' },
  { key: 30, label: '1mo' },
  { key: 182, label: '6mo' },
  { key: 0, label: 'All time' },
];

// Exercise log colours: weight training and cardio.
const STRENGTH = '#3B82F6';
const CARDIO = '#EF4444';

export default function ProgressScreen({ goTo, sub }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const { profile } = state;
  const units = profile.units;
  const [range, setRange] = useState(30);
  // Opened from Today's goals with sub 'weigh': start with the weigh-in sheet open.
  const [logOpen, setLogOpen] = useState(sub === 'weigh');
  const [logKg, setLogKg] = useState(profile.weightKg);
  const [logDate, setLogDate] = useState(dayKey());
  const [historyOpen, setHistoryOpen] = useState(false);
  // The weigh-in being edited from the history (null: a new weigh-in).
  const [editing, setEditing] = useState(null);

  const trend = useMemo(() => weightTrend(state.weights), [state.weights]);
  const rate = useMemo(() => weightRate(state.weights), [state.weights]);

  const cutoff = range ? dayKey(addDays(new Date(), -range)) : '0000';
  const shown = trend.filter((w) => w.date >= cutoff);
  const points = shown.map((w) => ({ x: parseDayKey(w.date).getTime(), y: weightToDisplay(w.kg, units), y2: weightToDisplay(w.trend, units) }));
  const latestTrend = trend.length ? trend[trend.length - 1].trend : profile.weightKg;
  // The latest weigh-in (what the scale said), shown as "Current weight".
  const currentKg = trend.length ? trend[trend.length - 1].kg : profile.weightKg;
  const first = trend.length ? trend[0].kg : null;
  const eta = profile.goalWeightKg && rate ? projectGoalDate(latestTrend, profile.goalWeightKg, rate) : null;
  const b = bmi(profile.weightKg, profile.heightCm);

  const openWeighIn = (w) => {
    setEditing(w || null);
    setLogKg(w ? w.kg : profile.weightKg);
    setLogDate(w ? w.date : dayKey());
    setLogOpen(true);
  };
  const saveWeighIn = () => {
    if (editing) dispatch({ type: 'UPDATE_WEIGHT', id: editing.id, kg: logKg, date: logDate });
    else dispatch({ type: 'ADD_WEIGHT', kg: logKg, date: logDate });
    setLogOpen(false);
    setEditing(null);
  };
  const deleteWeighIn = (w) =>
    Alert.alert('Delete weigh-in?', `${formatShortDate(w.date)}: ${formatWeight(w.kg, units)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'REMOVE_WEIGHT', id: w.id });
          setLogOpen(false);
          setEditing(null);
        },
      },
    ]);

  return (
    <Screen>
      {/* Weight */}
      <Card
        title="⚖️ Weight"
        right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button small variant="secondary" title="History" disabled={!state.weights.length} onPress={() => setHistoryOpen(true)} />
            <Button small color={t.weight} title="Weigh in" onPress={() => openWeighIn(null)} />
          </View>
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View>
            <Txt faint size={12}>
              Current weight
            </Txt>
            <Txt size={24} weight="800">
              {formatWeight(currentKg, units)}
            </Txt>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Txt faint size={12}>
              Weekly rate
            </Txt>
            <Txt size={18} weight="700" color={rate == null ? t.textDim : profile.goal === 'lose' ? (rate < 0 ? t.good : t.warn) : t.text}>
              {rate == null ? '—' : formatWeightDelta(rate, units)}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt faint size={12}>
              Total change
            </Txt>
            <Txt size={18} weight="700">
              {first != null ? formatWeightDelta(latestTrend - first, units) : '—'}
            </Txt>
          </View>
        </View>
        {trend.length >= 2 ? (
          <>
            {points.length >= 2 ? (
              <LineChart
                points={points}
                color={t.weight}
                trendColor={t.weight}
                goal={profile.goalWeightKg ? weightToDisplay(profile.goalWeightKg, units) : null}
                yLabel={units === 'metric' ? 'kg' : 'lb'}
                formatY={(v) => v.toFixed(0)}
                formatX={(x) => formatShortDate(new Date(x))}
              />
            ) : (
              <Empty>Fewer than 2 weigh-ins in this range. Try a longer one.</Empty>
            )}
            <View style={{ marginTop: 8 }}>
              <Segmented options={RANGES} value={range} onChange={setRange} />
            </View>
            <Txt faint size={11} style={{ marginTop: 6 }}>
              Dots are weigh-ins. The bold line is your smoothed trend, which filters out daily water swings.
              {profile.goalWeightKg ? ' The dashed line is your goal.' : ''}
            </Txt>
          </>
        ) : (
          <Empty>Weigh in at least twice to see your chart.</Empty>
        )}
        <View style={{ marginTop: 8 }}>
          {profile.goalWeightKg ? (
            <Row
              label="Goal"
              value={`${formatWeight(profile.goalWeightKg, units)} (${formatWeightDelta(profile.goalWeightKg - latestTrend, units)} to go)`}
            />
          ) : (
            <Row label="Goal weight" value="Set in Settings → Physical profile" />
          )}
          {eta && <Row label="Projected" value={eta.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} />}
          {b ? <Row label="BMI" value={`${b} · ${bmiCategory(b)}`} /> : null}
        </View>
      </Card>

      <FoodStreak />
      <ExerciseStreak />
      <WeekCard now={new Date()} day={dayKey()} setDay={(k) => goTo && goTo('move', { day: k })} />

      <Sheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title="Weigh-in history">
        {[...state.weights].reverse().map((w) => (
          <Pressable
            key={w.id}
            onPress={() => {
              setHistoryOpen(false);
              openWeighIn(w);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: t.border }}
          >
            <View style={{ flex: 1 }}>
              <Txt>{formatShortDate(w.date)}</Txt>
              {w.t ? <Txt faint size={12}>{formatClock(w.t)}{w.fromHC ? ' · Health Connect' : ''}</Txt> : null}
            </View>
            <Txt weight="700" style={{ marginRight: 12 }}>{formatWeight(w.kg, units)}</Txt>
            <Txt color={t.primary}>✎</Txt>
          </Pressable>
        ))}
        <Txt faint size={12} style={{ marginTop: 8 }}>Tap a weigh-in to change or delete it.</Txt>
      </Sheet>

      <Sheet
        visible={logOpen}
        onClose={() => {
          setLogOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit weigh-in' : 'Weigh in'}
        footer={
          <View style={{ gap: 8 }}>
            <Button color={t.weight} title="Save" disabled={!logKg} onPress={saveWeighIn} />
            {editing && <Button variant="ghost" color={t.danger} title="Delete this weigh-in" onPress={() => deleteWeighIn(editing)} />}
          </View>
        }
      >
        <WeightField kg={logKg} units={units} onChange={setLogKg} />
        <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
          Date
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button small variant="secondary" title="‹" onPress={() => setLogDate(dayKey(addDays(parseDayKey(logDate), -1)))} />
          <Txt weight="600">{logDate === dayKey() ? 'Today' : formatShortDate(logDate)}</Txt>
          <Button small variant="secondary" title="›" disabled={logDate >= dayKey()} onPress={() => setLogDate(dayKey(addDays(parseDayKey(logDate), 1)))} />
        </View>
        <Txt faint size={12} style={{ marginTop: 10 }}>
          Saving on a date that already has a weigh-in replaces it.
        </Txt>
      </Sheet>
    </Screen>
  );
}

// "‹ Nov 9 – 15 ›": step through calendar weeks, never past this one.
function WeekNav({ offset, setOffset, keys }) {
  const label = offset === 0 ? 'This week' : offset === 1 ? 'Last week' : `${formatShortDate(keys[0])} – ${formatShortDate(keys[6])}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Button small variant="ghost" title="‹" onPress={() => setOffset(offset + 1)} />
      <Pressable onPress={() => setOffset(0)} disabled={offset === 0} style={{ alignItems: 'center' }}>
        <Txt size={15} weight="700">{label}</Txt>
        {offset > 1 ? null : <Txt faint size={11}>{formatShortDate(keys[0])} – {formatShortDate(keys[6])}</Txt>}
      </Pressable>
      <Button small variant="ghost" title="›" disabled={offset === 0} onPress={() => setOffset(offset - 1)} />
    </View>
  );
}

function StreakLine({ current, best, unit, color }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
      <View>
        <Txt size={30} weight="900" color={current ? color : undefined}>🔥 {current}</Txt>
        <Txt faint size={12}>{current === 1 ? `day in a row` : `days in a row`} {unit}</Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Txt size={18} weight="700">{best}</Txt>
        <Txt faint size={12}>best run</Txt>
      </View>
    </View>
  );
}

// Which days of the week had food logged. No meal details, just whether you logged.
function FoodStreak() {
  const t = useTheme();
  const { state } = useStore();
  const today = dayKey();
  const [offset, setOffset] = useState(0);
  const keys = weekOf(today, offset);
  const logged = (k) => foodLogged(state, k);
  const count = keys.filter((k) => k <= today && logged(k)).length;
  const sofar = keys.filter((k) => k <= today).length;
  return (
    <Card title="🍽️ Food log streak">
      <StreakLine current={currentRun(logged, today)} best={bestRun(state, logged)} unit="with food logged" color={t.food} />
      <WeekNav offset={offset} setOffset={setOffset} keys={keys} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {keys.map((k) => {
          const future = k > today;
          const on = !future && logged(k);
          return (
            <View key={k} style={{ alignItems: 'center', flex: 1 }}>
              <Txt faint size={11} weight={k === today ? '800' : '500'} color={k === today ? t.text : undefined}>
                {parseDayKey(k).toLocaleDateString(undefined, { weekday: 'narrow' })}
              </Txt>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  marginTop: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? t.food : 'transparent',
                  borderWidth: k === today ? 2 : 1.5,
                  borderColor: on ? t.food : k === today ? t.text : t.border,
                  opacity: future ? 0.35 : 1,
                }}
              >
                <Txt size={14} weight="800" color={on ? '#1A1200' : t.textFaint}>{on ? '✓' : parseDayKey(k).getDate()}</Txt>
              </View>
            </View>
          );
        })}
      </View>
      <Txt faint size={12} style={{ marginTop: 10 }}>
        {count} of {sofar} day{sofar === 1 ? '' : 's'} logged {offset === 0 ? 'so far this week' : 'that week'}.
      </Txt>
    </Card>
  );
}

// Calories burned exercising each day of the week: blue for weight training, red for cardio.
function ExerciseStreak() {
  const t = useTheme();
  const { state } = useStore();
  const today = dayKey();
  const [offset, setOffset] = useState(0);
  const keys = weekOf(today, offset);
  const logged = (k) => exerciseLogged(state, k);
  const split = keys.map((k) => exerciseSplit(state, k));
  const max = Math.max(1, ...split.map((d) => d.total));
  const H = 120;
  const week = split.reduce((a, d) => ({ strength: a.strength + d.strength, cardio: a.cardio + d.cardio }), { strength: 0, cardio: 0 });
  return (
    <Card title="🏋️ Exercise log streak">
      <StreakLine current={currentRun(logged, today)} best={bestRun(state, logged)} unit="with exercise logged" color={t.exercise} />
      <WeekNav offset={offset} setOffset={setOffset} keys={keys} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H + 14 }}>
        {keys.map((k, i) => {
          const d = split[i];
          const hS = (d.strength / max) * H;
          const hC = (d.cardio / max) * H;
          return (
            <View key={k} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {d.total > 0 ? <Txt faint size={9} style={{ marginBottom: 2 }}>{d.total}</Txt> : null}
              <View style={{ width: '58%', borderRadius: 4, overflow: 'hidden' }}>
                {d.cardio > 0 && <View style={{ height: Math.max(3, hC), backgroundColor: CARDIO }} />}
                {d.strength > 0 && <View style={{ height: Math.max(3, hS), backgroundColor: STRENGTH }} />}
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {keys.map((k) => (
          <Txt key={k} size={11} center weight={k === today ? '800' : '400'} color={k === today ? t.text : t.textFaint} style={{ flex: 1 }}>
            {parseDayKey(k).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </Txt>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
        <Legend color={STRENGTH} label={`Weight training · ${week.strength} kcal`} />
        <Legend color={CARDIO} label={`Cardio · ${week.cardio} kcal`} />
      </View>
      {week.strength + week.cardio === 0 && <Txt faint size={12} center style={{ marginTop: 8 }}>No exercise logged {offset === 0 ? 'this week yet' : 'that week'}.</Txt>}
    </Card>
  );
}

function Legend({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, marginRight: 6 }} />
      <Txt dim size={12}>{label}</Txt>
    </View>
  );
}
