import React, { useMemo, useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Screen, Card, Txt, Button, Ring, ChipRow, TimeRow, Sheet, Stepper, Empty, SectionTitle, useNow } from '../components/ui';
import { PROTOCOLS, STAGES, eatingWindow, fastHoursFor, fastStats, stageFor, nextStage } from '../lib/fasting';
import { formatHMS, formatClock, formatDuration, formatShortDate } from '../lib/dates';

export default function FastingScreen() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const now = useNow(1000);
  const { fasting } = state;
  const active = fasting.active;
  const target = fastHoursFor(fasting);
  const stats = useMemo(() => fastStats(fasting.history), [fasting.history]);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustHoursAgo, setAdjustHoursAgo] = useState(0);
  const w = eatingWindow(fasting, now);

  const setFasting = (patch) => dispatch({ type: 'SET_FASTING', patch });

  if (!fasting.enabled) {
    return (
      <Screen>
        <Card title="⏱️ Intermittent fasting">
          <Txt dim style={{ marginBottom: 12 }}>
            Fasting is turned off. Turn it on to track fasts, get eating-window reminders and see fasting insights.
          </Txt>
          <Button color={t.fasting} title="Turn on fasting" onPress={() => setFasting({ enabled: true })} />
        </Card>
        <SafetyNote />
      </Screen>
    );
  }

  let ringContent;
  if (active) {
    const start = new Date(active.start);
    const elapsed = now - start;
    const hrs = elapsed / 3600000;
    const stage = stageFor(hrs);
    const next = nextStage(hrs);
    const endAt = new Date(start.getTime() + active.targetHours * 3600000);
    const done = hrs >= active.targetHours;
    ringContent = (
      <Card>
        <View style={{ alignItems: 'center' }}>
          <Txt dim size={13} weight="600">
            {done ? 'GOAL REACHED 🎉' : 'FASTING'}
          </Txt>
          <View style={{ marginTop: 8 }}>
            <Ring value={hrs} max={active.targetHours} size={220} stroke={16} color={done ? t.good : t.fasting}>
              <Text style={{ color: t.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatHMS(elapsed)}</Text>
              <Txt dim size={13}>
                {done ? `+${formatDuration(elapsed - active.targetHours * 3600000)} past goal` : `${formatDuration(endAt - now)} left`}
              </Txt>
              <Txt faint size={12}>
                {Math.min(100, Math.round((hrs / active.targetHours) * 100))}% of {active.targetHours}h
              </Txt>
            </Ring>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 14 }}>
            <View>
              <Txt faint size={12}>
                Started
              </Txt>
              <Txt weight="600">{formatClock(start)}</Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt faint size={12}>
                Goal
              </Txt>
              <Txt weight="600">
                {formatClock(endAt)}
                {endAt.getDate() !== now.getDate() ? ' (tmrw)' : ''}
              </Txt>
            </View>
          </View>
          <View style={{ alignSelf: 'stretch', backgroundColor: t.fasting + '18', borderRadius: 12, padding: 12, marginTop: 14 }}>
            <Txt weight="700">
              {stage.icon} {stage.label}
            </Txt>
            <Txt dim size={13}>
              {stage.desc}
            </Txt>
            {next && (
              <Txt faint size={12} style={{ marginTop: 4 }}>
                Next: {next.label} in {formatDuration((next.from - hrs) * 3600000)}
              </Txt>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 14 }}>
            <Button
              variant="secondary"
              title="Edit start"
              onPress={() => {
                setAdjustHoursAgo(Math.round(hrs * 4) / 4);
                setAdjustOpen(true);
              }}
            />
            <Button
              style={{ flex: 1 }}
              color={done ? t.good : t.fasting}
              title="End fast"
              onPress={() => {
                if (done) dispatch({ type: 'END_FAST' });
                else
                  Alert.alert('End fast early?', `You're ${formatDuration(endAt - now)} short of your ${active.targetHours}h goal. That's okay. Listen to your body.`, [
                    { text: 'Keep going', style: 'cancel' },
                    { text: 'End fast', onPress: () => dispatch({ type: 'END_FAST' }) },
                  ]);
              }}
            />
          </View>
          <Pressable onPress={() => Alert.alert('Discard this fast?', 'It will not be saved to history.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => dispatch({ type: 'CANCEL_FAST' }) },
          ])} style={{ marginTop: 10 }}>
            <Txt faint size={13}>Discard fast</Txt>
          </Pressable>
        </View>
      </Card>
    );
  } else {
    ringContent = (
      <Card>
        <View style={{ alignItems: 'center' }}>
          <Txt dim size={13} weight="600">
            {w.isOpen ? 'EATING WINDOW OPEN' : 'EATING WINDOW CLOSED'}
          </Txt>
          <View style={{ marginTop: 8 }}>
            <Ring
              value={w.isOpen ? now - w.open : 0}
              max={w.close - w.open}
              size={200}
              stroke={14}
              color={t.food}
            >
              <Text style={{ color: t.text, fontSize: 28, fontWeight: '800' }}>
                {w.isOpen ? formatDuration(w.close - now) : formatDuration(w.open - now)}
              </Text>
              <Txt dim size={13}>
                {w.isOpen ? `until window closes` : 'until window opens'}
              </Txt>
              <Txt faint size={12}>
                {formatClock(w.open)} – {formatClock(w.close)}
              </Txt>
            </Ring>
          </View>
          <Button
            style={{ alignSelf: 'stretch', marginTop: 16 }}
            color={t.fasting}
            title={`Start ${target}h fast now`}
            onPress={() => dispatch({ type: 'START_FAST', targetHours: target })}
          />
          <Pressable
            onPress={() => {
              setAdjustHoursAgo(1);
              setAdjustOpen(true);
            }}
            style={{ marginTop: 10 }}
          >
            <Txt color={t.primary} size={14}>
              Forgot to start? Start it in the past
            </Txt>
          </Pressable>
        </View>
      </Card>
    );
  }

  return (
    <Screen>
      {ringContent}

      <Card title="Your plan">
        <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
          Fasting schedule
        </Txt>
        <ChipRow
          options={PROTOCOLS.map((p) => ({ key: p.key, label: p.label }))}
          value={fasting.protocol}
          onChange={(k) => setFasting({ protocol: k })}
          color={t.fasting}
        />
        <Txt faint size={12} style={{ marginTop: 6 }}>
          {PROTOCOLS.find((p) => p.key === fasting.protocol)?.desc} · {target}h fast / {Math.max(1, 24 - target)}h eating
        </Txt>
        {fasting.protocol === 'custom' && (
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Stepper value={fasting.customHours || 16} onChange={(v) => setFasting({ customHours: v })} min={10} max={72} step={1} format={(v) => `${v}h`} />
          </View>
        )}
        <TimeRow
          label="Eating window starts"
          sub={`Window: ${formatClock(w.open)} – ${formatClock(w.close)}`}
          value={fasting.windowStart}
          onChange={(v) => setFasting({ windowStart: v })}
        />
        <Txt faint size={12} style={{ marginTop: 8 }}>
          You'll get reminders when your window opens, 1 hour before it closes and when it's time to fast (Settings → Nutrition).
        </Txt>
      </Card>

      <Card title="Stats">
        {stats.count === 0 ? (
          <Empty>Complete your first fast to see stats.</Empty>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MiniStat label="Fasts" value={stats.count} />
            <MiniStat label="Average" value={`${stats.avgHours.toFixed(1)}h`} />
            <MiniStat label="Longest" value={`${stats.longestHours.toFixed(1)}h`} />
            <MiniStat label="Hit goal" value={`${Math.round(stats.completionRate * 100)}%`} />
            <MiniStat label="Streak" value={stats.streak} />
          </View>
        )}
      </Card>

      {fasting.history.length > 0 && (
        <Card title="History">
          {[...fasting.history]
            .reverse()
            .slice(0, 14)
            .map((f) => {
              const hrs = (new Date(f.end) - new Date(f.start)) / 3600000;
              const hit = hrs >= (f.targetHours || 16) - 0.25;
              return (
                <Pressable
                  key={f.id}
                  onLongPress={() =>
                    Alert.alert('Delete this fast?', '', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => dispatch({ type: 'REMOVE_FAST', id: f.id }) },
                    ])
                  }
                  style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: t.border }}
                >
                  <View>
                    <Txt>{formatShortDate(f.start)}</Txt>
                    <Txt faint size={12}>
                      {formatClock(f.start)} → {formatClock(f.end)}
                    </Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt weight="700" color={hit ? t.good : t.textDim}>
                      {hrs.toFixed(1)}h {hit ? '✓' : ''}
                    </Txt>
                    <Txt faint size={12}>
                      goal {f.targetHours}h
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
        </Card>
      )}

      <SectionTitle>Fasting stages (approximate)</SectionTitle>
      <Card>
        {STAGES.map((s) => (
          <View key={s.from} style={{ flexDirection: 'row', paddingVertical: 7 }}>
            <Text style={{ width: 30, fontSize: 18 }}>{s.icon}</Text>
            <View style={{ flex: 1 }}>
              <Txt weight="600">
                {s.from}h+ · {s.label}
              </Txt>
              <Txt dim size={13}>
                {s.desc}
              </Txt>
            </View>
          </View>
        ))}
      </Card>
      <SafetyNote />

      <Sheet
        visible={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={active ? 'Edit start time' : 'Start fast in the past'}
        footer={
          <Button
            color={t.fasting}
            title="Save"
            onPress={() => {
              const start = new Date(Date.now() - adjustHoursAgo * 3600000).toISOString();
              if (active) dispatch({ type: 'EDIT_ACTIVE_FAST', patch: { start } });
              else dispatch({ type: 'START_FAST', targetHours: target, start });
              setAdjustOpen(false);
            }}
          />
        }
      >
        <Txt dim style={{ marginBottom: 12 }}>
          How long ago did your fast start? (usually your last bite of food)
        </Txt>
        <View style={{ alignItems: 'center' }}>
          <Stepper value={adjustHoursAgo} onChange={setAdjustHoursAgo} step={0.25} bigStep={1} min={0} max={72} format={(v) => formatDuration(v * 3600000)} />
          <Txt faint size={13} style={{ marginTop: 10 }}>
            Started at {formatClock(new Date(Date.now() - adjustHoursAgo * 3600000))}
          </Txt>
        </View>
      </Sheet>
    </Screen>
  );
}

function MiniStat({ label, value }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt size={18} weight="800">
        {value}
      </Txt>
      <Txt faint size={11}>
        {label}
      </Txt>
    </View>
  );
}

function SafetyNote() {
  return (
    <Txt faint size={12} style={{ marginTop: 4, marginBottom: 8, lineHeight: 18 }}>
      ⚕️ Fasting isn't right for everyone. Skip it, or talk to a doctor first, if you're pregnant or breastfeeding, under 18, have diabetes or take blood-sugar medication, or have a history of disordered eating. Drink plenty of water while fasting.
    </Txt>
  );
}
