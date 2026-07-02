const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Strips the time-of-day, keeping only the local calendar date. All day math
 * in this module works off local dates — never parse/format the ISO string
 * as UTC, or generation near midnight shifts a meal onto the wrong day.
 */
export function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The real calendar date for a plan day, counting forward from the plan's start day. */
export function dateForDayIndex(weekStartISO: string, dayIndex: number): Date {
  const d = localMidnight(new Date(weekStartISO));
  d.setDate(d.getDate() + dayIndex);
  return d;
}

/** How many calendar days `today` is past the plan's start day (0 = the day it was generated). */
export function todayOffset(weekStartISO: string, today: Date = new Date()): number {
  const start = localMidnight(new Date(weekStartISO)).getTime();
  const now = localMidnight(today).getTime();
  return Math.round((now - start) / MS_PER_DAY);
}

/** "Tonight" / "Tomorrow" / weekday name for a plan day, relative to today. */
export function dayLabel(weekStartISO: string, dayIndex: number, today: Date = new Date()): string {
  const offset = todayOffset(weekStartISO, today);
  if (dayIndex === offset) return 'Tonight';
  if (dayIndex === offset + 1) return 'Tomorrow';
  return dateForDayIndex(weekStartISO, dayIndex).toLocaleDateString(undefined, { weekday: 'long' });
}
