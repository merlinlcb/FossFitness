// Date helpers. Days are keyed by the *local* calendar date (YYYY-MM-DD) so
// totals roll over at local midnight.

const pad = (n) => String(n).padStart(2, '0');

export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Returns the last `n` day keys ending with `end` (inclusive), oldest first.
export function lastNDays(n, end = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) keys.push(dayKey(addDays(end, -i)));
  return keys;
}

// "HH:MM" -> minutes since midnight
export function timeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function formatTime12(hhmm) {
  const mins = timeToMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function formatClock(date) {
  const d = new Date(date);
  return formatTime12(`${d.getHours()}:${d.getMinutes()}`);
}

// Date at a given "HH:MM" on the same calendar day as `base`.
export function atTime(base, hhmm) {
  const d = new Date(base);
  const mins = timeToMinutes(hhmm);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

export function minutesSinceMidnight(date = new Date()) {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
}

export function formatDuration(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${pad(m)}m`;
}

export function formatHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDayName(key) {
  return DAY_NAMES[parseDayKey(key).getDay()];
}

export function formatDayLabel(key, today = dayKey()) {
  if (key === today) return 'Today';
  if (key === dayKey(addDays(parseDayKey(today), -1))) return 'Yesterday';
  const d = parseDayKey(key);
  return `${DAY_NAMES[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatShortDate(dateOrKey) {
  const d = typeof dateOrKey === 'string' && dateOrKey.length === 10 ? parseDayKey(dateOrKey) : new Date(dateOrKey);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
