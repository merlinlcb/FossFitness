// Colour palettes and the rule for picking one. Pure JavaScript (tested); theme.js wires it into React.
import { timeToMinutes } from './dates';

const EMERALD = '#10B981';

export const DARK = {
  dark: true,
  // Surfaces
  bg: '#000000',
  card: '#0B0F0D',
  cardAlt: '#141B17',
  tabBar: '#050806',
  border: '#1E2A24',
  track: '#18221D',
  overlay: 'rgba(0,0,0,0.72)',
  // Text
  text: '#ECFDF5',
  textDim: '#A3B8AE',
  textFaint: '#62736B',
  // Brand
  primary: EMERALD,
  primaryText: '#02140C', // near-black text on emerald buttons for strong contrast
  // Data / category colors (bright enough for black backgrounds)
  water: '#38BDF8',
  food: '#F59E0B',
  protein: '#A78BFA',
  carbs: '#FACC15',
  fat: '#2DD4BF',
  fasting: EMERALD,
  exercise: '#84CC16',
  weight: '#F472B6',
  good: '#34D399',
  warn: '#FB923C',
  danger: '#F87171',
  star: '#FACC15',
};

export const LIGHT = {
  dark: false,
  bg: '#F4F7F5',
  card: '#FFFFFF',
  cardAlt: '#EAF1ED',
  tabBar: '#FFFFFF',
  border: '#D5E0DA',
  track: '#E1E9E4',
  overlay: 'rgba(15,30,22,0.45)',
  text: '#0B1F17',
  textDim: '#45594F',
  textFaint: '#7A8B83',
  primary: '#059669',
  primaryText: '#FFFFFF',
  // Deeper versions of the data colors so they read on white
  water: '#0284C7',
  food: '#D97706',
  protein: '#7C3AED',
  carbs: '#CA8A04',
  fat: '#0D9488',
  fasting: '#059669',
  exercise: '#4D7C0F',
  weight: '#DB2777',
  good: '#059669',
  warn: '#EA580C',
  danger: '#DC2626',
  star: '#CA8A04',
};

// Is the scheduled night mode on at this moment? Handles windows that cross midnight (20:00 → 07:00).
export function isNight(now, start = '20:00', end = '07:00') {
  const m = now.getHours() * 60 + now.getMinutes();
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === e) return false;
  return s < e ? m >= s && m < e : m >= s || m < e;
}

export function pickTheme(appearance, systemScheme, now = new Date()) {
  const a = appearance || {};
  const mode = a.mode || 'dark';
  if (mode === 'light') return LIGHT;
  if (mode === 'system') return systemScheme === 'light' ? LIGHT : DARK;
  if (mode === 'schedule') return isNight(now, a.darkFrom, a.darkUntil) ? DARK : LIGHT;
  return DARK;
}

