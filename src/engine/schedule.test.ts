import { dateForDayIndex, dayLabel, localMidnight, todayOffset } from './schedule';

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
  it('counts forward from the plan week start', () => {
    const weekStart = new Date(2026, 6, 5).toISOString(); // Sunday
    expect(dateForDayIndex(weekStart, 0).getDate()).toBe(5);
    expect(dateForDayIndex(weekStart, 3).getDate()).toBe(8);
  });
});

describe('todayOffset', () => {
  it('is 0 the day the plan was generated', () => {
    const weekStart = new Date(2026, 6, 5).toISOString();
    const today = new Date(2026, 6, 5, 18, 0, 0); // same day, evening
    expect(todayOffset(weekStart, today)).toBe(0);
  });

  it('counts whole calendar days elapsed, independent of time-of-day', () => {
    const weekStart = new Date(2026, 6, 5, 23, 0, 0).toISOString();
    const today = new Date(2026, 6, 8, 1, 0, 0);
    expect(todayOffset(weekStart, today)).toBe(3);
  });
});

describe('dayLabel', () => {
  const weekStart = new Date(2026, 6, 5).toISOString();
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
