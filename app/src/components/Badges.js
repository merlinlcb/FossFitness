// Badge medals (Audible-style): each family is one medal that levels up through metal tiers.
// <Medal> draws one; <BadgeShelf> is the grid on the Quests page; <BadgeSheet> the detail view;
// <Celebration> the pop-up when something new is earned.
import React, { useId, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Circle, Path, Polygon, G } from 'react-native-svg';
import { useTheme } from '../theme';
import { Sheet, Txt, ProgressBar, Button } from './ui';
import { TIER_NAMES, familyByKey, badgeById } from '../lib/game';
import { formatShortDate } from '../lib/dates';

// [light, mid, dark] per tier: bronze, silver, gold, diamond, amethyst, ruby, obsidian.
const METALS = [
  ['#F6CD9C', '#CD7F32', '#6E4019'],
  ['#FFFFFF', '#C3CBD4', '#68737F'],
  ['#FFF4B0', '#E8B923', '#86600C'],
  ['#EAFBFF', '#7DD3FC', '#25627F'],
  ['#F5E6FF', '#C084FC', '#561E80'],
  ['#FFDDE1', '#F43F5E', '#7A1224'],
  ['#B8BEC7', '#3B4250', '#07090D'],
];
export const metalFor = (tier) => METALS[Math.max(0, Math.min(METALS.length - 1, tier))];
export const tierName = (tier) => TIER_NAMES[Math.max(0, Math.min(TIER_NAMES.length - 1, tier))];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function mix(a, b, amt) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * amt).toString(16).padStart(2, '0')).join('')}`;
}

// Serrated rosette edge around the medal.
const ROSETTE = (() => {
  const pts = [];
  const n = 36;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 44 : 48;
    const a = (Math.PI * i) / n;
    pts.push(`${(50 + r * Math.sin(a)).toFixed(2)},${(50 - r * Math.cos(a)).toFixed(2)}`);
  }
  return pts.join(' ');
})();

// tier: index of the metal (0 = bronze). locked: grey, with `progress` (0–1) toward it as an arc.
// level/maxLevel: little pips on the rim showing how far up the family you are.
export function Medal({ icon, color, tier = 0, locked = false, progress = 0, level = 0, maxLevel = 0, size = 84, ribbon = true }) {
  const t = useTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [hi, mid, lo] = locked ? [t.border, t.track, t.cardAlt] : metalFor(tier);
  const disc = locked ? [t.cardAlt, t.track] : [mix(color, '#FFFFFF', 0.35), mix(color, '#000000', 0.35)];
  const h = ribbon ? size * 1.14 : size;
  const R = 40;
  const C = 2 * Math.PI * R;
  // Pips spread along the bottom of the rim.
  const pips = [];
  if (maxLevel > 1) {
    const spread = Math.min(100, maxLevel * 16);
    for (let i = 0; i < maxLevel; i++) {
      const deg = 180 + spread / 2 - (spread * (i + 0.5)) / maxLevel; // fills left to right
      const a = (deg * Math.PI) / 180;
      pips.push({ x: 50 + R * Math.sin(a), y: 50 - R * Math.cos(a), on: i < level });
    }
  }
  return (
    <View style={{ width: size, height: h, alignItems: 'center' }}>
      <Svg width={size} height={h} viewBox={`0 0 100 ${ribbon ? 114 : 100}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`m${uid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={hi} />
            <Stop offset="0.5" stopColor={mid} />
            <Stop offset="1" stopColor={lo} />
          </LinearGradient>
          <LinearGradient id={`r${uid}`} x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={hi} />
            <Stop offset="1" stopColor={lo} />
          </LinearGradient>
          <RadialGradient id={`d${uid}`} cx="0.4" cy="0.3" r="0.8">
            <Stop offset="0" stopColor={disc[0]} />
            <Stop offset="1" stopColor={disc[1]} />
          </RadialGradient>
        </Defs>
        {ribbon ? (
          <G opacity={locked ? 0.5 : 1}>
            <Polygon points="30,70 44,80 38,113 31,105 23,110" fill={locked ? t.track : mix(color, '#000000', 0.15)} />
            <Polygon points="70,70 56,80 62,113 69,105 77,110" fill={locked ? t.track : mix(color, '#000000', 0.3)} />
          </G>
        ) : null}
        <Polygon points={ROSETTE} fill={`url(#m${uid})`} />
        <Circle cx="50" cy="50" r={R} fill={`url(#r${uid})`} />
        <Circle cx="50" cy="50" r="34" fill={`url(#d${uid})`} stroke={locked ? t.border : hi} strokeWidth="1.2" />
        <Circle cx="50" cy="50" r="30.5" fill="none" stroke="#FFFFFF" strokeOpacity={locked ? 0.06 : 0.28} strokeWidth="0.8" />
        {!locked ? <Path d="M24 40 A 27 27 0 0 1 76 40 A 34 22 0 0 0 24 40 Z" fill="#FFFFFF" fillOpacity="0.16" /> : null}
        {locked && progress > 0 ? (
          <Circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - Math.min(1, progress))} transform="rotate(-90 50 50)" />
        ) : null}
        {pips.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r="2.4" fill={p.on ? '#FFFFFF' : lo} fillOpacity={p.on ? 0.95 : 0.55} stroke={lo} strokeWidth="0.6" />
        ))}
      </Svg>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.3, opacity: locked ? 0.35 : 1 }}>{icon}</Text>
      </View>
    </View>
  );
}

const fmtNum = (v) => (Math.round(v * 10) / 10).toLocaleString();
const progressText = (b) => (b.unit ? `${fmtNum(b.value)} / ${b.goal.toLocaleString()} ${b.unit}` : b.earned ? 'Done' : 'Not yet');

// The grid of families on the Quests page.
export function BadgeShelf({ families }) {
  const t = useTheme();
  const [open, setOpen] = useState(null);
  const earnedTiers = families.reduce((n, f) => n + f.level, 0);
  const allTiers = families.reduce((n, f) => n + f.maxLevel, 0);
  const latest = families
    .flatMap((f) => f.tiers.filter((b) => b.earned))
    .sort((a, b) => (b.earnedOn || '').localeCompare(a.earnedOn || '') || b.tier - a.tier)
    .slice(0, 3);
  const sorted = [...families].sort(
    (a, b) => (b.level > 0) - (a.level > 0) || (b.lastEarnedOn || '').localeCompare(a.lastEarnedOn || '') || b.progress - a.progress,
  );
  const fam = open && families.find((f) => f.key === open);
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt size={13} dim>{earnedTiers} of {allTiers} medals · {families.filter((f) => f.level > 0).length} of {families.length} families started</Txt>
          <ProgressBar value={earnedTiers} max={allTiers} height={5} color={t.star} style={{ marginTop: 6 }} />
        </View>
      </View>
      {latest.length ? (
        <>
          <Txt dim size={12} weight="800" style={{ marginBottom: 6 }}>LATEST</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {latest.map((b) => (
              <Pressable key={b.id} onPress={() => setOpen(b.family)} style={[st.latest, { backgroundColor: t.cardAlt }]}>
                <Medal icon={b.icon} color={b.color} tier={b.tier} size={54} ribbon={false} />
                <Txt size={12} weight="800" center numberOfLines={1} style={{ marginTop: 4 }}>{b.name}</Txt>
                <Txt faint size={11} center>{b.earnedOn ? formatShortDate(b.earnedOn) : ''}</Txt>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <View style={st.grid}>
        {sorted.map((f) => {
          const locked = f.level === 0;
          return (
            <Pressable key={f.key} onPress={() => setOpen(f.key)} style={st.cell}>
              <Medal
                icon={f.icon}
                color={f.color}
                tier={locked ? 0 : f.level - 1}
                locked={locked}
                progress={f.progress}
                level={f.level}
                maxLevel={f.maxLevel}
                size={78}
              />
              <Txt size={12} weight="800" center numberOfLines={1} style={{ marginTop: 2 }}>{locked ? f.name : f.top.name}</Txt>
              <Txt faint size={11} center numberOfLines={1}>
                {locked ? `${Math.round(f.progress * 100)}% to ${f.next.name}` : f.level === f.maxLevel ? 'Maxed out' : `${tierName(f.level - 1)} · ${f.level}/${f.maxLevel}`}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {fam ? <BadgeSheet family={fam} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

// One family: the medal, what the next tier needs, and every tier with dates.
export function BadgeSheet({ family: f, onClose }) {
  const t = useTheme();
  const locked = f.level === 0;
  const shown = f.top || f.next;
  return (
    <Sheet visible onClose={onClose} title={f.name}>
      <View style={{ alignItems: 'center', paddingVertical: 6 }}>
        <Medal icon={f.icon} color={f.color} tier={locked ? 0 : f.level - 1} locked={locked} progress={f.progress} level={f.level} maxLevel={f.maxLevel} size={150} />
        <Txt size={22} weight="800" style={{ marginTop: 6 }}>{shown.name}</Txt>
        <Txt dim size={13}>
          {locked ? 'Not earned yet' : `${tierName(f.top.tier)} · level ${f.level} of ${f.maxLevel}${f.top.earnedOn ? ` · earned ${formatShortDate(f.top.earnedOn)}` : ''}`}
        </Txt>
      </View>
      {f.next ? (
        <View style={[st.next, { backgroundColor: t.cardAlt }]}>
          <Txt size={12} dim weight="800">NEXT: {f.next.name.toUpperCase()} ({tierName(f.next.tier).toUpperCase()})</Txt>
          <Txt size={15} weight="600" style={{ marginTop: 4 }}>{f.next.desc}</Txt>
          <ProgressBar value={f.next.value} max={f.next.goal} height={8} color={f.color} style={{ marginTop: 8 }} />
          <Txt faint size={12} style={{ marginTop: 4 }}>{progressText(f.next)}</Txt>
        </View>
      ) : (
        <Txt center color={t.star} weight="800" style={{ marginVertical: 10 }}>Every level earned. Legendary.</Txt>
      )}
      <Txt dim size={12} weight="800" style={{ marginTop: 14, marginBottom: 4 }}>ALL LEVELS</Txt>
      {f.tiers.map((b) => (
        <View key={b.id} style={[st.tierRow, { borderBottomColor: t.border }]}>
          <Medal icon={b.icon} color={b.color} tier={b.tier} locked={!b.earned} progress={b.value / b.goal} size={44} ribbon={false} />
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="700" color={b.earned ? t.text : t.textDim}>
              {b.name} <Txt faint size={12}>{ROMAN[b.tier]}</Txt>
            </Txt>
            <Txt faint size={12}>{b.desc}</Txt>
          </View>
          <Txt size={12} color={b.earned ? t.primary : t.textFaint} weight="700">
            {b.earned ? (b.earnedOn ? formatShortDate(b.earnedOn) : '✓') : `${Math.round((b.value / b.goal) * 100)}%`}
          </Txt>
        </View>
      ))}
    </Sheet>
  );
}

// Pop-up for a level-up and/or new medals. `c` = { levelUp, title, badges: [id] }.
export function Celebration({ c, onClose }) {
  const t = useTheme();
  if (!c) return null;
  const badges = c.badges.map(badgeById).filter(Boolean);
  const main = badges[badges.length - 1];
  const f = main && familyByKey(main.family);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, st.center, { backgroundColor: t.overlay }]} onPress={onClose}>
        <View style={[st.pop, { backgroundColor: t.card, borderColor: t.border }]}>
          <Txt size={13} weight="800" color={t.star} style={{ letterSpacing: 1.5 }}>
            {main ? (badges.length > 1 ? `${badges.length} NEW MEDALS` : 'NEW MEDAL') : 'LEVEL UP'}
          </Txt>
          {main ? (
            <>
              <View style={{ marginVertical: 10 }}>
                <Medal icon={main.icon} color={main.color} tier={main.tier} level={main.tier + 1} maxLevel={f ? f.tiers.length : 0} size={150} />
              </View>
              <Txt size={22} weight="800" center>{main.name}</Txt>
              <Txt dim size={13} center>{tierName(main.tier)}{f ? ` · ${f.name}` : ''}</Txt>
              <Txt size={14} center style={{ marginTop: 6 }}>{main.desc}</Txt>
              {badges.length > 1 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                  {badges.slice(0, -1).map((b) => (
                    <View key={b.id} style={{ alignItems: 'center', width: 64 }}>
                      <Medal icon={b.icon} color={b.color} tier={b.tier} size={44} ribbon={false} />
                      <Txt faint size={10} center numberOfLines={2}>{b.name}</Txt>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
          {c.levelUp ? (
            <Txt size={main ? 15 : 26} weight="800" center style={{ marginTop: main ? 12 : 10 }}>
              ⬆️ Level {c.levelUp}: {c.title}
            </Txt>
          ) : null}
          <Button title="Nice!" onPress={onClose} style={{ marginTop: 16, alignSelf: 'stretch' }} />
        </View>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  cell: { width: '33.33%', alignItems: 'center', paddingHorizontal: 2 },
  latest: { flex: 1, borderRadius: 12, padding: 8, alignItems: 'center' },
  next: { borderRadius: 12, padding: 12, marginTop: 8 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  pop: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
});
