// A "Nutrition Facts" label for what you ate: one day, or the average of the last 7 days.
import React, { useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Screen, Card, Txt, Button, Segmented } from '../components/ui';
import { nutritionFacts } from '../lib/facts';
import FactsLabel from '../components/FactsLabel';
import { macroTargets } from '../lib/calc';
import { dayKey, addDays, parseDayKey, formatDayLabel, shortDayName, lastNDays } from '../lib/dates';

export default function NutritionFactsView({ initialDay }) {
  const t = useTheme();
  const { state } = useStore();
  const today = dayKey();
  const [day, setDay] = useState(initialDay || today);
  const [mode, setMode] = useState('day');
  const keys = mode === 'week' ? lastNDays(7, parseDayKey(day)) : [day];
  const f = useMemo(() => nutritionFacts(state, keys), [state, mode, day]); // eslint-disable-line react-hooks/exhaustive-deps
  const goals = macroTargets(state.profile);
  const recent = [0, -1, -2, -3, -4, -5, -6].map((n) => dayKey(addDays(new Date(), n)));
  const step = (n) => setDay(dayKey(addDays(parseDayKey(day), n)));
  const missing = f.entries - f.known;

  return (
    <Screen>
      <View style={{ marginBottom: 10 }}>
        <Segmented options={[{ key: 'day', label: 'One day' }, { key: 'week', label: '7-day average' }]} value={mode} onChange={setMode} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button small variant="ghost" title="‹" onPress={() => step(-1)} />
        <Txt size={16} weight="700">
          {mode === 'week' ? `${formatDayLabel(keys[0], today)} – ${formatDayLabel(day, today)}` : formatDayLabel(day, today)}
        </Txt>
        <Button small variant="ghost" title="›" disabled={day >= today} onPress={() => step(1)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
        {recent.map((k) => (
          <Pressable key={k} onPress={() => setDay(k)} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, backgroundColor: k === day ? t.primary + '33' : t.cardAlt }}>
            <Txt size={12} weight={k === day ? '800' : '500'}>{k === today ? 'Today' : shortDayName(k)}</Txt>
          </Pressable>
        ))}
      </View>

      {f.entries === 0 ? (
        <Card><Txt dim>Nothing logged {mode === 'week' ? 'in these 7 days' : 'this day'}.</Txt></Card>
      ) : (
        <FactsLabel
          totals={f.totals}
          micro={f.micro}
          goals={goals}
          subtitle={mode === 'week' ? `Daily average of ${f.days} day${f.days === 1 ? '' : 's'} with food logged` : `${f.entries} item${f.entries === 1 ? '' : 's'} logged`}
        />
      )}

      {f.entries > 0 && (
        <Txt faint size={12} style={{ marginTop: 10, lineHeight: 17 }}>
          {f.coverage >= 0.995
            ? 'Every item logged has full nutrient details.'
            : `Vitamins, minerals, sodium and sugars cover ${Math.round(f.coverage * 100)}% of these calories. ${missing} item${missing === 1 ? '' : 's'} (quick adds or custom foods without label details) only count toward calories and macros, so the real totals are a bit higher.`}
        </Txt>
      )}
    </Screen>
  );
}
