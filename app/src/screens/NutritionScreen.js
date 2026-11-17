// Nutrition = the food log, with water and fasting folded in (compact cards on top,
// full pages one tap away). When water or fasting is switched off, only a small
// ⚠️ marker by the macros reminds you the option exists.
import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Card, Txt, Button, ProgressBar } from '../components/ui';
import { dayMetrics, waterPaceTarget } from '../lib/metrics';
import { dayKey } from '../lib/dates';
import { formatWater } from '../lib/units';
import FoodScreen from './FoodScreen';
import WaterScreen from './WaterScreen';
import FastingScreen from './FastingScreen';
import { FastingMini } from './TodayScreen';
import NutritionFactsView from './NutritionFactsView';

export default function NutritionScreen({ goTo, sub, day }) {
  const { state } = useStore();
  const waterOn = state.profile.waterTracking !== false;
  if (sub === 'water' && waterOn) return <SubPage label="Water" goTo={goTo} Page={WaterScreen} />;
  if (sub === 'fast' && state.fasting.enabled) return <SubPage label="Fasting" goTo={goTo} Page={FastingScreen} />;
  if (sub === 'facts') return <SubPage label="Nutrition facts" goTo={goTo}><NutritionFactsView initialDay={day} /></SubPage>;
  return <FoodScreen goTo={goTo} initialDay={day} />;
}

function SubPage({ label, goTo, Page, children }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={() => goTo('nutrition')} hitSlop={10} style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        <Text style={{ color: t.primary, fontSize: 15, fontWeight: '700' }}>‹ Food log</Text>
      </Pressable>
      <Txt size={18} weight="800" style={{ paddingHorizontal: 16, marginBottom: 4 }}>{label}</Txt>
      <View style={{ flex: 1 }}>
        {children || <Page goTo={goTo} />}
      </View>
    </View>
  );
}

// Compact water + fasting cards for the top of the food log (today only).
export function WaterAndFasting({ goTo }) {
  const { state, dispatch } = useStore();
  const t = useTheme();
  const waterOn = state.profile.waterTracking !== false;
  if (!waterOn && !state.fasting.enabled) return null;
  const m = dayMetrics(state, dayKey());
  const wu = state.profile.waterUnit;
  const pace = waterPaceTarget(state.profile, m.waterGoal, new Date());
  return (
    <>
      {waterOn && (
        <Card
          title="💧 Water"
          right={<Button small variant="ghost" title="Details ›" onPress={() => goTo('water')} />}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Txt dim size={13}>{formatWater(m.water, wu)} of {formatWater(m.waterGoal, wu)}</Txt>
            <Txt size={13} color={m.water >= pace ? t.good : t.warn}>
              {m.water >= m.waterGoal ? 'Goal reached' : m.water >= pace ? 'On pace' : `${formatWater(pace - m.water, wu)} behind`}
            </Txt>
          </View>
          <ProgressBar value={m.water} max={m.waterGoal} color={t.water} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {state.waterPresets.slice(0, 3).map((p) => (
              <Button key={p.id} small variant="secondary" color={t.water} style={{ flex: 1 }} title={`${p.icon} +${formatWater(p.ml, wu)}`}
                onPress={() => dispatch({ type: 'ADD_WATER', ml: p.ml, label: p.label })} />
            ))}
          </View>
        </Card>
      )}
      {state.fasting.enabled && <FastingMini state={state} dispatch={dispatch} goTo={goTo} />}
    </>
  );
}

// "💧⚠️ off" / "⏱️⚠️ off" markers shown next to the macros when a tracker is switched off.
export function OffMarkers({ goTo }) {
  const { state } = useStore();
  const t = useTheme();
  const off = [
    state.profile.waterTracking === false && { key: 'water', icon: '💧', label: 'Water off' },
    !state.fasting.enabled && { key: 'fast', icon: '⏱️', label: 'Fasting off' },
  ].filter(Boolean);
  if (!off.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      {off.map((o) => (
        <Pressable key={o.key} onPress={() => goTo('settings', { sub: 'nutrition' })} accessibilityLabel={`${o.label}. Turn it on in Settings → Nutrition`}
          style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: t.warn + '1F', borderWidth: 1, borderColor: t.warn + '55' }}>
          <Text style={{ fontSize: 14 }}>{o.icon}⚠️</Text>
          <Text style={{ color: t.textDim, fontSize: 12, marginLeft: 6 }}>{o.label} · tap to turn on</Text>
        </Pressable>
      ))}
    </View>
  );
}
