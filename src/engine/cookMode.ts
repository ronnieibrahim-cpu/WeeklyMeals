/**
 * Cook mode (M3.4): detects a cook time mentioned in a recipe step's text,
 * so the screen can offer a pre-set countdown timer without the user typing
 * anything. Handles the patterns actually used across the recipe corpus:
 * a single duration ("Bake for 25 minutes") and a range ("Simmer 3–4
 * minutes", with either dash style or the word "to") in both minutes and
 * hours. A range presets to the upper bound — better to under-promise a
 * timer that goes a little long than to pull something out too early.
 */
export function parseDurationMinutes(step: string): number | null {
  const range = step.match(/(\d+)\s*(?:[-–—]|to)\s*(\d+)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  if (range) {
    return toMinutes(Number(range[2]), range[3]);
  }
  const single = step.match(/(\d+)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  if (single) {
    return toMinutes(Number(single[1]), single[2]);
  }
  return null;
}

function toMinutes(value: number, unit: string): number {
  return /^h/i.test(unit) ? value * 60 : value;
}
