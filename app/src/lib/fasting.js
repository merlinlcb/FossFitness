import { atTime, addDays, timeToMinutes } from './dates';

export const PROTOCOLS = [
  { key: '12:12', fastHours: 12, label: '12:12', desc: 'Beginner — overnight fast' },
  { key: '14:10', fastHours: 14, label: '14:10', desc: 'Easy step up' },
  { key: '16:8', fastHours: 16, label: '16:8', desc: 'Most popular' },
  { key: '18:6', fastHours: 18, label: '18:6', desc: 'Intermediate' },
  { key: '20:4', fastHours: 20, label: '20:4', desc: 'Advanced' },
  { key: 'omad', fastHours: 23, label: 'OMAD', desc: 'One meal a day (23:1)' },
  { key: 'custom', fastHours: 16, label: 'Custom', desc: 'Your own target' },
];

export function protocolByKey(key) {
  return PROTOCOLS.find((p) => p.key === key) || PROTOCOLS[2];
}

export function fastHoursFor(fasting) {
  if (fasting.protocol === 'custom') return Number(fasting.customHours) || 16;
  return protocolByKey(fasting.protocol).fastHours;
}

// Approximate physiological stages. Timing varies a lot between people.
export const STAGES = [
  { from: 0, label: 'Digesting', desc: 'Your body is processing your last meal.', icon: '🍽️' },
  { from: 4, label: 'Blood sugar settling', desc: 'Insulin falls as digestion finishes.', icon: '📉' },
  { from: 12, label: 'Fat burning', desc: 'Stored glycogen runs low; your body leans more on fat.', icon: '🔥' },
  { from: 18, label: 'Ketosis', desc: 'Ketone production typically rises.', icon: '⚡' },
  { from: 24, label: 'Deep fast', desc: 'Cellular clean-up (autophagy) may increase.', icon: '♻️' },
  { from: 48, label: 'Extended fast', desc: 'Long fasts should be supervised by a professional.', icon: '⚠️' },
];

export function stageFor(hours) {
  let s = STAGES[0];
  for (const st of STAGES) if (hours >= st.from) s = st;
  return s;
}

export function nextStage(hours) {
  return STAGES.find((s) => s.from > hours) || null;
}

// The planned daily eating window, derived from protocol + window start time.
// Returns concrete Date objects for the window that is current or next relative to `now`.
export function eatingWindow(fasting, now = new Date()) {
  const fastHours = fastHoursFor(fasting);
  const windowMin = Math.max(60, (24 - fastHours) * 60);
  const startMin = timeToMinutes(fasting.windowStart || '12:00');

  // Candidate windows starting yesterday, today and tomorrow; pick the first that hasn't ended.
  for (let offset = -1; offset <= 1; offset++) {
    const open = atTime(addDays(now, offset), fasting.windowStart || '12:00');
    const close = new Date(open.getTime() + windowMin * 60000);
    if (close > now) {
      return { open, close, isOpen: now >= open, fastHours, windowHours: windowMin / 60, startMin };
    }
  }
  const open = atTime(addDays(now, 1), fasting.windowStart || '12:00');
  return { open, close: new Date(open.getTime() + windowMin * 60000), isOpen: false, fastHours, windowHours: windowMin / 60, startMin };
}

export function fastStats(history = []) {
  const done = history.filter((f) => f.end);
  if (!done.length) return { count: 0, avgHours: 0, longestHours: 0, completionRate: 0, streak: 0 };
  const hours = done.map((f) => (new Date(f.end) - new Date(f.start)) / 3600000);
  const completed = done.filter((f, i) => hours[i] >= (f.targetHours || 16) - 0.25);

  // Streak: consecutive most-recent fasts that hit their target.
  let streak = 0;
  for (let i = done.length - 1; i >= 0; i--) {
    if (hours[i] >= (done[i].targetHours || 16) - 0.25) streak++;
    else break;
  }
  return {
    count: done.length,
    avgHours: hours.reduce((a, b) => a + b, 0) / hours.length,
    longestHours: Math.max(...hours),
    completionRate: completed.length / done.length,
    streak,
  };
}
