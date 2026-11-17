// Pieces of the Train tab: one exercise to log (ExerciseCard) and an exercise's
// details and progress (ExerciseSheet).
import React from 'react';
import { View, Text, Pressable, Alert, Linking } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Card, Txt, Button, Chip, NumberField, Stepper, Sheet, Empty } from '../components/ui';
import LineChart from '../components/LineChart';
import { parseDayKey, formatShortDate } from '../lib/dates';
import { weightToDisplay, weightFromDisplay, weightUnit } from '../lib/units';
import { exerciseCalories } from '../lib/calc';
import { effectiveMet, INTENSITIES } from '../lib/exercise';
import { cardioLog, exerciseHistory, lastSession, lastCardio, readyToProgress, bestSet } from '../lib/workoutPlan';

export const repText = (ex) =>
  ex.kind === 'cardio'
    ? `${ex.minutes}–${ex.maxMinutes} min`
    : `${ex.sets} × ${ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`}${ex.unit === 'sec' ? ' sec' : ''}${ex.perSide ? ' per side' : ''}`;

const unitLabel = (ex) => (ex.unit === 'sec' ? 'sec' : 'reps');

const openVideo = (url) => {
  if (!url) return;
  Linking.openURL(url).catch(() => Alert.alert('Could not open video', 'Open YouTube and search for the exercise name.'));
};

export function ExerciseCard({ ex, day, log, onOpen, onRemove }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const units = state.profile.units;
  const wu = weightUnit(units);
  const sets = (log.sets || {})[ex.id] || [];
  const last = lastSession(state.days, ex.id, day);
  const rows = Math.max(ex.sets || 0, sets.length);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <Pressable style={{ flex: 1, paddingRight: 8 }} onPress={onOpen} disabled={!onOpen}>
        <Txt size={16} weight="700">
          {ex.name}
          {onOpen ? <Txt faint size={12}>  📈</Txt> : null}
        </Txt>
        <Txt dim size={13}>
          {repText(ex)}{ex.notes ? ` · ${ex.notes}` : ''}
        </Txt>
      </Pressable>
      {ex.video && <Button small variant="secondary" title="▶ Video" onPress={() => openVideo(ex.video)} />}
      {onRemove && (
        <Pressable hitSlop={10} onPress={onRemove} style={{ paddingLeft: 10, paddingTop: 4 }} accessibilityLabel={`Remove ${ex.name} from this day`}>
          <Txt faint size={18}>✕</Txt>
        </Pressable>
      )}
    </View>
  );

  if (ex.kind === 'cardio') {
    const c = cardioLog((log.cardio || {})[ex.id]);
    const minutes = c.minutes;
    const set = (patch) => dispatch({ type: 'SET_WORKOUT_CARDIO', day, exerciseId: ex.id, ...patch });
    const kcal = exerciseCalories(effectiveMet(ex.activity || 'other', c.intensity), state.profile.weightKg, minutes);
    const prevC = lastCardio(state.days, ex.id, day);
    return (
      <Card>
        {header}
        {prevC && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Txt faint size={12} style={{ flex: 1 }}>
              Last time ({formatShortDate(prevC.day)}): {prevC.minutes} min, {prevC.intensity}{prevC.laps ? `, ${prevC.laps} laps` : ''}
            </Txt>
            {!minutes && (
              <Button small variant="secondary" title="Same as last time" onPress={() => set({ minutes: prevC.minutes, intensity: prevC.intensity, laps: prevC.laps })} />
            )}
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {[ex.minutes, Math.round((ex.minutes + ex.maxMinutes) / 2), ex.maxMinutes].filter((v, i, a) => a.indexOf(v) === i).map((m) => (
            <Chip key={m} label={`${m} min`} selected={minutes === m} color={t.exercise} onPress={() => set({ minutes: minutes === m ? 0 : m })} />
          ))}
        </View>
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Stepper value={minutes} onChange={(v) => set({ minutes: v })} step={5} min={0} max={240} format={(v) => (v ? `${v} min` : 'not done')} />
        </View>
        <Txt dim size={13} weight="600" style={{ marginTop: 12, marginBottom: 6 }}>Intensity</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {INTENSITIES.map((i) => (
            <Chip key={i.key} label={i.label} selected={c.intensity === i.key} color={t.exercise} onPress={() => set({ intensity: i.key })} style={{ flex: 1, alignItems: 'center' }} />
          ))}
        </View>
        {ex.laps && (
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <Stepper value={c.laps} onChange={(v) => set({ laps: v })} step={1} bigStep={10} min={0} max={500} format={(v) => `${v} laps`} />
          </View>
        )}
        <Txt dim size={13} style={{ marginTop: 10 }}>
          {minutes ? `≈ ${kcal} kcal burned` : 'Set the time to see calories burned'}
          {minutes && state.profile.eatBackExercise ? ` · ${Math.round(kcal * 0.5)} added to today's food target` : ''}
        </Txt>
      </Card>
    );
  }

  const progress = readyToProgress(ex, last);
  const lastText = last
    ? last.sets.map((s) => (ex.kind === 'strength' && s.kg ? `${weightToDisplay(s.kg, units)}×${s.reps}` : `${s.reps}`)).join(', ')
    : null;

  return (
    <Card>
      {header}
      {lastText && (
        <Txt faint size={12} style={{ marginTop: 6 }}>
          Last time ({formatShortDate(last.date)}): {lastText}
          {ex.kind === 'strength' && last.sets[0].kg ? ` ${wu}` : ` ${unitLabel(ex)}`}
        </Txt>
      )}
      {progress && (
        <Txt size={12} color={t.good} weight="600" style={{ marginTop: 4 }}>
          ⬆ You hit {ex.repMax} {unitLabel(ex)} on every set last time. Next step: {ex.progression || 'add a rep or slow the tempo'}.
        </Txt>
      )}
      <View style={{ marginTop: 10 }}>
        {Array.from({ length: rows }).map((_, i) => {
          const s = sets[i] || {};
          const prev = last && last.sets[i];
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Txt dim size={13} style={{ width: 42 }}>
                Set {i + 1}
              </Txt>
              {ex.kind === 'strength' && (
                <NumberField
                  style={{ flex: 1, marginBottom: 0 }}
                  value={s.kg != null ? weightToDisplay(s.kg, units) : null}
                  placeholder={prev && prev.kg ? String(weightToDisplay(prev.kg, units)) : wu}
                  suffix={wu}
                  onChange={(v) => dispatch({ type: 'SET_WORKOUT_SET', day, exerciseId: ex.id, index: i, patch: { kg: v == null ? null : weightFromDisplay(v, units) } })}
                />
              )}
              <NumberField
                style={{ flex: 1, marginBottom: 0 }}
                value={s.reps != null ? s.reps : null}
                decimals={false}
                placeholder={prev ? String(prev.reps) : `${ex.repMin}–${ex.repMax}`}
                suffix={unitLabel(ex)}
                onChange={(v) => dispatch({ type: 'SET_WORKOUT_SET', day, exerciseId: ex.id, index: i, patch: { reps: v } })}
              />
              {i >= (ex.sets || 0) && (
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert(`Delete set ${i + 1}?`, ex.name, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => dispatch({ type: 'REMOVE_WORKOUT_SET', day, exerciseId: ex.id, index: i }) },
                    ])
                  }
                >
                  <Txt faint>✕</Txt>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        {last && (
          <Button
            small
            variant="secondary"
            title="Same as last time"
            onPress={() =>
              last.sets.slice(0, Math.max(ex.sets, 1)).forEach((p, i) =>
                dispatch({ type: 'SET_WORKOUT_SET', day, exerciseId: ex.id, index: i, patch: { kg: p.kg ?? null, reps: p.reps } })
              )
            }
          />
        )}
        <Button small variant="ghost" title="+ Set" onPress={() => dispatch({ type: 'SET_WORKOUT_SET', day, exerciseId: ex.id, index: rows, patch: {} })} />
      </View>
    </Card>
  );
}

export function ExerciseSheet({ ex, units, onClose }) {
  const t = useTheme();
  const { state } = useStore();
  const history = exerciseHistory(state.days, ex.id);
  const wu = weightUnit(units);
  // Weight training: top weight per session, and reps (all sets added up). Bodyweight: reps of the best set.
  const weightPoints = history
    .map((h) => ({ h, b: bestSet(h) }))
    .filter((x) => x.b && x.b.kg)
    .map(({ h, b }) => ({ x: parseDayKey(h.date).getTime(), y: weightToDisplay(b.kg, units) }));
  const repPoints = history.map((h) => ({
    x: parseDayKey(h.date).getTime(),
    y: ex.kind === 'strength' ? h.sets.reduce((a, s) => a + (s.reps || 0), 0) : (bestSet(h) || {}).reps || 0,
  })).filter((p) => p.y > 0);

  return (
    <Sheet visible onClose={onClose} title={ex.name}>
      <Txt dim style={{ marginBottom: 4 }}>
        {repText(ex)}
      </Txt>
      <Txt style={{ marginBottom: ex.progression ? 6 : 12 }}>{ex.notes}</Txt>
      {ex.progression ? (
        <Txt dim size={13} style={{ marginBottom: 12 }}>
          ⬆ When it gets easy: {ex.progression}
        </Txt>
      ) : null}
      {ex.video ? (
        <Button variant="secondary" title="▶ Watch a form demo (YouTube)" onPress={() => openVideo(ex.video)} />
      ) : null}
      {ex.video ? (
        <Txt faint size={12} style={{ marginTop: 6 }}>
          Opens a YouTube search so the link never goes dead. Pick a short demo from a coach.
        </Txt>
      ) : null}

      {ex.kind !== 'cardio' && (
        <View style={{ marginTop: 16 }}>
          <Txt weight="700" style={{ marginBottom: 8 }}>
            Progress
          </Txt>
          {ex.kind === 'strength' && weightPoints.length >= 2 ? (
            <>
              <Txt dim size={13} style={{ marginBottom: 4 }}>Top weight ({wu})</Txt>
              <LineChart points={weightPoints} color={t.primary} height={140} formatY={(v) => v.toFixed(0)} formatX={(x) => formatShortDate(new Date(x))} />
            </>
          ) : null}
          {repPoints.length >= 2 ? (
            <>
              <Txt dim size={13} style={{ marginTop: 10, marginBottom: 4 }}>
                {ex.kind === 'strength' ? 'Total reps (all sets)' : ex.unit === 'sec' ? 'Best hold (seconds)' : 'Best set (reps)'}
              </Txt>
              <LineChart points={repPoints} color={t.exercise} height={140} formatY={(v) => v.toFixed(0)} formatX={(x) => formatShortDate(new Date(x))} />
            </>
          ) : null}
          {history.length === 1 ? <Txt faint size={12}>Log one more session to see a graph.</Txt> : null}
          {history.length === 0 && <Empty>No sessions logged yet.</Empty>}
          {[...history]
            .reverse()
            .slice(0, 12)
            .map((h) => (
              <View key={h.date} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
                <Txt>{formatShortDate(h.date)}</Txt>
                <Text style={{ color: t.textDim, fontSize: 14 }}>
                  {h.sets.map((s) => (ex.kind === 'strength' && s.kg ? `${weightToDisplay(s.kg, units)}×${s.reps}` : `${s.reps}`)).join('  ')}
                  {ex.kind === 'strength' ? ` ${wu}` : ` ${unitLabel(ex)}`}
                </Text>
              </View>
            ))}
        </View>
      )}
    </Sheet>
  );
}
