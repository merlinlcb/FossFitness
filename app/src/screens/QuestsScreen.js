import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '../state/store';
import { useHub } from '../state/hub';
import { useTheme, areaColor } from '../theme';
import { Screen, Card, Txt, Button, ProgressBar, Ring, SectionTitle, BarChart } from '../components/ui';
import { formatWater } from '../lib/units';
import { BadgeShelf } from '../components/Badges';
import { shortDayName } from '../lib/dates';

const ago = (ms) => {
  if (!ms) return 'never';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 36) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
};

export default function QuestsScreen({ openSettings }) {
  const t = useTheme();
  const { state } = useStore();
  const { game, people, auth } = useHub();
  const waterUnit = state.profile.waterUnit;

  // This week's race. A summary from an older week counts as 0 so far.
  const race = (people || [])
    .map((p) => {
      const st = p.stats || {};
      const sameDay = st.day === game.today.day;
      return {
        id: p.id,
        name: p.isMe ? 'You' : p.displayName,
        isMe: p.isMe,
        weekXp: p.isMe ? game.weekXp : st.weekKey === game.weekKey ? st.weekXp || 0 : 0,
        level: p.isMe ? game.level : st.level || 1,
        title: p.isMe ? game.title : st.title || 'Rookie',
        streak: p.isMe ? game.streak : st.streak || 0,
        todayXp: p.isMe ? game.today.xp : sameDay ? st.todayXp || 0 : 0,
        quests: p.isMe ? `${game.questsDone}/${game.quests.length}` : `${sameDay ? st.questsDone || 0 : 0}/${st.questsTotal || 6}`,
        fastingSince: p.isMe ? null : st.fastingSince,
        seen: p.statsUpdated,
        hasStats: p.isMe || !!st.updatedAt,
      };
    })
    .sort((a, b) => b.weekXp - a.weekXp);
  const raceMax = Math.max(1, ...race.map((r) => r.weekXp));
  const others = race.filter((r) => !r.isMe);
  const me = race.find((r) => r.isMe);
  let raceLine = null;
  if (me && others.length) {
    const top = others[0];
    const diff = me.weekXp - top.weekXp;
    raceLine = diff > 0 ? `You lead ${top.name} by ${diff} XP` : diff < 0 ? `${top.name} leads you by ${-diff} XP` : `You and ${top.name} are tied`;
  }

  return (
    <Screen>
      <Card>
        <View style={s.heroRow}>
          <Ring value={game.levelXp} max={game.levelSpan} size={96} stroke={9}>
            <Text style={{ color: t.text, fontSize: 30, fontWeight: '800' }}>{game.level}</Text>
            <Text style={{ color: t.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }}>LEVEL</Text>
          </Ring>
          <View style={{ flex: 1 }}>
            <Txt size={22} weight="800">{game.title}</Txt>
            <Txt dim size={14}>{game.xp.toLocaleString()} XP total</Txt>
            <Txt dim size={13} style={{ marginTop: 6 }}>
              {game.toNext.toLocaleString()} XP to level {game.level + 1}
            </Txt>
          </View>
        </View>
        <View style={[s.statRow, { borderTopColor: t.border }]}>
          <Stat value={`🔥 ${game.streak}`} label="day streak" />
          <Stat value={`+${game.today.xp}`} label="XP today" />
          <Stat value={String(game.weekXp)} label="XP this week" />
        </View>
        {game.streakAtRisk ? (
          <Txt color={t.warn} size={13} style={{ marginTop: 10 }}>
            ⚠️ Log anything today to keep your {game.streak}-day streak.
          </Txt>
        ) : game.streak === 0 && game.bestStreak > 0 ? (
          <Txt faint size={13} style={{ marginTop: 10 }}>
            Best streak so far: {game.bestStreak} days. Log something today to start a new one.
          </Txt>
        ) : null}
      </Card>

      <SectionTitle right={<Txt dim size={13}>{game.questsDone}/{game.quests.length} done</Txt>}>Today's quests</SectionTitle>
      <Card>
        {game.quests.map((q, i) => (
          <View key={q.id} style={[s.quest, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
            <Text style={s.questIcon}>{q.done ? '✅' : q.icon}</Text>
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="600" color={q.done ? t.textDim : t.text}>{q.title}</Txt>
              <ProgressBar value={q.done ? 1 : q.progress} max={1} height={6} color={areaColor(t, q.area)} style={{ marginTop: 6 }} />
              <Txt faint size={12} style={{ marginTop: 4 }}>
                {q.unit === 'water' ? `${formatWater(q.current, waterUnit)} / ${formatWater(q.target, waterUnit)}` : q.detail}
              </Txt>
            </View>
            <View style={[s.xpChip, { backgroundColor: q.done ? t.primary : t.cardAlt }]}>
              <Text style={{ color: q.done ? t.primaryText : t.textDim, fontSize: 12, fontWeight: '800' }}>{q.done ? 'Done' : `+${q.xp}`}</Text>
            </View>
          </View>
        ))}
        <Txt faint size={12} style={{ marginTop: 8 }}>
          Water, food on target and a workout (or a 12-hour fast) on the same day is a Perfect Day: +50 XP.
        </Txt>
      </Card>

      <SectionTitle>This week</SectionTitle>
      <Card>
        {!auth ? (
          <>
            <Txt dim size={14} style={{ marginBottom: 10 }}>
              Sign in to race each other on weekly XP and to chat.
            </Txt>
            <Button title="Set up account" onPress={openSettings} />
          </>
        ) : !people ? (
          <Txt dim>Loading…</Txt>
        ) : (
          <>
            {raceLine ? <Txt size={16} weight="700" style={{ marginBottom: 6 }}>{raceLine}</Txt> : null}
            {race.map((r) => (
              <View key={r.id} style={{ paddingVertical: 8 }}>
                <View style={s.raceHead}>
                  <Txt size={15} weight="700" style={{ flexShrink: 1 }}>
                    {r.name} <Txt faint size={12}>Lv {r.level} {r.title}</Txt>
                  </Txt>
                  <Txt size={15} weight="800">{r.weekXp} XP</Txt>
                </View>
                <ProgressBar value={r.weekXp} max={raceMax} color={r.isMe ? t.primary : t.star} style={{ marginTop: 6 }} />
                <Txt faint size={12} style={{ marginTop: 4 }}>
                  {r.hasStats
                    ? `🔥 ${r.streak} · +${r.todayXp} today · quests ${r.quests}` +
                      (r.fastingSince ? ` · fasting ${Math.max(0, Math.floor((Date.now() - r.fastingSince) / 3600000))}h` : '') +
                      (r.isMe ? '' : ` · seen ${ago(r.seen)}`)
                    : 'Has not synced yet'}
                </Txt>
              </View>
            ))}
            {!others.length ? <Txt faint size={13}>Nobody else has joined yet.</Txt> : null}
          </>
        )}
      </Card>

      <SectionTitle>Last 7 days</SectionTitle>
      <Card>
        <BarChart
          data={game.recent.map((r) => ({ value: r.xp, label: shortDayName(r.day).slice(0, 2), highlight: r.day === game.today.day }))}
          color={t.primary}
          formatValue={(v) => String(v)}
        />
      </Card>

      <SectionTitle>Badges</SectionTitle>
      <Card>
        <BadgeShelf families={game.families} />
      </Card>
    </Screen>
  );
}

function Stat({ value, label }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Txt size={20} weight="800">{value}</Txt>
      <Txt faint size={12}>{label}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statRow: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  quest: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  questIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  xpChip: { minWidth: 50, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center' },
  raceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
});
