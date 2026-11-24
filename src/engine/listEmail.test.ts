import { ShoppingItem, ShoppingList } from '@/domain/models';

import { buildListEmail, formatWeekLabel, isPlausibleEmail, mailtoUrl } from './listEmail';

function item(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    ingredientName: 'onion',
    quantity: 1,
    unit: 'piece',
    department: 'Produce',
    estimatedPrice: 1,
    checked: false,
    fromRecipeIds: ['r1'],
    ...overrides,
  };
}

function list(items: ShoppingItem[]): ShoppingList {
  return { planId: 'p1', items, estimatedTotal: 0, costPerServing: 0, generatedAtISO: '2026-11-24T00:00:00Z' };
}

const manual = (displayName: string, extra: Partial<{ quantityLabel: string; checked: boolean; deleted: boolean; department: 'Dairy' | 'Household' }> = {}) => ({
  displayName,
  quantityLabel: extra.quantityLabel,
  department: extra.department ?? 'Household',
  checked: extra.checked ?? false,
  deleted: extra.deleted ?? false,
});

describe('formatWeekLabel', () => {
  it('formats a local date without a timezone shift', () => {
    expect(formatWeekLabel('2026-11-30')).toBe('Nov 30');
    expect(formatWeekLabel('2027-01-04')).toBe('Jan 4');
  });
  it('passes through anything unexpected', () => {
    expect(formatWeekLabel('soon')).toBe('soon');
  });
});

describe('buildListEmail', () => {
  it('groups unchecked items by store department in walk order, with H-E-B product names', () => {
    const email = buildListEmail(
      list([
        item({ ingredientName: 'chicken thighs', quantity: 2.004, unit: 'lb', department: 'Meat', hebProductName: 'H-E-B Chicken Thighs', estimatedPrice: 7.5 }),
        item({ ingredientName: 'cilantro', unit: 'bunch', hebProductName: 'cilantro', estimatedPrice: 0.5 }),
      ]),
      [],
      '2026-11-30',
    );
    expect(email.subject).toBe('Weekly Meals H-E-B list - week of Nov 30');
    expect(email.itemCount).toBe(2);
    const body = email.body.split('\n');
    expect(body.indexOf('PRODUCE')).toBeLessThan(body.indexOf('MEAT'));
    expect(body).toContain('- cilantro: 1 bunch');
    expect(body).toContain('- chicken thighs: 2 lb (H-E-B Chicken Thighs)');
    expect(email.body).toContain('2 items · planned items est. $8.00');
  });

  it('leaves out checked planned items and checked or deleted hand-added items', () => {
    const email = buildListEmail(
      list([item({ ingredientName: 'garlic', checked: true }), item({ ingredientName: 'lemon' })]),
      [manual('milk', { quantityLabel: ' a gallon ', department: 'Dairy' }), manual('soap', { checked: true }), manual('foil', { deleted: true })],
      '2026-11-30',
    );
    expect(email.itemCount).toBe(2);
    expect(email.body).toContain('- lemon: 1 piece');
    expect(email.body).toContain('- milk: a gallon');
    expect(email.body).not.toContain('garlic');
    expect(email.body).not.toContain('soap');
    expect(email.body).not.toContain('foil');
  });

  it('says so when nothing is left to buy', () => {
    const email = buildListEmail(null, [], '2026-11-30');
    expect(email.itemCount).toBe(0);
    expect(email.body).toContain('Nothing left to buy');
  });

  it('never changes the list it reads (Product Law #1)', () => {
    const l = list([item({ checked: true }), item({ ingredientName: 'lemon' })]);
    const before = JSON.stringify(l);
    buildListEmail(l, [], '2026-11-30');
    expect(JSON.stringify(l)).toBe(before);
  });
});

describe('mailtoUrl / isPlausibleEmail', () => {
  it('builds an encoded mailto link', () => {
    const url = mailtoUrl(' me@example.com ', { subject: 'A & B', body: 'line 1\nline 2' });
    expect(url).toBe('mailto:me@example.com?subject=A%20%26%20B&body=line%201%0Aline%202');
  });
  it('accepts a normal address and rejects junk', () => {
    expect(isPlausibleEmail('me@example.com')).toBe(true);
    expect(isPlausibleEmail('not an email')).toBe(false);
    expect(isPlausibleEmail('')).toBe(false);
  });
});
