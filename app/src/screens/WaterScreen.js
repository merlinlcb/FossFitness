import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Screen, Card, Txt, Button, Ring, Sheet, NumberField, TextField, BarChart, Empty, Row, useNow } from '../components/ui';
import { dayMetrics, waterPaceTarget } from '../lib/metrics';
import { dayKey, lastNDays, shortDayName, formatClock, uid } from '../lib/dates';
import { formatWater, waterToDisplay, waterFromDisplay } from '../lib/units';
import { waterGoal } from '../lib/calc';

const ICONS = ['🥛', '☕', '🧴', '🍶', '🥤', '🍵', '🧃', '💧'];

export default function WaterScreen() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const now = useNow(60000);
  const today = dayKey(now);
  const m = useMemo(() => dayMetrics(state, today), [state, today]);
  const wu = state.profile.waterUnit;
  const unitLabel = wu === 'ml' ? 'ml' : 'oz';
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmt, setCustomAmt] = useState(null);
  const [editPresets, setEditPresets] = useState(false);

  const pace = waterPaceTarget(state.profile, m.waterGoal, now);
  const left = Math.max(0, m.waterGoal - m.water);
  const week = lastNDays(7, now).map((k) => {
    const dm = dayMetrics(state, k);
    return { label: shortDayName(k).slice(0, 2), value: waterToDisplay(dm.water, wu), highlight: k === today };
  });
  const entries = [...m.day.water].sort((a, b) => b.t.localeCompare(a.t));
  const base = waterGoal({ ...state.profile }, 0);

  const add = (ml, label) => dispatch({ type: 'ADD_WATER', ml, label });
  const undo = () => {
    if (!entries.length) return;
    dispatch({ type: 'REMOVE_WATER', day: today, id: entries[0].id });
  };

  return (
    <Screen>
      <Card>
        <View style={{ alignItems: 'center' }}>
          <Ring value={m.water} max={m.waterGoal} size={190} stroke={16} color={t.water}>
            <Txt size={34} weight="800" color={t.water}>
              {formatWater(m.water, wu)}
            </Txt>
            <Txt dim size={14}>
              of {formatWater(m.waterGoal, wu)}
            </Txt>
            <Txt faint size={12} style={{ marginTop: 4 }}>
              {left > 0 ? `${formatWater(left, wu)} to go` : 'Goal reached 🎉'}
            </Txt>
          </Ring>
          <View
            style={{
              marginTop: 12,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: (m.water >= pace ? t.good : t.warn) + '22',
            }}
          >
            <Txt size={13} weight="600" color={m.water >= pace ? t.good : t.warn}>
              {m.water >= m.waterGoal
                ? 'Done for today'
                : m.water >= pace
                ? `On pace (target by now: ${formatWater(pace, wu)})`
                : `${formatWater(pace - m.water, wu)} behind pace`}
            </Txt>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {state.waterPresets.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => add(p.ml, p.label)}
              style={({ pressed }) => ({
                width: '48%',
                flexGrow: 1,
                backgroundColor: t.water + (pressed ? '33' : '18'),
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
              })}
            >
              <Text style={{ fontSize: 24 }}>{p.icon}</Text>
              <Txt weight="700" color={t.water}>
                +{formatWater(p.ml, wu)}
              </Txt>
              <Txt faint size={12}>
                {p.label}
              </Txt>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button small variant="secondary" color={t.water} title="Custom amount" style={{ flex: 1 }} onPress={() => setCustomOpen(true)} />
          <Button small variant="secondary" title="↩ Undo last" style={{ flex: 1 }} disabled={!entries.length} onPress={undo} />
          <Button small variant="secondary" title="✎ Cups" onPress={() => setEditPresets(true)} />
        </View>
      </Card>

      <Card title="Today's log">
        {entries.length === 0 && <Empty>No water logged yet today.</Empty>}
        {entries.map((e) => (
          <Pressable
            key={e.id}
            onLongPress={() =>
              Alert.alert('Remove entry?', `${formatWater(e.ml, wu)} at ${formatClock(e.t)}`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => dispatch({ type: 'REMOVE_WATER', day: today, id: e.id }) },
              ])
            }
            style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: t.border }}
          >
            <Txt>
              {formatClock(e.t)}
              {e.label ? <Txt faint size={13}>{`  ${e.label}`}</Txt> : null}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Txt weight="600" color={t.water}>
                {formatWater(e.ml, wu)}
              </Txt>
              <Pressable hitSlop={10} onPress={() => dispatch({ type: 'REMOVE_WATER', day: today, id: e.id })}>
                <Txt faint>✕</Txt>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </Card>

      <Card title="Last 7 days" right={<Txt faint size={12}>{unitLabel}</Txt>}>
        <BarChart data={week} color={t.water} goal={waterToDisplay(m.waterGoal, wu)} formatValue={(v) => String(v)} />
      </Card>

      <Card title="How your goal is set">
        <Row label="Base (≈35 ml per kg of body weight)" value={formatWater(base, wu)} />
        {m.exMinutes > 0 && <Row label={`Exercise today (${m.exMinutes} min)`} value={`+${formatWater(m.waterGoal - base, wu)}`} />}
        <Row label="Climate" value={state.profile.climate === 'hot' ? 'Hot (+500 ml)' : 'Normal'} />
        <Txt faint size={12} style={{ marginTop: 8 }}>
          Logging a workout raises today's goal automatically. Change climate and units in Settings → Nutrition. Coffee, tea and other drinks count toward hydration too.
        </Txt>
      </Card>

      <Sheet
        visible={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Custom amount"
        footer={
          <Button
            color={t.water}
            title="Add"
            disabled={!customAmt}
            onPress={() => {
              add(waterFromDisplay(customAmt, wu), null);
              setCustomAmt(null);
              setCustomOpen(false);
            }}
          />
        }
      >
        <NumberField label={`Amount (${unitLabel})`} value={customAmt} onChange={setCustomAmt} suffix={unitLabel} autoFocus />
      </Sheet>

      {editPresets && <PresetEditor onClose={() => setEditPresets(false)} />}
    </Screen>
  );
}

function PresetEditor({ onClose }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const wu = state.profile.waterUnit;
  const unitLabel = wu === 'ml' ? 'ml' : 'oz';
  const [presets, setPresets] = useState(state.waterPresets.map((p) => ({ ...p, display: waterToDisplay(p.ml, wu) })));

  const update = (id, patch) => setPresets((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Your cups & bottles"
      footer={
        <Button
          color={t.water}
          title="Save"
          onPress={() => {
            const clean = presets
              .filter((p) => p.display > 0)
              .map(({ display, ...p }) => ({ ...p, ml: Math.round(waterFromDisplay(display, wu)), label: p.label.trim() || 'Drink' }));
            if (clean.length) dispatch({ type: 'SET_WATER_PRESETS', presets: clean });
            onClose();
          }}
        />
      }
    >
      <Txt faint size={12} style={{ marginBottom: 10 }}>
        Set these to match the containers you actually use, so one tap logs the right amount.
      </Txt>
      {presets.map((p) => (
        <View key={p.id} style={{ borderBottomWidth: 0.5, borderBottomColor: t.border, paddingBottom: 8, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {ICONS.map((ic) => (
              <Pressable
                key={ic}
                onPress={() => update(p.id, { icon: ic })}
                style={{ padding: 4, borderRadius: 8, backgroundColor: p.icon === ic ? t.water + '33' : 'transparent' }}
              >
                <Text style={{ fontSize: 20 }}>{ic}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <TextField style={{ flex: 1.3, marginBottom: 0 }} value={p.label} onChangeText={(v) => update(p.id, { label: v })} placeholder="Name" />
            <NumberField style={{ flex: 1, marginBottom: 0 }} value={p.display} onChange={(v) => update(p.id, { display: v })} suffix={unitLabel} />
            <Button small variant="ghost" color={t.danger} title="✕" onPress={() => setPresets((ps) => ps.filter((x) => x.id !== p.id))} />
          </View>
        </View>
      ))}
      {presets.length < 6 && (
        <Button
          small
          variant="secondary"
          title="+ Add container"
          onPress={() => setPresets((ps) => [...ps, { id: `p-${uid()}`, label: 'New', icon: '💧', ml: 300, display: waterToDisplay(300, wu) }])}
        />
      )}
    </Sheet>
  );
}
