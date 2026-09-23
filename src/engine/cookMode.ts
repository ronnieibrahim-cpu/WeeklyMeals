import { Recipe } from '@/domain/models';

/** One step in a composed cook-mode flow (M4.2 part 2) — a plain string for
 * a main's own step, or a side's step carrying a `sectionLabel` on its
 * first line so the screen can show a clear section break ("Side: Garlic
 * Green Beans") without presuming every main "rests" or otherwise fitting
 * one canned phrase. */
export interface ComposedStep {
  text: string;
  sectionLabel?: string;
}

/** The main's steps, then each side's steps appended in order, each side's
 * first step carrying a section header. Cook mode still indexes this as one
 * flat array — no change to how progress/navigation work, only to what
 * fills the array. Sauces get the same "Sauce: X" treatment as sides. */
export function composeCookSteps(main: Recipe, sides: Recipe[]): ComposedStep[] {
  const steps: ComposedStep[] = main.steps.map((text) => ({ text }));
  for (const side of sides) {
    const label = side.role === 'sauce' ? `Sauce: ${side.name}` : `Side: ${side.name}`;
    side.steps.forEach((text, i) => {
      steps.push({ text, sectionLabel: i === 0 ? label : undefined });
    });
  }
  return steps;
}

/** Content-addressed identity of a plate (main + its sides) for cook-mode
 * progress invalidation (M4.2 part 2). Sorted so a re-ordering from sync or
 * recomposition — same sides, different array order — doesn't spuriously
 * reset progress; only an actual change in WHICH sides are on the plate does. */
export function cookModePlateKey(recipeId: string, sideRecipeIds: string[] = []): string {
  return `${recipeId}::${[...sideRecipeIds].sort().join(',')}`;
}

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
  const range = step.match(new RegExp(`${NUM}\\s*(?:[-–—]|to)\\s*${NUM}\\s*${UNIT}`, 'i'));
  if (range) {
    return toMinutes(parseAmount(range[2]), range[3]);
  }
  const single = step.match(new RegExp(`${NUM}\\s*${UNIT}`, 'i'));
  if (single) {
    return toMinutes(parseAmount(single[1]), single[2]);
  }
  return null;
}

/** A whole number, a decimal ("2.5"), a whole number with a unicode
 * fraction ("1½"), or a bare fraction ("½"). Before September 2026 only
 * plain integers matched, so "1½ hours" offered no timer at all and
 * "2.5 hours" preset a 5-hour timer (the regex latched onto the "5"). */
const NUM = '(\\d+(?:\\.\\d+)?\\s*[¼½¾]?|[¼½¾])';
const UNIT = '(hours?|hrs?|minutes?|mins?)\\b';
const FRACTIONS: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75 };

function parseAmount(text: string): number {
  const t = text.replace(/\s+/g, '');
  const frac = FRACTIONS[t.slice(-1)];
  if (frac !== undefined) {
    const whole = t.slice(0, -1);
    return (whole ? Number(whole) : 0) + frac;
  }
  return Number(t);
}

function toMinutes(value: number, unit: string): number {
  return Math.round(/^h/i.test(unit) ? value * 60 : value);
}
