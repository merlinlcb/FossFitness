// Emerald theme, dark or light. Settings → App settings → Appearance picks one of:
//   'dark' · 'light' · 'system' (follow the phone) · 'schedule' (light by day, dark between two times).
// Data colors (water, food, macros…) stay distinct in both so charts remain easy to read.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { DARK, LIGHT, isNight, pickTheme } from './lib/themes';

export { DARK, LIGHT, isNight, pickTheme };

const ThemeContext = createContext(DARK);

// Wrap the app in this (inside the store) so every screen follows the chosen appearance.
export function ThemeProvider({ appearance, children }) {
  const system = useColorScheme();
  const [tick, setTick] = useState(0);
  // Re-check the schedule every minute.
  useEffect(() => {
    if (!appearance || appearance.mode !== 'schedule') return;
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [appearance]);
  const theme = pickTheme(appearance, system, new Date());
  void tick;
  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Area colors and icons. Colors are looked up from the theme in use, so they work in light mode too.
export const AREA_KEYS = { water: 'water', food: 'food', fasting: 'fasting', exercise: 'exercise', weight: 'weight', general: 'primary' };
export function areaColor(t, area) {
  return t[AREA_KEYS[area] || 'primary'];
}
export const AREA_COLORS = Object.fromEntries(Object.entries(AREA_KEYS).map(([k, v]) => [k, DARK[v]]));

export const AREA_ICONS = {
  water: '💧',
  food: '🍽️',
  fasting: '⏱️',
  exercise: '🏃',
  weight: '⚖️',
  general: '💡',
};
