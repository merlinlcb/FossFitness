// The exercise goal (switch, kind and target). Used in Settings → Training and in onboarding.
import React from 'react';
import { View, Switch } from 'react-native';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Row, Chip, NumberField, Txt } from './ui';
import { GOAL_KINDS, goalKind, exerciseGoal } from '../lib/exerciseGoal';

export default function ExerciseGoalEditor() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const goal = exerciseGoal(state.workoutPlan);
  const gk = goalKind(goal.kind);
  const setGoal = (patch) => dispatch({ type: 'SET_WORKOUT_PLAN', patch: { goal: { ...goal, ...patch } } });
  return (
    <>
      <Row
        label="Show an Exercise ring on Today"
        right={<Switch value={goal.enabled} onValueChange={(v) => setGoal({ enabled: v })} trackColor={{ true: t.primary }} />}
      />
      {goal.enabled && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {GOAL_KINDS.map((k) => (
              <Chip key={k.key} label={k.label} selected={goal.kind === k.key} onPress={() => setGoal({ kind: k.key, target: k.default })} />
            ))}
          </View>
          <NumberField
            label={`Goal (${gk.unit}${gk.key.startsWith('week') ? ' per week' : ' per day'})`}
            value={goal.target}
            decimals={false}
            suffix={gk.unit}
            style={{ marginTop: 12 }}
            onChange={(v) => v && setGoal({ target: Math.max(gk.min, Math.min(gk.max, v)) })}
          />
          <Txt faint size={12}>
            {gk.key === 'weekWorkouts'
              ? 'A day counts once you log any workout or activity. Weeks run Monday to Sunday.'
              : gk.key === 'dayKcal'
                ? 'Calories from logged workouts and activities (not steps).'
                : 'Minutes from logged workouts and activities. Weeks run Monday to Sunday.'}
          </Txt>
        </>
      )}
    </>
  );
}
