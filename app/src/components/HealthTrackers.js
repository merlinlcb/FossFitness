// Optional health trackers: medications and the person's own charts (blood pressure, blood sugar, ...).
// Off until switched on in Settings → Health trackers. Private: kept on this phone only, never in
// XP, medals, quests, Compare or chat (see lib/health.js).
import React, { useMemo, useState } from 'react';
import { View, Pressable, Switch, Alert } from 'react-native';
import Svg, { Polyline, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Card, Txt, Button, Sheet, ChipRow, NumberField, TextField, TimeRow, Segmented, SectionTitle, Empty } from './ui';
import { addDays, atTime, dayKey, formatClock, formatDayLabel, formatTime12, formatShortDate, minutesToTime, parseDayKey, uid } from '../lib/dates';
import {
  METRIC_PRESETS,
  activeMeds,
  adherence,
  chartSeries,
  dosesForDay,
  doseDue,
  sortTimes,
  formatValues,
  isScheduled,
  latestReading,
  outOfRange,
  readingsFor,
  validValues,
} from '../lib/health';

const PRIVACY_NOTE = 'Stays on this phone. Never part of XP, medals, quests, Compare or chat, and never sent to a sync server.';

// ---------- Today ----------

export function HealthTodayCard({ goTo }) {
  const { state, dispatch } = useStore();
  const h = state.health;
  const [reading, setReading] = useState(null);
  const today = dayKey();
  const meds = activeMeds(h);
  if (!h.enabled || (!meds.length && !h.metrics.length)) return null;
  const rows = dosesForDay(h, today);
  const asNeeded = meds.filter((m) => !isScheduled(m));
  const scheduled = rows.filter((r) => r.time);
  const toggle = (medId, slot) => dispatch({ type: 'TOGGLE_DOSE', day: today, medId, slot });

  return (
    <Card title="🩺 Health" right={<Button small variant="ghost" title="Charts ›" onPress={() => goTo('progress')} />}>
      {scheduled.map((r) => (
        <Pressable
          key={`${r.med.id}-${r.slot}`}
          onPress={() => toggle(r.med.id, r.slot)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <Txt size={20} style={{ width: 32 }}>{r.takenAt ? '✅' : '⬜'}</Txt>
          <View style={{ flex: 1 }}>
            <Txt weight="600">
              {r.med.name}
              {r.med.dose ? <Txt dim> · {r.med.dose}</Txt> : null}
            </Txt>
            <Txt faint size={12}>
              {formatTime12(r.time)}
              {r.takenAt ? ` · taken ${formatClock(new Date(r.takenAt))}` : ''}
            </Txt>
          </View>
        </Pressable>
      ))}
      {asNeeded.map((med) => {
        const taken = rows.filter((r) => r.med.id === med.id && r.takenAt).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
        return (
          <View key={med.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <Txt size={20} style={{ width: 32 }}>💊</Txt>
            <View style={{ flex: 1 }}>
              <Txt weight="600">
                {med.name}
                {med.dose ? <Txt dim> · {med.dose}</Txt> : null}
              </Txt>
              <Txt faint size={12}>
                As needed{taken.length ? ` · today ${taken.map((r) => formatClock(new Date(r.takenAt))).join(', ')}` : ''}
              </Txt>
            </View>
            {taken.length > 0 && (
              <Button small variant="ghost" title="Undo" onPress={() => toggle(med.id, taken[taken.length - 1].slot)} />
            )}
            <Button small variant="secondary" title="Took one" onPress={() => toggle(med.id, `prn-${Date.now()}`)} />
          </View>
        );
      })}
      {h.metrics.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: rows.length || asNeeded.length ? 8 : 0 }}>
          {h.metrics.map((m) => {
            const last = latestReading(h, m.id);
            const isToday = last && dayKey(new Date(last.t)) === today;
            return (
              <Button
                key={m.id}
                small
                variant="secondary"
                title={`＋ ${m.name}${isToday ? ` (${formatValues(m, last.values)})` : ''}`}
                onPress={() => setReading({ metric: m })}
              />
            );
          })}
        </View>
      )}
      {reading && <ReadingSheet metric={reading.metric} reading={reading.reading} onClose={() => setReading(null)} />}
    </Card>
  );
}

// ---------- Progress ----------

const RANGES = [
  { key: 7, label: '1w' },
  { key: 30, label: '1mo' },
  { key: 90, label: '3mo' },
  { key: 0, label: 'All' },
];

export function HealthCharts() {
  const { state } = useStore();
  const h = state.health;
  const meds = activeMeds(h).filter(isScheduled);
  if (!h.enabled || (!h.metrics.length && !meds.length)) return null;
  return (
    <>
      <SectionTitle>Health trackers</SectionTitle>
      {h.metrics.map((m) => (
        <MetricCard key={m.id} metric={m} />
      ))}
      {meds.length > 0 && <AdherenceCard meds={meds} />}
    </>
  );
}

function MetricCard({ metric }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const h = state.health;
  const [days, setDays] = useState(30);
  const [sheet, setSheet] = useState(null);
  const [all, setAll] = useState(false);
  const from = days ? Date.now() - days * 86400000 : 0;
  const series = useMemo(() => chartSeries(h, metric, from), [h, metric, from]);
  const readings = readingsFor(h, metric.id).reverse();
  const last = readings[0];
  const flag = last ? outOfRange(metric, last.values) : null;

  const remove = (r) =>
    Alert.alert('Delete this reading?', `${formatValues(metric, r.values)} · ${formatShortDate(new Date(r.t))} ${formatClock(new Date(r.t))}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => dispatch({ type: 'REMOVE_READING', id: r.id }) },
    ]);

  return (
    <Card title={metric.name} right={<Button small title="＋ Reading" onPress={() => setSheet({})} />}>
      {last ? (
        <View style={{ marginBottom: 10 }}>
          <Txt faint size={12}>Latest · {formatShortDate(new Date(last.t))} {formatClock(new Date(last.t))}</Txt>
          <Txt size={24} weight="800" color={flag ? t.warn : t.text}>
            {formatValues(metric, last.values)}
            {flag ? <Txt size={13} color={t.warn}>  {flag === 'high' ? 'above' : 'below'} your range</Txt> : null}
          </Txt>
        </View>
      ) : (
        <Empty>No readings yet. Tap ＋ Reading to add one.</Empty>
      )}
      {series[0].length > 0 && (
        <>
          <MultiLineChart series={series} low={metric.low} high={metric.high} decimals={metric.decimals ?? 1} />
          {metric.fields.length > 1 && (
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
              {metric.fields.map((f, i) => (
                <Txt key={f} size={12} color={SERIES_COLORS(t)[i]}>● {f}</Txt>
              ))}
            </View>
          )}
          <Segmented options={RANGES} value={days} onChange={setDays} />
        </>
      )}
      {readings.length > 0 && (
        <View style={{ marginTop: 10 }}>
          {(all ? readings : readings.slice(0, 5)).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setSheet({ reading: r })}
              onLongPress={() => remove(r)}
              style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}
            >
              <Txt dim size={13}>
                {formatShortDate(new Date(r.t))} {formatClock(new Date(r.t))}
                {r.note ? ` · ${r.note}` : ''}
              </Txt>
              <Txt size={13} weight="600" color={outOfRange(metric, r.values) ? t.warn : t.text}>
                {formatValues(metric, r.values)}
              </Txt>
            </Pressable>
          ))}
          {readings.length > 5 && (
            <Button small variant="ghost" title={all ? 'Show fewer' : `Show all ${readings.length}`} onPress={() => setAll(!all)} />
          )}
          <Txt faint size={12} style={{ marginTop: 4 }}>Tap a reading to change it, hold to delete it.</Txt>
        </View>
      )}
      {sheet && <ReadingSheet metric={metric} reading={sheet.reading} onClose={() => setSheet(null)} />}
    </Card>
  );
}

function AdherenceCard({ meds }) {
  const t = useTheme();
  const { state } = useStore();
  const [open, setOpen] = useState(null);
  const a = adherence(state.health, 7);
  return (
    <Card title="💊 Medication, last 7 days">
      {meds.map((m) => {
        const x = a[m.id] || { taken: 0, due: 0 };
        return (
          <Pressable
            key={m.id}
            onPress={() => setOpen(m.id)}
            style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}
          >
            <Txt>{m.name}</Txt>
            <Txt weight="600" color={x.due && x.taken < x.due ? t.warn : t.good}>
              {x.taken} of {x.due} doses ›
            </Txt>
          </Pressable>
        );
      })}
      <Txt faint size={12} style={{ marginTop: 4 }}>Tap a medication to see or fix past days.</Txt>
      {open && (
        <Sheet visible onClose={() => setOpen(null)} title="Dose history">
          <DoseHistory medId={open} />
        </Sheet>
      )}
    </Card>
  );
}

// ‹ date › picker for past days (never later than today).
function DayStepper({ day, onChange, label }) {
  const today = dayKey();
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>{label}</Txt> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button small variant="secondary" title="‹" onPress={() => onChange(dayKey(addDays(parseDayKey(day), -1)))} />
        <Txt weight="600">{day === today ? 'Today' : `${formatDayLabel(day)} · ${formatShortDate(day)}`}</Txt>
        <Button small variant="secondary" title="›" disabled={day >= today} onPress={() => onChange(dayKey(addDays(parseDayKey(day), 1)))} />
      </View>
    </View>
  );
}

// Past days of one scheduled medication: tick or untick any dose, or mark a whole stretch taken.
function DoseHistory({ medId }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const med = state.health.meds.find((m) => m.id === medId);
  const today = dayKey();
  const [since, setSince] = useState(dayKey(addDays(new Date(), -6)));
  const [shown, setShown] = useState(14);
  if (!med || !isScheduled(med)) return <Empty>This medication is taken as needed, so it has no schedule to fill in.</Empty>;
  const times = sortTimes(med.times);
  const days = Array.from({ length: shown }, (_, i) => dayKey(addDays(new Date(), -i)));
  const taken = (day, time) => ((state.health.doses[day] || {})[med.id] || {})[time];

  const markSince = () =>
    Alert.alert(
      'Mark doses taken?',
      `Every ${med.name} dose from ${since === today ? 'today' : formatShortDate(since)} until now is marked taken at its usual time. Doses you already marked keep their time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark taken', onPress: () => dispatch({ type: 'BACKFILL_DOSES', medId: med.id, from: since }) },
      ]
    );

  return (
    <View>
      <Txt weight="700" style={{ marginBottom: 6 }}>
        {med.name}
        {med.dose ? <Txt dim> · {med.dose}</Txt> : null}
      </Txt>
      <Card style={{ marginHorizontal: 0 }}>
        <DayStepper label="Taken every day since" day={since} onChange={setSince} />
        <Button small title="Mark every dose taken since then" onPress={markSince} />
      </Card>
      <Txt dim size={13} weight="600" style={{ marginTop: 6, marginBottom: 4 }}>Or tick days one by one</Txt>
      {days.map((day) => (
        <View key={day} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
          <Txt size={14} style={{ flex: 1 }}>{day === today ? 'Today' : `${formatDayLabel(day)} · ${formatShortDate(day)}`}</Txt>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {times.map((time) => {
              const due = doseDue(day, time);
              const got = taken(day, time);
              return (
                <Pressable
                  key={time}
                  disabled={!due}
                  onPress={() =>
                    dispatch({
                      type: 'TOGGLE_DOSE',
                      day,
                      medId: med.id,
                      slot: time,
                      at: day === today ? new Date().toISOString() : atTime(parseDayKey(day), time).toISOString(),
                    })
                  }
                  style={({ pressed }) => ({
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 14,
                    backgroundColor: got ? t.good : t.cardAlt,
                    opacity: !due ? 0.4 : pressed ? 0.6 : 1,
                  })}
                >
                  <Txt size={13} weight="600" color={got ? t.primaryText : t.text}>
                    {got ? '✓ ' : ''}
                    {formatTime12(time)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Button small variant="ghost" title="Show 30 more days" onPress={() => setShown((n) => n + 30)} />
    </View>
  );
}

const SERIES_COLORS = (t) => [t.primary, t.water, t.fat];

// Up to three series (e.g. systolic and diastolic) with the person's own range shaded.
function MultiLineChart({ series, low, high, decimals, height = 180 }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const pts = series.flat();
  const ys = pts.map((p) => p.y);
  if (typeof low === 'number') ys.push(low);
  if (typeof high === 'number') ys.push(high);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (maxY - minY < 2) {
    minY -= 1;
    maxY += 1;
  }
  const pad = (maxY - minY) * 0.1;
  minY -= pad;
  maxY += pad;
  const xs = pts.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) === minX ? minX + 1 : Math.max(...xs);
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const w = Math.max(1, width - padL - padR);
  const h = height - padT - padB;
  const sx = (x) => padL + ((x - minX) / (maxX - minX)) * w;
  const sy = (y) => padT + (1 - (y - minY) / (maxY - minY)) * h;
  const ticks = [minY + (maxY - minY) * 0.15, (minY + maxY) / 2, maxY - (maxY - minY) * 0.15];
  const colors = SERIES_COLORS(t);
  const fmtX = (x) => formatShortDate(new Date(x));
  const hasLow = typeof low === 'number';
  const hasHigh = typeof high === 'number';

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height, marginBottom: 8 }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {(hasLow || hasHigh) && (
            <Rect
              x={padL}
              width={w}
              y={sy(hasHigh ? high : maxY)}
              height={Math.max(0, sy(hasLow ? low : minY) - sy(hasHigh ? high : maxY))}
              fill={t.good}
              opacity={0.08}
            />
          )}
          {ticks.map((v, i) => (
            <React.Fragment key={i}>
              <Line x1={padL} x2={width - padR} y1={sy(v)} y2={sy(v)} stroke={t.border} strokeWidth={1} />
              <SvgText x={padL - 6} y={sy(v) + 4} fontSize={10} fill={t.textFaint} textAnchor="end">
                {v.toFixed(decimals > 0 && maxY - minY < 10 ? 1 : 0)}
              </SvgText>
            </React.Fragment>
          ))}
          {series.map((s, i) => (
            <React.Fragment key={i}>
              {s.length > 1 && (
                <Polyline points={s.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} fill="none" stroke={colors[i]} strokeWidth={2} strokeLinejoin="round" />
              )}
              {s.length <= 60 && s.map((p, j) => <Circle key={j} cx={sx(p.x)} cy={sy(p.y)} r={3} fill={colors[i]} />)}
            </React.Fragment>
          ))}
          <SvgText x={padL} y={height - 6} fontSize={10} fill={t.textFaint}>
            {fmtX(minX)}
          </SvgText>
          <SvgText x={width - padR} y={height - 6} fontSize={10} fill={t.textFaint} textAnchor="end">
            {fmtX(maxX)}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

// ---------- Sheets ----------

function ReadingSheet({ metric, reading, onClose }) {
  const t = useTheme();
  const { dispatch } = useStore();
  const [values, setValues] = useState(reading ? reading.values : metric.fields.map(() => null));
  const when = reading ? new Date(reading.t) : new Date();
  const [day, setDay] = useState(dayKey(when));
  const [time, setTime] = useState(minutesToTime(when.getHours() * 60 + when.getMinutes()));
  const [note, setNote] = useState(reading ? reading.note || '' : '');
  const at = atTime(parseDayKey(day), time);
  const future = at.getTime() > Date.now() + 60000;
  const ok = validValues(metric, values) && !future;

  const save = () => {
    const d = at;
    dispatch({ type: 'ADD_READING', reading: { ...(reading ? { id: reading.id } : {}), metricId: metric.id, t: d.toISOString(), values, note: note.trim() } });
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={reading ? `Edit ${metric.name.toLowerCase()}` : metric.name}
      footer={
        <View style={{ gap: 8 }}>
          <Button title="Save" disabled={!ok} onPress={save} />
          {reading && (
            <Button
              variant="ghost"
              color={t.danger}
              title="Delete this reading"
              onPress={() => {
                dispatch({ type: 'REMOVE_READING', id: reading.id });
                onClose();
              }}
            />
          )}
        </View>
      }
    >
      {metric.fields.map((f, i) => (
        <NumberField
          key={f}
          label={f}
          autoFocus={i === 0}
          value={values[i]}
          suffix={metric.unit}
          decimals={(metric.decimals ?? 1) > 0}
          onChange={(v) => setValues((vs) => vs.map((x, j) => (j === i ? v : x)))}
        />
      ))}
      <DayStepper label="Date" day={day} onChange={setDay} />
      <TimeRow label="Time" value={time} onChange={setTime} />
      {future && <Txt size={12} color={t.warn}>That time hasn't happened yet today.</Txt>}
      <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. after breakfast" />
    </Sheet>
  );
}

function MedEditorSheet({ med, onClose }) {
  const t = useTheme();
  const { dispatch } = useStore();
  const [name, setName] = useState(med.name || '');
  const [dose, setDose] = useState(med.dose || '');
  const [kind, setKind] = useState(med.id && !isScheduled(med) ? 'prn' : 'scheduled');
  const [times, setTimes] = useState(isScheduled(med) ? med.times : ['08:00']);
  const [remind, setRemind] = useState(med.remind !== false);
  const [active, setActive] = useState(med.active !== false);
  const [view, setView] = useState('main'); // main | history
  // New medication already being taken: fill in doses since this day (null = start from now).
  const [since, setSince] = useState(null);

  const save = () => {
    const id = med.id || uid();
    dispatch({ type: 'SAVE_MED', med: { id, name: name.trim(), dose: dose.trim(), times: kind === 'prn' ? [] : times, remind, active } });
    if (!med.id && since && kind === 'scheduled') dispatch({ type: 'BACKFILL_DOSES', medId: id, from: since });
    onClose();
  };

  if (view === 'history') {
    return (
      <Sheet visible onClose={onClose} title="Dose history" footer={<Button variant="secondary" title="‹ Back" onPress={() => setView('main')} />}>
        <DoseHistory medId={med.id} />
      </Sheet>
    );
  }
  const remove = () =>
    Alert.alert(`Delete ${med.name}?`, 'Its history of doses is deleted too. To stop it for now but keep the history, pause it instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'REMOVE_MED', id: med.id });
          onClose();
        },
      },
    ]);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={med.id ? 'Edit medication' : 'Add a medication'}
      footer={
        <View style={{ gap: 8 }}>
          <Button title="Save" disabled={!name.trim() || (kind === 'scheduled' && !times.length)} onPress={save} />
          {med.id && <Button variant="ghost" color={t.danger} title="Delete" onPress={remove} />}
        </View>
      }
    >
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Metformin" autoFocus={!med.id} />
      <TextField label="Dose (optional)" value={dose} onChangeText={setDose} placeholder="e.g. 500 mg" />
      <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>When</Txt>
      <ChipRow
        options={[
          { key: 'scheduled', label: 'At set times' },
          { key: 'prn', label: 'As needed' },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === 'scheduled' && (
        <View style={{ marginTop: 8 }}>
          {times.map((time, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <TimeRow label={`Dose ${i + 1}`} value={time} onChange={(v) => setTimes((ts) => ts.map((x, j) => (j === i ? v : x)))} />
              </View>
              {times.length > 1 && <Button small variant="ghost" title="✕" onPress={() => setTimes((ts) => ts.filter((_, j) => j !== i))} />}
            </View>
          ))}
          <Button small variant="ghost" title="＋ Another time" style={{ alignSelf: 'flex-start' }} onPress={() => setTimes((ts) => [...ts, '20:00'])} />
          <SwitchRow label="Remind me" sub="A notification at each time, unless it's already marked taken." value={remind} onChange={setRemind} />
          {!med.id && (
            <>
              <SwitchRow
                label="I've already been taking it"
                sub="Marks every dose taken since the day you started, at its usual time. You can untick any you missed afterwards."
                value={!!since}
                onChange={(v) => setSince(v ? dayKey(addDays(new Date(), -13)) : null)}
              />
              {since && <DayStepper label="Started on" day={since} onChange={setSince} />}
            </>
          )}
        </View>
      )}
      {med.id && <SwitchRow label="Taking it now" sub="Off pauses it: hidden from Today, history kept." value={active} onChange={setActive} />}
      {med.id && isScheduled(med) && (
        <Button variant="secondary" title="Dose history: fix or fill in past days ›" style={{ marginTop: 8 }} onPress={() => setView('history')} />
      )}
    </Sheet>
  );
}

function MetricEditorSheet({ metric, onClose }) {
  const t = useTheme();
  const { dispatch } = useStore();
  const isNew = !metric.id;
  const [name, setName] = useState(metric.name || '');
  const [unit, setUnit] = useState(metric.unit || '');
  const [fields, setFields] = useState(metric.fields && metric.fields.length ? metric.fields : ['']);
  const [decimals, setDecimals] = useState(metric.decimals ?? 1);
  const [low, setLow] = useState(metric.low ?? null);
  const [high, setHigh] = useState(metric.high ?? null);

  const applyPreset = (p) => {
    setName(p.name);
    setUnit(p.unit);
    setFields(p.fields);
    setDecimals(p.decimals);
  };
  const cleanFields = fields.map((f, i) => f.trim() || (fields.length === 1 ? name.trim() || 'Value' : `Value ${i + 1}`));
  const save = () => {
    dispatch({
      type: 'SAVE_METRIC',
      metric: { ...(metric.id ? { id: metric.id } : {}), name: name.trim(), unit: unit.trim(), fields: cleanFields, decimals, low: low ?? undefined, high: high ?? undefined },
    });
    onClose();
  };
  const remove = () =>
    Alert.alert(`Delete ${metric.name}?`, 'All of its readings are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'REMOVE_METRIC', id: metric.id });
          onClose();
        },
      },
    ]);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={isNew ? 'New chart' : `Edit ${metric.name}`}
      footer={
        <View style={{ gap: 8 }}>
          <Button title="Save" disabled={!name.trim()} onPress={save} />
          {!isNew && <Button variant="ghost" color={t.danger} title="Delete chart and readings" onPress={remove} />}
        </View>
      }
    >
      {isNew && (
        <>
          <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>Start from</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {METRIC_PRESETS.map((p) => (
              <Button key={p.key} small variant="secondary" title={`${p.icon} ${p.name}${p.key === 'glucose' || p.key === 'glucoseMmol' ? ` (${p.unit})` : ''}`} onPress={() => applyPreset(p)} />
            ))}
          </View>
        </>
      )}
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Blood pressure" />
      <TextField label="Unit (optional)" value={unit} onChangeText={setUnit} placeholder="e.g. mmHg" />
      <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>Numbers per reading</Txt>
      <ChipRow
        options={[
          { key: 1, label: 'One' },
          { key: 2, label: 'Two (like 120 / 80)' },
        ]}
        value={fields.length}
        onChange={(n) => setFields((fs) => (n === 1 ? [fs[0] || ''] : [fs[0] || '', fs[1] || '']))}
      />
      {fields.length > 1 &&
        fields.map((f, i) => (
          <TextField key={i} label={`Name of number ${i + 1}`} value={f} onChangeText={(v) => setFields((fs) => fs.map((x, j) => (j === i ? v : x)))} placeholder={i ? 'e.g. Diastolic' : 'e.g. Systolic'} />
        ))}
      <Txt dim size={13} weight="600" style={{ marginTop: 10, marginBottom: 6 }}>Decimals</Txt>
      <ChipRow
        options={[
          { key: 0, label: 'Whole numbers' },
          { key: 1, label: 'One decimal' },
        ]}
        value={decimals}
        onChange={setDecimals}
      />
      <Txt dim size={13} weight="600" style={{ marginTop: 14 }}>Your range (optional)</Txt>
      <Txt faint size={12} style={{ marginBottom: 6 }}>
        If your doctor gave you a target range, enter it: the chart shades it and readings outside it are highlighted
        {fields.length > 1 ? ` (judged on ${(cleanFields[0] || 'the first number').toLowerCase()})` : ''}.
      </Txt>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <NumberField label="Low" value={low} onChange={setLow} style={{ flex: 1 }} />
        <NumberField label="High" value={high} onChange={setHigh} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

function SwitchRow({ label, sub, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Txt weight="600">{label}</Txt>
        {sub ? <Txt faint size={12}>{sub}</Txt> : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

// ---------- Settings page ----------

export function HealthSettingsPage() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const h = state.health;
  const [med, setMed] = useState(null);
  const [metric, setMetric] = useState(null);

  return (
    <>
      <Card>
        <Txt dim size={14} style={{ lineHeight: 20 }}>
          Optional extras for anyone who needs them: tick off medications, and chart any measurement you track, like blood pressure or blood sugar.
        </Txt>
        <Txt dim size={14} style={{ lineHeight: 20, marginTop: 8 }}>🔒 {PRIVACY_NOTE} Your exported backup file includes it.</Txt>
        <SwitchRow label="Use health trackers" value={h.enabled} onChange={(v) => dispatch({ type: 'SET_HEALTH', patch: { enabled: v } })} />
        <Txt faint size={12}>Turning this off hides them everywhere and stops medication reminders; nothing is deleted.</Txt>
      </Card>

      {h.enabled && (
        <>
          <SectionTitle right={<Button small variant="ghost" title="＋ Add" onPress={() => setMed({})} />}>Medications</SectionTitle>
          <Card>
            {h.meds.length ? (
              h.meds.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => setMed(m)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    borderBottomWidth: i < h.meds.length - 1 ? 0.5 : 0,
                    borderBottomColor: t.border,
                    opacity: pressed ? 0.6 : m.active === false ? 0.5 : 1,
                  })}
                >
                  <Txt weight="600">
                    💊 {m.name}
                    {m.dose ? <Txt dim> · {m.dose}</Txt> : null}
                  </Txt>
                  <Txt faint size={12}>
                    {m.active === false ? 'Paused · ' : ''}
                    {isScheduled(m) ? m.times.map(formatTime12).join(', ') + (m.remind === false ? ' · no reminder' : ' · reminders on') : 'As needed'}
                  </Txt>
                </Pressable>
              ))
            ) : (
              <Empty>None yet. Add one to tick it off on the Today page.</Empty>
            )}
          </Card>

          <SectionTitle right={<Button small variant="ghost" title="＋ Add" onPress={() => setMetric({})} />}>Charts</SectionTitle>
          <Card>
            {h.metrics.length ? (
              h.metrics.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => setMetric(m)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    borderBottomWidth: i < h.metrics.length - 1 ? 0.5 : 0,
                    borderBottomColor: t.border,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Txt weight="600">📈 {m.name}</Txt>
                  <Txt faint size={12}>
                    {m.fields.join(' / ')}
                    {m.unit ? ` · ${m.unit}` : ''} · {readingsFor(h, m.id).length} readings
                  </Txt>
                </Pressable>
              ))
            ) : (
              <Empty>None yet. Add blood pressure, blood sugar or anything else you measure; charts show on the Progress page.</Empty>
            )}
          </Card>
        </>
      )}
      {med && <MedEditorSheet med={med} onClose={() => setMed(null)} />}
      {metric && <MetricEditorSheet metric={metric} onClose={() => setMetric(null)} />}
    </>
  );
}
