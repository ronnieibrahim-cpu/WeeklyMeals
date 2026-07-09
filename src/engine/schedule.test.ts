import { dateForDayIndex, dayLabel, localDateString, localMidnight, todayOffset } from './schedule';

describe('localMidnight', () => {
  it('strips the time-of-day but keeps the local calendar date', () => {
    const d = localMidnight(new Date(2026, 6, 3, 23, 59, 59));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(3);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe('dateForDayIndex', () => {
  it('counts forward from the plan week start (current YYYY-MM-DD format)', () => {
    const weekStart = '2026-07-05'; // Sunday
    expect(dateForDayIndex(weekStart, 0).getDate()).toBe(5);
    expect(dateForDayIndex(weekStart, 3).getDate()).toBe(8);
  });

  it('still parses a legacy full-ISO-instant week start (pre-P2-2 persisted plans)', () => {
    const weekStart = new Date(2026, 6, 5).toISOString(); // Sunday
    expect(dateForDayIndex(weekStart, 0).getDate()).toBe(5);
    expect(dateForDayIndex(weekStart, 3).getDate()).toBe(8);
  });
});

describe('todayOffset', () => {
  it('is 0 the day the plan was generated (current YYYY-MM-DD format)', () => {
    const weekStart = '2026-07-05';
    const today = new Date(2026, 6, 5, 18, 0, 0); // same day, evening
    expect(todayOffset(weekStart, today)).toBe(0);
  });

  it('counts whole calendar days elapsed, independent of time-of-day', () => {
    const weekStart = '2026-07-05';
    const today = new Date(2026, 6, 8, 1, 0, 0);
    expect(todayOffset(weekStart, today)).toBe(3);
  });

  it('still works with a legacy full-ISO-instant week start (pre-P2-2 persisted plans)', () => {
    const weekStart = new Date(2026, 6, 5, 23, 0, 0).toISOString();
    const today = new Date(2026, 6, 8, 1, 0, 0);
    expect(todayOffset(weekStart, today)).toBe(3);
  });
});

describe('localDateString', () => {
  it('formats a local date as plain YYYY-MM-DD, zero-padded', () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDateString(new Date(2026, 10, 23))).toBe('2026-11-23');
  });

  it('round-trips through dateForDayIndex/todayOffset back to the same local day', () => {
    const now = new Date(2026, 6, 9, 23, 45, 0); // late evening, still "today"
    const stored = localDateString(now);
    expect(todayOffset(stored, now)).toBe(0);
    expect(dateForDayIndex(stored, 0).getDate()).toBe(9);
  });
});

describe('cross-timezone safety (P2-2)', () => {
  // This test runner pins the process to UTC (getTimezoneOffset() is always
  // 0 here, regardless of process.env.TZ — verified: mutating TZ mid-test
  // does not change it), so a live two-timezone scenario can't be simulated
  // by actually switching zones. Instead, hand-compute the UTC instant a
  // Tokyo (UTC+9) device would have produced under the pre-fix format, and
  // show it reads back as the wrong calendar day on a reader whose local
  // time is UTC — exactly the cross-device mismatch P2-2 describes, just
  // with "UTC" playing the role of the second device's timezone.
  it('demonstrates the bug this fix closes: a UTC-instant week start written by a device in another timezone reads back as the wrong calendar day', () => {
    // Tokyo local midnight, July 9 2026 == 2026-07-08T15:00:00.000Z — the
    // pre-fix `localMidnight(new Date()).toISOString()` a Tokyo device
    // would have stored.
    const oldFormatWeekStart = '2026-07-08T15:00:00.000Z';
    const readBack = dateForDayIndex(oldFormatWeekStart, 0);
    expect(readBack.getMonth()).toBe(6);
    expect(readBack.getDate()).toBe(8); // wrong day — this is the bug P2-2 fixes
  });

  it('a plain YYYY-MM-DD week start reads back as the exact calendar day it names, with no UTC round-trip to get wrong', () => {
    // The same real day Tokyo meant above (July 9), stored in the current
    // format instead of the old UTC instant.
    const weekStart = '2026-07-09';
    const readBack = dateForDayIndex(weekStart, 0);
    expect(readBack.getMonth()).toBe(6);
    expect(readBack.getDate()).toBe(9); // correct day, regardless of reader's timezone
  });

  it("localDateString's output has no time-of-day or UTC marker to misinterpret", () => {
    const value = localDateString(new Date(2026, 6, 9, 23, 45));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(value).not.toContain('T');
    expect(value).not.toContain('Z');
  });
});

describe('dayLabel', () => {
  const weekStart = '2026-07-05';
  const today = new Date(2026, 6, 5); // offset 0

  it('labels the current offset "Tonight"', () => {
    expect(dayLabel(weekStart, 0, today)).toBe('Tonight');
  });

  it('labels the next day "Tomorrow"', () => {
    expect(dayLabel(weekStart, 1, today)).toBe('Tomorrow');
  });

  it('labels a farther-out day by weekday name', () => {
    const label = dayLabel(weekStart, 4, today);
    expect(label).not.toBe('Tonight');
    expect(label).not.toBe('Tomorrow');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});
