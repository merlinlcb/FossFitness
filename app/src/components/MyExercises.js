// Settings → Training → My exercises (also opened from the Train tab): switch on the exercises you do (grouped by body part),
// and add your own. The Train tab then lets you log just these.
import React, { useState } from 'react';
import { View, Switch, Pressable } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Sheet, Txt, Button, TextField, NumberField, Segmented, ChipRow, Empty } from './ui';
import { allExercises, myExerciseIds, makeCustomExercise, SUBGROUPS, subgroupOf } from '../lib/workoutPlan';

export const repText = (ex) =>
  ex.kind === 'cardio'
    ? `${ex.minutes}–${ex.maxMinutes} min${ex.laps ? ' · laps' : ''}`
    : `${ex.sets} × ${ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`}${ex.unit === 'sec' ? ' sec' : ''}${ex.perSide ? ' per side' : ''}${ex.kind === 'strength' ? ' · weight' : ''}`;

export function MyExercisesSheet({ onClose }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const plan = state.workoutPlan;
  const on = myExerciseIds(plan);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [opened, setOpened] = useState({});
  const query = q.trim().toLowerCase();
  const list = allExercises(plan).filter((e) => !query || e.name.toLowerCase().includes(query));
  const set = (ids) => dispatch({ type: 'SET_WORKOUT_PLAN', patch: { myExercises: ids } });
  const toggle = (id, v) => set(v ? [...on.filter((x) => x !== id), id] : on.filter((x) => x !== id));

  return (
    <Sheet visible onClose={onClose} title="My exercises" footer={<Button title={`Done · ${on.length} switched on`} onPress={onClose} />}>
      <Txt dim size={13} style={{ marginBottom: 10, lineHeight: 19 }}>
        Switch on the exercises you do. On the Train tab you then pick which of these you did each day and log your sets.
      </Txt>
      <TextField value={q} onChangeText={setQ} placeholder="Search exercises" />
      {SUBGROUPS.map((g) => {
        const rows = list.filter((e) => subgroupOf(e) === g.key);
        if (!rows.length) return null;
        const count = rows.filter((e) => on.includes(e.id)).length;
        // Open while searching; otherwise categories with something switched on start open.
        const isOpen = !!query || (opened[g.key] ?? count > 0);
        return (
          <View key={g.key} style={{ marginBottom: 6 }}>
            <Pressable onPress={() => setOpened({ ...opened, [g.key]: !isOpen })} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 2 }}>
              <Txt dim size={12} weight="800" style={{ flex: 1 }}>
                {g.label.toUpperCase()}  ·  {count ? `${count} on of ${rows.length}` : `${rows.length}`}
              </Txt>
              <Txt dim size={14}>{isOpen ? '▾' : '▸'}</Txt>
            </Pressable>
            {isOpen && rows.map((ex) => (
              <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Txt>
                    {ex.name}
                    {ex.custom ? <Txt size={12} color={t.primary}>  yours</Txt> : null}
                  </Txt>
                  <Txt faint size={12}>{repText(ex)}</Txt>
                </View>
                <Switch value={on.includes(ex.id)} onValueChange={(v) => toggle(ex.id, v)} trackColor={{ true: t.primary }} />
              </View>
            ))}
          </View>
        );
      })}
      {!list.length && <Empty>No match. Add it as your own exercise below.</Empty>}
      {adding ? (
        <CustomExerciseForm
          initialName={q}
          onCancel={() => setAdding(false)}
          onSave={(spec) => {
            const ex = makeCustomExercise(spec);
            dispatch({ type: 'SET_WORKOUT_PLAN', patch: { customExercises: [...(plan.customExercises || []), ex], myExercises: [...on, ex.id] } });
            setAdding(false);
            setQ('');
          }}
        />
      ) : (
        <Button variant="secondary" title="＋ Add your own exercise" style={{ marginTop: 10 }} onPress={() => setAdding(true)} />
      )}
    </Sheet>
  );
}

const KINDS = [
  { key: 'strength', label: 'Weights' },
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'cardio', label: 'Cardio' },
];

function CustomExerciseForm({ initialName, onCancel, onSave }) {
  const t = useTheme();
  const [name, setName] = useState(initialName || '');
  const [kind, setKind] = useState('strength');
  const [sub, setSub] = useState('chest');
  const [sets, setSets] = useState(3);
  const [repMin, setRepMin] = useState(8);
  const [repMax, setRepMax] = useState(12);
  const [minutes, setMinutes] = useState(20);
  const subs = SUBGROUPS.filter((g) => g.group && g.group !== 'cardio');
  return (
    <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: t.cardAlt }}>
      <Txt weight="700" style={{ marginBottom: 8 }}>Your own exercise</Txt>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Cable fly" />
      <View style={{ marginBottom: 10 }}>
        <Segmented options={KINDS} value={kind} onChange={setKind} />
      </View>
      {kind === 'cardio' ? (
        <NumberField label="Usual length" value={minutes} decimals={false} suffix="min" onChange={setMinutes} />
      ) : (
        <>
          <View style={{ marginBottom: 10 }}>
            <ChipRow scroll options={subs.map((g) => ({ key: g.key, label: g.label }))} value={sub} onChange={setSub} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <NumberField style={{ flex: 1 }} label="Sets" value={sets} decimals={false} onChange={setSets} />
            <NumberField style={{ flex: 1 }} label="Reps from" value={repMin} decimals={false} onChange={setRepMin} />
            <NumberField style={{ flex: 1 }} label="to" value={repMax} decimals={false} onChange={setRepMax} />
          </View>
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button variant="secondary" title="Cancel" onPress={onCancel} />
        <Button
          style={{ flex: 1 }}
          title="Add exercise"
          disabled={!name.trim()}
          onPress={() => {
            const g = SUBGROUPS.find((x) => x.key === sub);
            onSave({ name, kind, group: kind === 'cardio' ? 'cardio' : g.group, sub: kind === 'cardio' ? 'cardio' : sub, sets, repMin, repMax, minutes, maxMinutes: minutes });
          }}
        />
      </View>
    </View>
  );
}
