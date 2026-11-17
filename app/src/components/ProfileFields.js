import React from 'react';
import { View } from 'react-native';
import { NumberField, ChipRow, Txt, Segmented } from './ui';
import { cmToIn, inToCm, weightToDisplay, weightFromDisplay, weightUnit } from '../lib/units';
import { ACTIVITY_LEVELS, GOALS, PACES } from '../lib/calc';

export function HeightField({ heightCm, units, onChange }) {
  if (units === 'metric') {
    return <NumberField label="Height" value={heightCm ? Math.round(heightCm) : null} suffix="cm" onChange={(v) => v && onChange(v)} />;
  }
  const totalIn = heightCm ? Math.round(cmToIn(heightCm)) : 0;
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn % 12;
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <NumberField
        label="Height"
        style={{ flex: 1 }}
        value={ft || null}
        suffix="ft"
        decimals={false}
        onChange={(v) => v != null && onChange(inToCm(v * 12 + inch))}
      />
      <NumberField
        label=" "
        style={{ flex: 1 }}
        value={inch}
        suffix="in"
        decimals={false}
        onChange={(v) => v != null && v < 12 && onChange(inToCm(ft * 12 + v))}
      />
    </View>
  );
}

export function WeightField({ label = 'Weight', kg, units, onChange, placeholder }) {
  return (
    <NumberField
      label={label}
      value={weightToDisplay(kg, units)}
      suffix={weightUnit(units)}
      placeholder={placeholder}
      onChange={(v) => onChange(v == null ? null : weightFromDisplay(v, units))}
    />
  );
}

export function SexPicker({ value, onChange }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
        Sex (for metabolism estimates)
      </Txt>
      <Segmented
        options={[
          { key: 'male', label: 'Male' },
          { key: 'female', label: 'Female' },
        ]}
        value={value}
        onChange={onChange}
      />
    </View>
  );
}

export function ActivityPicker({ value, onChange }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
        Activity level (outside logged workouts)
      </Txt>
      <ChipRow options={ACTIVITY_LEVELS.map((a) => ({ key: a.key, label: a.label }))} value={value} onChange={onChange} />
      <Txt faint size={12} style={{ marginTop: 6 }}>
        {(ACTIVITY_LEVELS.find((a) => a.key === value) || {}).desc}
      </Txt>
    </View>
  );
}

export function GoalPicker({ goal, pace, onGoal, onPace }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
        Goal
      </Txt>
      <Segmented options={GOALS} value={goal} onChange={onGoal} />
      {goal !== 'maintain' && (
        <View style={{ marginTop: 12 }}>
          <Txt dim size={13} weight="600" style={{ marginBottom: 6 }}>
            Pace
          </Txt>
          <ChipRow options={PACES.map((p) => ({ key: p.key, label: p.label }))} value={pace} onChange={onPace} />
          <Txt faint size={12} style={{ marginTop: 6 }}>
            {(PACES.find((p) => p.key === pace) || {}).desc}
          </Txt>
        </View>
      )}
    </View>
  );
}
