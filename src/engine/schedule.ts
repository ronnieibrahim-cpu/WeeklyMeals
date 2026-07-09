const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Strips the time-of-day, keeping only the local calendar date. All day math
 * in this module works off local dates — never parse/format the ISO string
 * as UTC, or generation near midnight shifts a meal onto the wrong day.
 */
export function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Plain `YYYY-MM-DD` for a local calendar date — the timezone-safe way to
 * store "the day a plan started." `date.toISOString()` bakes in the
 * writer's timezone (it encodes a UTC instant), so a household member whose
 * device is in a different timezone re-derives the wrong calendar day from
 * it; a plain local date string has no timezone to get wrong.
 */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a stored week-start value back into a local-midnight `Date`.
 * Handles both the current plain `YYYY-MM-DD` format (parsed via local
 * date components, never `new Date(dateOnlyString)` — the built-in parser
 * treats a date-only ISO string as UTC midnight, reintroducing the exact
 * timezone bug this format exists to avoid) and legacy full ISO instants
 * from plans generated before this format changed, so old persisted plans
 * keep working.
 */
function parseWeekStart(weekStartISO: string): Date {
  const plainDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartISO);
  if (plainDate) {
    const [, y, m, d] = plainDate;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return localMidnight(new Date(weekStartISO));
}

/** The real calendar date for a plan day, counting forward from the plan's start day. */
export function dateForDayIndex(weekStartISO: string, dayIndex: number): Date {
  const d = parseWeekStart(weekStartISO);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

/** How many calendar days `today` is past the plan's start day (0 = the day it was generated). */
export function todayOffset(weekStartISO: string, today: Date = new Date()): number {
  const start = parseWeekStart(weekStartISO).getTime();
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
