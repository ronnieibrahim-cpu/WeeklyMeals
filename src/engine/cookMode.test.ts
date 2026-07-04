import { parseDurationMinutes } from './cookMode';

describe('parseDurationMinutes', () => {
  it('parses a single duration in minutes', () => {
    expect(parseDurationMinutes('Bake for 25 minutes, until golden.')).toBe(25);
    expect(parseDurationMinutes('Rest 5 min before slicing.')).toBe(5);
  });

  it('parses a range and takes the upper bound', () => {
    expect(parseDurationMinutes('Simmer for 3–4 minutes, stirring occasionally.')).toBe(4);
    expect(parseDurationMinutes('Cook for 10 to 12 minutes.')).toBe(12);
    expect(parseDurationMinutes('Saute 5-8 minutes until soft.')).toBe(8);
  });

  it('parses hours and converts to minutes', () => {
    expect(parseDurationMinutes('Marinate for 1 hour.')).toBe(60);
    expect(parseDurationMinutes('Slow cook for 6–8 hours on low.')).toBe(480);
  });

  it('returns null when no duration is mentioned', () => {
    expect(parseDurationMinutes('Season with salt and pepper to taste.')).toBeNull();
  });
});
