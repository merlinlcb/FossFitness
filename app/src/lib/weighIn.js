// When a weigh-in is due: every day, or once a week on the chosen day
// (reminders.weighIn.day, 0 = Sunday … 6 = Saturday; Monday when not set).
import { parseDayKey } from './dates';

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const weighInDay = (weighIn) => {
  const d = Number(weighIn && weighIn.day);
  return Number.isInteger(d) && d >= 0 && d <= 6 ? d : 1;
};

export const isWeeklyWeighIn = (weighIn) => !!weighIn && weighIn.frequency === 'weekly';

// date: a Date or a day key. Ignores whether the reminder is switched on.
export function weighInDueOn(weighIn, date) {
  if (!isWeeklyWeighIn(weighIn)) return true;
  const d = typeof date === 'string' ? parseDayKey(date) : date;
  return d.getDay() === weighInDay(weighIn);
}
