import { composeCookSteps, cookModePlateKey, parseDurationMinutes } from './cookMode';
import { makeRecipe } from './testFixtures';

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

describe('composeCookSteps (M4.2 part 2)', () => {
  it('appends a side\'s steps after the main\'s, with a section label on the side\'s first step only', () => {
    const main = makeRecipe({ steps: ['Sear the steak.', 'Rest 5 minutes.'] });
    const side = makeRecipe({ name: 'Garlic Green Beans', role: 'side', steps: ['Trim the beans.', 'Saute 4 minutes.'] });

    const composed = composeCookSteps(main, [side]);

    expect(composed.map((s) => s.text)).toEqual([
      'Sear the steak.',
      'Rest 5 minutes.',
      'Trim the beans.',
      'Saute 4 minutes.',
    ]);
    expect(composed[0].sectionLabel).toBeUndefined();
    expect(composed[1].sectionLabel).toBeUndefined();
    expect(composed[2].sectionLabel).toBe('Side: Garlic Green Beans');
    expect(composed[3].sectionLabel).toBeUndefined();
  });

  it('labels a sauce differently from a side', () => {
    const main = makeRecipe({ steps: ['Grill the chicken.'] });
    const sauce = makeRecipe({ name: 'Chimichurri', role: 'sauce', steps: ['Chop the parsley.'] });

    const composed = composeCookSteps(main, [sauce]);

    expect(composed[1].sectionLabel).toBe('Sauce: Chimichurri');
  });

  it('appends multiple sides in order, each with its own section label', () => {
    const main = makeRecipe({ steps: ['Cook the main.'] });
    const sideA = makeRecipe({ name: 'Rice', role: 'side', steps: ['Rinse rice.', 'Simmer.'] });
    const sideB = makeRecipe({ name: 'Broccoli', role: 'side', steps: ['Steam broccoli.'] });

    const composed = composeCookSteps(main, [sideA, sideB]);

    expect(composed.map((s) => s.text)).toEqual(['Cook the main.', 'Rinse rice.', 'Simmer.', 'Steam broccoli.']);
    expect(composed[1].sectionLabel).toBe('Side: Rice');
    expect(composed[2].sectionLabel).toBeUndefined();
    expect(composed[3].sectionLabel).toBe('Side: Broccoli');
  });

  it('returns just the main\'s steps when there are no sides', () => {
    const main = makeRecipe({ steps: ['Step one.', 'Step two.'] });
    expect(composeCookSteps(main, []).map((s) => s.text)).toEqual(['Step one.', 'Step two.']);
  });
});

describe('cookModePlateKey (M4.2 part 2)', () => {
  it('is stable regardless of side id order (sorted)', () => {
    expect(cookModePlateKey('main-1', ['side-b', 'side-a'])).toBe(cookModePlateKey('main-1', ['side-a', 'side-b']));
  });

  it('changes when the set of sides actually changes', () => {
    const before = cookModePlateKey('main-1', ['side-a']);
    const after = cookModePlateKey('main-1', ['side-a', 'side-b']);
    expect(before).not.toBe(after);
  });

  it('changes when the main changes, even with identical sides', () => {
    expect(cookModePlateKey('main-1', ['side-a'])).not.toBe(cookModePlateKey('main-2', ['side-a']));
  });

  it('defaults to no sides when omitted', () => {
    expect(cookModePlateKey('main-1')).toBe('main-1::');
  });
});
