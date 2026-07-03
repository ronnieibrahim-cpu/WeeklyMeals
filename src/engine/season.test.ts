import { seasonForDate } from './season';

describe('seasonForDate', () => {
  it('maps each month to the expected Texas-appropriate season', () => {
    expect(seasonForDate(new Date(2026, 0, 15))).toBe('winter'); // Jan
    expect(seasonForDate(new Date(2026, 1, 15))).toBe('winter'); // Feb
    expect(seasonForDate(new Date(2026, 2, 15))).toBe('spring'); // Mar
    expect(seasonForDate(new Date(2026, 4, 15))).toBe('spring'); // May
    expect(seasonForDate(new Date(2026, 5, 15))).toBe('summer'); // Jun
    expect(seasonForDate(new Date(2026, 7, 15))).toBe('summer'); // Aug
    expect(seasonForDate(new Date(2026, 8, 15))).toBe('fall'); // Sep
    expect(seasonForDate(new Date(2026, 10, 15))).toBe('fall'); // Nov
    expect(seasonForDate(new Date(2026, 11, 15))).toBe('winter'); // Dec
  });
});
