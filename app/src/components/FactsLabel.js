// A "Nutrition Facts" label: calories, macros with % Daily Value, then vitamins and
// minerals. Used for a day's log (NutritionFactsView) and for one food's portion
// (the add-food screen). Missing values show as "—".
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { MICRONUTRIENTS, MACRO_DV, formatAmount } from '../lib/nutrients';

const byKey = Object.fromEntries(MICRONUTRIENTS.map((n) => [n.key, n]));
const pct = (v, dv) => (dv ? `${Math.round((v / dv) * 100)}%` : '');

// totals: { kcal, protein, carbs, fat, fiber }; micro: { key: amount } (may be empty);
// goals: optional macro targets to show next to the amounts; note: the footnote's extra line.
export default function FactsLabel({ totals, micro = {}, subtitle, goals, note }) {
  const t = useTheme();
  const m = (k) => (micro || {})[k];

  const Line = ({ label, value, unit, dv, bold, indent, thick, goal }) => (
    <View style={[styles.line, { borderTopColor: t.text, borderTopWidth: thick ? 5 : StyleSheet.hairlineWidth, paddingLeft: indent ? 16 : 0 }]}>
      <Text style={{ flex: 1, color: t.text, fontSize: 15 }}>
        <Text style={{ fontWeight: bold ? '800' : '400' }}>{label}</Text> {value == null ? <Text style={{ color: t.textFaint }}>—</Text> : formatAmount(value, unit)}
        {goal ? <Text style={{ color: t.textFaint, fontSize: 12 }}>  goal {goal} {unit}</Text> : null}
      </Text>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>{value == null ? '' : pct(value, dv)}</Text>
    </View>
  );

  return (
    <View style={[styles.label, { borderColor: t.text, backgroundColor: t.card }]}>
      <Text style={[styles.title, { color: t.text }]}>Nutrition Facts</Text>
      {subtitle ? <Text style={{ color: t.textDim, fontSize: 13 }}>{subtitle}</Text> : null}
      <View style={[styles.line, { borderTopColor: t.text, borderTopWidth: 9, alignItems: 'flex-end' }]}>
        <Text style={{ flex: 1, color: t.text, fontSize: 24, fontWeight: '900' }}>Calories</Text>
        <Text style={{ color: t.text, fontSize: 30, fontWeight: '900' }}>{Math.round(totals.kcal || 0)}</Text>
      </View>
      <View style={[styles.line, { borderTopColor: t.text, borderTopWidth: 4 }]}>
        <Text style={{ flex: 1 }} />
        <Text style={{ color: t.text, fontSize: 12, fontWeight: '800' }}>% Daily Value*</Text>
      </View>
      <Line label="Total Fat" value={totals.fat} unit="g" dv={MACRO_DV.fat} bold goal={goals && goals.fat} />
      <Line label="Saturated Fat" value={m('satFat')} unit="g" dv={byKey.satFat.dv} indent />
      <Line label="Trans Fat" value={m('transFat')} unit="g" indent />
      <Line label="Cholesterol" value={m('cholesterol')} unit="mg" dv={byKey.cholesterol.dv} bold />
      <Line label="Sodium" value={m('sodium')} unit="mg" dv={byKey.sodium.dv} bold />
      <Line label="Total Carbohydrate" value={totals.carbs} unit="g" dv={MACRO_DV.carbs} bold goal={goals && goals.carbs} />
      <Line label="Dietary Fiber" value={totals.fiber} unit="g" dv={MACRO_DV.fiber} indent goal={goals && goals.fiber} />
      <Line label="Total Sugars" value={m('sugars')} unit="g" indent />
      <Line label="Added Sugars" value={m('addedSugars')} unit="g" dv={byKey.addedSugars.dv} indent />
      <Line label="Protein" value={totals.protein} unit="g" dv={MACRO_DV.protein} bold goal={goals && goals.protein} />
      <View style={{ borderTopColor: t.text, borderTopWidth: 9, marginTop: 2 }} />
      <Text style={[styles.section, { color: t.text }]}>Vitamins</Text>
      {MICRONUTRIENTS.filter((n) => n.vitamin).map((n) => (
        <MicroRow key={n.key} n={n} value={m(n.key)} />
      ))}
      <Text style={[styles.section, { color: t.text, marginTop: 8 }]}>Minerals</Text>
      {MICRONUTRIENTS.filter((n) => n.mineral).map((n) => (
        <MicroRow key={n.key} n={n} value={m(n.key)} />
      ))}
      <View style={{ borderTopColor: t.text, borderTopWidth: 4, marginTop: 6, paddingTop: 6 }}>
        <Text style={{ color: t.textDim, fontSize: 11, lineHeight: 16 }}>
          * The % Daily Value is the US FDA reference for adults.{goals ? ' "goal" is your own target from Settings → Nutrition.' : ''}
          {note ? `\n${note}` : ''}
        </Text>
      </View>
    </View>
  );
}

function MicroRow({ n, value }) {
  const t = useTheme();
  const share = n.dv && value != null ? value / n.dv : null;
  return (
    <View style={[styles.line, { borderTopColor: t.text, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' }]}>
      <Text style={{ width: 120, color: t.text, fontSize: 14 }}>{n.label}</Text>
      <Text style={{ flex: 1, color: value == null ? t.textFaint : t.textDim, fontSize: 13 }}>{value == null ? '—' : formatAmount(value, n.unit)}</Text>
      <View style={{ width: 54, height: 6, borderRadius: 3, backgroundColor: t.track, overflow: 'hidden', marginRight: 8 }}>
        {share != null && <View style={{ width: `${Math.min(1, share) * 100}%`, height: '100%', backgroundColor: share >= 1 ? t.good : t.primary }} />}
      </View>
      <Text style={{ width: 44, textAlign: 'right', color: t.text, fontSize: 14, fontWeight: '800' }}>{share != null ? `${Math.round(share * 100)}%` : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { borderWidth: 2, borderRadius: 6, padding: 10 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  line: { flexDirection: 'row', paddingVertical: 4 },
  section: { fontSize: 15, fontWeight: '800', marginTop: 4, marginBottom: 2 },
});
