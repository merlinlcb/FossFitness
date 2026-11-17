// Social = Quests, Chat, Compare and shared Notes in one tab.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Circle, Rect } from 'react-native-svg';
import { useStore } from '../state/store';
import { useHub } from '../state/hub';
import { useTheme } from '../theme';
import { Screen, Card, Txt, Button, Segmented, ProgressBar, Empty } from '../components/ui';
import { titleForLevel } from '../lib/game';
import { api } from '../lib/api';
import { dayKey, formatDayLabel, formatShortDate } from '../lib/dates';
import { formatWeight, formatWeightDelta } from '../lib/units';
import QuestsScreen from './QuestsScreen';
import ChatScreen from './ChatScreen';

const VIEWS = [
  { key: 'quests', label: 'Quests' },
  { key: 'chat', label: 'Chat' },
  { key: 'compare', label: 'Compare' },
  { key: 'notes', label: 'Notes' },
];

export default function SocialScreen({ goTo, sub, openSettings }) {
  const view = VIEWS.some((v) => v.key === sub) ? sub : 'quests';
  const { unread } = useHub();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Segmented
          options={VIEWS.map((v) => ({ ...v, label: v.key === 'chat' && unread ? `Chat (${unread})` : v.label }))}
          value={view}
          onChange={(k) => goTo('social', { sub: k })}
        />
      </View>
      <View style={{ flex: 1 }}>
        {view === 'quests' && <QuestsScreen openSettings={openSettings} />}
        {view === 'chat' && <ChatScreen openSettings={openSettings} />}
        {view === 'compare' && <CompareView openSettings={openSettings} />}
        {view === 'notes' && <NotesView openSettings={openSettings} />}
      </View>
    </View>
  );
}

function SignInFirst({ what, openSettings }) {
  return (
    <Screen>
      <Card>
        <Txt dim style={{ marginBottom: 10 }}>Sign in to your server to {what}.</Txt>
        <Button title="Set up account" onPress={openSettings} />
      </Card>
    </Screen>
  );
}

// ── Compare: weights and which daily goals each person hit ────────────────────
const GOALS = [
  { id: 'water', icon: '💧', label: 'Water' },
  { id: 'food', icon: '🍽️', label: 'Calories on target' },
  { id: 'protein', icon: '🥩', label: 'Protein' },
  { id: 'move', icon: '🏋️', label: 'Workout' },
  { id: 'weigh', icon: '⚖️', label: 'Weigh-in' },
  { id: 'fast', icon: '⏱️', label: '12h fast' },
];

function CompareView({ openSettings }) {
  const t = useTheme();
  const { state } = useStore();
  const { auth } = useHub();
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const units = state.profile.units;

  useEffect(() => {
    if (!auth) return;
    let live = true;
    setError('');
    api(auth.server, `/api/compare?days=${days}&today=${dayKey()}`, { token: auth.token })
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [auth, days]);

  if (!auth) return <SignInFirst what="compare with each other" openSettings={openSettings} />;
  const people = data ? [...data.people].sort((a, b) => (b.isMe - a.isMe) || a.id - b.id) : [];
  const on = (p, g) => p.days.some((d) => d.hits[g] !== null && d.hits[g] !== undefined);

  return (
    <Screen>
      <View style={{ marginBottom: 10 }}>
        <Segmented options={[{ key: 7, label: '7 days' }, { key: 14, label: '14 days' }, { key: 30, label: '30 days' }]} value={days} onChange={setDays} />
      </View>
      {error ? <Txt color={t.warn} style={{ marginBottom: 8 }}>{error}</Txt> : null}
      {!data && !error ? <Empty>Loading…</Empty> : null}
      {people.map((p) => {
        const goals = GOALS.filter((g) => on(p, g.id));
        const hit = p.days.reduce((a, d) => a + goals.filter((g) => d.hits[g.id]).length, 0);
        const possible = goals.length * p.days.length;
        const today = p.days[0];
        return (
          <Card key={p.id} title={p.isMe ? `${p.displayName} (you)` : p.displayName}>
            {p.level ? <HeroStats level={p.level} streak={p.streak || 0} id={p.id} /> : null}
            {p.currentKg ? (
              <>
                <Txt size={26} weight="800">{formatWeight(p.currentKg, units)}</Txt>
                <Txt faint size={12}>
                  Weighed {formatDayLabel(p.currentDay)}
                  {p.startKg && p.startKg !== p.currentKg ? ` · ${formatWeightDelta(p.currentKg - p.startKg, units)} in ${days} days` : ''}
                  {p.goalKg ? ` · goal ${formatWeight(p.goalKg, units)}` : ''}
                </Txt>
              </>
            ) : (
              <Txt faint>No weigh-ins yet</Txt>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <Txt size={13}>Goals hit: {hit} of {possible}</Txt>
              <Txt dim size={13}>today {goals.filter((g) => today.hits[g.id]).length}/{goals.length}</Txt>
            </View>
            <ProgressBar value={hit} max={possible || 1} color={t.good} height={8} style={{ marginTop: 4 }} />
            {goals.map((g) => {
              const n = p.days.filter((d) => d.hits[g.id]).length;
              return (
                <View key={g.id} style={styles.goalRow}>
                  <Txt size={13} style={{ flex: 1 }}>{g.icon} {g.label}</Txt>
                  <Txt dim size={13}>{n}/{p.days.length}</Txt>
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              {[...p.days].reverse().map((d) => {
                const n = goals.filter((g) => d.hits[g.id]).length;
                const share = goals.length ? n / goals.length : 0;
                return (
                  <View key={d.day} accessibilityLabel={`${formatShortDate(d.day)}: ${n} of ${goals.length} goals`}
                    style={{ width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: share ? t.good + Math.round(40 + share * 180).toString(16).padStart(2, '0') : t.track }}>
                    <Text style={{ fontSize: 10, color: t.text, fontWeight: '700' }}>{n}</Text>
                  </View>
                );
              })}
            </View>
            <Txt faint size={11} style={{ marginTop: 4 }}>Goals hit per day, oldest first</Txt>
          </Card>
        );
      })}
      <Txt faint size={12} center>Only weights and which goals were hit are shared, never what anyone ate.</Txt>
    </Screen>
  );
}

// Level and streak, front and centre: a glowing gold level medal and a flame that
// flickers while the streak is alive.
const GOLD = '#FACC15';
const EMBER = '#F97316';

function HeroStats({ level, streak, id }) {
  const t = useTheme();
  const flicker = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!streak) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [streak, flicker]);
  const flameScale = flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const hot = streak >= 7;
  const S = 88;
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
      {/* Level medal */}
      <View style={[styles.hero, { borderColor: GOLD, shadowColor: GOLD, backgroundColor: t.cardAlt }]}>
        <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={S} height={S} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id={`lv${id}`} cx="40%" cy="35%" r="65%">
                <Stop offset="0" stopColor="#FEF08A" />
                <Stop offset="0.55" stopColor={GOLD} />
                <Stop offset="1" stopColor="#B45309" />
              </RadialGradient>
            </Defs>
            <Circle cx={S / 2} cy={S / 2} r={S / 2 - 3} fill={`url(#lv${id})`} stroke="#FDE68A" strokeWidth={3} />
          </Svg>
          <Text style={styles.lvSmall}>LEVEL</Text>
          <Text style={styles.lvBig}>{level}</Text>
        </View>
        <Text style={[styles.heroLabel, { color: GOLD }]} numberOfLines={1}>{titleForLevel(level)}</Text>
      </View>
      {/* Streak flame */}
      <View style={[styles.hero, { borderColor: streak ? EMBER : t.border, shadowColor: EMBER, backgroundColor: t.cardAlt, elevation: streak ? 10 : 0 }]}>
        {streak ? (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={`st${id}`} x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={EMBER} stopOpacity={hot ? 0.45 : 0.3} />
                <Stop offset="1" stopColor={EMBER} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#st${id})`} />
          </Svg>
        ) : null}
        <View style={{ height: S, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.Text style={{ fontSize: 34, opacity: streak ? 1 : 0.3, transform: [{ scale: streak ? flameScale : 1 }] }}>🔥</Animated.Text>
          <Text style={[styles.streakBig, { color: streak ? EMBER : t.textFaint }]}>{streak}</Text>
        </View>
        <Text style={[styles.heroLabel, { color: streak ? EMBER : t.textFaint }]}>
          {!streak ? 'No streak yet' : hot ? `${streak}-day streak! 🔥` : `${streak === 1 ? 'day' : 'days'} in a row`}
        </Text>
      </View>
    </View>
  );
}

// ── Notes: a notepad everyone on the server can read and edit ────────────────
function NotesView({ openSettings }) {
  const t = useTheme();
  const { auth } = useHub();
  const [notes, setNotes] = useState(null);
  const [editing, setEditing] = useState(null); // { id?, title, body }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!auth) return;
    api(auth.server, '/api/notes', { token: auth.token })
      .then((r) => { setNotes(r.notes); setError(''); })
      .catch((e) => setError(e.message));
  }, [auth]);
  useEffect(load, [load]);

  if (!auth) return <SignInFirst what="share notes" openSettings={openSettings} />;

  const save = async () => {
    setBusy(true);
    try {
      await api(auth.server, '/api/notes/save', { method: 'POST', token: auth.token, body: editing });
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <Screen>
        <Card>
          <TextInput value={editing.title} onChangeText={(v) => setEditing({ ...editing, title: v })} placeholder="Title"
            placeholderTextColor={t.textFaint} style={[styles.title, { color: t.text, borderBottomColor: t.border }]} />
          <TextInput value={editing.body} onChangeText={(v) => setEditing({ ...editing, body: v })} placeholder="Write something…"
            placeholderTextColor={t.textFaint} multiline textAlignVertical="top" style={[styles.body, { color: t.text }]} />
          {error ? <Txt color={t.warn} size={13}>{error}</Txt> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button variant="secondary" title="Cancel" onPress={() => { setEditing(null); setError(''); }} />
            <Button style={{ flex: 1 }} title={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={save} />
          </View>
          {editing.id ? (
            <Button small variant="ghost" color={t.danger} title="Delete note" style={{ marginTop: 6 }}
              onPress={() => Alert.alert('Delete this note?', 'It is deleted for everyone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => {
                  try {
                    await api(auth.server, '/api/notes/delete', { method: 'POST', token: auth.token, body: { id: editing.id } });
                    setEditing(null);
                    load();
                  } catch (e) { setError(e.message); }
                } },
              ])} />
          ) : null}
        </Card>
        <Txt faint size={12} center>Everyone on your server can read and edit notes.</Txt>
      </Screen>
    );
  }

  return (
    <Screen>
      <Button title="＋ New note" onPress={() => setEditing({ title: '', body: '' })} style={{ marginBottom: 12 }} />
      {error ? <Txt color={t.warn} style={{ marginBottom: 8 }}>{error}</Txt> : null}
      {notes === null && !error ? <Empty>Loading…</Empty> : null}
      {notes && !notes.length ? <Empty>No notes yet. Shared shopping lists, plans and recipes go well here.</Empty> : null}
      {(notes || []).map((n) => (
        <Card key={n.id} onPress={() => setEditing({ id: n.id, title: n.title, body: n.body })}>
          <Txt size={16} weight="700">{n.title}</Txt>
          {n.body ? <Txt dim size={14} numberOfLines={4} style={{ marginTop: 4, lineHeight: 20 }}>{n.body}</Txt> : null}
          <Txt faint size={11} style={{ marginTop: 6 }}>
            {n.updatedBy || n.createdBy} · {new Date(n.updated).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Txt>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', borderWidth: 2, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 6, overflow: 'hidden', elevation: 10, shadowOpacity: 0.6, shadowRadius: 12 },
  lvSmall: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#451A03' },
  lvBig: { fontSize: 34, fontWeight: '900', color: '#451A03', lineHeight: 38 },
  streakBig: { fontSize: 32, fontWeight: '900', lineHeight: 36, marginTop: -2 },
  heroLabel: { fontSize: 13, fontWeight: '800', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  goalRow: { flexDirection: 'row', paddingVertical: 4 },
  title: { fontSize: 18, fontWeight: '700', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { fontSize: 15, minHeight: 200, paddingVertical: 10, lineHeight: 21 },
});
